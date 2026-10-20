from django.db import transaction
from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.models import Notification
from apps.common.permissions import IsTeacher
from .models import (
    StudentTopicProposal,
    Topic,
    TopicAssignment,
    TopicHistory,
    TopicRegistration,
)
from .serializers import (
    StudentTopicProposalCreateSerializer,
    StudentTopicProposalRespondSerializer,
    StudentTopicProposalSerializer,
    TopicAssignmentSerializer,
    TopicRegistrationCreateSerializer,
    TopicRegistrationRespondSerializer,
    TopicRegistrationSerializer,
)
from .services.workflow import assign_topic, propose_topic


class StudentTopicProposalViewSet(viewsets.ModelViewSet):
    """
    API Quản lý đề xuất đề tài do sinh viên tự khởi tạo gửi lên GVHD.
    """
    serializer_class = StudentTopicProposalSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        qs = StudentTopicProposal.objects.select_related(
            "student", "student__cohort", "student__department",
            "teacher", "department", "field", "cohort", "academic_year", "semester", "created_topic"
        ).all()
        if user.role == "student":
            return qs.filter(student=user)
        if user.role == "teacher":
            return qs.filter(teacher=user)
        if user.role == "department_head" and user.department_id:
            return qs.filter(department_id=user.department_id)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != "student":
            raise PermissionDenied("Chỉ sinh viên mới có quyền đề xuất đề tài.")

        # Quy tắc 1: 1 sinh viên chỉ được có 1 đề tài đồ án
        if TopicAssignment.objects.filter(students=user, status="active").exists():
            raise ValidationError({"detail": "Bạn đã có một đề tài đồ án đang thực hiện, không thể đề xuất thêm."})

        if StudentTopicProposal.objects.filter(student=user, status=StudentTopicProposal.Status.PENDING).exists():
            raise ValidationError({"detail": "Bạn đã có một đề xuất đề tài đang chờ giảng viên xử lý. Vui lòng chờ phản hồi."})

        create_serializer = StudentTopicProposalCreateSerializer(data=self.request.data)
        create_serializer.is_valid(raise_exception=True)
        data = create_serializer.validated_data

        with transaction.atomic():
            proposal = StudentTopicProposal.objects.create(
                student=user,
                teacher=data["teacher"],
                title=data["title"].strip(),
                description=data.get("description", ""),
                expected_technologies=data.get("expected_technologies", ""),
                department=data["department"],
                field=data.get("field"),
                cohort=data["cohort"],
                academic_year=data["academic_year"],
                semester=data["semester"],
                status=StudentTopicProposal.Status.PENDING,
            )

            # Gửi thông báo cho giảng viên
            Notification.objects.create(
                recipient=data["teacher"],
                sender=user,
                title="Đề xuất đề tài đồ án mới từ sinh viên",
                message=f"Sinh viên {user.get_full_name() or user.username} ({user.student_code or 'N/A'}) đã đề xuất đề tài: '{proposal.title}'. Vui lòng xem xét.",
                notification_type=Notification.NotificationType.TOPIC_PROPOSAL,
                link="/teacher/student-requests",
            )
            self._created_instance = proposal

    def create(self, request, *args, **kwargs):
        self.perform_create(None)
        return Response(
            StudentTopicProposalSerializer(self._created_instance).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], permission_classes=[IsTeacher], url_path="respond")
    def respond(self, request, pk=None):
        proposal = self.get_object()
        if proposal.teacher_id != request.user.id and request.user.role != "admin":
            raise PermissionDenied("Chỉ giảng viên được đề xuất mới có quyền xử lý đề tài này.")

        if proposal.status != StudentTopicProposal.Status.PENDING and proposal.status != StudentTopicProposal.Status.REVISION_REQUESTED:
            raise ValidationError({"detail": "Đề xuất này đã được hoàn tất xử lý trước đó."})

        serializer = StudentTopicProposalRespondSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_type = serializer.validated_data["action"]
        teacher_note = serializer.validated_data.get("teacher_note", "")

        with transaction.atomic():
            if action_type == "approve":
                # Kiểm tra lại xem sinh viên đã có đề tài nào khác chưa
                if TopicAssignment.objects.filter(students=proposal.student, status="active").exists():
                    raise ValidationError({"detail": "Sinh viên này đã có đề tài đồ án khác đang thực hiện."})

                # Tạo Topic chính thức gửi lên Trưởng bộ môn
                topic = Topic.objects.create(
                    title=proposal.title,
                    description=proposal.description,
                    department=proposal.department,
                    field=proposal.field,
                    cohort=proposal.cohort,
                    academic_year=proposal.academic_year,
                    semester=proposal.semester,
                    proposed_by=request.user,
                    created_by=proposal.student,
                    status=Topic.Status.PENDING,
                )
                propose_topic(topic, actor=request.user)

                # Tự động gán sinh viên vào đề tài này
                assignment = TopicAssignment.objects.create(
                    topic=topic,
                    assigned_by=request.user,
                    note="Đề tài do sinh viên đề xuất và được GVHD chấp thuận.",
                )
                assignment.students.set([proposal.student])

                proposal.status = StudentTopicProposal.Status.APPROVED
                proposal.teacher_note = teacher_note
                proposal.created_topic = topic
                proposal.save(update_fields=["status", "teacher_note", "created_topic", "updated_at"])

                # Hủy các đăng ký đề tài khác đang chờ của sinh viên này
                TopicRegistration.objects.filter(
                    student=proposal.student,
                    status=TopicRegistration.Status.PENDING,
                ).update(status=TopicRegistration.Status.CANCELLED)

                note_info = f" Ghi chú: {teacher_note}" if teacher_note else ""
                Notification.objects.create(
                    recipient=proposal.student,
                    sender=request.user,
                    title="Đề xuất đề tài đã được GVHD duyệt",
                    message=f"Giảng viên {request.user.get_full_name() or request.user.username} đã chấp thuận đề tài '{proposal.title}' và chuyển lên Trưởng bộ môn phê duyệt.{note_info}",
                    notification_type=Notification.NotificationType.TOPIC_PROPOSAL_RESPONSE,
                    link="/projects",
                )
            elif action_type == "revision_requested":
                proposal.status = StudentTopicProposal.Status.REVISION_REQUESTED
                proposal.teacher_note = teacher_note
                proposal.save(update_fields=["status", "teacher_note", "updated_at"])

                Notification.objects.create(
                    recipient=proposal.student,
                    sender=request.user,
                    title="Yêu cầu chỉnh sửa đề xuất đề tài",
                    message=f"Giảng viên {request.user.get_full_name() or request.user.username} yêu cầu bạn chỉnh sửa đề tài '{proposal.title}'. Nhận xét: {teacher_note}",
                    notification_type=Notification.NotificationType.TOPIC_PROPOSAL_RESPONSE,
                    link="/student/proposals",
                )
            else:
                proposal.status = StudentTopicProposal.Status.REJECTED
                proposal.teacher_note = teacher_note
                proposal.save(update_fields=["status", "teacher_note", "updated_at"])

                reason_info = f" Lý do: {teacher_note}" if teacher_note else ""
                Notification.objects.create(
                    recipient=proposal.student,
                    sender=request.user,
                    title="Đề xuất đề tài bị từ chối",
                    message=f"Giảng viên {request.user.get_full_name() or request.user.username} đã từ chối đề tài '{proposal.title}'.{reason_info}",
                    notification_type=Notification.NotificationType.TOPIC_PROPOSAL_RESPONSE,
                    link="/student/proposals",
                )

        return Response(StudentTopicProposalSerializer(proposal).data)


class TopicRegistrationViewSet(viewsets.ModelViewSet):
    """
    API cho sinh viên đăng ký (chọn) đề tài có sẵn từ danh mục đã duyệt.
    Áp dụng 2 quy tắc:
    1. 1 sinh viên chỉ được chọn 1 đề tài.
    2. Không sinh viên nào cùng khóa chọn chung 1 đề tài.
    """
    serializer_class = TopicRegistrationSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        qs = TopicRegistration.objects.select_related(
            "topic", "topic__cohort", "topic__proposed_by",
            "student", "student__cohort", "student__department"
        ).all()
        if user.role == "student":
            return qs.filter(student=user)
        if user.role == "teacher":
            return qs.filter(topic__proposed_by=user)
        if user.role == "department_head" and user.department_id:
            return qs.filter(topic__department_id=user.department_id)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role != "student":
            raise PermissionDenied("Chỉ sinh viên mới có quyền đăng ký đề tài.")

        create_serializer = TopicRegistrationCreateSerializer(data=self.request.data)
        create_serializer.is_valid(raise_exception=True)
        topic_id = create_serializer.validated_data["topic_id"]
        note = create_serializer.validated_data.get("note", "")

        topic = Topic.objects.select_related("cohort", "proposed_by").get(pk=topic_id)

        # -------------------------------------------------------------
        # QUY TẮC 1: 1 sinh viên chỉ được chọn 1 đề tài đồ án
        # -------------------------------------------------------------
        if TopicAssignment.objects.filter(students=user, status="active").exists():
            raise ValidationError({"detail": "Bạn đã có một đề tài đồ án đang thực hiện. Không thể đăng ký thêm đề tài khác."})

        if TopicRegistration.objects.filter(student=user, status__in=[TopicRegistration.Status.PENDING, TopicRegistration.Status.APPROVED]).exists():
            raise ValidationError({"detail": "Bạn đã có một yêu cầu đăng ký đề tài đang chờ xử lý hoặc đã duyệt."})

        if StudentTopicProposal.objects.filter(student=user, status=StudentTopicProposal.Status.PENDING).exists():
            raise ValidationError({"detail": "Bạn đang có đề xuất đề tài chờ giảng viên duyệt, không thể đăng ký đề tài khác."})

        # -------------------------------------------------------------
        # QUY TẮC 2: Không sinh viên nào cùng khóa chọn chung 1 đề tài
        # -------------------------------------------------------------
        cohort = user.cohort
        cohort_name = cohort.name if cohort else "cùng khóa"

        if cohort:
            # Kiểm tra xem đề tài này đã được giao cho sinh viên nào cùng khóa chưa
            same_cohort_assigned = TopicAssignment.objects.filter(
                topic=topic,
                status="active",
                students__cohort=cohort,
            ).exists()
            if same_cohort_assigned:
                raise ValidationError({"detail": f"Đề tài này đã có sinh viên thuộc khóa {cohort_name} thực hiện. Mỗi đề tài chỉ dành cho 1 sinh viên/nhóm của khóa đó."})

            # Kiểm tra xem có sinh viên nào cùng khóa đang có đăng ký pending/approved cho đề tài này chưa
            same_cohort_registered = TopicRegistration.objects.filter(
                topic=topic,
                status__in=[TopicRegistration.Status.PENDING, TopicRegistration.Status.APPROVED],
                student__cohort=cohort,
            ).exclude(student=user).exists()
            if same_cohort_registered:
                raise ValidationError({"detail": f"Đề tài này đã có sinh viên cùng khóa {cohort_name} đăng ký. Vui lòng chọn đề tài khác."})

        with transaction.atomic():
            reg = TopicRegistration.objects.create(
                topic=topic,
                student=user,
                note=note,
                status=TopicRegistration.Status.PENDING,
            )

            # Gửi thông báo cho GVHD đề tài
            Notification.objects.create(
                recipient=topic.proposed_by,
                sender=user,
                title="Đăng ký đề tài mới từ sinh viên",
                message=f"Sinh viên {user.get_full_name() or user.username} ({user.student_code or 'N/A'}) khóa {cohort_name} đã đăng ký thực hiện đề tài '{topic.title}'.",
                notification_type=Notification.NotificationType.TOPIC_REGISTRATION,
                link="/teacher/student-requests",
            )
            self._created_instance = reg

    def create(self, request, *args, **kwargs):
        self.perform_create(None)
        return Response(
            TopicRegistrationSerializer(self._created_instance).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], permission_classes=[IsTeacher], url_path="respond")
    def respond(self, request, pk=None):
        reg = self.get_object()
        if reg.topic.proposed_by_id != request.user.id and request.user.role != "admin":
            raise PermissionDenied("Chỉ giảng viên phụ trách đề tài mới có quyền duyệt đăng ký này.")

        if reg.status != TopicRegistration.Status.PENDING:
            raise ValidationError({"detail": "Yêu cầu đăng ký này đã được xử lý trước đó."})

        serializer = TopicRegistrationRespondSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resp_action = serializer.validated_data["action"]
        teacher_note = serializer.validated_data.get("teacher_note", "")

        with transaction.atomic():
            if resp_action == "approve":
                # Kiểm tra lại ràng buộc trước khi chốt
                if TopicAssignment.objects.filter(students=reg.student, status="active").exists():
                    raise ValidationError({"detail": "Sinh viên này đã có đề tài đồ án đang thực hiện."})

                cohort = reg.student.cohort
                if cohort:
                    same_cohort_assigned = TopicAssignment.objects.filter(
                        topic=reg.topic,
                        status="active",
                        students__cohort=cohort,
                    ).exists()
                    if same_cohort_assigned:
                        raise ValidationError({"detail": f"Đề tài này đã có sinh viên thuộc khóa {cohort.name} thực hiện."})

                # Giao đề tài cho sinh viên
                assignment, _ = TopicAssignment.objects.get_or_create(
                    topic=reg.topic,
                    defaults={
                        "assigned_by": request.user,
                        "note": f"Đăng ký đề tài được chấp thuận. {teacher_note}".strip(),
                    },
                )
                assignment.students.add(reg.student)

                TopicHistory.objects.create(
                    topic=reg.topic,
                    action=TopicHistory.Action.ASSIGNED,
                    actor=request.user,
                    note=f"Chấp nhận đăng ký của sinh viên {reg.student.get_full_name() or reg.student.username}.",
                )

                reg.status = TopicRegistration.Status.APPROVED
                reg.teacher_note = teacher_note
                reg.save(update_fields=["status", "teacher_note", "updated_at"])

                # Hủy các đăng ký khác của sinh viên này
                TopicRegistration.objects.filter(
                    student=reg.student,
                    status=TopicRegistration.Status.PENDING,
                ).exclude(pk=reg.pk).update(status=TopicRegistration.Status.CANCELLED)

                # Từ chối các đăng ký của sinh viên cùng khóa đối với đề tài này
                if cohort:
                    TopicRegistration.objects.filter(
                        topic=reg.topic,
                        status=TopicRegistration.Status.PENDING,
                        student__cohort=cohort,
                    ).exclude(pk=reg.pk).update(
                        status=TopicRegistration.Status.REJECTED,
                        teacher_note=f"Đề tài đã được giao cho một sinh viên khác thuộc khóa {cohort.name}."
                    )

                Notification.objects.create(
                    recipient=reg.student,
                    sender=request.user,
                    title="Đăng ký đề tài đã được chấp thuận",
                    message=f"Giảng viên {request.user.get_full_name() or request.user.username} đã đồng ý cho bạn thực hiện đề tài '{reg.topic.title}'.",
                    notification_type=Notification.NotificationType.TOPIC_REGISTRATION_RESPONSE,
                    link="/projects",
                )
            else:
                reg.status = TopicRegistration.Status.REJECTED
                reg.teacher_note = teacher_note
                reg.save(update_fields=["status", "teacher_note", "updated_at"])

                reason_str = f" Lý do: {teacher_note}" if teacher_note else ""
                Notification.objects.create(
                    recipient=reg.student,
                    sender=request.user,
                    title="Đăng ký đề tài bị từ chối",
                    message=f"Giảng viên {request.user.get_full_name() or request.user.username} đã từ chối yêu cầu đăng ký đề tài '{reg.topic.title}' của bạn.{reason_str}",
                    notification_type=Notification.NotificationType.TOPIC_REGISTRATION_RESPONSE,
                    link="/topics",
                )

        return Response(TopicRegistrationSerializer(reg).data)

    @action(detail=False, methods=["get"], url_path="my-topic-status")
    def my_topic_status(self, request):
        """
        Tổng quan tình trạng đề tài của sinh viên đang đăng nhập:
        - Đã có đề tài chính thức chưa?
        - Có đăng ký nào đang chờ không?
        - Có đề xuất nào đang chờ không?
        - Có thể chọn đề tài mới không?
        """
        user = request.user
        if user.role != "student":
            return Response({"detail": "Chỉ áp dụng cho sinh viên."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Active assignment
        active_assignment = TopicAssignment.objects.filter(
            students=user,
            status="active",
        ).select_related("topic", "topic__proposed_by", "assigned_by").first()

        # 2. Pending registration
        pending_reg = TopicRegistration.objects.filter(
            student=user,
            status=TopicRegistration.Status.PENDING,
        ).select_related("topic", "topic__proposed_by").first()

        # 3. Pending or revision proposal
        pending_prop = StudentTopicProposal.objects.filter(
            student=user,
            status__in=[StudentTopicProposal.Status.PENDING, StudentTopicProposal.Status.REVISION_REQUESTED],
        ).select_related("teacher", "department").first()

        has_topic = active_assignment is not None
        can_choose_topic = not has_topic and pending_reg is None and pending_prop is None

        return Response({
            "has_topic": has_topic,
            "can_choose_topic": can_choose_topic,
            "cohort_name": user.cohort.name if user.cohort else "Chưa phân khóa",
            "active_assignment": TopicAssignmentSerializer(active_assignment).data if active_assignment else None,
            "pending_registration": TopicRegistrationSerializer(pending_reg).data if pending_reg else None,
            "pending_proposal": StudentTopicProposalSerializer(pending_prop).data if pending_prop else None,
        })
