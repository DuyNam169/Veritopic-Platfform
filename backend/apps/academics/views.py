from rest_framework import viewsets

from apps.common.permissions import ReadOnlyOrAdmin

from .models import AcademicYear, Cohort, Department, Field, Semester
from .serializers import (
    AcademicYearSerializer,
    CohortSerializer,
    DepartmentSerializer,
    FieldSerializer,
    SemesterSerializer,
)


class CohortViewSet(viewsets.ModelViewSet):
    """/api/v1/academics/cohorts/ — Quản lý khóa học. Ai đăng nhập cũng xem được, chỉ Admin sửa/xóa."""
    queryset = Cohort.objects.all()
    serializer_class = CohortSerializer
    permission_classes = (ReadOnlyOrAdmin,)


class AcademicYearViewSet(viewsets.ModelViewSet):
    """/api/v1/academics/academic-years/"""
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = (ReadOnlyOrAdmin,)


class SemesterViewSet(viewsets.ModelViewSet):
    """/api/v1/academics/semesters/"""
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer
    permission_classes = (ReadOnlyOrAdmin,)
    filterset_fields = ("academic_year",)


class DepartmentViewSet(viewsets.ModelViewSet):
    """/api/v1/academics/departments/"""
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = (ReadOnlyOrAdmin,)


class FieldViewSet(viewsets.ModelViewSet):
    """/api/v1/academics/fields/ — Lĩnh vực đề tài (Web, Mobile, AI...)."""
    queryset = Field.objects.all()
    serializer_class = FieldSerializer
    permission_classes = (ReadOnlyOrAdmin,)
