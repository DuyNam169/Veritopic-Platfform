from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LoginView, MeView, RegisterView

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("login/refresh/", TokenRefreshView.as_view(), name="auth-login-refresh"),
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("me/", MeView.as_view(), name="auth-me"),
]
