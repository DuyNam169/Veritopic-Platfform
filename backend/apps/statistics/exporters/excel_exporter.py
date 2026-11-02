"""Xuất danh sách đề tài ra file Excel (.xlsx) bằng openpyxl."""
import io

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

FONT_NAME = "Times New Roman"

TITLE_FONT = Font(name=FONT_NAME, size=13, bold=True, color="FFFFFF")
META_FONT = Font(name=FONT_NAME, size=9.5, italic=True, color="334155")
HEADER_FONT = Font(name=FONT_NAME, size=10, bold=True, color="FFFFFF")
DATA_FONT = Font(name=FONT_NAME, size=9.5, color="000000")
DATA_FONT_BOLD = Font(name=FONT_NAME, size=9.5, bold=True, color="000000")
EMPTY_FONT = Font(name=FONT_NAME, size=9.5, italic=True, color="64748B")


def _safe_cell(value):
    """Prevent values supplied by users from being interpreted as Excel formulas."""
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
        return f"'{value}"
    return value


def export_topics_to_excel(topics, *, generated_at="", filter_summary="Tất cả đề tài", students=None) -> io.BytesIO:
    wb = Workbook()
    thin = Side(style="thin", color="CBD5E1")
    border_all = Border(left=thin, right=thin, top=thin, bottom=thin)

    # ==========================================
    # SHEET 1: DANH SÁCH ĐỀ TÀI
    # ==========================================
    ws = wb.active
    ws.title = "Danh sách đề tài"

    headers = ["ID", "Tên đề tài", "Bộ môn", "Lĩnh vực", "Khóa", "Năm học", "Học kỳ", "GVHD", "Trạng thái"]
    ws.merge_cells("A1:I1")
    ws["A1"] = "BÁO CÁO DANH SÁCH ĐỀ TÀI"
    ws["A1"].font = TITLE_FONT
    ws["A1"].fill = PatternFill("solid", fgColor="1E3A8A")
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 26

    ws.merge_cells("A2:I2")
    ws["A2"] = f"Thời điểm xuất: {generated_at}"
    ws["A2"].font = META_FONT
    ws.row_dimensions[2].height = 18

    ws.merge_cells("A3:I3")
    ws["A3"] = f"Phạm vi dữ liệu: {filter_summary}"
    ws["A3"].font = META_FONT
    ws["A3"].alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[3].height = 18

    ws.append(headers)
    header_row = 4
    ws.row_dimensions[header_row].height = 24
    for cell in ws[header_row]:
        cell.font = HEADER_FONT
        cell.fill = PatternFill("solid", fgColor="2563EB")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border_all

    row_count = 0
    center_cols_s1 = {1, 5, 6, 7, 9}  # ID, Khóa, Năm học, Học kỳ, Trạng thái (1-based index)
    for t in topics:
        row_count += 1
        ws.append(
            [
                t.id,
                _safe_cell(t.title),
                t.department.name if t.department else "",
                t.field.name if t.field else "",
                t.cohort.name if t.cohort else "",
                t.academic_year.name if t.academic_year else "",
                t.semester.name if t.semester else "",
                _safe_cell((t.proposed_by.get_full_name() or t.proposed_by.username) if t.proposed_by else ""),
                t.get_status_display(),
            ]
        )

    if row_count == 0:
        ws.merge_cells("A5:I5")
        ws["A5"] = "Không có đề tài phù hợp với điều kiện lọc."
        ws["A5"].alignment = Alignment(horizontal="center", vertical="center")
        ws["A5"].font = EMPTY_FONT
        ws["A5"].border = border_all
    else:
        for row in ws.iter_rows(min_row=5):
            for col_idx, cell in enumerate(row, start=1):
                cell.border = border_all
                cell.font = DATA_FONT
                h_align = "center" if col_idx in center_cols_s1 else "left"
                cell.alignment = Alignment(horizontal=h_align, vertical="center", wrap_text=True)

    widths = [8, 40, 22, 20, 10, 14, 14, 24, 18]
    for index, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(index)].width = width
    ws.freeze_panes = "A5"
    ws.auto_filter.ref = f"A4:I{max(ws.max_row, 4)}"
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.print_title_rows = "1:4"

    # ==========================================
    # SHEET 2: SINH VIÊN HƯỚNG DẪN (NẾU CÓ)
    # ==========================================
    if students is not None:
        ws_sv = wb.create_sheet(title="Sinh viên hướng dẫn")
        headers_sv = ["STT", "Mã SV", "Họ và tên", "Lớp", "Khóa", "Bộ môn", "Đề tài đồ án", "Tiến độ", "Trạng thái", "Tình trạng nộp bài"]
        ws_sv.merge_cells("A1:J1")
        ws_sv["A1"] = "DANH SÁCH SINH VIÊN HƯỚNG DẪN & TIẾN ĐỘ ĐỒ ÁN"
        ws_sv["A1"].font = TITLE_FONT
        ws_sv["A1"].fill = PatternFill("solid", fgColor="006A60")
        ws_sv["A1"].alignment = Alignment(horizontal="center", vertical="center")
        ws_sv.row_dimensions[1].height = 26

        ws_sv.merge_cells("A2:J2")
        ws_sv["A2"] = f"Thời điểm xuất: {generated_at}"
        ws_sv["A2"].font = META_FONT
        ws_sv.row_dimensions[2].height = 18

        ws_sv.merge_cells("A3:J3")
        ws_sv["A3"] = f"Phạm vi: {filter_summary}"
        ws_sv["A3"].font = META_FONT
        ws_sv["A3"].alignment = Alignment(wrap_text=True, vertical="center")
        ws_sv.row_dimensions[3].height = 18

        ws_sv.append(headers_sv)
        ws_sv.row_dimensions[4].height = 24
        for cell in ws_sv[4]:
            cell.font = HEADER_FONT
            cell.fill = PatternFill("solid", fgColor="0F766E")
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = border_all

        for idx, s in enumerate(students, start=1):
            if s.get("is_late"):
                warning = "Trễ hạn nộp"
            elif s.get("has_pending_feedback"):
                warning = "Chờ GV nhận xét"
            elif s.get("reports_count", 0) > 0:
                warning = "Đúng tiến độ"
            else:
                warning = "Chưa có báo cáo"

            ws_sv.append([
                idx,
                _safe_cell(s.get("student_code", "")),
                _safe_cell(s.get("student_name", "")),
                _safe_cell(s.get("class_name", "")),
                s.get("cohort_name", ""),
                s.get("department_name", ""),
                _safe_cell(s.get("topic_title") or "Chưa giao đề tài"),
                f"{s.get('latest_percent', 0)}%",
                s.get("assignment_status_display", ""),
                warning,
            ])

        if len(students) == 0:
            ws_sv.merge_cells("A5:J5")
            ws_sv["A5"] = "Chưa có sinh viên hướng dẫn phù hợp."
            ws_sv["A5"].alignment = Alignment(horizontal="center", vertical="center")
            ws_sv["A5"].font = EMPTY_FONT
            ws_sv["A5"].border = border_all
        else:
            center_cols_s2 = {1, 2, 4, 5, 8, 9, 10}  # STT, Mã SV, Lớp, Khóa, Tiến độ, Trạng thái, Cảnh báo (1-based index)
            for row in ws_sv.iter_rows(min_row=5):
                for col_idx, cell in enumerate(row, start=1):
                    cell.border = border_all
                    # Họ và tên hoặc Tiến độ cho đậm nhẹ
                    if col_idx in (3, 8):
                        cell.font = DATA_FONT_BOLD
                    else:
                        cell.font = DATA_FONT
                    h_align = "center" if col_idx in center_cols_s2 else "left"
                    cell.alignment = Alignment(horizontal=h_align, vertical="center", wrap_text=True)

        widths_sv = [6, 14, 24, 14, 10, 22, 38, 12, 16, 18]
        for index, width in enumerate(widths_sv, start=1):
            ws_sv.column_dimensions[get_column_letter(index)].width = width
        ws_sv.freeze_panes = "A5"
        ws_sv.auto_filter.ref = f"A4:J{max(ws_sv.max_row, 4)}"
        ws_sv.sheet_properties.pageSetUpPr.fitToPage = True
        ws_sv.page_setup.orientation = "landscape"
        ws_sv.page_setup.fitToWidth = 1
        ws_sv.page_setup.fitToHeight = 0
        ws_sv.print_title_rows = "1:4"

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
