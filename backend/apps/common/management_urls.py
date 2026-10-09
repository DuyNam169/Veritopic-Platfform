"""
Route quản lý riêng (tách khỏi route nghiệp vụ thông thường).
Chỉ Admin / Trưởng bộ môn được phép truy cập (áp permission ở từng view bên trong).
Mục đích tách riêng: dễ áp thêm middleware/logging/rate-limit riêng cho khu vực quản trị sau này
mà không ảnh hưởng tới API nghiệp vụ dùng chung cho Giảng viên/Sinh viên.
"""
from django.urls import include, path

urlpatterns = [
    path("people/", include("apps.accounts.people_urls")),
    path("users/", include("apps.accounts.management_urls")),
    path("topics/", include("apps.topics.management_urls")),
]
