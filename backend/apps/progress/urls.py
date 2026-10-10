from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AddFeedbackView, DownloadAttachmentView, ProjectProgressViewSet

router = DefaultRouter()
router.register("projects", ProjectProgressViewSet, basename="progress-project")

urlpatterns = [
    path("reports/<int:pk>/feedback/", AddFeedbackView.as_view(), name="progress-feedback"),
    path("reports/<int:pk>/download-attachment/", DownloadAttachmentView.as_view(), name="progress-download-attachment"),
] + router.urls
