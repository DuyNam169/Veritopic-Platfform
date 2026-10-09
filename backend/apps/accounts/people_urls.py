"""Read-only lecturer and student directory for admins and department heads."""
from rest_framework.routers import DefaultRouter

from .management_views import PeopleDirectoryViewSet

router = DefaultRouter()
router.register("", PeopleDirectoryViewSet, basename="management-people")

urlpatterns = router.urls
