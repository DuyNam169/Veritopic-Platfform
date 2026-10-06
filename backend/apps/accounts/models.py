from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    User tùy chỉnh, thêm trường role để phân quyền (RBAC).
    4 vai trò theo đúng yêu cầu đề tài: admin, department_head, teacher, student.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Quản trị viên"
        DEPARTMENT_HEAD = "department_head", "Trưởng bộ môn"
        TEACHER = "teacher", "Giảng viên"
        STUDENT = "student", "Sinh viên"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    avatar = models.ImageField(upload_to="avatars/%Y/%m/", null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    department = models.ForeignKey(
        "academics.Department",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="members",
    )
    cohort = models.ForeignKey(
        "academics.Cohort",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="students",
        help_text="Khóa học của sinh viên",
    )
    student_code = models.CharField(max_length=30, blank=True, help_text="Mã số sinh viên (nếu role=student)")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"
