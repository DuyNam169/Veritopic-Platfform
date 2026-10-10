from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsAdmin, IsTeacher, IsTopicOwnerOrAdmin

from .models import Topic, TopicAssignment, TopicDeletionAudit, TopicHistory
from .serializers import (
    AssignTopicSerializer,
    TopicAssignmentSerializer,
    TopicCreateSerializer,
    TopicHistorySerializer,
    TopicSerializer,
    TopicSimilarityResultSerializer,
)
from .services.similarity import find_similar_topics
from .services.workflow import assign_topic, propose_topic, refresh_similarity_results


class TopicViewSet(viewsets.ModelViewSet):
    """
    /api/v1/topics/topics/
    Tìm kiếm: ?search=<từ khóa>&department=&cohort=&academic_year=&semester=&status=
    """
    queryset = Topic.objects.select_related(
        "department", "field", "cohort", "academic_year", "semester", "proposed_by"
    ).all()
    permission_classes = (IsAuthenticated,)
    filterset_fields = ("department", "field", "cohort", "academic_year", "semester", "status", "proposed_by")
    search_fields = ("title", "description")
    ordering_fields = ("created_at", "title")

    def get_serializer_class(self):
        if self.action == "create":
            return TopicCreateSerializer
        return TopicSerializer

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsTopicOwnerOrAdmin()]
        if self.action == "assign":
            return [IsTeacher()]
        if self.action == "refresh_similarity":
            return [IsAdmin()]
        return [IsAuthenticated()]

    def _ensure_teacher_topic_is_editable(self, topic):
        """Protect approved/assigned work from teacher-side changes."""
        if self.request.user.role == "admin":
            return
        if topic.status == Topic.Status.APPROVED or topic.assignments.exists():
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Không thể sửa hoặc xóa đề tài đã duyệt hoặc đã được giao.")

    def perform_update(self, serializer):
        topic = self.get_object()
        self._ensure_teacher_topic_is_editable(topic)
        field_labels = {
            "title": "tên đề tài",
            "description": "mô tả",
            "department": "bộ môn",
            "field": "lĩnh vực",
            "cohort": "khóa học",
            "academic_year": "năm học",
            "semester": "học kỳ",
        }
        changed_fields = [
            field_labels.get(field, field)
            for field, value in serializer.validated_data.items()
            if getattr(topic, field) != value
        ]
        updated = serializer.save()
        if topic.status == Topic.Status.RENAME_REQUESTED:
            updated.status = Topic.Status.PENDING
            updated.reviewed_by = None
            updated.review_note = ""
            updated.save(update_fields=["status", "reviewed_by", "review_note", "updated_at"])
        from .models import TopicHistory

        TopicHistory.objects.create(
            topic=updated,
            action=TopicHistory.Action.UPDATED,
            actor=self.request.user,
            note=f"Thay đổi: {', '.join(changed_fields)}." if changed_fields else "Không có thông tin thay đổi.",
        )

    def perform_destroy(self, instance):
        self._ensure_teacher_topic_is_editable(instance)
        assignment_count = instance.assignments.count()
        with transaction.atomic():
            TopicDeletionAudit.objects.create(
                original_topic_id=instance.pk,
                title=instance.title,
                status=instance.status,
                proposed_by_label=instance.proposed_by.get_full_name() or instance.proposed_by.username,
                deleted_by=self.request.user,
                had_assignments=assignment_count > 0,
                snapshot={
                    "description": instance.description,
                    "department_id": instance.department_id,
                    "field_id": instance.field_id,
                    "cohort_id": instance.cohort_id,
                    "academic_year_id": instance.academic_year_id,
                    "semester_id": instance.semester_id,
                    "proposed_by_id": instance.proposed_by_id,
                    "reviewed_by_id": instance.reviewed_by_id,
                    "review_note": instance.review_note,
                    "assignment_count": assignment_count,
                    "history_count": instance.history.count(),
                    "similarity_result_count": instance.similarity_results.count(),
                },
            )
            instance.delete()

    def perform_create(self, serializer):
        # Chỉ Giảng viên được đề xuất đề tài mới
        if self.request.user.role != "teacher":
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Chỉ Giảng viên mới được đề xuất đề tài mới.")
        topic = serializer.save()
        # Ngay sau khi tạo: kiểm tra trùng tên, lọc TF-IDF và chấm tương đồng ngữ nghĩa
        self._propose_result = propose_topic(topic, actor=self.request.user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        # Trả kèm kết quả kiểm tra trùng lặp/tương đồng ngay trong response tạo đề tài,
        # để Frontend hiển thị cảnh báo ngay lập tức mà không cần gọi thêm similarity-check/.
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

    @action(detail=True, methods=["get"], url_path="similarity-check")
    def similarity_check(self, request, pk=None):
        """GET /api/v1/topics/topics/{id}/similarity-check/ — trả Top đề tài tương đồng kèm % và mức cảnh báo."""
        if request.user.role == "student":
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Sinh viên không có quyền chạy kiểm tra tương đồng.")
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
        entries = topic.history.select_related("actor").order_by("-created_at", "-id")
        serializer = TopicHistorySerializer(entries, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="similarity-results")
    def similarity_results(self, request, pk=None):
        """Kết quả tương đồng đã lưu khi đề tài được đề xuất."""
        topic = self.get_object()
        results = topic.similarity_results.select_related("similar_topic").all()
        return Response(TopicSimilarityResultSerializer(results, many=True).data)

    @action(detail=True, methods=["post"], url_path="refresh-similarity", permission_classes=[IsAdmin])
    def refresh_similarity(self, request, pk=None):
        """Allow an administrator to recompute and persist similarity results at any time."""
        topic = self.get_object()
        refresh_similarity_results(topic)
        TopicHistory.objects.create(
            topic=topic,
            action=TopicHistory.Action.SIMILARITY_REFRESHED,
            actor=request.user,
            note="Đã chạy lại và lưu kết quả kiểm tra trùng lặp/tương đồng.",
        )
        results = topic.similarity_results.select_related("similar_topic").all()
        return Response(TopicSimilarityResultSerializer(results, many=True).data)

    @action(detail=True, methods=["post"], url_path="assign", permission_classes=[IsTeacher])
    def assign(self, request, pk=None):
        """POST /api/v1/topics/topics/{id}/assign/ — giao đề tài cho sinh viên/nhóm sinh viên."""
        topic = self.get_object()
        if topic.proposed_by_id != request.user.id:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Chỉ được giao đề tài do chính bạn đề xuất.")
        if topic.status != Topic.Status.APPROVED:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("Chỉ được giao đề tài đã được phê duyệt.")
        serializer = AssignTopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = assign_topic(
            topic,
            student_ids=serializer.validated_data["student_ids"],
            actor=request.user,
            note=serializer.validated_data.get("note", ""),
        )
        return Response(TopicAssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED)


class TopicAssignmentViewSet(viewsets.ReadOnlyModelViewSet):
    """/api/v1/topics/assignments/ — tra cứu các lượt giao đề tài."""
    queryset = TopicAssignment.objects.select_related("topic", "assigned_by").prefetch_related("students")
    serializer_class = TopicAssignmentSerializer
    permission_classes = (IsAuthenticated,)
    filterset_fields = ("topic", "students")

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "student":
            return qs.filter(students=user).distinct()
        if user.role == "teacher":
            return qs.filter(assigned_by=user)
        return qs
