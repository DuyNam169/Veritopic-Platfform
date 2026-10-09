from rest_framework import serializers

from apps.accounts.serializers import UserSerializer

from .models import Topic, TopicAssignment, TopicHistory, TopicSimilarityResult


class TopicSerializer(serializers.ModelSerializer):
    proposed_by_detail = UserSerializer(source="proposed_by", read_only=True)

    class Meta:
        model = Topic
        fields = (
            "id", "title", "description", "keywords", "max_students", "requirements",
            "department", "field", "cohort", "academic_year", "semester",
            "proposed_by", "proposed_by_detail", "status", "reviewed_by",
            "review_note", "created_at", "updated_at",
        )
        read_only_fields = ("status", "reviewed_by", "review_note", "created_at", "updated_at")


class TopicCreateSerializer(serializers.ModelSerializer):
    """Serializer riêng cho tạo mới — không cho set status/reviewed_by trực tiếp."""

    class Meta:
        model = Topic
        fields = (
            "id", "title", "description", "keywords", "max_students", "requirements",
            "department", "field", "cohort", "academic_year", "semester",
        )

    def create(self, validated_data):
        validated_data["proposed_by"] = self.context["request"].user
        return super().create(validated_data)


class TitleCheckSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500, required=True)


class SimilarityCheckDraftSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500, required=True)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    keywords = serializers.ListField(child=serializers.CharField(), required=False, default=list)


class ResubmitTopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = (
            "title", "description", "keywords", "max_students", "requirements",
            "department", "field", "cohort", "academic_year", "semester",
        )


class TopicSimilarityResultSerializer(serializers.ModelSerializer):
    similar_topic_title = serializers.CharField(source="similar_topic.title", read_only=True)

    class Meta:
        model = TopicSimilarityResult
        fields = ("id", "similar_topic", "similar_topic_title", "similarity_percent", "warning_level", "created_at")


class TopicHistorySerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.get_full_name", read_only=True)

    class Meta:
        model = TopicHistory
        fields = ("id", "action", "actor", "actor_name", "note", "created_at")


class TopicAssignmentSerializer(serializers.ModelSerializer):
    students_detail = UserSerializer(source="students", many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = TopicAssignment
        fields = (
            "id", "topic", "students", "students_detail", "assigned_by",
            "status", "status_display", "due_date", "assigned_at", "note",
        )
        read_only_fields = ("assigned_by", "assigned_at")


class ReviewActionSerializer(serializers.Serializer):
    """Body dùng chung cho approve / reject / request-rename."""
    note = serializers.CharField(required=False, allow_blank=True, default="")


class AssignTopicSerializer(serializers.Serializer):
    student_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    due_date = serializers.DateField(required=False, allow_null=True, default=None)
    note = serializers.CharField(required=False, allow_blank=True, default="")

