from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError

from apps.common.permissions import ReadOnlyOrAdmin

from .models import AcademicYear, Cohort, Department, Field, Semester
from .serializers import (
    AcademicYearSerializer,
    CohortSerializer,
    DepartmentSerializer,
    FieldSerializer,
    SemesterSerializer,
)


class CatalogViewSet(viewsets.ModelViewSet):
    permission_classes = (ReadOnlyOrAdmin,)

    def perform_destroy(self, instance):
        try:
            with transaction.atomic():
                instance.delete()
        except ProtectedError:
            raise ValidationError({"detail": "Không thể xóa: danh mục đang có học kỳ, đề tài hoặc tài khoản người dùng trực thuộc."})

    def save_catalog(self, serializer):
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            raise ValidationError({"detail": "Dữ liệu bị trùng hoặc vừa được thay đổi. Vui lòng tải lại và thử lại."})

    def perform_create(self, serializer):
        self.save_catalog(serializer)

    def perform_update(self, serializer):
        self.save_catalog(serializer)


class CohortViewSet(CatalogViewSet):
    """/api/v1/academics/cohorts/ — Quản lý khóa học. Ai đăng nhập cũng xem được, chỉ Admin sửa/xóa."""
    queryset = Cohort.objects.all()
    serializer_class = CohortSerializer
    permission_classes = (ReadOnlyOrAdmin,)

    def perform_destroy(self, instance):
        references = []
        if instance.topics.exists():
            references.append("đề tài")
        if instance.students.exists():
            references.append("tài khoản sinh viên")
        if references:
            raise ValidationError({
                "detail": f"Không thể xóa khóa học vì đang được sử dụng bởi {' và '.join(references)}."
            })
        super().perform_destroy(instance)


class AcademicYearViewSet(CatalogViewSet):
    """/api/v1/academics/academic-years/"""
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = (ReadOnlyOrAdmin,)

    def perform_destroy(self, instance):
        references = []
        if instance.semesters.exists():
            references.append("học kỳ")
        if instance.topics.exists():
            references.append("đề tài")
        if references:
            raise ValidationError({
                "detail": f"Không thể xóa năm học vì đang có {' và '.join(references)} trực thuộc."
            })
        super().perform_destroy(instance)


class SemesterViewSet(CatalogViewSet):
    """/api/v1/academics/semesters/"""
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer
    permission_classes = (ReadOnlyOrAdmin,)
    filterset_fields = ("academic_year",)

    def perform_destroy(self, instance):
        if instance.topics.exists():
            raise ValidationError({
                "detail": "Không thể xóa học kỳ vì đang có đề tài trực thuộc."
            })
        super().perform_destroy(instance)


class DepartmentViewSet(CatalogViewSet):
    """/api/v1/academics/departments/"""
    queryset = Department.objects.select_related("head").all()
    serializer_class = DepartmentSerializer
    permission_classes = (ReadOnlyOrAdmin,)

    def perform_destroy(self, instance):
        references = []
        if instance.topics.exists():
            references.append("đề tài")
        if instance.members.exists():
            references.append("tài khoản người dùng")
        if references:
            raise ValidationError({
                "detail": f"Không thể xóa bộ môn vì đang có {' và '.join(references)} trực thuộc."
            })
        super().perform_destroy(instance)


class FieldViewSet(CatalogViewSet):
    """/api/v1/academics/fields/ — Lĩnh vực đề tài (Web, Mobile, AI...)."""
    queryset = Field.objects.all()
    serializer_class = FieldSerializer
    permission_classes = (ReadOnlyOrAdmin,)
