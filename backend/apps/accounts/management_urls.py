"""Route quản lý tài khoản người dùng — chỉ Admin. Gắn dưới /api/v1/management/users/."""
from rest_framework.routers import DefaultRouter

from .management_views import UserManagementViewSet

router = DefaultRouter()
router.register("", UserManagementViewSet, basename="management-users")

urlpatterns = router.urls
