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
    keywords = models.JSONField(default=list, blank=True)
    max_students = models.PositiveSmallIntegerField(default=5)
    requirements = models.TextField(blank=True)
    topic_code = models.CharField(max_length=50, blank=True, default="")
    major = models.ForeignKey("academics.Major", on_delete=models.PROTECT, null=True, blank=True, related_name="topics")
    project_type = models.CharField(max_length=50, blank=True)
    architecture = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_topics")

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
    embedding_signature = models.CharField(max_length=64, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["topic_code"], condition=~models.Q(topic_code=""), name="unique_topic_code_nonempty")]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["cohort", "academic_year", "semester"]),
        ]

    def __str__(self):
        return self.title


class TopicAssignment(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Đang thực hiện"
        COMPLETED = "completed", "Đã hoàn thành"
        CANCELLED = "cancelled", "Đã hủy"

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    due_date = models.DateField(null=True, blank=True)
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
    groq_score = models.FloatField(null=True, blank=True)
    groq_explanation = models.TextField(blank=True)
    assessment_status = models.CharField(max_length=20, default="disabled", choices=[
        ("disabled", "Chưa bật đánh giá bổ sung"),
        ("completed", "Đã đánh giá bổ sung"),
        ("unavailable", "Đánh giá bổ sung tạm thời không khả dụng"),
        ("exact_match", "Trùng tên chính xác"),
    ])
    rank = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["rank", "-similarity_percent"]


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


class StudentTopicProposal(models.Model):
    """
    Sinh viên đề xuất đề tài mới lên cho Giảng viên hướng dẫn.
    Đề xuất ở trạng thái chờ GVHD xử lý (Đồng ý / Từ chối / Yêu cầu sửa).
    Khi GVHD đồng ý, một Topic chính thức và TopicAssignment sẽ được khởi tạo.
    """
    class Status(models.TextChoices):
        PENDING = "pending", "Chờ GVHD xử lý"
        APPROVED = "approved", "GVHD đã đồng ý"
        REJECTED = "rejected", "GVHD từ chối"
        REVISION_REQUESTED = "revision_requested", "Yêu cầu chỉnh sửa"

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_topic_proposals",
        limit_choices_to={"role": "student"},
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_topic_proposals",
        limit_choices_to={"role": "teacher"},
    )
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    expected_technologies = models.CharField(max_length=255, blank=True, help_text="Công nghệ dự kiến")
    department = models.ForeignKey(
        "academics.Department",
        on_delete=models.PROTECT,
        related_name="student_proposals",
    )
    field = models.ForeignKey(
        "academics.Field",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_proposals",
    )
    cohort = models.ForeignKey(
        "academics.Cohort",
        on_delete=models.PROTECT,
        related_name="student_proposals",
    )
    academic_year = models.ForeignKey(
        "academics.AcademicYear",
        on_delete=models.PROTECT,
        related_name="student_proposals",
    )
    semester = models.ForeignKey(
        "academics.Semester",
        on_delete=models.PROTECT,
        related_name="student_proposals",
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING,
    )
    teacher_note = models.TextField(blank=True, help_text="Phản hồi/nhận xét của GVHD")
    created_topic = models.ForeignKey(
        Topic,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="from_student_proposal",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Proposal: {self.title} by {self.student_id} ({self.status})"


class TopicRegistration(models.Model):
    """
    Sinh viên đăng ký (chọn) một đề tài có sẵn từ ngân hàng đề tài.
    Ràng buộc: 
    - 1 sinh viên chỉ được chọn 1 đề tài.
    - Không sinh viên nào cùng khóa chọn chung 1 đề tài.
    """
    class Status(models.TextChoices):
        PENDING = "pending", "Chờ duyệt"
        APPROVED = "approved", "Đã duyệt"
        REJECTED = "rejected", "Từ chối"
        CANCELLED = "cancelled", "Đã hủy"

    topic = models.ForeignKey(
        Topic,
        on_delete=models.CASCADE,
        related_name="registrations",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="topic_registrations",
        limit_choices_to={"role": "student"},
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    note = models.TextField(blank=True, help_text="Ghi chú nguyện vọng của sinh viên khi đăng ký")
    teacher_note = models.TextField(blank=True, help_text="Phản hồi của giảng viên")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Registration: {self.student_id} -> Topic #{self.topic_id} ({self.status})"
