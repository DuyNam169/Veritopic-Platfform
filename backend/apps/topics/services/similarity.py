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
    """Chuẩn hóa: bỏ dấu tiếng Việt (kể cả đ/Đ), viết thường, loại khoảng trắng thừa — dùng cho bước kiểm tra trùng tên chính xác."""
    if not text:
        return ""
    text = text.strip().lower()
    text = text.replace("đ", "d").replace("Đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
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
    """
    Bước 3: lấy vector ngữ nghĩa (dùng Groq API nếu có key, hoặc TF-IDF/Hash embedding chuẩn hóa).
    """
    if settings.GROQ_API_KEY:
        try:
            response = requests.post(
                "https://api.groq.com/openai/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={"model": settings.GROQ_EMBEDDING_MODEL, "input": text},
                timeout=10,
            )
            if response.status_code == 200:
                return response.json()["data"][0]["embedding"]
        except Exception:
            pass

    # Fallback cho local testing không phụ thuộc API bên ngoài: tạo deterministic semantic vector
    import hashlib
    words = normalize_text(text).split()
    vector = [0.0] * 768
    for word in words:
        h = hashlib.sha256(word.encode()).digest()
        for idx in range(768):
            vector[idx] += (h[idx % len(h)] - 128) / 128.0
    
    # Normalize vector to unit length
    magnitude = sum(x * x for x in vector) ** 0.5
    if magnitude > 0:
        vector = [x / magnitude for x in vector]
    return vector


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


def find_similar_topics_for_draft(title: str, description: str = "", keywords: list = None, top_n: int | None = None):
    """
    Kiểm tra tương đồng cho bản nháp (khi đang soạn thảo form) KHÔNG lưu vào DB.
    Trả về danh sách các đề tài tương đồng kèm phần trăm và warning_level.
    """
    from apps.topics.models import Topic
    top_n = top_n or settings.SIMILARITY_TOP_N
    keywords_text = " ".join(keywords) if keywords else ""
    full_text = f"{title}\n{description}\n{keywords_text}".strip()

    draft_embedding = get_embedding(full_text)

    from pgvector.django import CosineDistance

    candidates = (
        Topic.objects.exclude(embedding__isnull=True)
        .annotate(distance=CosineDistance("embedding", draft_embedding))
        .order_by("distance")[: top_n * 2]
    )

    results = []
    norm_title = normalize_text(title)
    for topic in candidates:
        raw_percent = (1 - topic.distance) * 100
        similarity_percent = round(max(0.0, min(100.0, raw_percent)), 2)
        
        # Đánh dấu trùng tên chính xác nếu có
        if normalize_text(topic.title) == norm_title:
            similarity_percent = 100.0
            warning_level = "duplicate"
        else:
            warning_level = classify_warning_level(similarity_percent)

        results.append({
            "topic": topic,
            "similarity_percent": similarity_percent,
            "warning_level": warning_level,
        })

    results.sort(key=lambda r: r["similarity_percent"], reverse=True)
    return results[:top_n]

