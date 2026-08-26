from django.db.models import Count
from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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
        ("status", "status"),
    ):
        value = request.query_params.get(param)
        if value:
            qs = qs.filter(**{field: value})
    return qs


class StatisticsOverviewView(APIView):
    """
    GET /api/v1/statistics/overview/
    Thống kê số đề tài theo: năm học, khóa, giảng viên, lĩnh vực, trạng thái.
    """
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        qs = _filtered_topics(request)
        return Response(
            {
                "total": qs.count(),
                "by_academic_year": list(qs.values("academic_year__name").annotate(count=Count("id"))),
                "by_cohort": list(qs.values("cohort__name").annotate(count=Count("id"))),
                "by_teacher": list(qs.values("proposed_by__first_name", "proposed_by__last_name").annotate(count=Count("id"))),
                "by_field": list(qs.values("field__name").annotate(count=Count("id"))),
                "by_status": list(qs.values("status").annotate(count=Count("id"))),
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
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        export_format = request.query_params.get("export_format", "excel")
        topics = _filtered_topics(request)

        if export_format == "pdf":
            buffer = export_topics_to_pdf(topics)
            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = 'attachment; filename="danh_sach_de_tai.pdf"'
            return response

        buffer = export_topics_to_excel(topics)
        response = HttpResponse(
            buffer.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="danh_sach_de_tai.xlsx"'
        return response
