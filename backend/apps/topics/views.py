from django.db import transaction
from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsAdmin, IsTeacher, IsTopicOwnerOrAdmin, ReadOnlyOrAdmin

from .models import (
    Technology,
    Topic,
    TopicAssignment,
    TopicDeletionAudit,
    TopicDocument,
    TopicFunction,
    TopicHistory,
    TopicTechnology,
)
from .serializers import (
    AssignTopicSerializer,
    TopicAssignmentSerializer,
    TopicCreateSerializer,
    TopicDocumentSerializer,
    TopicFunctionSerializer,
    TopicHistorySerializer,
    TopicSerializer,
    TopicSimilarityResultSerializer,
    TopicTechnologySerializer,
    TechnologySerializer,
    SimilarityCheckRequestSerializer,
)
from .services.document_extraction import FileExtractionError, extract_document_text, find_title_candidates
from .services.similarity import (
    classify_warning_level,
    find_similar_topics,
    get_embedding,
    is_exact_duplicate,
    normalize_text,
)
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
    queryset = TopicAssignment.objects.select_related(
        "topic", "topic__proposed_by", "assigned_by"
    ).prefetch_related("students")
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


class TopicResourcePermission(IsAuthenticated):
    message = "Chỉ Admin hoặc giảng viên sở hữu đề tài mới được sửa thông tin này."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.method in ("GET", "HEAD", "OPTIONS") or request.user.role in ("admin", "teacher")

    def has_object_permission(self, request, view, obj):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return request.user.role == "admin" or obj.topic.proposed_by_id == request.user.id


class TopicResourceViewSet(viewsets.ModelViewSet):
    permission_classes = (TopicResourcePermission,)
    filterset_fields = ("topic",)

    def perform_create(self, serializer):
        topic = serializer.validated_data["topic"]
        if self.request.user.role != "admin" and topic.proposed_by_id != self.request.user.id:
            raise PermissionDenied(TopicResourcePermission.message)
        serializer.save()

    def perform_update(self, serializer):
        topic = serializer.validated_data.get("topic", serializer.instance.topic)
        if self.request.user.role != "admin" and topic.proposed_by_id != self.request.user.id:
            raise PermissionDenied(TopicResourcePermission.message)
        serializer.save()


class TechnologyViewSet(viewsets.ModelViewSet):
    queryset = Technology.objects.all()
    serializer_class = TechnologySerializer
    permission_classes = (ReadOnlyOrAdmin,)
    search_fields = ("name", "category", "description")
    ordering_fields = ("name", "category", "created_at")


class TopicTechnologyViewSet(TopicResourceViewSet):
    queryset = TopicTechnology.objects.select_related("topic", "technology").all()
    serializer_class = TopicTechnologySerializer


class TopicFunctionViewSet(TopicResourceViewSet):
    queryset = TopicFunction.objects.select_related("topic").all()
    serializer_class = TopicFunctionSerializer


class TopicDocumentViewSet(TopicResourceViewSet):
    queryset = TopicDocument.objects.select_related("topic", "uploaded_by").all()
    serializer_class = TopicDocumentSerializer
    parser_classes = (MultiPartParser, FormParser)
    search_fields = ("file_name",)
    ordering_fields = ("uploaded_at", "file_name")

    def perform_create(self, serializer):
        topic = serializer.validated_data["topic"]
        if self.request.user.role != "admin" and topic.proposed_by_id != self.request.user.id:
            raise PermissionDenied(TopicResourcePermission.message)
        serializer.save(uploaded_by=self.request.user)

    def perform_destroy(self, instance):
        stored_file = instance.file
        instance.delete()
        if stored_file:
            stored_file.delete(save=False)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        document = self.get_object()
        if not document.file:
            raise NotFound("Tệp đính kèm không còn tồn tại.")
        return FileResponse(
            document.file.open("rb"),
            as_attachment=True,
            filename=document.file_name,
        )


class SimilarityCheckViewSet(viewsets.GenericViewSet):
    permission_classes = (IsAuthenticated,)

    def _ensure_not_student(self, user):
        if user.role == "student":
            raise PermissionDenied("Sinh viên không có quyền chạy kiểm tra tương đồng.")

    @action(detail=False, methods=["post"], url_path="check")
    def check(self, request):
        self._ensure_not_student(request.user)
        serializer = SimilarityCheckRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        source_topic_id = data.get("source_topic_id")
        title = data.get("title", "").strip()

        if source_topic_id:
            try:
                source_topic = Topic.objects.get(pk=source_topic_id)
            except Topic.DoesNotExist as error:
                raise NotFound("Không tìm thấy đề tài được chọn.") from error
            if not title:
                title = source_topic.title

        candidates = Topic.objects.filter(embedding__isnull=False)
        if source_topic_id:
            candidates = candidates.exclude(pk=source_topic_id)
        existing_titles = list(candidates.values_list("title", flat=True))
        if not existing_titles:
            return Response({"query": title, "count": 0, "results": []})

        from pgvector.django import CosineDistance

        embedding = get_embedding(title)
        exact_duplicate = is_exact_duplicate(title, existing_titles)
        ranked = (
            candidates.select_related(
                "proposed_by", "department", "field", "cohort", "academic_year", "semester"
            )
            .annotate(distance=CosineDistance("embedding", embedding))
            .order_by("distance")[:data["top_k"]]
        )
        results = []
        for topic in ranked:
            percent = round(max(0.0, min(100.0, (1 - topic.distance) * 100)), 2)
            exact_match = exact_duplicate and normalize_text(topic.title) == normalize_text(title)
            if exact_match:
                percent = 100.0
            level = "duplicate" if exact_match else classify_warning_level(percent)
            results.append({
                "topic_id": topic.pk,
                "title": topic.title,
                "topic_title": topic.title,
                "similarity": percent / 100,
                "percent": percent,
                "similarity_percent": percent,
                "warning": level,
                "warning_level": level,
            })
        return Response({"query": title, "count": len(results), "results": results})

    @action(
        detail=False,
        methods=["post"],
        url_path="extract-file",
        parser_classes=(MultiPartParser, FormParser),
    )
    def extract_file(self, request):
        self._ensure_not_student(request.user)
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            raise ValidationError({"file": "Hãy chọn một tệp PDF hoặc DOCX."})
        try:
            text = extract_document_text(uploaded_file)
        except FileExtractionError as error:
            raise ValidationError({"file": str(error)}) from error

        candidates = find_title_candidates(text)
        return Response({
            "title_candidates": candidates,
            "suggested_title": candidates[0]["title"] if candidates else "",
            "preview_text": text[:5000],
        })
