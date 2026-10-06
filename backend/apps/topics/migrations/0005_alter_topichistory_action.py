from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("topics", "0004_backfill_created_history"),
    ]

    operations = [
        migrations.AlterField(
            model_name="topichistory",
            name="action",
            field=models.CharField(
                choices=[
                    ("created", "Tạo mới"),
                    ("updated", "Cập nhật"),
                    ("approved", "Duyệt"),
                    ("rejected", "Từ chối"),
                    ("rename_requested", "Yêu cầu sửa tên"),
                    ("assigned", "Giao đề tài"),
                    ("similarity_refreshed", "Chạy lại kiểm tra tương đồng"),
                ],
                max_length=30,
            ),
        ),
    ]
