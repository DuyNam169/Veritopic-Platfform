from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdminOrDepartmentHead

from .models import Topic
from .serializers import ReviewActionSerializer, TopicSerializer
from .services.workflow import approve_topic, reject_topic, request_rename


class PendingTopicListView(ListAPIView):
    """GET /api/v1/management/topics/pending/ — danh sách đề tài đang chờ Trưởng bộ môn duyệt."""
    serializer_class = TopicSerializer
    permission_classes = (IsAdminOrDepartmentHead,)

    def get_queryset(self):
        qs = Topic.objects.filter(status=Topic.Status.PENDING).select_related(
            "department", "proposed_by"
        )
        if self.request.user.role == "department_head":
            qs = qs.filter(department=self.request.user.department)
        return qs


def _get_reviewable_topic(request, pk):
    topic = get_object_or_404(Topic.objects.select_for_update(), pk=pk)
    if request.user.role == "department_head" and topic.department_id != request.user.department_id:
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Bạn chỉ có thể duyệt đề tài thuộc bộ môn của mình.")
    if topic.status != Topic.Status.PENDING:
        raise ValidationError({
            "detail": "Đề tài này không còn ở trạng thái chờ duyệt và có thể đã được người khác xử lý."
        })
    return topic


class ApproveTopicView(APIView):
    permission_classes = (IsAdminOrDepartmentHead,)

    @transaction.atomic
    def post(self, request, pk):
        topic = _get_reviewable_topic(request, pk)
        serializer = ReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = approve_topic(topic, actor=request.user, note=serializer.validated_data["note"])
        return Response(TopicSerializer(topic).data)


class RejectTopicView(APIView):
    permission_classes = (IsAdminOrDepartmentHead,)

    @transaction.atomic
    def post(self, request, pk):
        topic = _get_reviewable_topic(request, pk)
        serializer = ReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = reject_topic(topic, actor=request.user, note=serializer.validated_data["note"])
        return Response(TopicSerializer(topic).data)


class RequestRenameTopicView(APIView):
    permission_classes = (IsAdminOrDepartmentHead,)

    @transaction.atomic
    def post(self, request, pk):
        topic = _get_reviewable_topic(request, pk)
        serializer = ReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = request_rename(topic, actor=request.user, note=serializer.validated_data["note"])
        return Response(TopicSerializer(topic).data)
