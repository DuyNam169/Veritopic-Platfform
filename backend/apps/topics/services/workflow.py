"""Logic nghiệp vụ cho vòng đời đề tài: đề xuất -> kiểm tra tương đồng -> duyệt/từ chối/yêu cầu sửa tên -> giao đề tài."""
from django.db import transaction

from apps.topics.models import Topic, TopicHistory, TopicSimilarityResult

from .similarity import find_similar_topics, get_embedding, is_exact_duplicate


@transaction.atomic
def propose_topic(topic: Topic, actor):
    """
    Được gọi ngay sau khi Giảng viên tạo đề tài mới. Chạy đủ 2 bước kiểm tra (theo đúng
    Chương 2, mục 2.1.5):
      Bước 1 — kiểm tra trùng tên chính xác (so khớp chuỗi, không cần AI).
      Bước 2 — tính embedding + xếp hạng tương đồng ngữ nghĩa qua pgvector.
    (Bước lọc TF-IDF trong similarity.py là hàm tối ưu tùy chọn, không bắt buộc trong pipeline
    vì pgvector đã tự làm truy vấn lân cận gần nhất hiệu quả — xem ghi chú trong similarity.py)
    """
    existing_titles = list(
        Topic.objects.exclude(pk=topic.pk).values_list("title", flat=True)
    )
    exact_duplicate = is_exact_duplicate(topic.title, existing_titles)

    topic.embedding = get_embedding(f"{topic.title}\n{topic.description}")
    topic.save(update_fields=["embedding"])

    similar_results = find_similar_topics(topic)

    # Tính giá trị cuối cùng (có ép 100%/duplicate cho trường hợp trùng tên chính xác) MỘT LẦN DUY NHẤT,
    # rồi dùng chung cho cả việc lưu DB lẫn trả về API — tránh lệch dữ liệu giữa hai nơi.
    normalized_title = topic.title.strip().lower()
    final_results = []
    for r in similar_results:
        is_this_the_exact_match = exact_duplicate and r["topic"].title.strip().lower() == normalized_title
        final_results.append(
            {
                "topic": r["topic"],
                "similarity_percent": 100.0 if is_this_the_exact_match else r["similarity_percent"],
                "warning_level": "duplicate" if is_this_the_exact_match else r["warning_level"],
            }
        )

    TopicSimilarityResult.objects.filter(topic=topic).delete()
    TopicSimilarityResult.objects.bulk_create(
        [
            TopicSimilarityResult(
                topic=topic,
                similar_topic=r["topic"],
                similarity_percent=r["similarity_percent"],
                warning_level=r["warning_level"],
            )
            for r in final_results
        ]
    )

    history_note = "Phát hiện trùng tên chính xác với đề tài đã có." if exact_duplicate else ""
    TopicHistory.objects.create(
        topic=topic, action=TopicHistory.Action.CREATED, actor=actor, note=history_note
    )
    return {"exact_duplicate": exact_duplicate, "similar_results": final_results}


@transaction.atomic
def approve_topic(topic: Topic, actor, note: str = ""):
    topic.status = Topic.Status.APPROVED
    topic.reviewed_by = actor
    topic.review_note = note
    topic.save(update_fields=["status", "reviewed_by", "review_note", "updated_at"])
    TopicHistory.objects.create(topic=topic, action=TopicHistory.Action.APPROVED, actor=actor, note=note)
    return topic


@transaction.atomic
def reject_topic(topic: Topic, actor, note: str = ""):
    topic.status = Topic.Status.REJECTED
    topic.reviewed_by = actor
    topic.review_note = note
    topic.save(update_fields=["status", "reviewed_by", "review_note", "updated_at"])
    TopicHistory.objects.create(topic=topic, action=TopicHistory.Action.REJECTED, actor=actor, note=note)
    return topic


@transaction.atomic
def request_rename(topic: Topic, actor, note: str = ""):
    topic.status = Topic.Status.RENAME_REQUESTED
    topic.reviewed_by = actor
    topic.review_note = note
    topic.save(update_fields=["status", "reviewed_by", "review_note", "updated_at"])
    TopicHistory.objects.create(topic=topic, action=TopicHistory.Action.RENAME_REQUESTED, actor=actor, note=note)
    return topic


@transaction.atomic
def resubmit_topic(topic: Topic, actor, updated_data: dict):
    """
    Nộp lại đề tài sau khi có 'Yêu cầu sửa' từ Trưởng bộ môn.
    Chuyển trạng thái từ rename_requested -> pending, tính lại embedding & kiểm tra tương đồng.
    """
    from rest_framework.exceptions import ValidationError

    if topic.status != Topic.Status.RENAME_REQUESTED:
        raise ValidationError({"detail": f"Đề tài ở trạng thái '{topic.get_status_display()}' không thể nộp lại. Chỉ nộp lại khi có 'Yêu cầu sửa'."})

    if actor.role != "admin" and topic.proposed_by != actor:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Chỉ giảng viên đề xuất mới được nộp lại đề tài này.")

    for field, val in updated_data.items():
        setattr(topic, field, val)

    topic.status = Topic.Status.PENDING
    topic.save()

    # Chạy lại tính embedding và snapshot tương đồng
    propose_result = propose_topic(topic, actor=actor)

    # Ghi history action resubmitted
    note = f"Nộp lại đề tài sau khi sửa theo yêu cầu của TBM. Ghi chú gốc của TBM: {topic.review_note}"
    TopicHistory.objects.create(
        topic=topic,
        action=TopicHistory.Action.RESUBMITTED,
        actor=actor,
        note=note,
    )
    return topic, propose_result


@transaction.atomic
def assign_topic(topic: Topic, student_ids: list[int], actor, due_date=None, note: str = ""):
    """
    Giao đề tài cho nhóm sinh viên với các ràng buộc nghiêm ngặt:
    1. Đề tài phải ở trạng thái APPROVED.
    2. Đề tài phải thuộc Giảng viên giao (hoặc Admin).
    3. Số sinh viên <= max_students.
    4. Không sinh viên nào đã có lượt giao ACTIVE trong cùng HỌC KỲ.
    """
    from django.contrib.auth import get_user_model
    from rest_framework.exceptions import ValidationError, PermissionDenied
    from apps.topics.models import TopicAssignment

    User = get_user_model()

    if topic.status != Topic.Status.APPROVED:
        raise ValidationError({"detail": "Chỉ đề tài ở trạng thái 'Đã duyệt' mới được phép giao cho sinh viên."})

    if actor.role != "admin" and topic.proposed_by != actor:
        raise PermissionDenied("Chỉ giảng viên hướng dẫn của đề tài này mới có quyền giao đề tài.")

    # 3. Kiểm tra tổng số sinh viên đã giao cho đề tài này (trong các lượt assignment đang active)
    active_assignments = TopicAssignment.objects.filter(
        topic=topic,
        status=TopicAssignment.Status.ACTIVE,
    )
    currently_assigned_count = sum(a.students.count() for a in active_assignments)
    
    if currently_assigned_count + len(student_ids) > topic.max_students:
        raise ValidationError({
            "detail": f"Đề tài này chỉ cho phép tối đa {topic.max_students} sinh viên. "
                      f"Hiện tại đã giao cho {currently_assigned_count} sinh viên, "
                      f"bạn không thể giao thêm {len(student_ids)} sinh viên nữa."
        })

    students = User.objects.filter(id__in=student_ids, role="student", is_active=True)
    if len(students) != len(student_ids):
        raise ValidationError({"detail": "Một hoặc nhiều sinh viên không hợp lệ hoặc không hoạt động."})

    # 4. Kiểm tra xem sinh viên đã có lượt giao active trong cùng học kỳ chưa
    for s in students:
        existing_assignment = TopicAssignment.objects.filter(
            students=s,
            status=TopicAssignment.Status.ACTIVE,
            topic__semester=topic.semester,
        ).exists()
        if existing_assignment:
            raise ValidationError({"detail": f"Sinh viên {s.get_full_name() or s.username} ({s.student_code}) đã có đồ án đang thực hiện trong học kỳ này."})

    assignment = TopicAssignment.objects.create(
        topic=topic,
        assigned_by=actor,
        status=TopicAssignment.Status.ACTIVE,
        due_date=due_date,
        note=note,
    )
    assignment.students.set(students)

    student_names = ", ".join([s.get_full_name() or s.username for s in students])
    TopicHistory.objects.create(
        topic=topic,
        action=TopicHistory.Action.ASSIGNED,
        actor=actor,
        note=f"Đã giao đề tài cho sinh viên: {student_names}. {note}".strip(),
    )
    return assignment

