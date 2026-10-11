from rest_framework import serializers
from rest_framework.reverse import reverse

from apps.accounts.serializers import UserSerializer
from apps.common.validation import validate_academic_links, validate_optional_code

from .models import (
    Technology,
    Topic,
    TopicAssignment,
    TopicDocument,
    TopicFunction,
    TopicHistory,
    TopicSimilarityResult,
    TopicTechnology,
)


class TopicAcademicPeriodValidationMixin:
    def validate_topic_code(self, value):
        return validate_optional_code(Topic, "topic_code", value, self.instance)

    def validate(self, attrs):
        validate_academic_links(attrs, self.instance)
        request = self.context.get("request")
        department = attrs.get("department", getattr(self.instance, "department", None))
        if request and request.user.role == "teacher" and request.user.department_id and department and department.pk != request.user.department_id:
            raise serializers.ValidationError({"department": "Chỉ được đề xuất đề tài trong bộ môn của bạn."})
        if "max_students" in attrs and not 1 <= attrs["max_students"] <= 5:
            raise serializers.ValidationError({"max_students": "Chọn từ 1 đến 5 sinh viên."})
        if "keywords" in attrs and (not isinstance(attrs["keywords"], list) or any(not isinstance(item, str) for item in attrs["keywords"])):
            raise serializers.ValidationError({"keywords": "Từ khóa phải là danh sách chuỗi."})
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
            "id", "title", "description", "keywords", "max_students", "requirements", "department", "field", "cohort",
            "academic_year", "semester", "proposed_by", "proposed_by_detail",
            "department_name", "field_name", "cohort_name", "academic_year_name",
            "semester_name", "assignment_count",
            "topic_code", "major", "project_type", "architecture", "created_by",
            "status", "reviewed_by", "review_note", "created_at", "updated_at",
        )
        read_only_fields = ("proposed_by", "created_by", "status", "reviewed_by", "review_note", "created_at", "updated_at")


class TopicCreateSerializer(TopicAcademicPeriodValidationMixin, serializers.ModelSerializer):
    """Serializer riêng cho tạo mới — không cho set status/reviewed_by trực tiếp."""

    class Meta:
        model = Topic
        fields = (
            "id", "title", "description", "keywords", "max_students", "requirements", "department", "field",
            "cohort", "academic_year", "semester",
            "topic_code", "major", "project_type", "architecture",
        )

    def create(self, validated_data):
        validated_data["proposed_by"] = self.context["request"].user
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class TopicSimilarityResultSerializer(serializers.ModelSerializer):
    similar_topic_title = serializers.CharField(source="similar_topic.title", read_only=True)
    similar_topic_description = serializers.CharField(source="similar_topic.description", read_only=True)

    class Meta:
        model = TopicSimilarityResult
        fields = ("id", "similar_topic", "similar_topic_title", "similar_topic_description", "similarity_percent", "warning_level", "groq_score", "groq_explanation", "assessment_status", "created_at")


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
    topic_title = serializers.CharField(source="topic.title", read_only=True)
    proposed_by_detail = UserSerializer(source="topic.proposed_by", read_only=True)

    class Meta:
        model = TopicAssignment
        fields = (
            "id", "topic", "topic_title", "proposed_by_detail", "students",
            "students_detail", "assigned_by", "assigned_at", "note", "status", "due_date",
        )
        read_only_fields = ("assigned_by", "assigned_at")


class TechnologySerializer(serializers.ModelSerializer):
    class Meta:
        model = Technology
        fields = ("id", "name", "category", "description", "created_at")
        read_only_fields = ("id", "created_at")


class TopicTechnologySerializer(serializers.ModelSerializer):
    technology_detail = TechnologySerializer(source="technology", read_only=True)

    class Meta:
        model = TopicTechnology
        fields = ("id", "topic", "technology", "technology_detail", "is_primary", "created_at")
        read_only_fields = ("id", "created_at")


class TopicFunctionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TopicFunction
        fields = ("id", "topic", "function_name", "description", "created_at")
        read_only_fields = ("id", "created_at")


class TopicDocumentSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TopicDocument
        fields = (
            "id", "topic", "file", "file_name", "file_type", "file_size",
            "file_url", "uploaded_by", "uploaded_at",
        )
        read_only_fields = ("id", "file_name", "file_type", "file_size", "uploaded_by", "uploaded_at")

    def validate_file(self, uploaded_file):
        suffix = uploaded_file.name.rsplit(".", 1)[-1].lower() if "." in uploaded_file.name else ""
        if suffix not in {"pdf", "docx"}:
            raise serializers.ValidationError("Chỉ hỗ trợ tệp PDF hoặc DOCX.")
        if uploaded_file.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("Tệp vượt quá giới hạn 10 MB.")
        return uploaded_file

    def create(self, validated_data):
        uploaded_file = validated_data["file"]
        validated_data["file_name"] = uploaded_file.name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        validated_data["file_type"] = uploaded_file.name.rsplit(".", 1)[-1].upper()
        validated_data["file_size"] = uploaded_file.size
        return super().create(validated_data)

    def update(self, instance, validated_data):
        uploaded_file = validated_data.get("file")
        old_file = instance.file if uploaded_file else None
        if uploaded_file:
            validated_data["file_name"] = uploaded_file.name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
            validated_data["file_type"] = uploaded_file.name.rsplit(".", 1)[-1].upper()
            validated_data["file_size"] = uploaded_file.size
        instance = super().update(instance, validated_data)
        if old_file and old_file.name != instance.file.name:
            old_file.delete(save=False)
        return instance

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        url = reverse("topic-document-download", kwargs={"pk": obj.pk}, request=request)
        return url


class ReviewActionSerializer(serializers.Serializer):
    """Body dùng chung cho approve / reject / request-rename."""
    note = serializers.CharField(required=False, allow_blank=True, default="")


class AssignTopicSerializer(serializers.Serializer):
    due_date = serializers.DateField(required=False, allow_null=True)
    student_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class SimilarityCheckRequestSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=10000, required=False, allow_blank=True, default="")
    title = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    source_topic_id = serializers.IntegerField(required=False)
    top_k = serializers.IntegerField(min_value=1, max_value=100, default=10)

    def validate(self, attrs):
        if not attrs.get("title", "").strip() and not attrs.get("source_topic_id"):
            raise serializers.ValidationError({
                "title": "Nhập tên đề tài hoặc chọn một đề tài trong hệ thống."
            })
        return attrs
