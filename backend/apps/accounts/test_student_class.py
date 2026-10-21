from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from apps.academics.models import StudentClass, Cohort, Department

User = get_user_model()


class StudentClassTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="class_admin", role="admin")
        self.department = Department.objects.create(name="Computing", code="CS")
        self.cohort = Cohort.objects.create(name="K73", start_year=2022, end_year=2026)
        self.first = StudentClass.objects.create(code="CNTT01", name="CNTT01", cohort=self.cohort, department=self.department)
        self.second = StudentClass.objects.create(code="CNTT02", name="CNTT02", cohort=self.cohort, department=self.department)
        self.client.force_authenticate(self.admin)

    def test_creation_requires_catalog_class_in_all_three_routes(self):
        for url in ("/api/v1/management/users/", "/api/v1/management/people/", "/api/v1/auth/register/"):
            with self.subTest(url=url):
                if url == "/api/v1/auth/register/":
                    self.client.force_authenticate(None)
                payload = {"username": f"student_{User.objects.count()}", "email": f"student_{User.objects.count()}@example.com", "password": "student-test-password", "role": "student"}
                for extra in ({}, {"student_class": None}, {"student_class": 999999}, {"class_name": "free text"}):
                    response = self.client.post(url, {**payload, **extra}, format="json")
                    self.assertEqual(response.status_code, 400, response.data)
                    self.assertIn("student_class", response.data)
                response = self.client.post(url, {**payload, "student_class": self.first.pk}, format="json")
                self.assertEqual(response.status_code, 201, response.data)
                student = User.objects.get(username=payload["username"])
                self.assertEqual((student.student_class_id, student.class_name, student.cohort_id, student.department_id), (self.first.pk, self.first.name, self.cohort.pk, self.department.pk))

    def test_update_search_and_rename_share_class(self):
        student = User.objects.create_user(username="class_student", role="student", student_class=self.first, cohort=self.cohort, department=self.department)
        for base in ("/api/v1/management/users/", "/api/v1/management/people/"):
            response = self.client.patch(f"{base}{student.pk}/", {"student_class": self.second.pk}, format="json")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["class_name"], self.second.name)
            response = self.client.get(base, {"search": self.second.name})
            self.assertEqual([item["id"] for item in response.data["results"]], [student.pk])
            self.assertEqual(self.client.patch(f"{base}{student.pk}/", {"student_class": None}, format="json").status_code, 400)
        response = self.client.patch(f"/api/v1/academics/classes/{self.second.pk}/", {"name": "Renamed class"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        student.refresh_from_db()
        self.assertEqual(student.class_name, "Renamed class")
        self.client.force_authenticate(student)
        response = self.client.patch("/api/v1/auth/me/", {"student_class": self.first.pk}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        student.refresh_from_db()
        self.assertEqual(student.class_name, self.first.name)

    def test_catalog_crud_permissions_unique_codes_and_protected_delete(self):
        url = "/api/v1/academics/classes/"
        response = self.client.post(url, {"code": " new01 ", "name": "New class"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["code"], "NEW01")
        self.assertEqual(self.client.post(url, {"code": "new01", "name": "Other"}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"code": "NEW02", "name": "new class"}, format="json").status_code, 400)
        User.objects.create_user(username="assigned", role="student", student_class=self.first)
        self.assertEqual(self.client.delete(f"{url}{self.first.pk}/").status_code, 400)
        self.assertEqual(self.client.delete(f"{url}{response.data['id']}/").status_code, 204)
        teacher = User.objects.create_user(username="class_teacher", role="teacher")
        self.client.force_authenticate(teacher)
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.post(url, {"code": "X", "name": "X"}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(f"{url}{self.first.pk}/", {"name": "X"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(f"{url}{self.first.pk}/").status_code, 403)

    def test_rejects_mismatched_academic_links_and_non_student_assignment(self):
        other = Cohort.objects.create(name="Other", start_year=2023, end_year=2027)
        payload = {"username": "mismatch", "email": "mismatch@example.com", "password": "student-test-password", "role": "student", "student_class": self.first.pk, "cohort": other.pk}
        response = self.client.post("/api/v1/management/users/", payload, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn("cohort", response.data)
        payload.update(role="teacher", cohort=None)
        response = self.client.post("/api/v1/management/users/", payload, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        student = User.objects.create_user(username="assigned", role="student", student_class=self.first)
        response = self.client.patch(f"/api/v1/academics/classes/{self.first.pk}/", {"cohort": other.pk}, format="json")
        self.assertEqual(response.status_code, 400, response.data)

    def test_legacy_unrelated_update_and_teacher_without_class(self):
        student = User.objects.create_user(username="legacy_student", role="student")
        response = self.client.patch(f"/api/v1/management/users/{student.pk}/", {"first_name": "Legacy"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.post("/api/v1/management/users/", {"username": "teacher_new", "email": "teacher@example.com", "password": "teacher-test-password", "role": "teacher"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)

    def test_personal_edit_preserves_concurrent_class_change(self):
        student = User.objects.create_user(username="concurrent_student", role="student", student_class=self.first)
        self.client.force_authenticate(student)
        User.objects.filter(pk=student.pk).update(student_class=self.second, class_name=self.second.name)
        response = self.client.patch("/api/v1/auth/me/", {"first_name": "Updated"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        student.refresh_from_db()
        self.assertEqual((student.student_class_id, student.class_name), (self.second.pk, self.second.name))
