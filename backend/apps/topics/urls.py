from rest_framework.routers import DefaultRouter
from django.urls import path
from .teacher_views import AssignableStudentsView, MyStudentsView
from .student_views import StudentTopicProposalViewSet, TopicRegistrationViewSet

from .views import (
    SimilarityCheckViewSet,
    TechnologyViewSet,
    TopicAssignmentViewSet,
    TopicDocumentViewSet,
    TopicFunctionViewSet,
    TopicTechnologyViewSet,
    TopicViewSet,
)

router = DefaultRouter()
router.register("topics", TopicViewSet, basename="topic")
router.register("assignments", TopicAssignmentViewSet, basename="topic-assignment")
router.register("technologies", TechnologyViewSet, basename="technology")
router.register("topic-technologies", TopicTechnologyViewSet, basename="topic-technology")
router.register("topic-functions", TopicFunctionViewSet, basename="topic-function")
router.register("topic-documents", TopicDocumentViewSet, basename="topic-document")
router.register("similarity/checks", SimilarityCheckViewSet, basename="similarity-check")
router.register("student-proposals", StudentTopicProposalViewSet, basename="student-proposal")
router.register("registrations", TopicRegistrationViewSet, basename="topic-registration")

urlpatterns = [path("assignable-students/", AssignableStudentsView.as_view()), path("my-students/", MyStudentsView.as_view())] + router.urls
