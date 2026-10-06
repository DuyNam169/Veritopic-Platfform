import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("topics", "0002_performance_indexes"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="TopicDeletionAudit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("original_topic_id", models.PositiveBigIntegerField(db_index=True)),
                ("title", models.CharField(max_length=500)),
                ("status", models.CharField(choices=[("pending", "Chờ duyệt"), ("approved", "Đã duyệt"), ("rejected", "Từ chối"), ("rename_requested", "Yêu cầu sửa tên")], max_length=20)),
                ("proposed_by_label", models.CharField(blank=True, max_length=255)),
                ("had_assignments", models.BooleanField(default=False)),
                ("snapshot", models.JSONField(default=dict)),
                ("deleted_at", models.DateTimeField(auto_now_add=True)),
                ("deleted_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="topic_deletion_audits", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-deleted_at"]},
        ),
    ]
