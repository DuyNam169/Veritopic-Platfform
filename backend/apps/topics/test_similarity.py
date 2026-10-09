import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings

from apps.topics.services.similarity import (
    Candidate,
    normalize_text,
    score_candidates_semantically,
    tfidf_prefilter,
)


def make_topic(topic_id, title, description, field_id=1, department_id=1):
    return SimpleNamespace(
        id=topic_id,
        title=title,
        description=description,
        field_id=field_id,
        department_id=department_id,
        field=SimpleNamespace(name="Trí tuệ nhân tạo"),
        department=SimpleNamespace(name="Hệ thống thông tin"),
    )


@override_settings(SIMILARITY_PREFILTER_TOP_K=20)
class TfidfPrefilterTests(SimpleTestCase):
    def test_normalize_text_ignores_accents_punctuation_and_spacing(self):
        self.assertEqual(
            normalize_text("  Hệ THỐNG quản lý—đề tài! "),
            "he thong quan ly de tai",
        )

    def test_prefilter_prioritizes_lexically_related_topic(self):
        new_topic = make_topic(
            1,
            "Hệ thống quản lý đề tài tốt nghiệp bằng trí tuệ nhân tạo",
            "Phát hiện đề tài trùng lặp bằng xử lý ngôn ngữ tự nhiên.",
        )
        related = make_topic(
            2,
            "Quản lý ngân hàng đề tài và phát hiện tương đồng",
            "Ứng dụng AI để cảnh báo nội dung đồ án gần trùng.",
        )
        unrelated = make_topic(
            3,
            "Robot tự hành vận chuyển vật tư",
            "Điều khiển động cơ và tránh vật cản trong nhà xưởng.",
            field_id=2,
            department_id=2,
        )

        candidates = tfidf_prefilter(new_topic, [unrelated, related])

        self.assertEqual(candidates[0].topic.id, related.id)
        self.assertGreater(candidates[0].lexical_score, candidates[1].lexical_score)


@override_settings(GROQ_API_KEY="test-key", GROQ_SIMILARITY_MODEL="qwen/qwen3.8-27b")
class GroqSemanticScoringTests(SimpleTestCase):
    @patch("apps.topics.services.similarity.requests.post")
    def test_semantic_scorer_validates_and_returns_scores_by_topic_id(self, post):
        topic = make_topic(1, "Đề tài mới", "Mô tả")
        candidates = [
            Candidate(make_topic(2, "Đề tài A", "Mô tả A"), 0.7),
            Candidate(make_topic(3, "Đề tài B", "Mô tả B"), 0.2),
        ]
        response = Mock(ok=True, status_code=200)
        response.json.return_value = {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "results": [{"id": 2, "score": 82}, {"id": 3, "score": 14}]
                    })
                }
            }]
        }
        post.return_value = response

        scores = score_candidates_semantically(topic, candidates)

        self.assertEqual(scores, {2: 82.0, 3: 14.0})
        request_body = post.call_args.kwargs["json"]
        self.assertEqual(request_body["model"], "qwen/qwen3.8-27b")
        self.assertTrue(request_body["response_format"]["json_schema"]["strict"])
