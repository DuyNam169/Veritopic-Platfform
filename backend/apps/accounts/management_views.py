from django.contrib.auth import get_user_model
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.permissions import IsAdmin

from .serializers import UserManagementSerializer

User = get_user_model()


class UserManagementViewSet(viewsets.ModelViewSet):
    """
    CRUD tài khoản người dùng — CHỈ Admin.
    Dùng cho: tạo tài khoản Giảng viên/Trưởng bộ môn, khóa tài khoản, đổi role...
    """
    queryset = User.objects.all().order_by("-created_at")
    serializer_class = UserManagementSerializer
    permission_classes = (IsAdmin,)
    filterset_fields = ("role", "department", "cohort")
    search_fields = ("username", "email", "first_name", "last_name", "student_code")

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        """Admin đặt lại mật khẩu cho tài khoản khác."""
        user = self.get_object()
        password = request.data.get("password")
        if not password or len(password) < 8:
            return Response(
                {"password": "Mật khẩu phải có ít nhất 8 ký tự."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"detail": "Đặt lại mật khẩu thành công."})
