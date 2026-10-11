from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("academics", "0003_catalog_integrity")]
    operations = [migrations.AddField(model_name="field", name="description",
                                    field=models.TextField(blank=True, default=""))]
