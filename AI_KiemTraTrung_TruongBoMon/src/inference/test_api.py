import unittest
from unittest.mock import patch

from src.inference.api import Candidate, CheckTitleRequest, check_title
from src.inference import predict


class CheckTitleEmbeddingTests(unittest.TestCase):
    @patch("src.inference.api.rank_title_candidates")
    def test_passes_database_embedding_to_ranker(self, rank_candidates):
        rank_candidates.return_value = []
        request = CheckTitleRequest(
            title="Tên đề tài cần kiểm tra",
            candidates=[
                Candidate(
                    topic_id=17,
                    title="Tên đề tài đã duyệt",
                    embedding=[0.125, 0.875],
                )
            ],
        )

        response = check_title(request)

        self.assertEqual(response["count"], 0)
        candidates = rank_candidates.call_args.args[1]
        self.assertEqual(candidates[0]["topic_id"], 17)
        self.assertEqual(candidates[0]["embedding"], [0.125, 0.875])

    @patch("src.inference.api.rank_title_candidates")
    def test_embedding_is_optional_for_older_backend_clients(self, rank_candidates):
        rank_candidates.return_value = []
        request = CheckTitleRequest(
            title="Tên đề tài cần kiểm tra",
            candidates=[
                Candidate(topic_id=21, title="Tên đề tài cũ")
            ],
        )

        check_title(request)

        candidates = rank_candidates.call_args.args[1]
        self.assertIsNone(candidates[0]["embedding"])

    @patch("src.inference.predict.warning_level", return_value="Bình thường")
    @patch("src.inference.predict.model_score_to_percent", return_value=25.0)
    @patch("src.inference.predict.cosine_similarity", return_value=0.25)
    @patch("src.inference.predict.encode_title")
    def test_ranker_reuses_cached_candidate_embedding(
        self, encode_title, cosine_similarity, _percent, _warning
    ):
        import torch

        encode_title.return_value = torch.tensor([[0.5, 0.5]])

        results = predict.rank_title_candidates(
            "Tên mới",
            [
                {
                    "topic_id": 17,
                    "title": "Tên cũ",
                    "embedding": [0.25, 0.75],
                }
            ],
        )

        self.assertEqual(encode_title.call_count, 1)
        self.assertEqual(results[0]["topic_id"], 17)
        compared_embedding = cosine_similarity.call_args.args[1]
        self.assertTrue(torch.equal(compared_embedding, torch.tensor([[0.25, 0.75]])))


if __name__ == "__main__":
    unittest.main()
