from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdmin
from apps.academics.models import AcademicYear, Cohort, Department, Field, Semester
from apps.topics.models import Topic

from .exporters.excel_exporter import export_topics_to_excel
from .exporters.pdf_exporter import export_topics_to_pdf


def _filtered_topics(request):
    qs = Topic.objects.select_related("department", "field", "cohort", "academic_year", "semester", "proposed_by")
    for param, field in (
        ("academic_year", "academic_year_id"),
        ("cohort", "cohort_id"),
        ("department", "department_id"),
        ("field", "field_id"),
        ("semester", "semester_id"),
        ("proposed_by", "proposed_by_id"),
        ("status", "status"),
    ):
        value = request.query_params.get(param)
        if value:
            qs = qs.filter(**{field: value})
    search = request.query_params.get("search", "").strip()
    if search:
        # Match DRF SearchFilter semantics used by the topic list: every term
        # must occur in at least one searchable field.
        for term in search.split():
            qs = qs.filter(Q(title__icontains=term) | Q(description__icontains=term))
    return qs.order_by("-created_at", "id")


def _report_metadata(request):
    """Build a human-readable description of the filters printed in each report."""
    filters = []
    catalog_filters = (
        ("academic_year", "Năm học", AcademicYear),
        ("cohort", "Khóa học", Cohort),
        ("department", "Bộ môn", Department),
        ("field", "Lĩnh vực", Field),
        ("semester", "Học kỳ", Semester),
    )
    for param, label, model in catalog_filters:
        value = request.query_params.get(param)
        if value:
            obj = model.objects.filter(pk=value).first()
            filters.append(f"{label}: {obj.name if obj else value}")

    proposed_by = request.query_params.get("proposed_by")
    if proposed_by:
        user = get_user_model().objects.filter(pk=proposed_by).first()
        filters.append(f"Giảng viên: {(user.get_full_name() or user.username) if user else proposed_by}")

    status = request.query_params.get("status")
    if status:
        filters.append(f"Trạng thái: {dict(Topic.Status.choices).get(status, status)}")
    search = request.query_params.get("search", "").strip()
    if search:
        filters.append(f'Từ khóa: "{search}"')

    return {
        "generated_at": timezone.localtime().strftime("%d/%m/%Y %H:%M"),
        "filter_summary": "; ".join(filters) if filters else "Tất cả đề tài",
    }


class StatisticsOverviewView(APIView):
    """
    GET /api/v1/statistics/overview/
    Thống kê số đề tài theo: năm học, khóa, giảng viên, lĩnh vực, trạng thái.
    """
    permission_classes = (IsAdmin,)

    def get(self, request):
        qs = _filtered_topics(request)
        return Response(
            {
                "total": qs.count(),
                "by_academic_year": list(qs.values("academic_year__name").annotate(count=Count("id")).order_by("academic_year__name")),
                "by_cohort": list(qs.values("cohort__name").annotate(count=Count("id")).order_by("cohort__name")),
                "by_teacher": list(qs.values("proposed_by__id", "proposed_by__username", "proposed_by__first_name", "proposed_by__last_name").annotate(count=Count("id")).order_by("proposed_by__username")),
                "by_field": list(qs.values("field__name").annotate(count=Count("id")).order_by("field__name")),
                "by_status": list(qs.values("status").annotate(count=Count("id")).order_by("status")),
            }
        )


class ExportTopicsView(APIView):
    """
    GET /api/v1/statistics/export/?export_format=excel|pdf&<bộ lọc giống overview>

    LƯU Ý: tham số dùng tên "export_format", KHÔNG dùng "format" — "format" là tên
    tham số DRF dành riêng để chọn renderer nội bộ (?format=json/api). Nếu đặt tên
    trùng, DRF sẽ tự raise Http404 khi giá trị không khớp renderer nào đã đăng ký
    (ví dụ "excel"/"pdf"), gây lỗi 404 khó hiểu dù routing và logic view đều đúng.
    """
    permission_classes = (IsAdmin,)

    def get(self, request):
        export_format = request.query_params.get("export_format", "excel")
        topics = _filtered_topics(request)
        metadata = _report_metadata(request)

        if export_format == "pdf":
            buffer = export_topics_to_pdf(topics, **metadata)
            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = 'attachment; filename="danh_sach_de_tai.pdf"'
            return response

        if export_format != "excel":
            raise ValidationError({"export_format": "Định dạng chỉ có thể là excel hoặc pdf."})

        buffer = export_topics_to_excel(topics, **metadata)
        response = HttpResponse(
            buffer.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="danh_sach_de_tai.xlsx"'
        return response
