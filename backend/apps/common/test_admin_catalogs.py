from django.core.management import call_command
from django.test import TestCase
from apps.academics.models import Field
from apps.topics.models import Technology


class AdminCatalogSeedTests(TestCase):
    def test_seed_is_repeatable_and_preserves_admin_edits(self):
        field = Field.objects.create(name="ứng dụng web", description="Nội dung của quản trị viên")
        technology = Technology.objects.create(name="python", category="Tùy chỉnh", description="Mô tả riêng")
        call_command("seed_admin_catalogs", verbosity=0)
        first_counts = (Field.objects.count(), Technology.objects.count())
        call_command("seed_admin_catalogs", verbosity=0)
        self.assertEqual(first_counts, (Field.objects.count(), Technology.objects.count()))
        field.refresh_from_db()
        technology.refresh_from_db()
        self.assertEqual(field.description, "Nội dung của quản trị viên")
        self.assertEqual(technology.description, "Mô tả riêng")
        self.assertEqual(technology.category, "Tùy chỉnh")
        self.assertEqual(Technology.objects.filter(name__iexact="Python").count(), 1)
