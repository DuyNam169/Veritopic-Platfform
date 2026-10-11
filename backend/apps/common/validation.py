from rest_framework import serializers


def validate_academic_links(attrs, instance=None, department=None):
    """Validate supplied or retained relations without assigning inferred data."""
    def value(name):
        return attrs.get(name, getattr(instance, name, None))

    major, cohort = value("major"), value("cohort")
    department = value("department") or department
    if major and department and major.department_id != department.pk:
        raise serializers.ValidationError({"major": "Chuyên ngành phải thuộc bộ môn đã chọn."})
    if cohort and cohort.major_id:
        if major and cohort.major_id != major.pk:
            raise serializers.ValidationError({"cohort": "Khóa học phải thuộc chuyên ngành đã chọn."})
        if department and cohort.major.department_id != department.pk:
            raise serializers.ValidationError({"cohort": "Khóa học phải thuộc bộ môn đã chọn."})


def validate_optional_code(model, field, value, instance=None):
    code = value.strip().upper()
    if code and model.objects.filter(**{f"{field}__iexact": code}).exclude(pk=instance.pk if instance else None).exists():
        raise serializers.ValidationError("Mã đã tồn tại.")
    return code
