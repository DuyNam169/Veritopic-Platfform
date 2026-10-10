from rest_framework.routers import DefaultRouter

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

urlpatterns = router.urls
