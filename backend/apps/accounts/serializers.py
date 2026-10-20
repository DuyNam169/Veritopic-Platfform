from django.contrib.auth import get_user_model
from .models import Notification, AdvisorRequest
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.common.validation import validate_academic_links, validate_optional_code

User = get_user_model()


class AcademicProfileValidationMixin:
    def validate_lecturer_code(self, value):
        return validate_optional_code(User, "lecturer_code", value, self.instance)

    def validate_profile(self, attrs):
        request = self.context.get("request")
        department = request.user.department if request and request.user.role == "department_head" else None
        validate_academic_links(attrs, self.instance, department=department)
        role = attrs.get("role", getattr(self.instance, "role", "student"))
        code = attrs.get("lecturer_code", getattr(self.instance, "lecturer_code", ""))
        if code and role not in ("teacher", "department_head"):
            raise serializers.ValidationError({"lecturer_code": "Mã giảng viên chỉ dành cho giảng viên hoặc trưởng bộ môn."})
        if role != "student" and attrs.get("academic_year", getattr(self.instance, "academic_year", None)):
            raise serializers.ValidationError({"academic_year": "Năm học hồ sơ chỉ dành cho sinh viên."})


class UserSerializer(serializers.ModelSerializer):
    def update(self, instance, validated_data):
        # A profile edit must not overwrite academic fields changed concurrently.
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if validated_data:
            instance.save(update_fields=[*validated_data, "updated_at"])
        return instance

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "first_name", "last_name",
            "role", "avatar", "phone_number", "department", "cohort", "student_code",
            "class_name", "created_at", "last_login",
            "major", "academic_year", "lecturer_code", "academic_degree", "specialization", "date_of_birth", "gender", "student_status",
        )
        # This serializer is also used by /auth/me/.  Never let a user change
        # their own role (or any other account's password) through that route.
        read_only_fields = ("id", "role", "department", "cohort", "student_code", "created_at", "last_login", "username", "major", "academic_year", "lecturer_code", "academic_degree", "specialization", "date_of_birth", "gender", "student_status")

    def validate_email(self, value):
        existing = User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk if self.instance else None)
        if existing.exists():
            raise serializers.ValidationError("Email này đã được sử dụng.")
        return value

    def validate_avatar(self, value):
        allowed_types = {"image/jpeg", "image/png", "image/webp"}
        content_type = getattr(value, "content_type", "")
        if content_type not in allowed_types:
            raise serializers.ValidationError("Ảnh đại diện phải có định dạng JPG, PNG hoặc WebP.")
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("Ảnh đại diện không được lớn hơn 2 MB.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mật khẩu hiện tại không chính xác.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Mật khẩu xác nhận không khớp."})
        if attrs["new_password"] == attrs["old_password"]:
            raise serializers.ValidationError({"new_password": "Mật khẩu mới không được trùng với mật khẩu hiện tại."})
        return attrs

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class UserManagementSerializer(AcademicProfileValidationMixin, serializers.ModelSerializer):
    """Admin-only serializer; accepts an initial password for new accounts."""

    password = serializers.CharField(write_only=True, min_length=8, required=False)
    email = serializers.EmailField(required=True, allow_blank=False)
    department_name = serializers.CharField(source="department.name", read_only=True, allow_null=True)
    cohort_name = serializers.CharField(source="cohort.name", read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "password", "first_name", "last_name",
            "role", "avatar", "phone_number", "department", "cohort", "student_code",
            "class_name", "is_active", "department_name", "cohort_name",
            "major", "academic_year", "lecturer_code", "academic_degree", "specialization", "date_of_birth", "gender", "student_status",
        )
        read_only_fields = ("id", "avatar")

    def validate_email(self, value):
        existing = User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk if self.instance else None)
        if existing.exists():
            raise serializers.ValidationError("Email này đã được sử dụng.")
        return value

    def validate_username(self, value):
        username = value.strip()
        existing = User.objects.filter(username__iexact=username).exclude(
            pk=self.instance.pk if self.instance else None
        )
        if existing.exists():
            raise serializers.ValidationError("Tên đăng nhập này đã được sử dụng.")
        return username

    def validate(self, attrs):
        self.validate_profile(attrs)
        instance = self.instance
        if not instance and not attrs.get("password"):
            raise serializers.ValidationError({"password": "Mật khẩu ban đầu là bắt buộc."})
        role = attrs.get("role", instance.role if instance else User.Role.STUDENT)
        is_active = attrs.get("is_active", instance.is_active if instance else True)
        cohort = attrs.get("cohort", instance.cohort if instance else None)
        if (
            instance
            and instance.role == User.Role.ADMIN
            and instance.is_active
            and (role != User.Role.ADMIN or not is_active)
            and not User.objects.filter(role=User.Role.ADMIN, is_active=True)
            .exclude(pk=instance.pk)
            .exists()
        ):
            field = "role" if role != User.Role.ADMIN else "is_active"
            raise serializers.ValidationError({
                field: "Không thể khóa hoặc hạ quyền Quản trị viên hoạt động cuối cùng của hệ thống."
            })
        if (
            instance
            and instance.role == User.Role.DEPARTMENT_HEAD
            and role != User.Role.DEPARTMENT_HEAD
            and instance.headed_departments.exists()
        ):
            raise serializers.ValidationError({
                "role": "Không thể đổi vai trò vì tài khoản đang phụ trách một hoặc nhiều bộ môn."
            })
        if role != User.Role.STUDENT and cohort is not None:
            raise serializers.ValidationError({"cohort": "Chỉ tài khoản sinh viên mới được gắn với khóa học."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class PeopleProfileSerializer(AcademicProfileValidationMixin, serializers.ModelSerializer):
    """Manager-maintained academic profile without creating login credentials."""

    role = serializers.ChoiceField(choices=("teacher", "student"))
    email = serializers.EmailField(required=False, allow_blank=True)
    department_name = serializers.CharField(source="department.name", read_only=True, allow_null=True)
    cohort_name = serializers.CharField(source="cohort.name", read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "first_name", "last_name", "role",
            "phone_number", "department", "department_name", "cohort",
            "cohort_name", "student_code", "is_active",
            "class_name", "major", "academic_year", "lecturer_code", "academic_degree", "specialization", "date_of_birth", "gender", "student_status",
        )
        read_only_fields = ("id", "is_active")

    def validate_email(self, value):
        if value:
            existing = User.objects.filter(email__iexact=value).exclude(
                pk=self.instance.pk if self.instance else None
            )
            if existing.exists():
                raise serializers.ValidationError("Email này đã được sử dụng.")
        return value

    def validate_username(self, value):
        username = value.strip()
        existing = User.objects.filter(username__iexact=username).exclude(
            pk=self.instance.pk if self.instance else None
        )
        if existing.exists():
            raise serializers.ValidationError("Tên đăng nhập này đã được sử dụng.")
        return username

    def validate(self, attrs):
        self.validate_profile(attrs)
        role = attrs.get("role", self.instance.role if self.instance else None)
        if self.instance and role != self.instance.role:
            raise serializers.ValidationError({"role": "Không thể đổi vai trò trong màn hình hồ sơ."})
        cohort = attrs.get("cohort", self.instance.cohort if self.instance else None)
        if role != User.Role.STUDENT and cohort is not None:
            raise serializers.ValidationError({"cohort": "Chỉ hồ sơ sinh viên mới được gắn khóa học."})
        return attrs

    def create(self, validated_data):
        person = User(**validated_data)
        person.set_unusable_password()
        person.save()
        return person


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Nhúng thêm thông tin role vào payload JWT, giúp Frontend biết ngay vai trò sau khi đăng nhập."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.get_full_name() or user.username
        return token


class RegisterSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=("student",), default="student")
    """Sử dụng cho endpoint ?đăng ký công khai (AllowAny)."""
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = (
            "username", "email", "password", "first_name", "last_name",
            "role", "phone_number", "department", "student_code",
        )

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ForgotPasswordSerializer(serializers.Serializer):
    """Nhập email để yêu cầu mã OTP."""
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Không tìm thấy tài khoản với email này.")
        return value


class ResetPasswordSerializer(serializers.Serializer):
    """Xác thực OTP và đặt mật khẩu mới."""
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        validate_password(value)
        return value


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id", "recipient", "sender", "sender_name",
            "title", "message", "notification_type", "link",
            "is_read", "created_at"
        )
        read_only_fields = ("id", "recipient", "sender", "sender_name", "created_at")

    def get_sender_name(self, obj):
        if obj.sender:
            return obj.sender.get_full_name() or obj.sender.username
        return "Hệ thống"


class AdvisorRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_code = serializers.CharField(source="student.student_code", read_only=True)
    student_email = serializers.EmailField(source="student.email", read_only=True)
    class_name = serializers.CharField(source="student.class_name", read_only=True)
    cohort_name = serializers.CharField(source="student.cohort.name", read_only=True, allow_null=True)
    department_name = serializers.CharField(source="student.department.name", read_only=True, allow_null=True)
    teacher_name = serializers.SerializerMethodField()
    teacher_email = serializers.EmailField(source="teacher.email", read_only=True)
    teacher_degree = serializers.CharField(source="teacher.academic_degree", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = AdvisorRequest
        fields = (
            "id", "student", "student_name", "student_code", "student_email",
            "class_name", "cohort_name", "department_name",
            "teacher", "teacher_name", "teacher_email", "teacher_degree",
            "status", "status_display", "message", "response_note",
            "created_at", "updated_at"
        )
        read_only_fields = (
            "id", "student", "status", "created_at", "updated_at"
        )

    def get_student_name(self, obj):
        return obj.student.get_full_name() or obj.student.username

    def get_teacher_name(self, obj):
        return obj.teacher.get_full_name() or obj.teacher.username


class AdvisorRequestCreateSerializer(serializers.Serializer):
    teacher_id = serializers.IntegerField()
    message = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_teacher_id(self, value):
        try:
            teacher = User.objects.get(pk=value, role="teacher")
        except User.DoesNotExist:
            raise serializers.ValidationError("Giảng viên không tồn tại hoặc không hợp lệ.")
        return value


class AdvisorRequestRespondSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["accept", "reject"])
    response_note = serializers.CharField(required=False, allow_blank=True, default="")
