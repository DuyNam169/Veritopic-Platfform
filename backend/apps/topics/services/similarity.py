"""Phát hiện đề tài trùng lặp/tương đồng bằng pipeline lai.

Quy trình:
1. Chuẩn hóa và kiểm tra trùng tên chính xác.
2. Lọc ứng viên trên toàn bộ ngân hàng đề tài bằng TF-IDF từ + ký tự.
3. Dùng mô hình ngôn ngữ Groq chấm mức tương đồng ngữ nghĩa theo rubric cố định.
4. Kết hợp điểm ngữ nghĩa và điểm từ vựng, rồi phân loại mức cảnh báo.

Groq hiện không cung cấp API embeddings. Vì vậy không được dùng vector hash giả thay thế
embedding: hash không mang thông tin ngữ nghĩa và tạo ra kết quả gần như ngẫu nhiên.
"""
import json
import re
import unicodedata
from dataclasses import dataclass

import requests
from django.conf import settings
from rest_framework.exceptions import APIException
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class SimilarityServiceUnavailable(APIException):
    status_code = 503
    default_detail = "Dịch vụ kiểm tra tương đồng đề tài (AI) tạm thời không khả dụng."
    default_code = "similarity_service_unavailable"


@dataclass(frozen=True)
class Candidate:
    topic: object
    lexical_score: float


def normalize_text(text: str) -> str:
    """Chuẩn hóa Unicode, dấu câu và khoảng trắng để đối chiếu tiêu đề ổn định."""
    text = unicodedata.normalize("NFD", (text or "").strip().lower()).replace("đ", "d")
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def is_exact_duplicate(title: str, existing_titles: list[str]) -> bool:
    normalized_title = normalize_text(title)
    return bool(normalized_title) and any(
        normalize_text(existing_title) == normalized_title
        for existing_title in existing_titles
    )


def _topic_text(topic) -> str:
    field_name = getattr(getattr(topic, "field", None), "name", "")
    department_name = getattr(getattr(topic, "department", None), "name", "")
    return "\n".join(filter(None, [
        f"Tên đề tài: {topic.title}",
        f"Mô tả: {topic.description}",
        f"Lĩnh vực: {field_name}",
        f"Bộ môn: {department_name}",
    ]))


def tfidf_prefilter(new_topic, topics: list, top_k: int | None = None) -> list[Candidate]:
    """Xếp hạng ứng viên bằng TF-IDF từ/ký tự, có cộng điểm cùng lĩnh vực và bộ môn."""
    if not topics:
        return []

    top_k = top_k or settings.SIMILARITY_PREFILTER_TOP_K
    texts = [_topic_text(topic) for topic in topics] + [_topic_text(new_topic)]
    word_vectorizer = TfidfVectorizer(
        preprocessor=normalize_text,
        ngram_range=(1, 2),
        sublinear_tf=True,
    )
    char_vectorizer = TfidfVectorizer(
        preprocessor=normalize_text,
        analyzer="char_wb",
        ngram_range=(3, 5),
        min_df=1,
        sublinear_tf=True,
    )
    word_matrix = word_vectorizer.fit_transform(texts)
    char_matrix = char_vectorizer.fit_transform(texts)
    word_scores = cosine_similarity(word_matrix[-1], word_matrix[:-1])[0]
    char_scores = cosine_similarity(char_matrix[-1], char_matrix[:-1])[0]

    candidates = []
    normalized_title = normalize_text(new_topic.title)
    for topic, word_score, char_score in zip(topics, word_scores, char_scores):
        score = (float(word_score) * 0.65) + (float(char_score) * 0.35)
        if new_topic.field_id and topic.field_id == new_topic.field_id:
            score += 0.08
        if topic.department_id == new_topic.department_id:
            score += 0.03
        if normalize_text(topic.title) == normalized_title:
            score = 1.0
        candidates.append(Candidate(topic=topic, lexical_score=min(score, 1.0)))

    candidates.sort(key=lambda candidate: candidate.lexical_score, reverse=True)
    return candidates[:top_k]


def _groq_error(response) -> SimilarityServiceUnavailable:
    if response.status_code == 429:
        return SimilarityServiceUnavailable(
            "Đã vượt giới hạn số lượt gọi Groq API. Vui lòng thử lại sau ít phút."
        )
    return SimilarityServiceUnavailable(
        f"Groq API trả về lỗi (HTTP {response.status_code}). Kiểm tra API key/model cấu hình."
    )


def score_candidates_semantically(new_topic, candidates: list[Candidate]) -> dict[int, float]:
    """Yêu cầu Groq chấm từng ứng viên theo cùng một rubric và trả JSON có schema chặt."""
    if not candidates:
        return {}
    if not settings.GROQ_API_KEY:
        raise SimilarityServiceUnavailable(
            "GROQ_API_KEY chưa được cấu hình ở phía Server. Liên hệ quản trị viên hệ thống."
        )

    candidate_payload = [
        {
            "id": candidate.topic.id,
            "title": candidate.topic.title,
            "description": candidate.topic.description,
            "field": getattr(candidate.topic.field, "name", "") if candidate.topic.field else "",
        }
        for candidate in candidates
    ]
    rubric = """
Bạn là hội đồng duyệt đề tài CNTT. Hãy chấm mức độ TRÙNG NỘI DUNG giữa đề tài mới và từng đề tài cũ.
Chỉ đánh giá sự giống nhau của bài toán, mục tiêu, phương pháp/công nghệ cốt lõi và sản phẩm đầu ra;
không cho điểm cao chỉ vì cùng lĩnh vực hoặc có vài từ chung.

Thang điểm bắt buộc:
- 90-100: gần như cùng một đề tài, chỉ đổi cách diễn đạt.
- 75-89: cùng bài toán và sản phẩm chính, khác một phần phạm vi/công nghệ.
- 50-74: liên quan đáng kể nhưng còn khác mục tiêu, dữ liệu hoặc đầu ra.
- 20-49: cùng lĩnh vực nhưng là bài toán khác.
- 0-19: hầu như không liên quan.

Phải trả đủ đúng một kết quả cho mỗi id ứng viên. Không thêm id khác.
""".strip()
    prompt = (
        f"{rubric}\n\nĐỀ TÀI MỚI:\n{_topic_text(new_topic)}\n\n"
        f"CÁC ĐỀ TÀI CŨ (JSON):\n{json.dumps(candidate_payload, ensure_ascii=False)}"
    )
    schema = {
        "type": "object",
        "properties": {
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"},
                        "score": {"type": "number", "minimum": 0, "maximum": 100},
                    },
                    "required": ["id", "score"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["results"],
        "additionalProperties": False,
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.GROQ_SIMILARITY_MODEL,
                "messages": [
                    {"role": "system", "content": "Đánh giá khách quan và chỉ trả dữ liệu JSON theo schema."},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "topic_similarity_scores",
                        "strict": True,
                        "schema": schema,
                    },
                },
                "reasoning_effort": "none",
                "temperature": 0.1,
                "max_completion_tokens": 1500,
            },
            timeout=30,
        )
        if not response.ok:
            raise _groq_error(response)
        content = response.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
    except SimilarityServiceUnavailable:
        raise
    except requests.exceptions.Timeout as exc:
        raise SimilarityServiceUnavailable(
            "Dịch vụ AI phản hồi quá chậm. Vui lòng thử lại sau ít phút."
        ) from exc
    except requests.exceptions.RequestException as exc:
        raise SimilarityServiceUnavailable(
            "Không thể kết nối tới dịch vụ AI. Kiểm tra kết nối mạng của Server."
        ) from exc
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise SimilarityServiceUnavailable(
            "Dịch vụ AI trả về dữ liệu không đúng định dạng. Vui lòng chạy lại."
        ) from exc

    allowed_ids = {candidate.topic.id for candidate in candidates}
    scores = {}
    for item in data.get("results", []):
        topic_id = int(item["id"])
        if topic_id in allowed_ids:
            scores[topic_id] = max(0.0, min(100.0, float(item["score"])))
    if scores.keys() != allowed_ids:
        raise SimilarityServiceUnavailable(
            "Dịch vụ AI không trả đủ kết quả cho các đề tài cần đối chiếu. Vui lòng chạy lại."
        )
    return scores


def classify_warning_level(similarity_percent: float) -> str:
    if similarity_percent > settings.SIMILARITY_THRESHOLD_DUPLICATE:
        return "duplicate"
    if similarity_percent > settings.SIMILARITY_THRESHOLD_HIGH:
        return "high"
    if similarity_percent > settings.SIMILARITY_THRESHOLD_REVIEW:
        return "review"
    return "normal"


def find_similar_topics(new_topic, top_n: int | None = None):
    """So sánh với toàn bộ kho đề tài, trả các kết quả có ý nghĩa nhất theo điểm giảm dần."""
    from apps.topics.models import Topic

    top_n = top_n or settings.SIMILARITY_TOP_N
    topics = list(
        Topic.objects.exclude(pk=new_topic.pk)
        .select_related("field", "department")
        .order_by("id")
    )
    candidates = tfidf_prefilter(new_topic, topics)
    semantic_scores = score_candidates_semantically(new_topic, candidates)
    normalized_title = normalize_text(new_topic.title)

    results = []
    for candidate in candidates:
        exact_match = normalize_text(candidate.topic.title) == normalized_title
        if exact_match:
            similarity_percent = 100.0
        else:
            semantic_score = semantic_scores[candidate.topic.id]
            similarity_percent = round(
                (semantic_score * 0.85) + (candidate.lexical_score * 100 * 0.15),
                2,
            )
        if similarity_percent < settings.SIMILARITY_MIN_DISPLAY:
            continue
        results.append({
            "topic": candidate.topic,
            "similarity_percent": similarity_percent,
            "warning_level": classify_warning_level(similarity_percent),
        })

    results.sort(key=lambda result: result["similarity_percent"], reverse=True)
    return results[:top_n]
