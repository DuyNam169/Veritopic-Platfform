from django.db import migrations


def migrate_classes(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    StudentClass = apps.get_model("academics", "StudentClass")
    alias = schema_editor.connection.alias
    for user in User.objects.using(alias).filter(role="student", student_class__isnull=True).exclude(class_name="").iterator():
        name = user.class_name.strip()
        if not name:
            continue
        student_class = StudentClass.objects.using(alias).filter(name__iexact=name).first()
        if not student_class:
            student_class = StudentClass.objects.using(alias).create(code=f"LEGACY-{user.pk}", name=name)
        User.objects.using(alias).filter(pk=user.pk).update(student_class=student_class, class_name=student_class.name)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0010_user_student_class")]
    operations = [migrations.RunPython(migrate_classes, migrations.RunPython.noop)]
