from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.topics.models import TopicAssignment
from .models import ProgressFeedback, ProgressReport


def check_is_assignment_late(assignment: TopicAssignment) -> bool:
    """
    Quy tắc trễ tiến độ: đề tài đang thực hiện (active) mà báo cáo gần nhất cũ hơn N ngày
    hoặc chưa có báo cáo nào từ khi phân công > N ngày.
    N đọc từ settings.PROGRESS_LATE_AFTER_DAYS (mặc định 7 ngày).
    """
    if assignment.status != TopicAssignment.Status.ACTIVE:
        return False

    late_days = getattr(settings, "PROGRESS_LATE_AFTER_DAYS", 7)
    threshold_date = timezone.now() - timedelta(days=late_days)

    latest_report = assignment.reports.first()
    if latest_report:
        return latest_report.submitted_at < threshold_date
    return assignment.assigned_at < threshold_date


def add_progress_feedback(report: ProgressReport, teacher, comment: str, score=None, result="passed"):
    """
    Thêm nhận xét tiến độ của Giảng viên.
    Chỉ cho phép Giảng viên giao đề tài (assigned_by hoặc proposed_by) nhận xét.
    """
    assignment = report.assignment
    if teacher.role != "admin" and assignment.topic.proposed_by != teacher and assignment.assigned_by != teacher:
        raise PermissionDenied("Bạn chỉ có quyền nhận xét tiến độ của đề tài bạn hướng dẫn.")

    if not comment.strip():
        raise ValidationError({"comment": "Nội dung nhận xét không được để trống."})

    feedback = ProgressFeedback.objects.create(
        report=report,
        teacher=teacher,
        comment=comment,
        score=score,
        result=result,
    )
    return feedback
