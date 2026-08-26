"""Route quản lý riêng cho vòng đời duyệt đề tài — chỉ Admin / Trưởng bộ môn. Gắn dưới /api/v1/management/topics/."""
from django.urls import path

from .management_views import (
    ApproveTopicView,
    PendingTopicListView,
    RejectTopicView,
    RequestRenameTopicView,
)

urlpatterns = [
    path("pending/", PendingTopicListView.as_view(), name="management-topics-pending"),
    path("<int:pk>/approve/", ApproveTopicView.as_view(), name="management-topic-approve"),
    path("<int:pk>/reject/", RejectTopicView.as_view(), name="management-topic-reject"),
    path("<int:pk>/request-rename/", RequestRenameTopicView.as_view(), name="management-topic-request-rename"),
]
