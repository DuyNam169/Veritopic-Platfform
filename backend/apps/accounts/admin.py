from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import OTPRecord, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Thông tin bổ sung", {"fields": ("role", "phone_number", "student_code", "class_name", "department")}),
    )
    list_display = ("username", "email", "get_full_name", "role", "is_staff")
    list_filter = ("role", "is_staff", "is_superuser")


@admin.register(OTPRecord)
class OTPRecordAdmin(admin.ModelAdmin):
    list_display = ("email", "otp", "created_at", "is_used")
    search_fields = ("email", "otp")

