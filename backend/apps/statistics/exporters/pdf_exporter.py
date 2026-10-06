"""
Xuất danh sách đề tài ra PDF bằng WeasyPrint (chuyển HTML/CSS -> PDF).
LƯU Ý: WeasyPrint cần system dependencies (libpango, libcairo...) — đã cài sẵn trong backend/Dockerfile.
"""
import io

from django.template.loader import render_to_string
from weasyprint import HTML


def export_topics_to_pdf(topics, *, generated_at="", filter_summary="Tất cả đề tài") -> io.BytesIO:
    html_string = render_to_string(
        "statistics/topics_report.html",
        {"topics": topics, "generated_at": generated_at, "filter_summary": filter_summary},
    )
    buffer = io.BytesIO()
    HTML(string=html_string).write_pdf(buffer)
    buffer.seek(0)
    return buffer
