from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("topics", "0005_alter_topichistory_action"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Technology",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100, unique=True)),
                ("category", models.CharField(default="Khác", max_length=50)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["category", "name"]},
        ),
        migrations.CreateModel(
            name="TopicFunction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("function_name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("topic", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="functions", to="topics.topic")),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="TopicDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="topic-documents/%Y/%m/")),
                ("file_name", models.CharField(max_length=255)),
                ("file_type", models.CharField(max_length=10)),
                ("file_size", models.PositiveBigIntegerField()),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                ("topic", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="documents", to="topics.topic")),
                ("uploaded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="topic_documents", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-uploaded_at", "-id"]},
        ),
        migrations.CreateModel(
            name="TopicTechnology",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_primary", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("technology", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="topic_uses", to="topics.technology")),
                ("topic", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="technologies", to="topics.topic")),
            ],
        ),
        migrations.AddConstraint(
            model_name="topictechnology",
            constraint=models.UniqueConstraint(fields=("topic", "technology"), name="uniq_topic_technology"),
        ),
    ]
