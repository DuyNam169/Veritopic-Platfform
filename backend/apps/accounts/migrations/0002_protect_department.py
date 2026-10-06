from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial"), ("academics", "0003_catalog_integrity")]
    operations = [migrations.AlterField(model_name="user", name="department", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="members", to="academics.department"))]
