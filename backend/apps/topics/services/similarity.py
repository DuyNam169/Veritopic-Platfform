"""Exact-title checks and PhoBERT embeddings for semantic topic similarity."""
import math
import re
import unicodedata

import requests
from django.conf import settings
from rest_framework.exceptions import APIException
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class SimilarityServiceUnavailable(APIException):
    """Return a controlled 503 when the separately hosted PhoBERT service fails."""

    status_code = 503
    default_detail = "Dịch vụ kiểm tra tương đồng đề tài (AI) tạm thời không khả dụng."
    default_code = "similarity_service_unavailable"


def normalize_text(text: str) -> str:
    """Normalize Vietnamese text for exact-title duplicate detection."""
    text = text.strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", text)


def is_exact_duplicate(title: str, existing_titles: list[str]) -> bool:
    """Check for a normalized exact-title match."""
    normalized_title = normalize_text(title)
    return any(normalize_text(existing) == normalized_title for existing in existing_titles)


def tfidf_prefilter(new_text: str, corpus: list[tuple[int, str]], top_k: int = 20) -> list[int]:
    """Return the IDs of the most lexically similar candidate topics."""
    if not corpus:
        return []

    ids = [item[0] for item in corpus]
    texts = [item[1] for item in corpus] + [new_text]
    matrix = TfidfVectorizer().fit_transform(texts)
    scores = cosine_similarity(matrix[-1], matrix[:-1])[0]
    ranked = sorted(zip(ids, scores), key=lambda item: item[1], reverse=True)
    return [topic_id for topic_id, score in ranked[:top_k] if score > 0]


def _validated_embeddings(data, expected_count: int) -> list[list[float]]:
    try:
        embeddings = data["embeddings"]
    except (KeyError, TypeError) as exc:
        raise SimilarityServiceUnavailable(
            "Dịch vụ PhoBERT trả về dữ liệu embedding không hợp lệ."
        ) from exc

    if not isinstance(embeddings, list) or len(embeddings) != expected_count:
        raise SimilarityServiceUnavailable(
            "Số lượng embedding PhoBERT trả về không khớp với số tiêu đề gửi lên."
        )

    validated = []
    for embedding in embeddings:
        if (
            not isinstance(embedding, list)
            or len(embedding) != 768
            or any(
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
                for value in embedding
            )
        ):
            raise SimilarityServiceUnavailable(
                "Embedding PhoBERT phải có đúng 768 giá trị số hữu hạn."
            )
        validated.append([float(value) for value in embedding])
    return validated


def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Request a batch of 768-dimensional model embeddings from PhoBERT."""
    if not texts:
        return []

    try:
        response = requests.post(
            f"{settings.PHOBERT_API_URL}/api/v1/encode-titles",
            json={"titles": texts},
            timeout=settings.PHOBERT_API_TIMEOUT,
        )
        response.raise_for_status()
    except requests.exceptions.Timeout as exc:
        raise SimilarityServiceUnavailable(
            "Dịch vụ PhoBERT phản hồi quá chậm. Vui lòng thử lại sau ít phút."
        ) from exc
    except requests.exceptions.HTTPError as exc:
        response_status = exc.response.status_code if exc.response is not None else None
        raise SimilarityServiceUnavailable(
            f"Dịch vụ PhoBERT trả về lỗi HTTP {response_status}. "
            "Kiểm tra trạng thái model/API rồi thử lại."
        ) from exc
    except requests.exceptions.RequestException as exc:
        raise SimilarityServiceUnavailable(
            "Không thể kết nối tới dịch vụ PhoBERT. "
            "Kiểm tra PHOBERT_API_URL và bảo đảm API đang chạy."
        ) from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise SimilarityServiceUnavailable(
            "Dịch vụ PhoBERT trả về dữ liệu embedding không hợp lệ."
        ) from exc

    return _validated_embeddings(data, len(texts))


def get_embedding(text: str) -> list[float]:
    """Request one model-produced embedding from the PhoBERT API."""
    return get_embeddings([text])[0]


def classify_warning_level(similarity_percent: float) -> str:
    """Classify a similarity score using environment-configured thresholds."""
    if similarity_percent > settings.SIMILARITY_THRESHOLD_DUPLICATE:
        return "duplicate"
    if similarity_percent > settings.SIMILARITY_THRESHOLD_HIGH:
        return "high"
    if similarity_percent > settings.SIMILARITY_THRESHOLD_REVIEW:
        return "review"
    return "normal"


def find_similar_topics(new_topic, top_n: int | None = None):
    """Rank topics with stored PhoBERT embeddings using pgvector cosine distance."""
    from apps.topics.models import Topic

    top_n = top_n or settings.SIMILARITY_TOP_N

    if new_topic.embedding is None:
        new_topic.embedding = get_embedding(new_topic.title)
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
        raw_percent = (1 - topic.distance) * 100
        similarity_percent = round(max(0.0, min(100.0, raw_percent)), 2)
        results.append(
            {
                "topic": topic,
                "similarity_percent": similarity_percent,
                "warning_level": classify_warning_level(similarity_percent),
            }
        )

    results.sort(key=lambda result: result["similarity_percent"], reverse=True)
    return results[:top_n]
