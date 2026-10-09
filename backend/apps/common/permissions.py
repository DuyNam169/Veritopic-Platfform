"""
Định nghĩa các Permission class dùng chung theo vai trò (RBAC).
Vai trò được lưu ở apps.accounts.models.User.Role — import lại ở đây để tránh phụ thuộc vòng.
"""
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    message = "Chỉ Quản trị viên mới có quyền thực hiện thao tác này."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "admin")


class IsDepartmentHead(BasePermission):
    message = "Chỉ Trưởng bộ môn mới có quyền thực hiện thao tác này."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "department_head")


class IsTeacher(BasePermission):
    message = "Chỉ Giảng viên mới có quyền thực hiện thao tác này."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "teacher")


class IsStudent(BasePermission):
    message = "Chỉ Sinh viên mới có quyền thực hiện thao tác này."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "student")


class IsAdminOrDepartmentHead(BasePermission):
    message = "Chỉ Quản trị viên hoặc Trưởng bộ môn mới có quyền thực hiện thao tác này."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("admin", "department_head")
        )


class ReadOnlyOrAdmin(BasePermission):
    """Cho phép mọi user đã đăng nhập đọc (GET), chỉ Admin mới được ghi (POST/PUT/PATCH/DELETE)."""

    SAFE_METHODS = ("GET", "HEAD", "OPTIONS")

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in self.SAFE_METHODS:
            return True
        return request.user.role == "admin"


class IsTeacherOrAdmin(BasePermission):
    message = "Chỉ Giảng viên hoặc Quản trị viên mới có quyền thực hiện thao tác này."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("teacher", "admin")
        )


class IsTopicOwner(BasePermission):
    """Object-level permission: Chỉ người đề xuất đề tài (hoặc Admin) mới có quyền chỉnh sửa/thao tác."""
    message = "Bạn không phải người tạo đề tài này."

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role == "admin":
            return True
        return hasattr(obj, "proposed_by") and obj.proposed_by == request.user

