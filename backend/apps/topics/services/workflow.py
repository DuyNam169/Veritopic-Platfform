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
def assign_topic(topic: Topic, student_ids: list[int], actor, note: str = ""):
    from apps.topics.models import TopicAssignment

    assignment = TopicAssignment.objects.create(topic=topic, assigned_by=actor, note=note)
    assignment.students.set(student_ids)
    TopicHistory.objects.create(topic=topic, action=TopicHistory.Action.ASSIGNED, actor=actor, note=note)
    return assignment
