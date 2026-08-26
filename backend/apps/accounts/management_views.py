from django.contrib.auth import get_user_model
from rest_framework import viewsets

from apps.common.permissions import IsAdmin

from .serializers import UserSerializer

User = get_user_model()


class UserManagementViewSet(viewsets.ModelViewSet):
    """
    CRUD tài khoản người dùng — CHỈ Admin.
    Dùng cho: tạo tài khoản Giảng viên/Trưởng bộ môn, khóa tài khoản, đổi role...
    """
    queryset = User.objects.all().order_by("-created_at")
    serializer_class = UserSerializer
    permission_classes = (IsAdmin,)
    filterset_fields = ("role", "department")
    search_fields = ("username", "email", "first_name", "last_name", "student_code")
