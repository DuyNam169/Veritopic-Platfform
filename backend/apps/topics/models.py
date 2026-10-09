from django.conf import settings
from django.db import models
from pgvector.django import VectorField

# Kích thước embedding của PhoBERT Siamese = 768 chiều.
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

    # Vector embedding PhoBERT, lưu bằng pgvector để tra cứu lân cận nhanh.
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
        SIMILARITY_REFRESHED = "similarity_refreshed", "Chạy lại kiểm tra tương đồng"

    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="history")
    action = models.CharField(max_length=30, choices=Action.choices)
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


class TopicDeletionAudit(models.Model):
    """Dấu vết độc lập, được giữ lại sau khi đề tài và dữ liệu trực thuộc bị xóa."""

    original_topic_id = models.PositiveBigIntegerField(db_index=True)
    title = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=Topic.Status.choices)
    proposed_by_label = models.CharField(max_length=255, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="topic_deletion_audits",
    )
    had_assignments = models.BooleanField(default=False)
    snapshot = models.JSONField(default=dict)
    deleted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-deleted_at"]

    def __str__(self):
        return f"Đã xóa #{self.original_topic_id} - {self.title}"


class Technology(models.Model):
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=50, default="Khác")
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return self.name


class TopicTechnology(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="technologies")
    technology = models.ForeignKey(
        Technology, on_delete=models.PROTECT, related_name="topic_uses"
    )
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("topic", "technology"), name="uniq_topic_technology"
            )
        ]


class TopicFunction(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="functions")
    function_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.topic.title}: {self.function_name}"


class TopicDocument(models.Model):
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="documents")
    file = models.FileField(upload_to="topic-documents/%Y/%m/")
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10)
    file_size = models.PositiveBigIntegerField()
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="topic_documents",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at", "-id"]

    def __str__(self):
        return self.file_name
