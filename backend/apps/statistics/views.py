from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdminOrTeacher
from apps.academics.models import AcademicYear, Cohort, Department, Field, Semester
from apps.topics.models import Topic

from .exporters.excel_exporter import export_topics_to_excel
from .exporters.pdf_exporter import export_topics_to_pdf


def _filtered_topics(request):
    qs = Topic.objects.select_related("department", "field", "cohort", "academic_year", "semester", "proposed_by")
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        if user.role == "teacher":
            qs = qs.filter(proposed_by=user)
        elif user.role == "department_head" and user.department_id:
            qs = qs.filter(department_id=user.department_id)

    for param, field in (
        ("academic_year", "academic_year_id"),
        ("cohort", "cohort_id"),
        ("department", "department_id"),
        ("field", "field_id"),
        ("semester", "semester_id"),
        ("proposed_by", "proposed_by_id"),
        ("status", "status"),
    ):
        if param == "proposed_by" and user and user.is_authenticated and user.role == "teacher":
            continue
        if param == "department" and user and user.is_authenticated and user.role == "department_head" and user.department_id:
            continue
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
    user = getattr(request, "user", None)
    if user and user.is_authenticated and user.role == "teacher":
        filters.append(f"Giảng viên: {user.get_full_name() or user.username}")
    elif user and user.is_authenticated and user.role == "department_head" and getattr(user, "department", None):
        filters.append(f"Bộ môn: {user.department.name}")

    catalog_filters = (
        ("academic_year", "Năm học", AcademicYear),
        ("cohort", "Khóa học", Cohort),
        ("department", "Bộ môn", Department),
        ("field", "Lĩnh vực", Field),
        ("semester", "Học kỳ", Semester),
    )
    for param, label, model in catalog_filters:
        if param == "department" and user and user.is_authenticated and user.role == "department_head" and user.department_id:
            continue
        value = request.query_params.get(param)
        if value:
            obj = model.objects.filter(pk=value).first()
            filters.append(f"{label}: {obj.name if obj else value}")

    if not (user and user.is_authenticated and user.role == "teacher"):
        proposed_by = request.query_params.get("proposed_by")
        if proposed_by:
            user_obj = get_user_model().objects.filter(pk=proposed_by).first()
            filters.append(f"Giảng viên: {(user_obj.get_full_name() or user_obj.username) if user_obj else proposed_by}")

    status = request.query_params.get("status")
    if status:
        filters.append(f"Trạng thái: {dict(Topic.Status.choices).get(status, status)}")
    search = request.query_params.get("search", "").strip()
    if search:
        filters.append(f'Từ khóa: "{search}"')

    if user and user.is_authenticated and user.role == "teacher":
        default_summary = f"Đề tài của giảng viên {user.get_full_name() or user.username}"
    else:
        default_summary = "Tất cả đề tài"

    return {
        "generated_at": timezone.localtime().strftime("%d/%m/%Y %H:%M"),
        "filter_summary": "; ".join(filters) if filters else default_summary,
    }


def _get_teacher_students_metrics(teacher_user):
    """
    Tính toán số liệu thống kê sinh viên hướng dẫn của giảng viên:
    - Danh sách sinh viên từ 2 nguồn: AdvisorRequest (đã accepted) và TopicAssignment (đề tài do GV đề xuất/giao).
    - Thống kê tiến độ, tình trạng trễ hạn, báo cáo chờ nhận xét, phân bố theo khóa, trạng thái đồ án.
    """
    from apps.accounts.models import AdvisorRequest
    from apps.topics.models import TopicAssignment

    advisor_reqs = AdvisorRequest.objects.filter(
        teacher=teacher_user,
        status=AdvisorRequest.Status.ACCEPTED,
    ).select_related("student", "student__cohort", "student__department")

    assignments = TopicAssignment.objects.filter(
        Q(topic__proposed_by=teacher_user) | Q(assigned_by=teacher_user)
    ).select_related(
        "topic", "topic__cohort", "topic__department", "topic__academic_year"
    ).prefetch_related(
        "students__cohort",
        "students__department",
        "reports",
        "reports__feedbacks",
    ).distinct()

    student_map = {}

    for req in advisor_reqs:
        s = req.student
        cohort = s.cohort or req.cohort
        dept = s.department
        student_map[s.id] = {
            "student_id": s.id,
            "student_name": s.get_full_name() or s.username,
            "student_code": s.student_code or "",
            "class_name": s.class_name or "",
            "email": s.email or "",
            "phone_number": s.phone_number or "",
            "cohort_name": cohort.name if cohort else "Chưa phân khóa",
            "department_name": dept.name if dept else "Chưa phân bộ môn",
            "has_topic": False,
            "topic_id": None,
            "topic_title": None,
            "assignment_id": None,
            "assignment_status": "unassigned",
            "assignment_status_display": "Chưa giao đề tài",
            "latest_percent": 0,
            "latest_submitted_at": None,
            "reports_count": 0,
            "is_late": False,
            "has_pending_feedback": False,
        }

    for assignment in assignments:
        reports = list(assignment.reports.all())
        latest_report = reports[0] if reports else None
        has_late = any(r.is_late for r in reports)
        has_pending = any(
            not any(f.teacher_id == teacher_user.id for f in r.feedbacks.all())
            for r in reports
        )

        for s in assignment.students.all():
            cohort = s.cohort or assignment.topic.cohort
            dept = s.department or assignment.topic.department
            student_map[s.id] = {
                "student_id": s.id,
                "student_name": s.get_full_name() or s.username,
                "student_code": s.student_code or "",
                "class_name": s.class_name or "",
                "email": s.email or "",
                "phone_number": s.phone_number or "",
                "cohort_name": cohort.name if cohort else "Chưa phân khóa",
                "department_name": dept.name if dept else "Chưa phân bộ môn",
                "has_topic": True,
                "topic_id": assignment.topic_id,
                "topic_title": assignment.topic.title,
                "assignment_id": assignment.id,
                "assignment_status": assignment.status,
                "assignment_status_display": assignment.get_status_display(),
                "latest_percent": latest_report.percent if latest_report else 0,
                "latest_submitted_at": latest_report.submitted_at.strftime("%d/%m/%Y %H:%M") if latest_report else None,
                "reports_count": len(reports),
                "is_late": has_late,
                "has_pending_feedback": has_pending,
            }

    students_list = sorted(student_map.values(), key=lambda x: (x["assignment_status"] != "active", x["student_name"]))

    total_students = len(students_list)
    assigned_count = sum(1 for s in students_list if s["has_topic"])
    unassigned_count = total_students - assigned_count
    active_count = sum(1 for s in students_list if s["assignment_status"] == "active")
    completed_count = sum(1 for s in students_list if s["assignment_status"] == "completed")

    with_topic_students = [s for s in students_list if s["has_topic"]]
    avg_progress = (
        round(sum(s["latest_percent"] for s in with_topic_students) / len(with_topic_students), 1)
        if with_topic_students else 0
    )

    late_students_count = sum(1 for s in students_list if s["is_late"])
    pending_feedback_count = sum(1 for s in students_list if s["has_pending_feedback"])

    cohort_counts = {}
    for s in students_list:
        c = s["cohort_name"]
        cohort_counts[c] = cohort_counts.get(c, 0) + 1
    by_cohort = [{"label": k, "count": v} for k, v in sorted(cohort_counts.items())]

    by_status = [
        {"status": "active", "label": "Đang làm đồ án", "count": active_count},
        {"status": "completed", "label": "Đã hoàn thành", "count": completed_count},
        {"status": "unassigned", "label": "Chờ giao đề tài", "count": unassigned_count},
    ]

    progress_ranges = {"0-25%": 0, "26-50%": 0, "51-75%": 0, "76-100%": 0}
    for s in with_topic_students:
        p = s["latest_percent"]
        if p <= 25:
            progress_ranges["0-25%"] += 1
        elif p <= 50:
            progress_ranges["26-50%"] += 1
        elif p <= 75:
            progress_ranges["51-75%"] += 1
        else:
            progress_ranges["76-100%"] += 1
    by_progress = [{"label": k, "count": v} for k, v in progress_ranges.items()]

    return {
        "total_students": total_students,
        "assigned_topic_count": assigned_count,
        "unassigned_topic_count": unassigned_count,
        "active_students_count": active_count,
        "completed_students_count": completed_count,
        "average_progress": avg_progress,
        "late_students_count": late_students_count,
        "pending_feedback_count": pending_feedback_count,
        "by_cohort": by_cohort,
        "by_status": by_status,
        "by_progress": by_progress,
        "students_list": students_list,
    }


class StatisticsOverviewView(APIView):
    """
    GET /api/v1/statistics/overview/
    Thống kê số đề tài theo: năm học, khóa, giảng viên, lĩnh vực, trạng thái.
    Khi người dùng là Giảng viên (hoặc lọc theo Giảng viên cụ thể): bổ sung thống kê sinh viên hướng dẫn & tiến độ.
    """
    permission_classes = (IsAdminOrTeacher,)

    def get(self, request):
        qs = _filtered_topics(request)
        overview_data = {
            "total": qs.count(),
            "by_academic_year": list(qs.values("academic_year__name").annotate(count=Count("id")).order_by("academic_year__name")),
            "by_cohort": list(qs.values("cohort__name").annotate(count=Count("id")).order_by("cohort__name")),
            "by_teacher": list(qs.values("proposed_by__id", "proposed_by__username", "proposed_by__first_name", "proposed_by__last_name").annotate(count=Count("id")).order_by("proposed_by__username")),
            "by_field": list(qs.values("field__name").annotate(count=Count("id")).order_by("field__name")),
            "by_status": list(qs.values("status").annotate(count=Count("id")).order_by("status")),
            "students_overview": None,
        }

        if request.user.role == "teacher":
            overview_data["students_overview"] = _get_teacher_students_metrics(request.user)
        else:
            proposed_by_id = request.query_params.get("proposed_by")
            if proposed_by_id:
                teacher = get_user_model().objects.filter(pk=proposed_by_id, role="teacher").first()
                if teacher:
                    overview_data["students_overview"] = _get_teacher_students_metrics(teacher)

        return Response(overview_data)


class ExportTopicsView(APIView):
    """
    GET /api/v1/statistics/export/?export_format=excel|pdf&<bộ lọc giống overview>

    LƯU Ý: tham số dùng tên "export_format", KHÔNG dùng "format" — "format" là tên
    tham số DRF dành riêng để chọn renderer nội bộ (?format=json/api). Nếu đặt tên
    trùng, DRF sẽ tự raise Http404 khi giá trị không khớp renderer nào đã đăng ký
    (ví dụ "excel"/"pdf"), gây lỗi 404 khó hiểu dù routing và logic view đều đúng.
    """
    permission_classes = (IsAdminOrTeacher,)

    def get(self, request):
        export_format = request.query_params.get("export_format", "excel")
        topics = _filtered_topics(request)
        metadata = _report_metadata(request)

        students_data = None
        if request.user.role == "teacher":
            students_metrics = _get_teacher_students_metrics(request.user)
            students_data = students_metrics["students_list"]
        else:
            proposed_by_id = request.query_params.get("proposed_by")
            if proposed_by_id:
                teacher = get_user_model().objects.filter(pk=proposed_by_id, role="teacher").first()
                if teacher:
                    students_data = _get_teacher_students_metrics(teacher)["students_list"]

        if export_format == "pdf":
            buffer = export_topics_to_pdf(topics, students=students_data, **metadata)
            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = 'attachment; filename="danh_sach_de_tai.pdf"'
            return response

        if export_format != "excel":
            raise ValidationError({"export_format": "Định dạng chỉ có thể là excel hoặc pdf."})

        buffer = export_topics_to_excel(topics, students=students_data, **metadata)
        response = HttpResponse(
            buffer.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="danh_sach_de_tai.xlsx"'
        return response
