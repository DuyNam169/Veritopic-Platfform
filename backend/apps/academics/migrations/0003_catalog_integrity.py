from django.db import migrations, models
import django.db.models.deletion


def keep_one_current(apps, schema_editor):
    years = apps.get_model("academics", "AcademicYear").objects.using(schema_editor.connection.alias)
    current = years.filter(is_current=True).order_by("-name", "-pk").first()
    if current:
        years.filter(is_current=True).exclude(pk=current.pk).update(is_current=False)


class Migration(migrations.Migration):
    dependencies = [("academics", "0002_initial")]
    operations = [
        migrations.RunPython(keep_one_current, migrations.RunPython.noop),
        migrations.AddConstraint(model_name="academicyear", constraint=models.UniqueConstraint(fields=("is_current",), condition=models.Q(is_current=True), name="one_current_academic_year")),
        migrations.AlterField(model_name="semester", name="academic_year", field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="semesters", to="academics.academicyear")),
    ]
