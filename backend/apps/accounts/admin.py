from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import AdvisorRequest, Notification, OTPRecord, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Thông tin bổ sung", {"fields": ("role", "phone_number", "student_code", "student_class", "class_name", "department", "cohort")}),
    )
    readonly_fields = ("class_name",)
    list_display = ("username", "email", "get_full_name", "role", "is_staff")
    list_filter = ("role", "is_staff", "is_superuser")


@admin.register(OTPRecord)
class OTPRecordAdmin(admin.ModelAdmin):
    list_display = ("email", "otp", "created_at", "is_used")
    search_fields = ("email", "otp")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "title", "notification_type", "is_read", "created_at")
    list_filter = ("notification_type", "is_read")
    search_fields = ("recipient__username", "title", "message")


@admin.register(AdvisorRequest)
class AdvisorRequestAdmin(admin.ModelAdmin):
    list_display = ("student", "teacher", "status", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("student__username", "teacher__username")
