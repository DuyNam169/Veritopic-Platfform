from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import AcademicYear, Cohort, Department, Field, Semester


class CohortSerializer(serializers.ModelSerializer):
    def validate_name(self, value):
        name = value.strip()
        existing = Cohort.objects.filter(name__iexact=name)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("Tên khóa học đã tồn tại.")
        return name

    def validate(self, attrs):
        start = attrs.get("start_year", getattr(self.instance, "start_year", None))
        end = attrs.get("end_year", getattr(self.instance, "end_year", None))
        if start is not None and end is not None and end < start:
            raise serializers.ValidationError({"end_year": "Năm kết thúc không được trước năm bắt đầu."})
        return attrs

    class Meta:
        model = Cohort
        fields = "__all__"


class AcademicYearSerializer(serializers.ModelSerializer):
    # Switching the current year is handled atomically by the model.
    is_current = serializers.BooleanField(required=False)

    def validate_name(self, value):
        name = value.strip()
        existing = AcademicYear.objects.filter(name__iexact=name)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("Tên năm học đã tồn tại.")
        return name

    class Meta:
        model = AcademicYear
        fields = "__all__"


class SemesterSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        name = attrs.get("name", getattr(self.instance, "name", "")).strip()
        academic_year = attrs.get(
            "academic_year", getattr(self.instance, "academic_year", None)
        )
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if "name" in attrs:
            attrs["name"] = name
        if name and academic_year:
            existing = Semester.objects.filter(
                academic_year=academic_year,
                name__iexact=name,
            )
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError({
                    "name": "Tên học kỳ đã tồn tại trong năm học này."
                })
        if start is not None and end is not None and end < start:
            raise serializers.ValidationError({"end_date": "Ngày kết thúc không được trước ngày bắt đầu."})
        if self.instance and "academic_year" in attrs and attrs["academic_year"].pk != self.instance.academic_year_id and self.instance.topics.exists():
            raise serializers.ValidationError({"academic_year": "Không thể đổi năm học khi học kỳ đang có đề tài."})
        return attrs

    class Meta:
        model = Semester
        fields = "__all__"


class DepartmentSerializer(serializers.ModelSerializer):
    head = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.filter(role="department_head"),
        allow_null=True, required=False,
    )
    head_name = serializers.SerializerMethodField()

    def get_head_name(self, obj):
        return (obj.head.get_full_name() or obj.head.username) if obj.head else None

    def validate_name(self, value):
        name = value.strip()
        existing = Department.objects.filter(name__iexact=name)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("Tên bộ môn đã tồn tại.")
        return name

    def validate_code(self, value):
        code = value.strip().upper()
        existing = Department.objects.filter(code__iexact=code)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("Mã bộ môn đã tồn tại.")
        return code

    class Meta:
        model = Department
        fields = "__all__"


class FieldSerializer(serializers.ModelSerializer):
    def validate_name(self, value):
        name = value.strip()
        existing = Field.objects.filter(name__iexact=name)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("Tên lĩnh vực đề tài đã tồn tại.")
        return name

    class Meta:
        model = Field
        fields = "__all__"
