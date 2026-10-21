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
    StudentTopicProposal,
    TopicRegistration,
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
    can_register = serializers.SerializerMethodField()
    has_my_cohort_registered = serializers.SerializerMethodField()
    # Giảng viên cần biết đề tài đã được giao chưa để hiển thị đúng nút hành động
    is_assigned = serializers.SerializerMethodField()
    active_assignment_id = serializers.SerializerMethodField()

    def get_is_assigned(self, obj):
        """True nếu đề tài đang có ít nhất 1 lượt giao active."""
        return obj.assignments.filter(status="active").exists()

    def get_active_assignment_id(self, obj):
        """Trả về ID của assignment active đầu tiên, hoặc None nếu chưa giao."""
        assignment = obj.assignments.filter(status="active").first()
        return assignment.pk if assignment else None

    def get_has_my_cohort_registered(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user.role != "student" or not request.user.cohort_id:
            return False
        if obj.assignments.filter(status="active", students__cohort_id=request.user.cohort_id).exists():
            return True
        if obj.registrations.filter(status__in=["pending", "approved"], student__cohort_id=request.user.cohort_id).exists():
            return True
        return False

    def get_can_register(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user.role != "student":
            return False
        if obj.status != Topic.Status.APPROVED:
            return False
        from .models import TopicAssignment, TopicRegistration
        if TopicAssignment.objects.filter(students=request.user, status="active").exists():
            return False
        if TopicRegistration.objects.filter(student=request.user, status__in=["pending", "approved"]).exists():
            return False
        if self.get_has_my_cohort_registered(obj):
            return False
        return True

    class Meta:
        model = Topic
        fields = (
            "id", "title", "description", "keywords", "max_students", "requirements", "department", "field", "cohort",
            "academic_year", "semester", "proposed_by", "proposed_by_detail",
            "department_name", "field_name", "cohort_name", "academic_year_name",
            "semester_name", "assignment_count", "can_register", "has_my_cohort_registered",
            "is_assigned", "active_assignment_id",
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


class StudentTopicProposalSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_code = serializers.CharField(source="student.student_code", read_only=True)
    student_email = serializers.EmailField(source="student.email", read_only=True)
    class_name = serializers.CharField(source="student.class_name", read_only=True)
    teacher_name = serializers.SerializerMethodField()
    teacher_email = serializers.EmailField(source="teacher.email", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    field_name = serializers.CharField(source="field.name", read_only=True, allow_null=True)
    cohort_name = serializers.CharField(source="cohort.name", read_only=True)
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    semester_name = serializers.CharField(source="semester.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = StudentTopicProposal
        fields = (
            "id", "student", "student_name", "student_code", "student_email", "class_name",
            "teacher", "teacher_name", "teacher_email",
            "title", "description", "expected_technologies",
            "department", "department_name", "field", "field_name",
            "cohort", "cohort_name", "academic_year", "academic_year_name",
            "semester", "semester_name", "status", "status_display",
            "teacher_note", "created_topic", "created_at", "updated_at",
        )
        read_only_fields = ("id", "student", "status", "created_topic", "created_at", "updated_at")

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username

    def get_teacher_name(self, obj):
        return obj.teacher.get_full_name() or obj.teacher.username


class StudentTopicProposalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentTopicProposal
        fields = (
            "teacher", "title", "description", "expected_technologies",
            "department", "field", "cohort", "academic_year", "semester",
        )

    def validate_teacher(self, value):
        if value.role != "teacher":
            raise serializers.ValidationError("Người được chọn phải là giảng viên.")
        return value

    def validate_title(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Tên đề tài không được để trống.")
        return val


class StudentTopicProposalRespondSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject", "revision_requested"])
    teacher_note = serializers.CharField(required=False, allow_blank=True, default="")


class TopicRegistrationSerializer(serializers.ModelSerializer):
    topic_title = serializers.CharField(source="topic.title", read_only=True)
    topic_code = serializers.CharField(source="topic.topic_code", read_only=True)
    topic_cohort_name = serializers.CharField(source="topic.cohort.name", read_only=True)
    topic_teacher_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    student_code = serializers.CharField(source="student.student_code", read_only=True)
    student_cohort_name = serializers.CharField(source="student.cohort.name", read_only=True, allow_null=True)
    class_name = serializers.CharField(source="student.class_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = TopicRegistration
        fields = (
            "id", "topic", "topic_title", "topic_code", "topic_cohort_name", "topic_teacher_name",
            "student", "student_name", "student_code", "student_cohort_name", "class_name",
            "status", "status_display", "note", "teacher_note", "created_at", "updated_at",
        )
        read_only_fields = ("id", "student", "status", "created_at", "updated_at")

    def get_topic_teacher_name(self, obj):
        return obj.topic.proposed_by.get_full_name() or obj.topic.proposed_by.username

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username


class TopicRegistrationCreateSerializer(serializers.Serializer):
    topic_id = serializers.IntegerField()
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_topic_id(self, value):
        try:
            topic = Topic.objects.get(pk=value)
        except Topic.DoesNotExist:
            raise serializers.ValidationError("Đề tài không tồn tại.")
        if topic.status != Topic.Status.APPROVED:
            raise serializers.ValidationError("Chỉ có thể đăng ký đề tài đã được phê duyệt.")
        return value


class TopicRegistrationRespondSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
    teacher_note = serializers.CharField(required=False, allow_blank=True, default="")
