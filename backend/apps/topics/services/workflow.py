"""Logic nghiệp vụ cho vòng đời đề tài: đề xuất -> kiểm tra tương đồng -> duyệt/từ chối/yêu cầu sửa tên -> giao đề tài."""
from django.db import transaction

from apps.topics.models import Topic, TopicHistory, TopicSimilarityResult

from .similarity import find_similar_topics, is_exact_duplicate, normalize_text


@transaction.atomic
def refresh_similarity_results(topic: Topic):
    """Tính lại kết quả trên toàn bộ ngân hàng đề tài và thay thế snapshot đã lưu."""
    results = find_similar_topics(topic)
    existing_titles = list(Topic.objects.exclude(pk=topic.pk).values_list("title", flat=True))
    exact_duplicate = is_exact_duplicate(topic.title, existing_titles)
    normalized_title = normalize_text(topic.title)
    final_results = []
    for result in results:
        exact_match = exact_duplicate and normalize_text(result["topic"].title) == normalized_title
        final_results.append({
            "topic": result["topic"],
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
        )
        for result in final_results
    ])
    return {"exact_duplicate": exact_duplicate, "similar_results": final_results}


@transaction.atomic
def propose_topic(topic: Topic, actor):
    """
    Được gọi ngay sau khi Giảng viên tạo đề tài mới. Chạy đủ 2 bước kiểm tra (theo đúng
    Chương 2, mục 2.1.5):
      Bước 1 — kiểm tra trùng tên chính xác (so khớp chuỗi, không cần AI).
      Bước 2 — TF-IDF lọc ứng viên trên toàn bộ ngân hàng đề tài.
      Bước 3 — mô hình ngôn ngữ chấm ngữ nghĩa và kết hợp với điểm từ vựng.
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
def assign_topic(topic: Topic, student_ids: list[int], actor, note: str = ""):
    from apps.topics.models import TopicAssignment

    assignment = TopicAssignment.objects.create(topic=topic, assigned_by=actor, note=note)
    assignment.students.set(student_ids)
    summary = f"Giao cho {len(student_ids)} sinh viên."
    history_note = f"{summary} {note}".strip() if note else summary
    TopicHistory.objects.create(
        topic=topic,
        action=TopicHistory.Action.ASSIGNED,
        actor=actor,
        note=history_note,
    )
    return assignment
