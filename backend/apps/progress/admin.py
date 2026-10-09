from django.contrib import admin
from .models import ProgressReport, ProgressFeedback


@admin.register(ProgressReport)
class ProgressReportAdmin(admin.ModelAdmin):
    list_display = ("id", "assignment", "period_label", "stage", "percent", "submitted_by", "submitted_at")
    list_filter = ("stage", "submitted_at")
    search_fields = ("assignment__topic__title", "submitted_by__username")


@admin.register(ProgressFeedback)
class ProgressFeedbackAdmin(admin.ModelAdmin):
    list_display = ("id", "report", "teacher", "score", "result", "created_at")
    list_filter = ("result", "created_at")
    search_fields = ("report__assignment__topic__title", "teacher__username")
