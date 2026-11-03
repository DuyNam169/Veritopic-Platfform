from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.common.permissions import IsTeacher
from .models import AdvisorRequest, Notification
from .serializers import (
    AdvisorRequestCreateSerializer,
    AdvisorRequestRespondSerializer,
    AdvisorRequestSerializer,
    UserSerializer,
)

User = get_user_model()


class AdvisorRequestViewSet(viewsets.ModelViewSet):
    serializer_class = AdvisorRequestSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        qs = AdvisorRequest.objects.select_related(
            "student", "student__cohort", "student__department",
            "teacher", "cohort", "semester"
        ).all()
        if user.role == "student":
            return qs.filter(student=user)
        if user.role == "teacher":
            return qs.filter(teacher=user)
        if user.role == "department_head" and user.department_id:
            return qs.filter(
                Q(teacher__department_id=user.department_id) |
                Q(student__department_id=user.department_id)
            )
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != "student":
            raise PermissionDenied("Chỉ sinh viên mới có thể gửi yêu cầu chọn Giảng viên hướng dẫn.")

        create_serializer = AdvisorRequestCreateSerializer(data=self.request.data)
        create_serializer.is_valid(raise_exception=True)
        teacher_id = create_serializer.validated_data["teacher_id"]
        message = create_serializer.validated_data.get("message", "")
        teacher = User.objects.get(pk=teacher_id)

        # Kiểm tra nếu sinh viên đã có GVHD được chấp thuận
        if AdvisorRequest.objects.filter(student=user, status=AdvisorRequest.Status.ACCEPTED).exists():
            raise ValidationError({"detail": "Bạn đã có Giảng viên hướng dẫn chính thức. Không thể gửi thêm yêu cầu."})

        # Kiểm tra nếu sinh viên đang có yêu cầu chờ xử lý tới giảng viên này
        if AdvisorRequest.objects.filter(student=user, teacher=teacher, status=AdvisorRequest.Status.PENDING).exists():
            raise ValidationError({"detail": f"Bạn đã gửi yêu cầu tới giảng viên {teacher.get_full_name() or teacher.username} và đang chờ phản hồi."})

        with transaction.atomic():
            advisor_req = AdvisorRequest.objects.create(
                student=user,
                teacher=teacher,
                cohort=user.cohort,
                message=message,
                status=AdvisorRequest.Status.PENDING,
            )
            # Tạo thông báo cho Giảng viên
            Notification.objects.create(
                recipient=teacher,
                sender=user,
                title="Yêu cầu hướng dẫn đồ án mới",
                message=f"Sinh viên {user.get_full_name() or user.username} ({user.student_code or 'N/A'}) - Khóa {user.cohort.name if user.cohort else 'N/A'} đã gửi yêu cầu chọn bạn làm Giảng viên hướng dẫn.",
                notification_type=Notification.NotificationType.ADVISOR_REQUEST,
                link="/teacher/student-requests?tab=advisors",
            )
            self._created_instance = advisor_req

    def create(self, request, *args, **kwargs):
        self.perform_create(None)
        return Response(
            AdvisorRequestSerializer(self._created_instance).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], permission_classes=[IsTeacher], url_path="respond")
    def respond(self, request, pk=None):
        advisor_req = self.get_object()
        if advisor_req.teacher_id != request.user.id and request.user.role != "admin":
            raise PermissionDenied("Chỉ giảng viên được yêu cầu mới có quyền phản hồi.")

        if advisor_req.status != AdvisorRequest.Status.PENDING:
            raise ValidationError({"detail": "Yêu cầu này đã được xử lý trước đó."})

        serializer = AdvisorRequestRespondSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resp_action = serializer.validated_data["action"]
        response_note = serializer.validated_data.get("response_note", "")

        with transaction.atomic():
            if resp_action == "accept":
                advisor_req.status = AdvisorRequest.Status.ACCEPTED
                advisor_req.response_note = response_note
                advisor_req.save(update_fields=["status", "response_note", "updated_at"])

                # Tự động hủy các yêu cầu pending khác của sinh viên này
                AdvisorRequest.objects.filter(
                    student=advisor_req.student,
                    status=AdvisorRequest.Status.PENDING,
                ).exclude(pk=advisor_req.pk).update(status=AdvisorRequest.Status.CANCELLED)

                # Gửi thông báo cho sinh viên
                note_str = f" Ghi chú: {response_note}" if response_note else ""
                Notification.objects.create(
                    recipient=advisor_req.student,
                    sender=request.user,
                    title="Giảng viên đã đồng ý hướng dẫn",
                    message=f"Giảng viên {request.user.get_full_name() or request.user.username} đã chấp nhận yêu cầu làm Giảng viên hướng dẫn đồ án của bạn.{note_str}",
                    notification_type=Notification.NotificationType.ADVISOR_RESPONSE,
                    link="/student/advisor",
                )
            else:
                advisor_req.status = AdvisorRequest.Status.REJECTED
                advisor_req.response_note = response_note
                advisor_req.save(update_fields=["status", "response_note", "updated_at"])

                # Gửi thông báo từ chối cho sinh viên
                reason_str = f" Lý do: {response_note}" if response_note else ""
                Notification.objects.create(
                    recipient=advisor_req.student,
                    sender=request.user,
                    title="Giảng viên từ chối yêu cầu hướng dẫn",
                    message=f"Giảng viên {request.user.get_full_name() or request.user.username} đã từ chối yêu cầu hướng dẫn đồ án của bạn.{reason_str}",
                    notification_type=Notification.NotificationType.ADVISOR_RESPONSE,
                    link="/student/advisor",
                )

        return Response(AdvisorRequestSerializer(advisor_req).data)

    @action(detail=False, methods=["get"], url_path="my-advisor")
    def my_advisor(self, request):
        """Lấy thông tin GVHD hiện tại của sinh viên."""
        # 1. Kiểm tra qua AdvisorRequest (đã được chấp nhận)
        req = AdvisorRequest.objects.filter(
            student=request.user,
            status=AdvisorRequest.Status.ACCEPTED,
        ).select_related("teacher", "teacher__department").first()
        if req:
            return Response({
                "has_advisor": True,
                "advisor": UserSerializer(req.teacher).data,
                "request": AdvisorRequestSerializer(req).data,
            })

        # 2. Kiểm tra nếu sinh viên đã có đề tài chính thức đang thực hiện (TopicAssignment active)
        from apps.topics.models import TopicAssignment
        active_assignment = TopicAssignment.objects.filter(
            students=request.user,
            status=TopicAssignment.Status.ACTIVE,
        ).select_related(
            "topic", "topic__proposed_by", "topic__proposed_by__department", "assigned_by", "assigned_by__department"
        ).first()

        if active_assignment:
            teacher = active_assignment.topic.proposed_by or active_assignment.assigned_by
            if teacher:
                # Đồng bộ hoặc tạo mới AdvisorRequest accepted
                advisor_req, _ = AdvisorRequest.objects.get_or_create(
                    student=request.user,
                    teacher=teacher,
                    defaults={
                        "status": AdvisorRequest.Status.ACCEPTED,
                        "message": f"Hướng dẫn qua đề tài đồ án: {active_assignment.topic.title}",
                        "response_note": "Chấp thuận qua phân công đề tài",
                    },
                )
                if advisor_req.status != AdvisorRequest.Status.ACCEPTED:
                    advisor_req.status = AdvisorRequest.Status.ACCEPTED
                    advisor_req.save(update_fields=["status", "updated_at"])

                # Hủy các yêu cầu chọn GVHD khác đang pending nếu có
                AdvisorRequest.objects.filter(
                    student=request.user,
                    status=AdvisorRequest.Status.PENDING,
                ).exclude(pk=advisor_req.pk).update(status=AdvisorRequest.Status.CANCELLED)

                return Response({
                    "has_advisor": True,
                    "advisor": UserSerializer(teacher).data,
                    "request": AdvisorRequestSerializer(advisor_req).data,
                })

        # 3. Nếu chưa có GVHD chính thức, kiểm tra xem có yêu cầu đang chờ duyệt (pending) không
        pending_req = AdvisorRequest.objects.filter(
            student=request.user,
            status=AdvisorRequest.Status.PENDING,
        ).select_related("teacher", "teacher__department").first()
        if pending_req:
            return Response({
                "has_advisor": False,
                "advisor": None,
                "request": AdvisorRequestSerializer(pending_req).data,
            })

        return Response({"has_advisor": False, "advisor": None, "request": None})

    @action(detail=False, methods=["get"], url_path="my-advisees")
    def my_advisees(self, request):
        """Giảng viên lấy danh sách SV đã chọn mình làm GVHD (AdvisorRequest accepted)."""
        if request.user.role not in ("teacher", "department_head", "admin"):
            return Response({"detail": "Chỉ giảng viên mới có thể xem danh sách này."}, status=403)

        search = request.query_params.get("search", "").casefold()
        reqs = AdvisorRequest.objects.filter(
            teacher=request.user,
            status=AdvisorRequest.Status.ACCEPTED,
        ).select_related(
            "student", "student__cohort", "student__department",
        ).order_by("-updated_at")

        data = []
        for req in reqs:
            sv = req.student
            name = sv.get_full_name() or sv.username
            if search and search not in f"{name} {sv.student_code} {sv.class_name}".casefold():
                continue
            data.append({
                "advisor_request_id": req.pk,
                "accepted_at": req.updated_at,
                "student_id": sv.pk,
                "student_name": name,
                "student_code": sv.student_code,
                "class_name": sv.class_name,
                "email": sv.email,
                "phone_number": sv.phone_number,
                "cohort_id": sv.cohort_id,
                "cohort_name": sv.cohort.name if sv.cohort else "",
                "department_id": sv.department_id,
                "department_name": sv.department.name if sv.department else "",
                "message": req.message,
            })
        return Response(data)

    @action(detail=False, methods=["get"], url_path="teachers")
    def available_teachers(self, request):
        """Danh sách Giảng viên để sinh viên chọn gửi yêu cầu."""
        dept_id = request.query_params.get("department_id")
        search = request.query_params.get("search", "")

        teachers = User.objects.filter(
            role__in=("teacher", "department_head"), is_active=True
        ).select_related("department")

        if dept_id:
            teachers = teachers.filter(department_id=dept_id)
        if search:
            teachers = teachers.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(username__icontains=search) |
                Q(lecturer_code__icontains=search)
            )

        data = []
        for t in teachers:
            # Đếm số SV đang hướng dẫn đã chấp thuận
            student_count = AdvisorRequest.objects.filter(
                teacher=t,
                status=AdvisorRequest.Status.ACCEPTED,
            ).count()
            data.append({
                "id": t.id,
                "username": t.username,
                "name": t.get_full_name() or t.username,
                "email": t.email,
                "phone_number": t.phone_number,
                "department_id": t.department_id,
                "department_name": t.department.name if t.department else "",
                "lecturer_code": t.lecturer_code,
                "academic_degree": t.academic_degree,
                "specialization": t.specialization,
                "active_student_count": student_count,
            })
        return Response(data)

