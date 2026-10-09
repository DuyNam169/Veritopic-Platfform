from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AssignableStudentsView, MyStudentsView, TopicAssignmentViewSet, TopicViewSet

router = DefaultRouter()
router.register("topics", TopicViewSet, basename="topic")
router.register("assignments", TopicAssignmentViewSet, basename="topic-assignment")

urlpatterns = [
    path("assignable-students/", AssignableStudentsView.as_view(), name="topic-assignable-students"),
    path("my-students/", MyStudentsView.as_view(), name="topic-my-students"),
] + router.urls

