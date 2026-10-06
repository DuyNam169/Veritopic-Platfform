from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from .models import AcademicYear, Cohort, Department, Field, Semester
from apps.topics.models import Topic
from apps.topics.serializers import TopicCreateSerializer


class CatalogTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username="catalog_admin", role="admin")
        self.teacher = User.objects.create_user(username="catalog_teacher", role="teacher")
        self.head = User.objects.create_user(username="catalog_head", role="department_head")
        self.client.force_authenticate(self.admin)
        self.year = AcademicYear.objects.create(name="2025-2026", is_current=True)
        self.cohort = Cohort.objects.create(name="K65", start_year=2025, end_year=2029)
        self.department = Department.objects.create(name="CNTT", code="IT")
        self.field = Field.objects.create(name="Web")
        self.semester = Semester.objects.create(name="HK1", academic_year=self.year, start_date="2025-09-01", end_date="2026-01-31")

    def url(self, resource, obj=None):
        return reverse(resource + ("-detail" if obj else "-list"), kwargs={"pk": obj.pk} if obj else None)

    def test_admin_crud_all_catalogs(self):
        cases = [
            ("cohort", {"name": "K66", "start_year": 2026, "end_year": 2030}),
            ("academic-year", {"name": "2026-2027"}),
            ("semester", {"name": "HK2", "academic_year": self.year.pk, "start_date": "2026-02-01", "end_date": "2026-06-01"}),
            ("department", {"name": "Toán", "code": "MATH", "head": self.head.pk}),
            ("field", {"name": "AI"}),
        ]
        for resource, payload in cases:
            with self.subTest(resource=resource):
                response = self.client.post(self.url(resource), payload)
                self.assertEqual(response.status_code, 201, response.data)
                detail = reverse(resource + "-detail", kwargs={"pk": response.data["id"]})
                self.assertEqual(self.client.patch(detail, {"name": payload["name"] + " mới"}).status_code, 200)
                self.assertEqual(self.client.delete(detail).status_code, 204)

    def test_roles_read_only_and_anonymous_denied(self):
        for role in ("teacher", "student", "department_head"):
            self.teacher.role = role
            self.teacher.save()
            self.client.force_authenticate(self.teacher)
            for resource, obj in (("cohort", self.cohort), ("academic-year", self.year), ("semester", self.semester), ("department", self.department), ("field", self.field)):
                self.assertEqual(self.client.get(self.url(resource)).status_code, 200)
                self.assertEqual(self.client.post(self.url(resource), {"name": "X"}).status_code, 403)
                self.assertEqual(self.client.patch(self.url(resource, obj), {"name": "X"}).status_code, 403)
                self.assertEqual(self.client.delete(self.url(resource, obj)).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url("cohort")).status_code, 401)

    def test_current_year_switch_and_failed_update_rollback(self):
        response = self.client.post(self.url("academic-year"), {"name": "2026-2027", "is_current": True})
        self.assertEqual(response.status_code, 201)
        self.year.refresh_from_db()
        self.assertFalse(self.year.is_current)
        self.assertEqual(AcademicYear.objects.filter(is_current=True).count(), 1)
        self.assertEqual(self.client.patch(self.url("academic-year", self.year), {"is_current": True}).status_code, 200)
        self.assertEqual(AcademicYear.objects.get(is_current=True), self.year)
        self.assertEqual(self.client.patch(self.url("academic-year", self.year), {"name": "2026-2027", "is_current": True}).status_code, 400)
        self.assertEqual(AcademicYear.objects.get(is_current=True), self.year)

    def test_validation_and_semester_filter(self):
        self.assertEqual(self.client.patch(self.url("cohort", self.cohort), {"end_year": 2020}).status_code, 400)
        self.assertEqual(self.client.patch(self.url("semester", self.semester), {"end_date": "2025-01-01"}).status_code, 400)
        self.assertEqual(self.client.post(self.url("semester"), {"name": "HK1", "academic_year": self.year.pk, "start_date": "2025-09-01", "end_date": "2026-01-31"}).status_code, 400)
        self.assertEqual(self.client.post(self.url("semester"), {"name": " hk1 ", "academic_year": self.year.pk, "start_date": "2025-09-01", "end_date": "2026-01-31"}).status_code, 400)
        self.assertEqual(self.client.post(self.url("semester"), {"name": "HK2", "start_date": "2026-02-01", "end_date": "2026-06-01"}).status_code, 400)
        other = AcademicYear.objects.create(name="2027-2028")
        self.assertEqual(self.client.post(self.url("semester"), {"name": "HK1", "academic_year": other.pk, "start_date": "2027-09-01", "end_date": "2028-01-31"}).status_code, 201)
        self.assertEqual(self.client.get(self.url("semester"), {"academic_year": other.pk}).data["count"], 1)
        self.assertEqual(self.client.patch(self.url("department", self.department), {"head": self.teacher.pk}).status_code, 400)
        for resource in ("cohort", "academic-year", "department", "field"):
            self.assertEqual(self.client.post(self.url(resource), {"name": "   "}).status_code, 400)
        self.assertEqual(self.client.post(self.url("field"), {"name": "Web"}).status_code, 400)
        self.assertEqual(self.client.post(self.url("field"), {"name": " web "}).status_code, 400)
        self.assertEqual(self.client.post(self.url("cohort"), {"name": " k65 ", "start_year": 2025, "end_year": 2029}).status_code, 400)
        self.assertEqual(self.client.post(self.url("academic-year"), {"name": " 2025-2026 "}).status_code, 400)
        self.assertEqual(self.client.post(self.url("department"), {"name": "Other", "code": "IT"}).status_code, 400)
        self.assertEqual(self.client.post(self.url("department"), {"name": " cntt ", "code": "OTHER"}).status_code, 400)
        self.assertEqual(self.client.post(self.url("department"), {"name": "Other", "code": " it "}).status_code, 400)

    def test_deletion_protection_and_field_unassignment(self):
        year_response = self.client.delete(self.url("academic-year", self.year))
        self.assertEqual(year_response.status_code, 400)
        self.assertIn("học kỳ", year_response.data["detail"])
        self.teacher.department = self.department
        self.teacher.save()
        department_response = self.client.delete(self.url("department", self.department))
        self.assertEqual(department_response.status_code, 400)
        self.assertIn("tài khoản người dùng", department_response.data["detail"])
        topic = Topic.objects.create(title="Test", department=self.department, field=self.field, cohort=self.cohort, academic_year=self.year, semester=self.semester, proposed_by=self.teacher)
        semester_response = self.client.delete(self.url("semester", self.semester))
        self.assertEqual(semester_response.status_code, 400)
        self.assertIn("đề tài", semester_response.data["detail"])
        response = self.client.delete(self.url("cohort", self.cohort))
        self.assertEqual(response.status_code, 400)
        self.assertIn("đề tài", response.data["detail"])
        department_response = self.client.delete(self.url("department", self.department))
        self.assertIn("đề tài", department_response.data["detail"])
        for resource, obj in (("cohort", self.cohort), ("academic-year", self.year), ("semester", self.semester), ("department", self.department)):
            self.assertEqual(self.client.delete(self.url(resource, obj)).status_code, 400)
        self.assertEqual(self.client.delete(self.url("field", self.field)).status_code, 204)
        topic.refresh_from_db()
        self.assertIsNone(topic.field_id)
        other = AcademicYear.objects.create(name="2028-2029")
        self.assertEqual(self.client.patch(self.url("semester", self.semester), {"academic_year": other.pk}).status_code, 400)

    def test_cohort_used_by_student_account_cannot_be_deleted(self):
        student_cohort = Cohort.objects.create(name="K67", start_year=2027, end_year=2031)
        get_user_model().objects.create_user(username="student_k67", role="student", cohort=student_cohort)

        response = self.client.delete(self.url("cohort", student_cohort))

        self.assertEqual(response.status_code, 400)
        self.assertIn("tài khoản sinh viên", response.data["detail"])

    def test_topic_semester_must_belong_to_selected_academic_year(self):
        other_year = AcademicYear.objects.create(name="2029-2030")
        other_semester = Semester.objects.create(
            name="HK1",
            academic_year=other_year,
            start_date="2029-09-01",
            end_date="2030-01-31",
        )
        serializer = TopicCreateSerializer(data={
            "title": "Đề tài sai niên khóa",
            "department": self.department.pk,
            "field": self.field.pk,
            "cohort": self.cohort.pk,
            "academic_year": self.year.pk,
            "semester": other_semester.pk,
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn("semester", serializer.errors)

    def test_topic_field_is_optional(self):
        serializer = TopicCreateSerializer(data={
            "title": "Đề tài chưa phân loại lĩnh vực",
            "department": self.department.pk,
            "cohort": self.cohort.pk,
            "academic_year": self.year.pk,
            "semester": self.semester.pk,
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
