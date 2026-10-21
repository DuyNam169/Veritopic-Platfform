import re

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.academics.models import StudentClass


class Command(BaseCommand):
    help = "Create class catalog entries for existing UTT demo students, preserving assigned classes and current academic links."

    @transaction.atomic
    def handle(self, *args, **options):
        count = 0
        students = get_user_model().objects.filter(role="student", student_class__isnull=True).select_related("cohort", "department")
        for student in students:
            if not (student.username == "sv_test" or re.fullmatch(r"sv_\d{2}_\d{2}", student.username)):
                continue
            if not student.cohort_id or not student.department_id:
                continue
            code = f"{student.cohort.name}-{student.department.code}01".upper()
            selected, _ = StudentClass.objects.get_or_create(code=code, defaults={
                "name": code, "cohort": student.cohort, "department": student.department,
                "description": "Lớp mẫu cho tài khoản demo UTT.",
            })
            if selected.cohort_id != student.cohort_id or selected.department_id != student.department_id:
                continue
            student.student_class = selected
            student.save(update_fields=["student_class", "class_name", "updated_at"])
            count += 1
        missing = get_user_model().objects.filter(role="student", student_class__isnull=True).count()
        self.stdout.write(self.style.SUCCESS(f"Assigned classes to {count} demo students; {missing} students still need a class selected."))
