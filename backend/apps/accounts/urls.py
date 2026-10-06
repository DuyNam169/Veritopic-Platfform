from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import AvatarDeleteView, LoginView, MeView, ChangePasswordView

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("login/refresh/", TokenRefreshView.as_view(), name="auth-login-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("me/avatar/", AvatarDeleteView.as_view(), name="auth-avatar-delete"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
]
