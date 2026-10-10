from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from .models import ProgressFeedback, ProgressReport


class ProgressFeedbackSerializer(serializers.ModelSerializer):
    teacher_info = UserSerializer(source="teacher", read_only=True)
    result_display = serializers.CharField(source="get_result_display", read_only=True)

    class Meta:
        model = ProgressFeedback
        fields = (
            "id",
            "report",
            "teacher",
            "teacher_info",
            "comment",
            "score",
            "result",
            "result_display",
            "created_at",
        )
        read_only_fields = ("id", "teacher", "created_at")


class ProgressFeedbackCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgressFeedback
        fields = ("comment", "score", "result")


class ProgressReportSerializer(serializers.ModelSerializer):
    submitted_by_info = UserSerializer(source="submitted_by", read_only=True)
    feedbacks = ProgressFeedbackSerializer(many=True, read_only=True)

    class Meta:
        model = ProgressReport
        fields = (
            "id",
            "assignment",
            "submitted_by",
            "submitted_by_info",
            "period_label",
            "stage",
            "percent",
            "content",
            "attachment",
            "submitted_at",
            "is_late",
            "feedbacks",
        )
        read_only_fields = ("id", "submitted_by", "submitted_at", "is_late")


class ProgressReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgressReport
        fields = ("period_label", "stage", "percent", "content", "attachment")

    def validate_percent(self, value):
        if not (0 <= value <= 100):
            raise serializers.ValidationError("Phần trăm hoàn thành phải nằm trong khoảng 0 - 100%.")
        return value
