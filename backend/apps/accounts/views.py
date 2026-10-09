from rest_framework import generics, permissions
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import (
    CustomTokenObtainPairSerializer, 
    RegisterSerializer, 
    UserSerializer,
    ForgotPasswordSerializer, 
    ResetPasswordSerializer,
    ChangePasswordSerializer
)
from .services import send_forgot_password_email, reset_user_password, change_user_password


class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login/  -> { access, refresh } kèm role trong payload token."""
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """POST /api/v1/auth/register/ — tạo tài khoản mới (mặc định role=student, Admin có thể đổi role sau)."""
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/me/ — xem & cập nhật hồ sơ bản thân."""
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return self.request.user


class ForgotPasswordView(APIView):
    """POST /api/v1/auth/forgot-password/"""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        try:
            # Gọi đến service để xử lý logic
            send_forgot_password_email(email)
            return Response({"detail": "Mã OTP đã được gửi đến email của bạn."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    """POST /api/v1/auth/reset-password/"""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        otp = serializer.validated_data["otp"]
        new_password = serializer.validated_data["new_password"]

        try:
            # Gọi đến service để xử lý logic
            reset_user_password(email, otp, new_password)
            return Response({"detail": "Đặt lại mật khẩu thành công."}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": "Đã xảy ra lỗi hệ thống."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChangePasswordView(APIView):
    """POST /api/v1/auth/change-password/"""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        old_password = serializer.validated_data["old_password"]
        new_password = serializer.validated_data["new_password"]

        try:
            # Gọi đến service để xử lý logic đổi mật khẩu
            change_user_password(request.user, old_password, new_password)
            return Response({"detail": "Đổi mật khẩu thành công."}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


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

