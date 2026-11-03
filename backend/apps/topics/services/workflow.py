"""Logic nghiệp vụ cho vòng đời đề tài: đề xuất -> kiểm tra tương đồng -> duyệt/từ chối/yêu cầu sửa tên -> giao đề tài."""
from django.db import transaction

from apps.topics.models import Topic, TopicHistory, TopicSimilarityResult

from .similarity import find_similar_topics, is_exact_duplicate, normalize_text


@transaction.atomic
def refresh_similarity_results(topic: Topic):
    """Tính lại kết quả trên toàn bộ ngân hàng đề tài và thay thế snapshot đã lưu."""
    results = find_similar_topics(topic, refresh_embedding=True)
    existing_titles = list(Topic.objects.exclude(pk=topic.pk).values_list("title", flat=True))
    exact_duplicate = is_exact_duplicate(topic.title, existing_titles)
    normalized_title = normalize_text(topic.title)
    final_results = []
    for result in results:
        exact_match = exact_duplicate and normalize_text(result["topic"].title) == normalized_title
        final_results.append({
            **result,
            "similarity_percent": 100.0 if exact_match else result["similarity_percent"],
            "warning_level": "duplicate" if exact_match else result["warning_level"],
        })

    TopicSimilarityResult.objects.filter(topic=topic).delete()
    TopicSimilarityResult.objects.bulk_create([
        TopicSimilarityResult(
            topic=topic,
            similar_topic=result["topic"],
            similarity_percent=result["similarity_percent"],
            warning_level=result["warning_level"],
            rank=rank,
            groq_score=result.get("groq_score"),
            groq_explanation=result.get("groq_explanation", ""),
            assessment_status=result.get("assessment_status", "disabled"),
        )
        for rank, result in enumerate(final_results, 1)
    ])
    return {"exact_duplicate": exact_duplicate, "similar_results": final_results}


@transaction.atomic
def propose_topic(topic: Topic, actor):
    """
    Được gọi ngay sau khi Giảng viên tạo đề tài mới. Pipeline kết hợp:
      Bước 1 — kiểm tra trùng tên chính xác (so khớp chuỗi, không cần AI).
      Bước 2 — TF-IDF lọc ứng viên trên toàn bộ ngân hàng đề tài.
      Bước 3 — PhoBERT tính điểm nền tảng; Groq tùy chọn đánh giá bổ sung, giữ riêng điểm.
    """
    refresh_result = refresh_similarity_results(topic)
    exact_duplicate = refresh_result["exact_duplicate"]
    final_results = refresh_result["similar_results"]

    history_note = "Phát hiện trùng tên chính xác với đề tài đã có." if exact_duplicate else ""
    TopicHistory.objects.create(
        topic=topic, action=TopicHistory.Action.CREATED, actor=actor, note=history_note
    )
    return {"exact_duplicate": exact_duplicate, "similar_results": final_results}


@transaction.atomic
def approve_topic(topic: Topic, actor, note: str = ""):
    from apps.accounts.models import Notification
    from apps.topics.models import StudentTopicProposal, TopicAssignment, TopicRegistration

    topic.status = Topic.Status.APPROVED
    topic.reviewed_by = actor
    topic.review_note = note
    topic.save(update_fields=["status", "reviewed_by", "review_note", "updated_at"])
    TopicHistory.objects.create(topic=topic, action=TopicHistory.Action.APPROVED, actor=actor, note=note)

    # Nếu đề tài này bắt nguồn từ đề xuất của sinh viên
    proposal = StudentTopicProposal.objects.filter(created_topic=topic).first()
    if proposal:
        proposal.status = StudentTopicProposal.Status.APPROVED
        proposal.save(update_fields=["status", "updated_at"])

        # Tạo lượt giao đề tài chính thức cho sinh viên đề xuất
        assignment, _ = TopicAssignment.objects.get_or_create(
            topic=topic,
            defaults={
                "assigned_by": topic.proposed_by,
                "note": f"Đề tài do sinh viên đề xuất, GVHD hướng dẫn và Trưởng bộ môn phê duyệt. {note}".strip(),
            },
        )
        assignment.students.add(proposal.student)

        # Đồng bộ Giảng viên hướng dẫn
        from apps.accounts.models import AdvisorRequest
        teacher = topic.proposed_by or proposal.teacher
        if teacher:
            AdvisorRequest.objects.filter(
                student=proposal.student,
                status=AdvisorRequest.Status.PENDING,
            ).update(status=AdvisorRequest.Status.CANCELLED)

            adv_req, _ = AdvisorRequest.objects.get_or_create(
                student=proposal.student,
                teacher=teacher,
                defaults={
                    "status": AdvisorRequest.Status.ACCEPTED,
                    "message": f"Đề xuất đề tài: {proposal.title}",
                    "response_note": "Đề tài đề xuất đã được phê duyệt.",
                },
            )
            if adv_req.status != AdvisorRequest.Status.ACCEPTED:
                adv_req.status = AdvisorRequest.Status.ACCEPTED
                adv_req.save(update_fields=["status", "updated_at"])

        # Hủy các đăng ký đề tài khác đang chờ của sinh viên này
        TopicRegistration.objects.filter(
            student=proposal.student,
            status=TopicRegistration.Status.PENDING,
        ).update(status=TopicRegistration.Status.CANCELLED)

        note_info = f" Ghi chú: {note}" if note else ""
        Notification.objects.create(
            recipient=proposal.student,
            sender=actor,
            title="Đề tài đồ án đã được Trưởng bộ môn phê duyệt",
            message=f"Đề tài '{topic.title}' do bạn đề xuất đã được Trưởng bộ môn phê duyệt chính thức và phân công cho bạn thực hiện.{note_info}",
            notification_type=Notification.NotificationType.TOPIC_PROPOSAL_RESPONSE,
            link="/projects",
        )

        if topic.proposed_by and topic.proposed_by != actor:
            Notification.objects.create(
                recipient=topic.proposed_by,
                sender=actor,
                title="Đề tài đề xuất từ sinh viên đã được phê duyệt",
                message=f"Đề tài '{topic.title}' (SV: {proposal.student.get_full_name() or proposal.student.username}) đã được Trưởng bộ môn phê duyệt.{note_info}",
                notification_type=Notification.NotificationType.TOPIC_PROPOSAL_RESPONSE,
                link="/teacher/student-requests?tab=proposals",
            )

    return topic


@transaction.atomic
def reject_topic(topic: Topic, actor, note: str = ""):
    from apps.accounts.models import Notification
    from apps.topics.models import StudentTopicProposal, TopicAssignment

    topic.status = Topic.Status.REJECTED
    topic.reviewed_by = actor
    topic.review_note = note
    topic.save(update_fields=["status", "reviewed_by", "review_note", "updated_at"])
    TopicHistory.objects.create(topic=topic, action=TopicHistory.Action.REJECTED, actor=actor, note=note)

    # Nếu đề tài có assignment đang active, hủy các assignment liên quan
    active_assignments = topic.assignments.filter(status=TopicAssignment.Status.ACTIVE).prefetch_related("students")
    for assign in active_assignments:
        assign.status = TopicAssignment.Status.CANCELLED
        assign.note = f"Đề tài bị Trưởng bộ môn từ chối duyệt. Lý do: {note}".strip()
        assign.save(update_fields=["status", "note"])

        for sv in assign.students.all():
            Notification.objects.create(
                recipient=sv,
                sender=actor,
                title="Đề tài đồ án bị từ chối phê duyệt",
                message=f"Đề tài '{topic.title}' đã bị Trưởng bộ môn từ chối duyệt.{f' Lý do: {note}' if note else ''} Lượt giao đề tài của bạn đã được hủy.",
                notification_type=Notification.NotificationType.TOPIC_PROPOSAL_RESPONSE,
                link="/projects",
            )

    # Cập nhật proposal nếu có
    proposal = StudentTopicProposal.objects.filter(created_topic=topic).first()
    if proposal:
        proposal.status = StudentTopicProposal.Status.REJECTED
        proposal.save(update_fields=["status", "updated_at"])

        note_info = f" Lý do: {note}" if note else ""
        Notification.objects.create(
            recipient=proposal.student,
            sender=actor,
            title="Đề tài đề xuất bị Trưởng bộ môn từ chối",
            message=f"Đề tài '{topic.title}' do bạn đề xuất đã bị Trưởng bộ môn từ chối duyệt.{note_info}",
            notification_type=Notification.NotificationType.TOPIC_PROPOSAL_RESPONSE,
            link="/student/propose",
        )
        if topic.proposed_by and topic.proposed_by != actor:
            Notification.objects.create(
                recipient=topic.proposed_by,
                sender=actor,
                title="Đề tài đề xuất từ sinh viên bị từ chối",
                message=f"Đề tài '{topic.title}' (SV: {proposal.student.get_full_name() or proposal.student.username}) đã bị Trưởng bộ môn từ chối duyệt.{note_info}",
                notification_type=Notification.NotificationType.TOPIC_PROPOSAL_RESPONSE,
                link="/teacher/student-requests?tab=proposals",
            )

    return topic


@transaction.atomic
def request_rename(topic: Topic, actor, note: str = ""):
    from apps.accounts.models import Notification
    from apps.topics.models import StudentTopicProposal

    topic.status = Topic.Status.RENAME_REQUESTED
    topic.reviewed_by = actor
    topic.review_note = note
    topic.save(update_fields=["status", "reviewed_by", "review_note", "updated_at"])
    TopicHistory.objects.create(topic=topic, action=TopicHistory.Action.RENAME_REQUESTED, actor=actor, note=note)

    proposal = StudentTopicProposal.objects.filter(created_topic=topic).first()
    if proposal:
        proposal.status = StudentTopicProposal.Status.REVISION_REQUESTED
        proposal.save(update_fields=["status", "updated_at"])

        note_info = f" Ghi chú: {note}" if note else ""
        Notification.objects.create(
            recipient=proposal.student,
            sender=actor,
            title="Yêu cầu sửa tên đề tài đề xuất",
            message=f"Đề tài '{topic.title}' do bạn đề xuất được Trưởng bộ môn yêu cầu điều chỉnh tên.{note_info}",
            notification_type=Notification.NotificationType.TOPIC_PROPOSAL_RESPONSE,
            link="/student/propose",
        )
        if topic.proposed_by and topic.proposed_by != actor:
            Notification.objects.create(
                recipient=topic.proposed_by,
                sender=actor,
                title="Yêu cầu sửa tên đề tài đề xuất từ sinh viên",
                message=f"Đề tài '{topic.title}' (SV: {proposal.student.get_full_name() or proposal.student.username}) được Trưởng bộ môn yêu cầu điều chỉnh tên.{note_info}",
                notification_type=Notification.NotificationType.TOPIC_PROPOSAL_RESPONSE,
                link="/teacher/student-requests?tab=proposals",
            )

    return topic


@transaction.atomic
def assign_topic(topic: Topic, student_ids: list[int], actor, note: str = "", due_date=None):
    from django.contrib.auth import get_user_model
    from rest_framework.exceptions import ValidationError
    from apps.accounts.models import Notification
    from apps.topics.models import TopicAssignment

    topic = Topic.objects.select_for_update().get(pk=topic.pk)
    ids = sorted(set(student_ids))
    students = list(get_user_model().objects.select_for_update().filter(pk__in=ids, role="student", is_active=True, student_status="active").order_by("pk"))
    if len(students) != len(ids) or len(ids) != len(student_ids):
        raise ValidationError("Danh sách sinh viên không hợp lệ hoặc bị lặp.")
    if len(ids) > topic.max_students:
        raise ValidationError("Vượt số sinh viên tối đa của đề tài.")
    if any(s.department_id and s.department_id != topic.department_id for s in students):
        raise ValidationError("Sinh viên phải thuộc bộ môn của đề tài.")
    if any(s.cohort_id and s.cohort_id != topic.cohort_id for s in students):
        raise ValidationError("Sinh viên phải thuộc khóa học của đề tài.")
    if topic.major_id and any(s.major_id and s.major_id != topic.major_id for s in students):
        raise ValidationError("Sinh viên phải thuộc chuyên ngành của đề tài.")
    if TopicAssignment.objects.filter(students__in=ids, topic__semester=topic.semester, status="active").exists():
        raise ValidationError("Sinh viên đã có đề tài đang thực hiện trong học kỳ này.")

    assignment = TopicAssignment.objects.create(topic=topic, assigned_by=actor, note=note, due_date=due_date)
    assignment.students.set(student_ids)
    summary = f"Giao cho {len(student_ids)} sinh viên."
    history_note = f"{summary} {note}".strip() if note else summary
    TopicHistory.objects.create(
        topic=topic,
        action=TopicHistory.Action.ASSIGNED,
        actor=actor,
        note=history_note,
    )

    # Đồng bộ Giảng viên hướng dẫn cho các sinh viên được phân công
    teacher = topic.proposed_by or actor
    if teacher and getattr(teacher, "role", "") in ("teacher", "department_head"):
        from apps.accounts.models import AdvisorRequest
        for student in students:
            AdvisorRequest.objects.filter(
                student=student,
                status=AdvisorRequest.Status.PENDING,
            ).update(status=AdvisorRequest.Status.CANCELLED)

            adv_req, _ = AdvisorRequest.objects.get_or_create(
                student=student,
                teacher=teacher,
                defaults={
                    "status": AdvisorRequest.Status.ACCEPTED,
                    "message": f"Phân công đề tài: {topic.title}",
                    "response_note": f"Giảng viên giao đề tài. {note or ''}".strip(),
                },
            )
            if adv_req.status != AdvisorRequest.Status.ACCEPTED:
                adv_req.status = AdvisorRequest.Status.ACCEPTED
                adv_req.save(update_fields=["status", "updated_at"])

    # Tự động gửi thông báo cho từng sinh viên được phân công
    actor_name = actor.get_full_name() or actor.username
    due_info = f" Hạn nộp hoàn thành: {due_date.strftime('%d/%m/%Y')}." if due_date else ""
    note_info = f" Lời dặn: {note}" if note else ""
    for student in students:
        Notification.objects.create(
            recipient=student,
            sender=actor,
            title="Bạn đã được phân công đề tài đồ án",
            message=f"Giảng viên {actor_name} đã phân công cho bạn thực hiện đề tài '{topic.title}'.{due_info}{note_info}",
            notification_type=Notification.NotificationType.TOPIC_ASSIGNMENT,
            link="/projects",
        )

    return assignment
