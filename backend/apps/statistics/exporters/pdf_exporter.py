"""
Xuất danh sách đề tài ra PDF bằng WeasyPrint (chuyển HTML/CSS -> PDF).
LƯU Ý: WeasyPrint cần system dependencies (libpango, libcairo...) — đã cài sẵn trong backend/Dockerfile.
"""
import io
from django.template.loader import render_to_string


def export_topics_to_pdf(topics, *, generated_at="", filter_summary="Tất cả đề tài") -> io.BytesIO:
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as exc:
        raise RuntimeError(
            "WeasyPrint yêu cầu thư viện hệ thống (GTK/gobject/pango) để xuất PDF. "
            "Vui lòng chạy trong môi trường Docker hoặc cài đặt GTK runtime trên Windows."
        ) from exc

    html_string = render_to_string(
        "statistics/topics_report.html",
        {"topics": topics, "generated_at": generated_at, "filter_summary": filter_summary},
    )
    buffer = io.BytesIO()
    HTML(string=html_string).write_pdf(buffer)
    buffer.seek(0)
    return buffer
