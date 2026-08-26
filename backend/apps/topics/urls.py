from rest_framework.routers import DefaultRouter

from .views import TopicAssignmentViewSet, TopicViewSet

router = DefaultRouter()
router.register("topics", TopicViewSet, basename="topic")
router.register("assignments", TopicAssignmentViewSet, basename="topic-assignment")

urlpatterns = router.urls
