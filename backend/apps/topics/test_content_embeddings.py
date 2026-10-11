from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from .services.similarity import (
    classify_warning_level, refresh_topic_embeddings,
    topic_embedding_signature, topic_embedding_text,
)


class ContentEmbeddingTests(SimpleTestCase):
    def make_topic(self):
        return SimpleNamespace(title="Quan trắc không khí", description="Đo bụi mịn qua LoRa",
                               embedding=[1.0], embedding_signature="")

    def test_description_affects_input_and_cache_signature(self):
        topic = self.make_topic()
        before = topic_embedding_signature(topic)
        self.assertIn("Đo bụi mịn", topic_embedding_text(topic))
        topic.description = "Cảnh báo điểm mù bằng siêu âm"
        self.assertNotEqual(before, topic_embedding_signature(topic))

    @patch("apps.topics.models.Topic.objects.bulk_update")
    @patch("apps.topics.services.similarity.get_embeddings", return_value=[[0.0, 1.0]])
    def test_stale_vector_is_rebuilt_but_current_vector_is_reused(self, encode, update):
        topic = self.make_topic()
        refresh_topic_embeddings([topic])
        encode.assert_called_once_with([topic_embedding_text(topic)])
        update.assert_called_once_with([topic], ["embedding", "embedding_signature"])
        self.assertEqual(topic.embedding_signature, topic_embedding_signature(topic))
        refresh_topic_embeddings([topic])
        self.assertEqual(encode.call_count, 1)
        self.assertEqual(update.call_count, 1)

    def test_model_change_invalidates_vectors(self):
        topic = self.make_topic()
        before = topic_embedding_signature(topic)
        with self.settings(SIMILARITY_EMBEDDING_MODEL="another-model"):
            self.assertNotEqual(before, topic_embedding_signature(topic))

    def test_high_cosine_does_not_claim_duplication(self):
        for score in [0, 49, 86, 99, 100]:
            self.assertEqual(classify_warning_level(score), "review")
