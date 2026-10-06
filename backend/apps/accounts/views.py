from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import CustomTokenObtainPairSerializer, UserSerializer, ChangePasswordSerializer


class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login/  -> { access, refresh } kèm role trong payload token."""
    serializer_class = CustomTokenObtainPairSerializer


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/me/ — xem & cập nhật hồ sơ bản thân."""
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        user = self.get_object()
        old_avatar_name = user.avatar.name if user.avatar else ""
        updated_user = serializer.save()
        new_avatar_name = updated_user.avatar.name if updated_user.avatar else ""
        if old_avatar_name and old_avatar_name != new_avatar_name:
            updated_user.avatar.storage.delete(old_avatar_name)


class AvatarDeleteView(generics.GenericAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def delete(self, request):
        user = request.user
        if user.avatar:
            avatar_name = user.avatar.name
            storage = user.avatar.storage
            user.avatar = None
            user.save(update_fields=["avatar", "updated_at"])
            storage.delete(avatar_name)
        return Response(UserSerializer(user, context={"request": request}).data)


class ChangePasswordView(generics.GenericAPIView):
    """POST /api/v1/auth/change-password/ — đổi mật khẩu tài khoản đang đăng nhập."""
    serializer_class = ChangePasswordSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Đổi mật khẩu thành công."}, status=status.HTTP_200_OK)
