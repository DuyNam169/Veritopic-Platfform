import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings

from .services.similarity import (
    Candidate,
    SemanticScores,
    SimilarityServiceUnavailable,
    assess_candidates,
    retrieve_candidates,
    score_candidates_semantically,
)


def topic(pk, title, vector):
    return SimpleNamespace(id=pk, pk=pk, title=title, embedding=vector, save=Mock())


@override_settings(SIMILARITY_GROQ_ENABLED=False)
class HybridAssessmentTests(SimpleTestCase):
    def setUp(self):
        self.query = topic(None, "Hệ thống quản lý đề tài", [1.0, 0.0])
        self.near = topic(1, "Ngân hàng đề tài", [0.8, 0.6])
        self.far = topic(2, "Nhận dạng ảnh", [0.0, 1.0])

    @patch("apps.topics.services.similarity.score_candidates_semantically")
    def test_disabled_uses_cosine_and_makes_no_groq_request(self, scorer):
        results = assess_candidates(self.query, [Candidate(self.far, 0.8), Candidate(self.near, 0.1)], [1, 0])
        self.assertEqual([r["topic"].id for r in results], [1, 2])
        self.assertEqual(results[0]["similarity_percent"], 80)
        self.assertEqual(results[0]["assessment_status"], "disabled")
        scorer.assert_not_called()

    @override_settings(SIMILARITY_GROQ_ENABLED=True)
    @patch("apps.topics.services.similarity.score_candidates_semantically")
    def test_groq_reranks_but_does_not_replace_cosine_or_warning(self, scorer):
        scores = SemanticScores()
        scores.update({1: 10, 2: 90})
        scores.explanations = {2: "Cùng mục tiêu, khác cách diễn đạt."}
        scorer.return_value = scores
        results = assess_candidates(self.query, [Candidate(self.near, 0.8), Candidate(self.far, 0.1)], [1, 0])
        self.assertEqual([r["topic"].id for r in results], [2, 1])
        self.assertEqual(results[0]["groq_score"], 90)
        self.assertEqual(results[0]["similarity_percent"], 0)
        self.assertEqual(results[0]["warning_level"], "normal")
        self.assertTrue(results[0]["groq_explanation"])

    @override_settings(SIMILARITY_GROQ_ENABLED=True)
    @patch("apps.topics.services.similarity.score_candidates_semantically", side_effect=SimilarityServiceUnavailable())
    def test_failed_groq_retains_baseline_order_and_marks_unavailable(self, scorer):
        results = assess_candidates(self.query, [Candidate(self.far, 0.9), Candidate(self.near, 0.1)], [1, 0])
        self.assertEqual([r["topic"].id for r in results], [1, 2])
        self.assertTrue(all(r["assessment_status"] == "unavailable" for r in results))
        self.assertTrue(all(r["groq_score"] is None for r in results))

    @override_settings(SIMILARITY_GROQ_ENABLED=True)
    @patch("apps.topics.services.similarity.get_embeddings")
    @patch("apps.topics.services.similarity.score_candidates_semantically")
    def test_exact_title_needs_neither_embedding_nor_groq(self, scorer, encoder):
        exact = topic(3, "HE THONG QUAN LY DE TAI!", None)
        results = assess_candidates(self.query, [Candidate(exact, 1)], None)
        self.assertEqual(results[0]["similarity_percent"], 100)
        self.assertEqual(results[0]["assessment_status"], "exact_match")
        scorer.assert_not_called()
        encoder.assert_not_called()

    @patch("apps.topics.services.similarity.get_embeddings", return_value=[[0.8, 0.6]])
    def test_lexical_candidate_without_vector_is_encoded_and_persisted(self, encoder):
        self.near.embedding = None
        results = assess_candidates(self.query, [Candidate(self.near, 0.9)], [1, 0])
        self.assertEqual(results[0]["similarity_percent"], 80)
        encoder.assert_called_once_with([self.near.title])
        self.near.save.assert_called_once_with(update_fields=["embedding"])

    @patch("apps.topics.models.Topic.objects")
    @patch("apps.topics.services.similarity.tfidf_prefilter")
    def test_retrieval_merges_shortlists_and_pins_unindexed_exact_name(self, lexical, manager):
        exact = topic(3, self.query.title, None)
        lexical.return_value = [Candidate(self.far, 0.9)]
        manager.exclude.return_value.exclude.return_value.select_related.return_value.annotate.return_value.order_by.return_value.__getitem__.return_value = [self.near]
        results = retrieve_candidates(self.query, [self.near, self.far, exact], [1, 0], 3)
        self.assertEqual(results[0].topic.id, 3)
        self.assertEqual({c.topic.id for c in results}, {1, 2, 3})


@override_settings(GROQ_API_KEY="test", GROQ_SIMILARITY_MODEL="test")
class GroqResponseValidationTests(SimpleTestCase):
    @patch("apps.topics.services.similarity.requests.post")
    def test_rejects_partial_duplicate_unknown_and_nonfinite_scores(self, post):
        query = SimpleNamespace(title="Tên", description="", field=None, department=None)
        candidate_topic = SimpleNamespace(id=1, title="Khác", description="", field=None)
        for payload in [[], [{"id": 2, "score": 10}], [{"id": 1, "score": float("nan")}],
                        [{"id": 1, "score": 20}, {"id": 1, "score": 30}], [{"id": 1, "score": 101}]]:
            with self.subTest(payload=payload):
                response = Mock(ok=True)
                response.json.return_value = {"choices": [{"message": {"content": json.dumps({"results": payload})}}]}
                post.return_value = response
                with self.assertRaises(SimilarityServiceUnavailable):
                    score_candidates_semantically(query, [Candidate(candidate_topic, 0.2)])
