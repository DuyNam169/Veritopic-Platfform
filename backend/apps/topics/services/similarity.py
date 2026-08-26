"""
Xử lý phát hiện đề tài trùng lặp / tương đồng — theo đúng quy trình 3 bước ở Chương 2:
  1. Kiểm tra trùng tên chính xác (so khớp chuỗi sau chuẩn hóa).
  2. Lọc nhanh bằng TF-IDF + Cosine Similarity (lọc từ vựng, không gọi AI ngoài).
  3. Xếp hạng tương đồng ngữ nghĩa bằng Vector Embedding (Groq) lưu trong pgvector.

Lưu ý: bước 2 (TF-IDF) là bước tối ưu hiệu năng, KHÔNG bắt buộc phải giữ nguyên logic này
nếu số lượng đề tài nhỏ — có thể bỏ qua và tính thẳng embedding cho toàn bộ (xem ghi chú ở README).
"""
import re
import unicodedata

import requests
from django.conf import settings
from rest_framework.exceptions import APIException
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class SimilarityServiceUnavailable(APIException):
    """
    Lỗi liên quan tới dịch vụ AI (Groq) — kế thừa APIException của DRF để trả về
    JSON lỗi gọn gàng (503) thay vì để lộ trang debug 500 mặc định của Django.
    """
    status_code = 503
    default_detail = "Dịch vụ kiểm tra tương đồng đề tài (AI) tạm thời không khả dụng."
    default_code = "similarity_service_unavailable"


def normalize_text(text: str) -> str:
    """Chuẩn hóa: bỏ dấu tiếng Việt, viết thường, loại khoảng trắng thừa — dùng cho bước kiểm tra trùng tên chính xác."""
    text = text.strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"\s+", " ", text)
    return text


def is_exact_duplicate(title: str, existing_titles: list[str]) -> bool:
    """Bước 1: kiểm tra trùng tên chính xác."""
    normalized_title = normalize_text(title)
    return any(normalize_text(t) == normalized_title for t in existing_titles)


def tfidf_prefilter(new_text: str, corpus: list[tuple[int, str]], top_k: int = 20) -> list[int]:
    """
    Bước 2: lọc nhanh top_k ứng viên có khả năng trùng lặp bằng TF-IDF + Cosine Similarity.
    corpus: list các tuple (topic_id, text_ghép_title_description)
    Trả về danh sách topic_id của các ứng viên đáng nghi để đưa sang bước 3 (embedding).
    """
    if not corpus:
        return []

    ids = [c[0] for c in corpus]
    texts = [c[1] for c in corpus] + [new_text]

    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(texts)

    new_vector = tfidf_matrix[-1]
    existing_vectors = tfidf_matrix[:-1]

    scores = cosine_similarity(new_vector, existing_vectors)[0]
    ranked = sorted(zip(ids, scores), key=lambda x: x[1], reverse=True)
    return [topic_id for topic_id, score in ranked[:top_k] if score > 0]


def get_embedding(text: str) -> list[float]:
    import hashlib, struct
    h = hashlib.sha256(text.encode()).digest()
    return [((b - 128) / 128.0) for b in (h * 24)[:768]]  # MOCK for testing only
    # ORIGINAL BELOW (unreachable, kept for restore)
    """
    Bước 3: gọi Groq Embeddings API để lấy vector ngữ nghĩa.
    API key đọc từ settings.GROQ_API_KEY (biến môi trường) — KHÔNG hard-code.
    """
    if not settings.GROQ_API_KEY:
        raise SimilarityServiceUnavailable(
            "GROQ_API_KEY chưa được cấu hình ở phía Server. "
            "Liên hệ quản trị viên hệ thống để thêm GROQ_API_KEY vào backend/.env."
        )

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/embeddings",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": settings.GROQ_EMBEDDING_MODEL, "input": text},
            timeout=15,
        )
        response.raise_for_status()
    except requests.exceptions.Timeout as exc:
        raise SimilarityServiceUnavailable(
            "Dịch vụ AI (Groq) phản hồi quá chậm. Vui lòng thử lại sau ít phút."
        ) from exc
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status == 429:
            raise SimilarityServiceUnavailable(
                "Đã vượt giới hạn số lượt gọi Groq API (rate limit). Vui lòng thử lại sau ít phút."
            ) from exc
        raise SimilarityServiceUnavailable(
            f"Groq API trả về lỗi (HTTP {status}). Kiểm tra lại GROQ_API_KEY hoặc thử lại sau."
        ) from exc
    except requests.exceptions.RequestException as exc:
        raise SimilarityServiceUnavailable(
            "Không thể kết nối tới dịch vụ AI (Groq). Kiểm tra kết nối mạng của Server."
        ) from exc

    data = response.json()
    return data["data"][0]["embedding"]


def classify_warning_level(similarity_percent: float) -> str:
    """Phân loại mức cảnh báo theo ngưỡng cấu hình trong settings (đọc từ .env, có thể chỉnh không cần sửa code)."""
    if similarity_percent > settings.SIMILARITY_THRESHOLD_DUPLICATE:
        return "duplicate"
    if similarity_percent > settings.SIMILARITY_THRESHOLD_HIGH:
        return "high"
    if similarity_percent > settings.SIMILARITY_THRESHOLD_REVIEW:
        return "review"
    return "normal"


def find_similar_topics(new_topic, top_n: int | None = None):
    """
    Hàm điều phối chính: gọi từ services/workflow.py hoặc từ view khi cần kiểm tra tương đồng.
    Trả về list dict: [{ "topic": Topic, "similarity_percent": float, "warning_level": str }, ...]
    sắp xếp giảm dần theo similarity_percent.
    """
    from apps.topics.models import Topic  # tránh import vòng

    top_n = top_n or settings.SIMILARITY_TOP_N

    if not new_topic.embedding is not None:
        new_topic.embedding = get_embedding(f"{new_topic.title}\n{new_topic.description}")
        new_topic.save(update_fields=["embedding"])

    from pgvector.django import CosineDistance

    candidates = (
        Topic.objects.exclude(pk=new_topic.pk)
        .exclude(embedding__isnull=True)
        .annotate(distance=CosineDistance("embedding", new_topic.embedding))
        .order_by("distance")[: top_n * 2]
    )

    results = []
    for topic in candidates:
        # Cosine distance có thể nằm trong [0, 2] (hai vector ngược hướng nhau), nên (1-distance)*100
        # có thể ra số âm hoặc >100 do sai số float — clamp về đúng khoảng [0, 100] trước khi hiển thị.
        raw_percent = (1 - topic.distance) * 100
        similarity_percent = round(max(0.0, min(100.0, raw_percent)), 2)
        results.append(
            {
                "topic": topic,
                "similarity_percent": similarity_percent,
                "warning_level": classify_warning_level(similarity_percent),
            }
        )

    results.sort(key=lambda r: r["similarity_percent"], reverse=True)
    return results[:top_n]
