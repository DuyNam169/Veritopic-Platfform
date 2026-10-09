from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id", "username", "email", "first_name", "last_name",
            "role", "avatar", "phone_number", "department", "cohort", "student_code",
            "created_at", "last_login",
        )
        # This serializer is also used by /auth/me/.  Never let a user change
        # their own role (or any other account's password) through that route.
        read_only_fields = ("id", "role", "department", "cohort", "student_code", "created_at", "last_login", "username")

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


class UserManagementSerializer(serializers.ModelSerializer):
    """Admin-only serializer; accepts an initial password for new accounts."""

    password = serializers.CharField(write_only=True, min_length=8, required=False)
    email = serializers.EmailField(required=True, allow_blank=False)
    department_name = serializers.CharField(source="department.name", read_only=True, allow_null=True)
    cohort_name = serializers.CharField(source="cohort.name", read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "password", "first_name", "last_name",
            "role", "avatar", "phone_number", "department", "cohort", "student_code", "is_active",
            "department_name", "cohort_name",
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


class PeopleProfileSerializer(serializers.ModelSerializer):
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
