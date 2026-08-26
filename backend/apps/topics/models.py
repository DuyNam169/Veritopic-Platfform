from django.conf import settings
from django.db import models
from pgvector.django import VectorField

# Kích thước vector của model embedding Groq (nomic-embed-text-v1_5) = 768 chiều.
# Nếu đổi model embedding khác, PHẢI đổi số này cho khớp rồi chạy lại migration.
EMBEDDING_DIM = 768


class Topic(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Chờ duyệt"
        APPROVED = "approved", "Đã duyệt"
        REJECTED = "rejected", "Từ chối"
        RENAME_REQUESTED = "rename_requested", "Yêu cầu sửa tên"

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)

    department = models.ForeignKey(
        "academics.Department", on_delete=models.PROTECT, related_name="topics"
    )
    field = models.ForeignKey(
        "academics.Field", on_delete=models.SET_NULL, null=True, blank=True, related_name="topics"
    )
    cohort = models.ForeignKey("academics.Cohort", on_delete=models.PROTECT, related_name="topics")
    academic_year = models.ForeignKey(
        "academics.AcademicYear", on_delete=models.PROTECT, related_name="topics"
    )
    semester = models.ForeignKey(
        "academics.Semester", on_delete=models.PROTECT, related_name="topics"
    )

    proposed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="proposed_topics",
        limit_choices_to={"role": "teacher"},
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_topics",
    )
    review_note = models.TextField(blank=True, help_text="Ghi chú của Trưởng bộ môn khi duyệt/từ chối/yêu cầu sửa")

    # Vector embedding ngữ nghĩa (Groq nomic-embed-text-v1_5), lưu bằng pgvector để tra cứu lân cận nhanh.
    # NULL khi mới tạo, được tính bất đồng bộ/đồng bộ ngay sau khi save (xem services/similarity.py)
    embedding = VectorField(dimensions=EMBEDDING_DIM, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["cohort", "academic_year", "semester"]),
        ]

    def __str__(self):
        return self.title


class TopicAssignment(models.Model):
    """Giao đề tài cho sinh viên hoặc nhóm sinh viên."""
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="assignments")
    students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="assigned_topics",
        limit_choices_to={"role": "student"},
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="assignments_made"
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    note = models.TextField(blank=True)

    def __str__(self):
        return f"Assignment #{self.pk} - {self.topic.title}"


class TopicHistory(models.Model):
    """
    Lưu vết lịch sử đề tài qua tất cả các khóa — phục vụ tra cứu & làm dữ liệu so sánh trùng lặp
    xuyên suốt nhiều năm, kể cả khi Topic gốc có bị chỉnh sửa sau này.
    """
    class Action(models.TextChoices):
        CREATED = "created", "Tạo mới"
        UPDATED = "updated", "Cập nhật"
        APPROVED = "approved", "Duyệt"
        REJECTED = "rejected", "Từ chối"
        RENAME_REQUESTED = "rename_requested", "Yêu cầu sửa tên"
        ASSIGNED = "assigned", "Giao đề tài"

    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="history")
    action = models.CharField(max_length=20, choices=Action.choices)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Topic histories"

    def __str__(self):
        return f"{self.topic.title} - {self.action}"


class TopicSimilarityResult(models.Model):
    """
    Lưu lại kết quả kiểm tra tương đồng tại thời điểm đề tài được đề xuất, để Trưởng bộ môn
    xem lại sau này mà không cần chạy lại thuật toán (audit trail).
    """
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="similarity_results")
    similar_topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="+")
    similarity_percent = models.FloatField(help_text="0-100")
    warning_level = models.CharField(
        max_length=20,
        choices=[
            ("normal", "Bình thường"),
            ("review", "Cần xem xét"),
            ("high", "Tương đồng cao"),
            ("duplicate", "Có khả năng trùng đề tài"),
        ],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-similarity_percent"]
