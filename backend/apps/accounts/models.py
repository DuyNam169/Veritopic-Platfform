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
    student_code = models.CharField(max_length=50, blank=True, help_text="Mã số sinh viên (nếu role=student)")
    class_name = models.CharField(max_length=100, blank=True, help_text="Tên lớp (nếu role=student)")
    lecturer_code = models.CharField(max_length=50, blank=True, default="")
    academic_degree = models.CharField(max_length=100, blank=True)
    specialization = models.TextField(blank=True)
    major = models.ForeignKey("academics.Major", on_delete=models.PROTECT, null=True, blank=True, related_name="users")
    academic_year = models.ForeignKey("academics.AcademicYear", on_delete=models.PROTECT, null=True, blank=True, related_name="students")
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)

    class StudentStatus(models.TextChoices):
        ACTIVE = "active", "Đang học"
        GRADUATED = "graduated", "Đã tốt nghiệp"
        SUSPENDED = "suspended", "Tạm ngừng học"
        DROPPED_OUT = "dropped_out", "Đã thôi học"

    student_status = models.CharField(max_length=30, choices=StudentStatus.choices, default=StudentStatus.ACTIVE)

    class Meta(AbstractUser.Meta):
        constraints = [models.UniqueConstraint(fields=["lecturer_code"], condition=~models.Q(lecturer_code=""), name="unique_lecturer_code_nonempty")]

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"


class OTPRecord(models.Model):
    """Lưu trữ mã OTP gửi qua email cho việc cấp lại mật khẩu."""
    email = models.EmailField()
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.email} - {self.otp} - Used: {self.is_used}"
