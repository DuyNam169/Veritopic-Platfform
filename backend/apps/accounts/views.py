from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    CustomTokenObtainPairSerializer,
    UserSerializer,
    ChangePasswordSerializer,
    RegisterSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
)
from .services.auth import send_forgot_password_email, reset_user_password


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


class RegisterView(generics.CreateAPIView):
    """POST /api/v1/auth/register/ — tạo tài khoản mới (mặc định role=student)."""
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)


class ForgotPasswordView(APIView):
    """POST /api/v1/auth/forgot-password/ — gửi OTP qua email."""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        try:
            send_forgot_password_email(email)
            return Response({"detail": "Mã OTP đã được gửi đến email của bạn."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    """POST /api/v1/auth/reset-password/ — xác nhận OTP và đặt mật khẩu mới."""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        otp = serializer.validated_data["otp"]
        new_password = serializer.validated_data["new_password"]
        try:
            reset_user_password(email, otp, new_password)
            return Response({"detail": "Đặt lại mật khẩu thành công."}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"detail": "Đã xảy ra lỗi hệ thống."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — blacklist refresh token."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                from rest_framework_simplejwt.tokens import RefreshToken
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({"detail": "Đăng xuất thành công."}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"detail": "Đã xảy ra lỗi khi đăng xuất hoặc token không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)
