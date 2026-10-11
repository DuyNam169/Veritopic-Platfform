from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.common.permissions import IsTeacher
from apps.accounts.serializers import UserSerializer
from apps.common.access import scope_assignments
from .models import TopicAssignment


class AssignableStudentsView(APIView):
    permission_classes = (IsTeacher,)

    def get(self, request):
        qs = get_user_model().objects.filter(role="student", is_active=True, student_status="active")
        if request.user.department_id:
            qs = qs.filter(department_id=request.user.department_id)
        semester = request.query_params.get("semester_id")
        if semester:
            qs = qs.exclude(assigned_topics__status="active", assigned_topics__topic__semester_id=semester)
        search = request.query_params.get("search", "")
        if search:
            qs = qs.filter(Q(first_name__icontains=search) | Q(last_name__icontains=search) | Q(student_code__icontains=search) | Q(username__icontains=search))
        return Response(UserSerializer(qs.distinct().order_by("id"), many=True).data)


class MyStudentsView(APIView):
    permission_classes = (IsTeacher,)

    def get(self, request):
        assignments = scope_assignments(TopicAssignment.objects.select_related("topic").prefetch_related("students", "reports"), request.user)
        data = []
        search = request.query_params.get("search", "").casefold()
        for assignment in assignments:
            latest = assignment.reports.first()
            for student in assignment.students.all():
                name = student.get_full_name() or student.username
                if search and search not in f"{name} {student.student_code} {assignment.topic.title}".casefold():
                    continue
                data.append({"assignment_id": assignment.pk, "assignment_status": assignment.status,
                    "assignment_status_display": assignment.get_status_display(), "due_date": assignment.due_date,
                    "topic_id": assignment.topic_id, "topic_title": assignment.topic.title,
                    "student_id": student.pk, "student_name": name, "student_code": student.student_code,
                    "class_name": student.class_name, "email": student.email, "phone_number": student.phone_number,
                    "latest_percent": latest.percent if latest else 0, "latest_submitted_at": latest.submitted_at if latest else None})
        return Response(data)
