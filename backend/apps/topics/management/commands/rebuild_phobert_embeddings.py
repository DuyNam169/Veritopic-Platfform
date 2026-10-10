from itertools import islice

from django.core.management.base import BaseCommand, CommandError

from apps.topics.models import Topic
from apps.topics.services.similarity import get_embeddings


class Command(BaseCommand):
    help = "Rebuild stored topic vectors using the PhoBERT embedding service."

    def add_arguments(self, parser):
        parser.add_argument("--batch-size", type=int, default=32)

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        if batch_size < 1 or batch_size > 500:
            raise CommandError("--batch-size must be between 1 and 500.")

        topics = Topic.objects.order_by("pk").iterator(chunk_size=batch_size)
        updated = 0
        while batch := list(islice(topics, batch_size)):
            texts = [topic.title for topic in batch]
            embeddings = get_embeddings(texts)
            for topic, embedding in zip(batch, embeddings, strict=True):
                topic.embedding = embedding
            Topic.objects.bulk_update(batch, ["embedding"], batch_size=batch_size)
            updated += len(batch)
            self.stdout.write(f"Đã cập nhật {updated} đề tài.")

        if updated == 0:
            self.stdout.write("Không có đề tài nào cần cập nhật.")
