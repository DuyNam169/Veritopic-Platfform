from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import UserSerializer
from apps.common.permissions import IsTeacher, IsTopicOwner

from .models import Topic, TopicAssignment
from .serializers import (
    AssignTopicSerializer,
    ResubmitTopicSerializer,
    SimilarityCheckDraftSerializer,
    TitleCheckSerializer,
    TopicAssignmentSerializer,
    TopicCreateSerializer,
    TopicHistorySerializer,
    TopicSerializer,
    TopicSimilarityResultSerializer,
)
from .services.similarity import find_similar_topics, find_similar_topics_for_draft, is_exact_duplicate
from .services.workflow import assign_topic, propose_topic, resubmit_topic

User = get_user_model()


class TopicViewSet(viewsets.ModelViewSet):
    """
    /api/v1/topics/topics/
    Tìm kiếm: ?search=<từ khóa>&department=&cohort=&academic_year=&semester=&status=&mine=true
    """
    queryset = Topic.objects.select_related(
        "department", "field", "cohort", "academic_year", "semester", "proposed_by"
    ).all()
    permission_classes = (IsAuthenticated,)
    filterset_fields = ("department", "field", "cohort", "academic_year", "semester", "status", "proposed_by")
    search_fields = ("title", "description")
    ordering_fields = ("created_at", "title")

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Lọc mine=true
        is_mine = self.request.query_params.get("mine") == "true"
        if is_mine:
            return qs.filter(proposed_by=user)

        # Scoping theo vai trò:
        # Giảng viên chỉ xem đề tài của chính mình (mọi status) + đề tài APPROVED của đồng nghiệp
        if user.role == "teacher":
            return qs.filter(Q(proposed_by=user) | Q(status=Topic.Status.APPROVED))
        elif user.role == "student":
            return qs.filter(status=Topic.Status.APPROVED)

        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return TopicCreateSerializer
        return TopicSerializer

    def perform_create(self, serializer):
        if self.request.user.role != "teacher":
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Chỉ Giảng viên mới được đề xuất đề tài mới.")
        topic = serializer.save()
        self._propose_result = propose_topic(topic, actor=self.request.user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        response.data["exact_duplicate"] = self._propose_result["exact_duplicate"]
        response.data["top_similar"] = [
            {
                "topic_id": r["topic"].id,
                "topic_title": r["topic"].title,
                "similarity_percent": r["similarity_percent"],
                "warning_level": r["warning_level"],
            }
            for r in self._propose_result["similar_results"]
        ]
        return response

    @action(detail=False, methods=["post"], url_path="check-title")
    def check_title(self, request):
        """POST /api/v1/topics/topics/check-title/ — kiểm tra trùng tên độc lập không lưu DB."""
        serializer = TitleCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        title = serializer.validated_data["title"]
        existing_titles = list(Topic.objects.values_list("title", flat=True))
        duplicate = is_exact_duplicate(title, existing_titles)
        return Response({"exact_duplicate": duplicate, "title": title})

    @action(detail=False, methods=["post"], url_path="check-similarity")
    def check_similarity(self, request):
        """POST /api/v1/topics/topics/check-similarity/ — kiểm tra tương đồng bản nháp khi đang soạn thảo."""
        serializer = SimilarityCheckDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        results = find_similar_topics_for_draft(
            title=serializer.validated_data["title"],
            description=serializer.validated_data.get("description", ""),
            keywords=serializer.validated_data.get("keywords", []),
        )
        data = [
            {
                "topic": TopicSerializer(r["topic"]).data,
                "similarity_percent": r["similarity_percent"],
                "warning_level": r["warning_level"],
            }
            for r in results
        ]
        return Response(data)

    @action(detail=True, methods=["post"], url_path="resubmit", permission_classes=[IsAuthenticated, IsTeacher, IsTopicOwner])
    def resubmit(self, request, pk=None):
        """POST /api/v1/topics/topics/{id}/resubmit/ — nộp lại đề tài sau yêu cầu sửa."""
        topic = self.get_object()
        serializer = ResubmitTopicSerializer(instance=topic, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_topic, propose_result = resubmit_topic(
            topic=topic,
            actor=request.user,
            updated_data=serializer.validated_data,
        )
        res_data = TopicSerializer(updated_topic).data
        res_data["exact_duplicate"] = propose_result["exact_duplicate"]
        res_data["top_similar"] = [
            {
                "topic_id": r["topic"].id,
                "topic_title": r["topic"].title,
                "similarity_percent": r["similarity_percent"],
                "warning_level": r["warning_level"],
            }
            for r in propose_result["similar_results"]
        ]
        return Response(res_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="similarity-check")
    def similarity_check(self, request, pk=None):
        """GET /api/v1/topics/topics/{id}/similarity-check/ — trả Top đề tài tương đồng."""
        topic = self.get_object()
        results = find_similar_topics(topic)
        data = [
            {
                "topic": TopicSerializer(r["topic"]).data,
                "similarity_percent": r["similarity_percent"],
                "warning_level": r["warning_level"],
            }
            for r in results
        ]
        return Response(data)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        """GET /api/v1/topics/topics/{id}/history/ — lịch sử thao tác của đề tài."""
        topic = self.get_object()
        serializer = TopicHistorySerializer(topic.history.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="assign", permission_classes=[IsAuthenticated, IsTeacher, IsTopicOwner])
    def assign(self, request, pk=None):
        """POST /api/v1/topics/topics/{id}/assign/ — giao đề tài cho sinh viên/nhóm sinh viên."""
        topic = self.get_object()
        serializer = AssignTopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = assign_topic(
            topic=topic,
            student_ids=serializer.validated_data["student_ids"],
            actor=request.user,
            due_date=serializer.validated_data.get("due_date"),
            note=serializer.validated_data.get("note", ""),
        )
        return Response(TopicAssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED)


class AssignableStudentsView(APIView):
    """GET /api/v1/topics/assignable-students/?semester_id=&search= — Lấy danh sách SV có thể giao đề tài."""
    permission_classes = (IsAuthenticated, IsTeacher)

    def get(self, request):
        search = request.query_params.get("search", "").strip()
        semester_id = request.query_params.get("semester_id")

        qs = User.objects.filter(role="student", is_active=True)

        if semester_id:
            assigned_student_ids = TopicAssignment.objects.filter(
                status=TopicAssignment.Status.ACTIVE,
                topic__semester_id=semester_id,
            ).values_list("students", flat=True)
            qs = qs.exclude(id__in=assigned_student_ids)

        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(username__icontains=search)
                | Q(student_code__icontains=search)
                | Q(class_name__icontains=search)
            )

        serializer = UserSerializer(qs[:50], many=True)
        return Response(serializer.data)


class MyStudentsView(APIView):
    """GET /api/v1/topics/my-students/?search= — Lấy danh sách SV được phân công hướng dẫn bởi GV hiện tại."""
    permission_classes = (IsAuthenticated, IsTeacher)

    def get(self, request):
        search = request.query_params.get("search", "").strip()

        assignments = TopicAssignment.objects.filter(
            topic__proposed_by=request.user
        ).select_related("topic").prefetch_related("students", "reports")

        results = []
        for assign in assignments:
            latest_report = assign.reports.first()
            status_val = assign.status.lower() if assign.status else "active"
            status_display_map = {
                "active": "Đang thực hiện",
                "completed": "Đã hoàn thành",
                "cancelled": "Đã hủy",
            }

            for student in assign.students.all():
                if search:
                    s_name = f"{student.first_name} {student.last_name}".lower()
                    if (
                        search.lower() not in s_name
                        and search.lower() not in student.student_code.lower()
                        and search.lower() not in (student.class_name or "").lower()
                    ):
                        continue

                results.append({
                    "assignment_id": assign.id,
                    "assignment_status": status_val,
                    "assignment_status_display": status_display_map.get(status_val, assign.get_status_display()),
                    "due_date": assign.due_date,
                    "topic_id": assign.topic.id,
                    "topic_title": assign.topic.title,
                    "student_id": student.id,
                    "student_code": student.student_code,
                    "class_name": student.class_name,
                    "student_name": student.get_full_name() or student.username,
                    "email": student.email,
                    "phone_number": student.phone_number,
                    "latest_percent": latest_report.percent if latest_report else 0,
                    "latest_submitted_at": latest_report.submitted_at if latest_report else None,
                })

        return Response(results)


class TopicAssignmentViewSet(viewsets.ReadOnlyModelViewSet):
    """/api/v1/topics/assignments/ — tra cứu các lượt giao đề tài."""
    queryset = TopicAssignment.objects.select_related("topic", "assigned_by").prefetch_related("students")
    serializer_class = TopicAssignmentSerializer
    permission_classes = (IsAuthenticated,)
    filterset_fields = ("topic", "students", "status")

    @action(detail=True, methods=["patch"], url_path="update-status", permission_classes=[IsAuthenticated, IsTeacher])
    def update_status(self, request, pk=None):
        """PATCH /api/v1/topics/assignments/{id}/update-status/ — Đổi trạng thái lượt giao sang completed / cancelled."""
        assignment = self.get_object()
        if request.user.role != "admin" and assignment.topic.proposed_by != request.user:
            raise PermissionDenied("Chỉ giảng viên hướng dẫn của đề tài này mới có quyền đổi trạng thái lượt giao.")

        new_status = request.data.get("status")
        if new_status not in [TopicAssignment.Status.COMPLETED, TopicAssignment.Status.CANCELLED, TopicAssignment.Status.ACTIVE]:
            return Response({"detail": "Trạng thái không hợp lệ. Chọn 'active', 'completed' hoặc 'cancelled'."}, status=status.HTTP_400_BAD_REQUEST)

        assignment.status = new_status
        assignment.save(update_fields=["status"])
        return Response(TopicAssignmentSerializer(assignment).data)

