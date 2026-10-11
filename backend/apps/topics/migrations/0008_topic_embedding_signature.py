from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("topics", "0007_alter_topicsimilarityresult_options_and_more")]
    operations = [
        migrations.AddField(
            model_name="topic",
            name="embedding_signature",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
    ]
