import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0003_catalog_integrity"),
        ("accounts", "0002_protect_department"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="cohort",
            field=models.ForeignKey(
                blank=True,
                help_text="Khóa học của sinh viên",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="students",
                to="academics.cohort",
            ),
        ),
    ]
