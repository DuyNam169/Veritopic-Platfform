from rest_framework.routers import DefaultRouter

from .views import (
    AcademicYearViewSet,
    CohortViewSet,
    DepartmentViewSet,
    FieldViewSet,
    SemesterViewSet,
)

router = DefaultRouter()
router.register("cohorts", CohortViewSet, basename="cohort")
router.register("academic-years", AcademicYearViewSet, basename="academic-year")
router.register("semesters", SemesterViewSet, basename="semester")
router.register("departments", DepartmentViewSet, basename="department")
router.register("fields", FieldViewSet, basename="field")

urlpatterns = router.urls
