from django.conf import settings
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
    student_class = models.ForeignKey("academics.StudentClass", on_delete=models.PROTECT, null=True, blank=True, related_name="students")
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

    def save(self, *args, **kwargs):
        fields = kwargs.get("update_fields")
        if self.student_class_id and (fields is None or "student_class" in fields or "class_name" in fields):
            self.class_name = self.student_class.name
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = set(kwargs["update_fields"]) | {"class_name"}
        super().save(*args, **kwargs)


class OTPRecord(models.Model):
    """Lưu trữ mã OTP gửi qua email cho việc cấp lại mật khẩu."""
    email = models.EmailField()
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.email} - {self.otp} - Used: {self.is_used}"


class Notification(models.Model):
    """Lưu trữ thông báo gửi tới người dùng trong hệ thống."""
    class NotificationType(models.TextChoices):
        ADVISOR_REQUEST = "advisor_request", "Yêu cầu hướng dẫn"
        ADVISOR_RESPONSE = "advisor_response", "Phản hồi hướng dẫn"
        TOPIC_PROPOSAL = "topic_proposal", "Đề xuất đề tài"
        TOPIC_PROPOSAL_RESPONSE = "topic_proposal_response", "Phản hồi đề xuất đề tài"
        TOPIC_REGISTRATION = "topic_registration", "Đăng ký đề tài"
        TOPIC_REGISTRATION_RESPONSE = "topic_registration_response", "Phản hồi đăng ký đề tài"
        TOPIC_ASSIGNMENT = "topic_assignment", "Phân công đề tài"
        SYSTEM = "system", "Hệ thống"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_notifications",
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM,
    )
    link = models.CharField(max_length=255, blank=True, default="")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notification to {self.recipient_id}: {self.title}"


class AdvisorRequest(models.Model):
    """
    Sinh viên gửi yêu cầu đăng ký Giảng viên hướng dẫn.
    Giảng viên có thể Đồng ý hoặc Từ chối kèm phản hồi.
    """
    class Status(models.TextChoices):
        PENDING = "pending", "Chờ phản hồi"
        ACCEPTED = "accepted", "Đã đồng ý"
        REJECTED = "rejected", "Từ chối"
        CANCELLED = "cancelled", "Đã hủy"

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="advisor_requests",
        limit_choices_to={"role": "student"},
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_advisor_requests",
        limit_choices_to={"role": "teacher"},
    )
    cohort = models.ForeignKey(
        "academics.Cohort",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="advisor_requests",
    )
    semester = models.ForeignKey(
        "academics.Semester",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="advisor_requests",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    message = models.TextField(blank=True, help_text="Nguyện vọng/lời nhắn của sinh viên")
    response_note = models.TextField(blank=True, help_text="Nhận xét/lý do phản hồi của giảng viên")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"AdvisorRequest: {self.student_id} -> {self.teacher_id} ({self.status})"
