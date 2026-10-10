from django.conf import settings
from django.db import models


class ProgressReport(models.Model):
    """Báo cáo tiến độ do sinh viên gửi lên theo từng đợt/tuần/mốc."""
    assignment = models.ForeignKey(
        "topics.TopicAssignment",
        on_delete=models.CASCADE,
        related_name="reports",
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submitted_progress_reports",
    )
    period_label = models.CharField(
        max_length=100,
        help_text="Tên mốc hoặc đợt báo cáo (vd: Tuần 3, Mốc 1)",
    )
    stage = models.CharField(
        max_length=100,
        blank=True,
        help_text="Giai đoạn thực hiện (vd: Báo cáo tổng quan, Thiết kế kiến trúc)",
    )
    percent = models.PositiveSmallIntegerField(
        default=0,
        help_text="Phần trăm hoàn thành (0-100%)",
    )
    content = models.TextField(help_text="Nội dung kết quả đã thực hiện")
    attachment = models.FileField(
        upload_to="progress_attachments/",
        null=True,
        blank=True,
        help_text="File tài liệu đính kèm (Word, PDF, ZIP... <= 20MB)",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    is_late = models.BooleanField(
        default=False,
        help_text="Cờ tự động đánh dấu trễ tiến độ nếu nộp sau thời hạn/quy định",
    )

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"Report {self.period_label} - Assignment #{self.assignment_id} ({self.percent}%)"


class ProgressFeedback(models.Model):
    """
    Nhận xét/đánh giá của Giảng viên hướng dẫn cho một báo cáo tiến độ.
    Quy tắc: Nhận xét chỉ được thêm mới, không chỉnh sửa hoặc xóa (PCN09).
    """
    class Result(models.TextChoices):
        PASSED = "passed", "Đạt"
        NEED_REVISION = "need_revision", "Cần chỉnh sửa"
        FAILED = "failed", "Không đạt"

    report = models.ForeignKey(
        ProgressReport,
        on_delete=models.CASCADE,
        related_name="feedbacks",
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="progress_feedbacks",
    )
    comment = models.TextField(help_text="Nội dung nhận xét/gợi ý của Giảng viên")
    score = models.FloatField(
        null=True,
        blank=True,
        help_text="Điểm đánh giá giai đoạn (nếu có, thang điểm 10)",
    )
    result = models.CharField(
        max_length=20,
        choices=Result.choices,
        default=Result.PASSED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Feedback by {self.teacher} on Report #{self.report_id}"
