from rest_framework import serializers

from apps.accounts.serializers import UserSerializer

from .models import Topic, TopicAssignment, TopicHistory, TopicSimilarityResult


class TopicAcademicPeriodValidationMixin:
    def validate(self, attrs):
        academic_year = attrs.get(
            "academic_year", getattr(self.instance, "academic_year", None)
        )
        semester = attrs.get("semester", getattr(self.instance, "semester", None))
        if academic_year and semester and semester.academic_year_id != academic_year.pk:
            raise serializers.ValidationError({
                "semester": "Học kỳ phải thuộc năm học đã chọn."
            })
        return attrs


class TopicSerializer(TopicAcademicPeriodValidationMixin, serializers.ModelSerializer):
    proposed_by_detail = UserSerializer(source="proposed_by", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    field_name = serializers.CharField(source="field.name", read_only=True, allow_null=True)
    cohort_name = serializers.CharField(source="cohort.name", read_only=True)
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    semester_name = serializers.CharField(source="semester.name", read_only=True)
    assignment_count = serializers.IntegerField(source="assignments.count", read_only=True)

    class Meta:
        model = Topic
        fields = (
            "id", "title", "description", "department", "field", "cohort",
            "academic_year", "semester", "proposed_by", "proposed_by_detail",
            "department_name", "field_name", "cohort_name", "academic_year_name",
            "semester_name", "assignment_count",
            "status", "reviewed_by", "review_note", "created_at", "updated_at",
        )
        read_only_fields = ("status", "reviewed_by", "review_note", "created_at", "updated_at")


class TopicCreateSerializer(TopicAcademicPeriodValidationMixin, serializers.ModelSerializer):
    """Serializer riêng cho tạo mới — không cho set status/reviewed_by trực tiếp."""

    class Meta:
        model = Topic
        fields = (
            "id", "title", "description", "department", "field",
            "cohort", "academic_year", "semester",
        )

    def create(self, validated_data):
        validated_data["proposed_by"] = self.context["request"].user
        return super().create(validated_data)


class TopicSimilarityResultSerializer(serializers.ModelSerializer):
    similar_topic_title = serializers.CharField(source="similar_topic.title", read_only=True)

    class Meta:
        model = TopicSimilarityResult
        fields = ("id", "similar_topic", "similar_topic_title", "similarity_percent", "warning_level", "created_at")


class TopicHistorySerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    def get_actor_name(self, obj):
        if not obj.actor:
            return ""
        return obj.actor.get_full_name() or obj.actor.username

    class Meta:
        model = TopicHistory
        fields = ("id", "action", "actor", "actor_name", "note", "created_at")


class TopicAssignmentSerializer(serializers.ModelSerializer):
    students_detail = UserSerializer(source="students", many=True, read_only=True)

    class Meta:
        model = TopicAssignment
        fields = ("id", "topic", "students", "students_detail", "assigned_by", "assigned_at", "note")
        read_only_fields = ("assigned_by", "assigned_at")


class ReviewActionSerializer(serializers.Serializer):
    """Body dùng chung cho approve / reject / request-rename."""
    note = serializers.CharField(required=False, allow_blank=True, default="")


class AssignTopicSerializer(serializers.Serializer):
    student_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    note = serializers.CharField(required=False, allow_blank=True, default="")
