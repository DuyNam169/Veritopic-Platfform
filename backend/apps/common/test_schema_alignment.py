from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from apps.academics.models import AcademicYear, Cohort, Department, Major, Semester
from apps.topics.models import Topic


class SchemaAlignmentTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username="schema_admin", role="admin")
        self.department = Department.objects.create(name="Computing", code="CS")
        self.other = Department.objects.create(name="Engineering", code="EN")
        self.major = Major.objects.create(name="Software", code="SE", department=self.department)
        self.other_major = Major.objects.create(name="Embedded", code="EM", department=self.other)
        self.teacher = User.objects.create_user(username="schema_teacher", role="teacher", department=self.department)
        self.student = User.objects.create_user(username="schema_student", role="student", department=self.department)
        self.year = AcademicYear.objects.create(name="2026-2027")
        self.cohort = Cohort.objects.create(name="K74", start_year=2026, end_year=2030, major=self.major)
        self.semester = Semester.objects.create(name="HK1", academic_year=self.year, start_date="2026-09-01", end_date="2027-01-31")
        self.client.force_authenticate(self.admin)

    def test_major_catalog_permissions_unique_code_and_protected_delete(self):
        url = reverse("major-list")
        response = self.client.post(url, {"name": "Networks", "code": " net ", "department": self.department.pk})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["code"], "NET")
        self.assertEqual(self.client.post(url, {"name": "Duplicate", "code": "net", "department": self.department.pk}).status_code, 400)
        detail = reverse("major-detail", kwargs={"pk": self.major.pk})
        self.assertEqual(self.client.delete(detail).status_code, 400)
        self.assertEqual(self.client.patch(detail, {"department": self.other.pk}).status_code, 400)
        self.client.force_authenticate(self.teacher)
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.post(url, {"name": "Unauthorized"}).status_code, 403)

    def test_optional_codes_and_semester_number_do_not_break_existing_data(self):
        url = reverse("semester-list")
        payload = {"name": "HK2", "academic_year": self.year.pk, "start_date": "2027-02-01", "end_date": "2027-06-30"}
        self.assertEqual(self.client.post(url, payload).status_code, 201)
        payload.update(name="HK3", semester_number=1)
        self.assertEqual(self.client.post(url, payload).status_code, 201)
        payload["name"] = "Other"
        self.assertEqual(self.client.post(url, payload).status_code, 400)
        payload["semester_number"] = 4
        self.assertEqual(self.client.post(url, payload).status_code, 400)
        cohort_url = reverse("cohort-list")
        data = {"name": "K75", "start_year": 2027, "end_year": 2031, "code": "75CS", "major": self.major.pk}
        self.assertEqual(self.client.post(cohort_url, data).status_code, 201)
        data.update(name="Other", code="75cs")
        self.assertEqual(self.client.post(cohort_url, data).status_code, 400)

    def test_academic_year_dates_and_department_description(self):
        response = self.client.patch(reverse("academic-year-detail", kwargs={"pk": self.year.pk}), {"start_date": "2026-09-01", "end_date": "2027-08-31", "is_active": True})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.patch(reverse("academic-year-detail", kwargs={"pk": self.year.pk}), {"end_date": "2025-01-01"}).status_code, 400)
        response = self.client.patch(reverse("department-detail", kwargs={"pk": self.department.pk}), {"description": "Faculty description"})
        self.assertEqual(response.data["description"], "Faculty description")

    def test_profile_fields_persist_and_relationships_validated(self):
        url = f"/api/v1/management/people/{self.student.pk}/"
        data = {"major": self.major.pk, "cohort": self.cohort.pk, "academic_year": self.year.pk, "date_of_birth": "2004-01-01", "gender": "female", "class_name": "Class A", "student_status": "graduated"}
        response = self.client.patch(url, data)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["student_status"], "graduated")
        self.assertEqual(self.client.patch(url, {"major": self.other_major.pk}).status_code, 400)
        self.assertEqual(self.client.patch(url, {"lecturer_code": "GV001"}).status_code, 400)
        self.client.force_authenticate(self.student)
        response = self.client.patch("/api/v1/auth/me/", {"major": self.other_major.pk, "student_status": "active"})
        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.major, self.major)
        self.assertEqual(self.student.student_status, "graduated")

    def test_lecturer_code_and_academic_profile(self):
        url = f"/api/v1/management/people/{self.teacher.pk}/"
        response = self.client.patch(url, {"lecturer_code": " gv001 ", "academic_degree": "Master", "specialization": "AI"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["lecturer_code"], "GV001")
        other_teacher = get_user_model().objects.create_user(username="second_teacher", role="teacher", department=self.department)
        self.assertEqual(self.client.patch(f"/api/v1/management/people/{other_teacher.pk}/", {"lecturer_code": "gv001"}).status_code, 400)

    def test_topic_fields_author_and_major_integrity(self):
        self.client.force_authenticate(self.teacher)
        payload = {"title": "Schema topic", "department": self.department.pk, "major": self.major.pk, "cohort": self.cohort.pk, "academic_year": self.year.pk, "semester": self.semester.pk, "topic_code": " tc001 ", "project_type": "Application", "architecture": "Microservices"}
        with patch("apps.topics.views.propose_topic", return_value={"exact_duplicate": False, "similar_results": []}):
            response = self.client.post("/api/v1/topics/topics/", payload)
        self.assertEqual(response.status_code, 201, response.data)
        topic = Topic.objects.get(pk=response.data["id"])
        self.assertEqual(topic.created_by, self.teacher)
        self.assertEqual(topic.topic_code, "TC001")
        self.assertEqual(topic.architecture, "Microservices")
        self.assertEqual(self.client.post("/api/v1/topics/topics/", payload).status_code, 400)
        payload.update(topic_code="TC002", major=self.other_major.pk)
        self.assertEqual(self.client.post("/api/v1/topics/topics/", payload).status_code, 400)
