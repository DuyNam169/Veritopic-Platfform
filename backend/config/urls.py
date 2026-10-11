"""
Toàn bộ API được gom dưới prefix /api/v1/.
Route quản trị (chỉ Quản trị viên / Trưởng bộ môn) được tách riêng dưới /api/v1/management/
để phân biệt rõ với route nghiệp vụ thông thường, dễ áp policy/permission/logging riêng.
"""
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),

    # ---- API docs ----
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),

    # ---- Auth (JWT) ----
    path("api/v1/auth/", include("apps.accounts.urls")),

    # ---- Nghiệp vụ chính ----
    path("api/v1/academics/", include("apps.academics.urls")),
    path("api/v1/topics/", include("apps.topics.urls")),
    path("api/v1/progress/", include("apps.progress.urls")),
    path("api/v1/statistics/", include("apps.statistics.urls")),

    # ---- Route quản lý riêng (Admin / Trưởng bộ môn) ----
    path("api/v1/management/", include("apps.common.management_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
