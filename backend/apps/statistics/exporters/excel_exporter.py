"""Xuất danh sách đề tài ra file Excel (.xlsx) bằng openpyxl."""
import io

from openpyxl import Workbook
from openpyxl.styles import Font


def export_topics_to_excel(topics) -> io.BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Danh sách đề tài"

    headers = ["ID", "Tên đề tài", "Bộ môn", "Lĩnh vực", "Khóa", "Năm học", "Học kỳ", "GVHD", "Trạng thái"]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)

    for t in topics:
        ws.append(
            [
                t.id,
                t.title,
                t.department.name if t.department else "",
                t.field.name if t.field else "",
                t.cohort.name if t.cohort else "",
                t.academic_year.name if t.academic_year else "",
                t.semester.name if t.semester else "",
                t.proposed_by.get_full_name() if t.proposed_by else "",
                t.get_status_display(),
            ]
        )

    for column_cells in ws.columns:
        length = max(len(str(cell.value or "")) for cell in column_cells)
        ws.column_dimensions[column_cells[0].column_letter].width = min(length + 4, 50)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
