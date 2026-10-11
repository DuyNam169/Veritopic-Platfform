import os
from django.http import FileResponse, Http404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsTeacher
from apps.topics.models import TopicAssignment
from .models import ProgressReport
from .serializers import (
    ProgressFeedbackCreateSerializer,
    ProgressFeedbackSerializer,
    ProgressReportCreateSerializer,
    ProgressReportSerializer,
)
from .services import add_progress_feedback, check_is_assignment_late


class ProjectProgressViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API Quản lý Tiến độ đồ án:
    GET /api/v1/progress/projects/ — danh sách các lượt giao đồ án kèm cờ trễ tiến độ.
    GET /api/v1/progress/projects/{id}/reports/ — danh sách báo cáo của lượt giao này.
    POST /api/v1/progress/projects/{id}/reports/ — gửi báo cáo tiến độ (dành cho SV / seed).
    """
    permission_classes = (IsAuthenticated,)
    serializer_class = ProgressReportSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == "teacher":
            return TopicAssignment.objects.filter(topic__proposed_by=user).select_related(
                "topic", "assigned_by"
            ).prefetch_related("students", "reports")
        elif user.role == "student":
            return TopicAssignment.objects.filter(students=user).select_related(
                "topic", "assigned_by"
            ).prefetch_related("students", "reports")
        return TopicAssignment.objects.all().select_related("topic", "assigned_by").prefetch_related("students", "reports")

    def list(self, request, *args, **kwargs):
        assignments = self.get_queryset()
        data = []
        for assign in assignments:
            latest_report = assign.reports.first()
            is_late = check_is_assignment_late(assign)
            status_val = assign.status.lower() if assign.status else "active"
            status_display_map = {
                "active": "Đang thực hiện",
                "completed": "Đã hoàn thành",
                "cancelled": "Đã hủy",
            }
            data.append({
                "assignment_id": assign.id,
                "topic_id": assign.topic.id,
                "topic_title": assign.topic.title,
                "status": status_val,
                "status_display": status_display_map.get(status_val, assign.get_status_display()),
                "due_date": assign.due_date,
                "students": [
                    {
                        "id": s.id,
                        "full_name": s.get_full_name() or s.username,
                        "student_code": s.student_code,
                    }
                    for s in assign.students.all()
                ],
                "latest_percent": latest_report.percent if latest_report else 0,
                "latest_submitted_at": latest_report.submitted_at if latest_report else None,
                "is_late": is_late,
                "total_reports": assign.reports.count(),
            })
        return Response(data)

    @action(detail=True, methods=["get", "post"], url_path="reports")
    def reports(self, request, pk=None):
        assignment = self.get_object()
        if request.method == "GET":
            reports = assignment.reports.all().prefetch_related("feedbacks", "feedbacks__teacher")
            serializer = ProgressReportSerializer(reports, many=True)
            return Response(serializer.data)

        # POST: tạo báo cáo tiến độ
        serializer = ProgressReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save(
            assignment=assignment,
            submitted_by=request.user,
        )
        return Response(ProgressReportSerializer(report).data, status=status.HTTP_201_CREATED)


class AddFeedbackView(APIView):
    """POST /api/v1/progress/reports/{id}/feedback/ — Giảng viên thêm nhận xét báo cáo tiến độ."""
    permission_classes = (IsAuthenticated, IsTeacher)

    def post(self, request, pk=None):
        try:
            report = ProgressReport.objects.get(pk=pk)
        except ProgressReport.DoesNotExist:
            raise Http404("Không tìm thấy báo cáo tiến độ.")

        serializer = ProgressFeedbackCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        feedback = add_progress_feedback(
            report=report,
            teacher=request.user,
            comment=serializer.validated_data["comment"],
            score=serializer.validated_data.get("score"),
            result=serializer.validated_data.get("result", "passed"),
        )
        return Response(ProgressFeedbackSerializer(feedback).data, status=status.HTTP_201_CREATED)


class DownloadAttachmentView(APIView):
    """GET /api/v1/progress/reports/{id}/download-attachment/ — Tải an toàn file đính kèm báo cáo."""
    permission_classes = (IsAuthenticated,)

    def get(self, request, pk=None):
        try:
            report = ProgressReport.objects.get(pk=pk)
        except ProgressReport.DoesNotExist:
            raise Http404("Không tìm thấy báo cáo tiến độ.")

        user = request.user
        assign = report.assignment
        # Kiểm tra quyền: Admin, GV hướng dẫn, hoặc SV nằm trong nhóm được giao
        is_allowed = (
            user.role == "admin"
            or assign.topic.proposed_by == user
            or assign.assigned_by == user
            or assign.students.filter(pk=user.pk).exists()
        )
        if not is_allowed:
            raise PermissionDenied("Bạn không có quyền tải file đính kèm của báo cáo này.")

        if not report.attachment or not os.path.exists(report.attachment.path):
            raise Http404("File đính kèm không tồn tại hoặc đã bị xóa.")

        return FileResponse(open(report.attachment.path, "rb"), as_attachment=True)
