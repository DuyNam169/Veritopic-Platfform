from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsTeacher

from .models import Topic, TopicAssignment
from .serializers import (
    AssignTopicSerializer,
    TopicAssignmentSerializer,
    TopicCreateSerializer,
    TopicHistorySerializer,
    TopicSerializer,
    TopicSimilarityResultSerializer,
)
from .services.similarity import find_similar_topics
from .services.workflow import assign_topic, propose_topic


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

    def perform_create(self, serializer):
        # Chỉ Giảng viên được đề xuất đề tài mới
        if self.request.user.role != "teacher":
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Chỉ Giảng viên mới được đề xuất đề tài mới.")
        topic = serializer.save()
        # Ngay sau khi tạo: kiểm tra trùng tên chính xác + tính embedding + xếp hạng tương đồng
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

    @action(detail=True, methods=["post"], url_path="assign", permission_classes=[IsTeacher])
    def assign(self, request, pk=None):
        """POST /api/v1/topics/topics/{id}/assign/ — giao đề tài cho sinh viên/nhóm sinh viên."""
        topic = self.get_object()
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
