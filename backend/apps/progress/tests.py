import tempfile
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase
from apps.academics.models import Department, Cohort, AcademicYear, Semester
from apps.topics.models import Topic, TopicAssignment
from .models import ProgressReport


class UnifiedRoleWorkflowTests(APITestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        self.settings = override_settings(MEDIA_ROOT=self.media.name)
        self.settings.enable()
        self.addCleanup(self.settings.disable)
        User = get_user_model()
        self.department = Department.objects.create(name="Computing", code="CS")
        self.other_department = Department.objects.create(name="Electronics", code="EE")
        self.cohort = Cohort.objects.create(name="K74", start_year=2026, end_year=2030)
        self.year = AcademicYear.objects.create(name="2026-2027")
        self.semester = Semester.objects.create(name="Semester 1", academic_year=self.year, start_date="2026-09-01", end_date="2027-01-01")
        self.users = {role: User.objects.create_user(username=role, role=role, department=self.department) for role in ("admin", "department_head", "teacher", "student")}
        self.outsider = User.objects.create_user(username="outsider", role="student", department=self.other_department)
        self.other_teacher = User.objects.create_user(username="other_teacher", role="teacher", department=self.other_department)
        self.topic = self.make_topic(self.users["teacher"], self.department)
        self.foreign_topic = self.make_topic(self.other_teacher, self.other_department)
        self.assignment = TopicAssignment.objects.create(topic=self.topic, assigned_by=self.users["teacher"])
        self.assignment.students.add(self.users["student"])
        self.foreign = TopicAssignment.objects.create(topic=self.foreign_topic, assigned_by=self.other_teacher)
        self.foreign.students.add(self.outsider)
        self.base = "/api/v1/progress/projects/"

    def make_topic(self, teacher, department):
        return Topic.objects.create(title=f"Project {teacher.username}", department=department, cohort=self.cohort, academic_year=self.year, semester=self.semester, proposed_by=teacher, status="approved", max_students=1)

    def auth(self, role):
        self.client.force_authenticate(self.users[role])

    def test_projects_scoped_for_each_role(self):
        for role in self.users:
            self.auth(role)
            response = self.client.get(self.base)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual({p["assignment_id"] for p in response.data}, {self.assignment.pk, self.foreign.pk} if role == "admin" else {self.assignment.pk})
            self.assertEqual(self.client.get(f"{self.base}{self.foreign.pk}/").status_code, 200 if role == "admin" else 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.base).status_code, 401)

    def test_student_reports_teacher_feedback_and_download(self):
        self.auth("student")
        response = self.client.post(f"{self.base}{self.assignment.pk}/reports/", {"period_label": "Week 1", "content": "Prototype", "percent": 30, "attachment": SimpleUploadedFile("report.pdf", b"%PDF-1.4", content_type="application/pdf")}, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        report = response.data["id"]
        for role in self.users:
            self.auth(role)
            download = self.client.get(f"/api/v1/progress/reports/{report}/download-attachment/")
            self.assertEqual(download.status_code, 200)
            self.assertTrue(b"".join(download.streaming_content).startswith(b"%PDF"))
        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(f"/api/v1/progress/reports/{report}/download-attachment/").status_code, 403)
        self.client.force_authenticate(self.other_teacher)
        self.assertEqual(self.client.post(f"/api/v1/progress/reports/{report}/feedback/", {"comment": "Review"}).status_code, 403)
        self.auth("teacher")
        self.assertEqual(self.client.post(f"/api/v1/progress/reports/{report}/feedback/", {"comment": "Review", "score": 11}).status_code, 400)
        self.assertEqual(self.client.post(f"/api/v1/progress/reports/{report}/feedback/", {"comment": "Review", "score": 8}).status_code, 201)
        self.auth("student")
        reports = self.client.get(f"{self.base}{self.assignment.pk}/reports/").data
        self.assertEqual(reports[0]["feedbacks"][0]["score"], 8)

    def test_report_creation_restricted_to_active_assigned_students(self):
        payload = {"period_label": "Week 1", "content": "Done", "percent": 20}
        for role in ("admin", "department_head", "teacher"):
            self.auth(role)
            self.assertEqual(self.client.post(f"{self.base}{self.assignment.pk}/reports/", payload).status_code, 403)
        self.auth("student")
        self.assertEqual(self.client.post(f"{self.base}{self.foreign.pk}/reports/", payload).status_code, 404)
        self.assignment.status = "completed"
        self.assignment.save()
        self.assertEqual(self.client.post(f"{self.base}{self.assignment.pk}/reports/", payload).status_code, 403)
        self.assertFalse(ProgressReport.objects.exists())

    def test_assignment_validation_and_status(self):
        self.auth("teacher")
        url = f"/api/v1/topics/topics/{self.topic.pk}/assign/"
        for ids in ([self.users["student"].pk], [self.users["teacher"].pk], [self.outsider.pk]):
            self.assertEqual(self.client.post(url, {"student_ids": ids}, format="json").status_code, 400)
        User = get_user_model()
        student = User.objects.create_user(username="new_student", role="student", department=self.department, cohort=self.cohort)
        self.assertEqual(self.client.post(url, {"student_ids": [student.pk, student.pk]}, format="json").status_code, 400)
        response = self.client.post(url, {"student_ids": [student.pk], "due_date": "2027-01-01"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["due_date"], "2027-01-01")
        status_url = f"/api/v1/topics/assignments/{response.data['id']}/update-status/"
        self.auth("student")
        self.assertEqual(self.client.patch(status_url, {"status": "completed"}).status_code, 403)
        self.auth("teacher")
        self.assertEqual(self.client.patch(status_url, {"status": "completed"}).status_code, 200)

    def test_teacher_apis_mine_and_resubmit(self):
        self.auth("teacher")
        response = self.client.get("/api/v1/topics/topics/", {"mine": "true"})
        self.assertEqual([t["id"] for t in response.data["results"]], [self.topic.pk])
        self.assertEqual(self.client.get("/api/v1/topics/my-students/").data[0]["student_id"], self.users["student"].pk)
        self.assertEqual(self.client.post("/api/v1/topics/topics/check-title/", {"title": self.topic.title}).data["exact_duplicate"], True)
        pending = self.make_topic(self.users["teacher"], self.department)
        pending.status = "rejected"
        pending.save()
        with patch("apps.topics.views.refresh_similarity_results"):
            response = self.client.post(f"/api/v1/topics/topics/{pending.pk}/resubmit/", {"title": "Updated", "keywords": ["AI"], "requirements": "Python", "max_students": 2}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["keywords"], ["AI"])

    def test_department_directory_cannot_access_other_departments(self):
        self.auth("department_head")
        response = self.client.get("/api/v1/management/people/")
        self.assertNotIn(self.outsider.pk, [p["id"] for p in response.data["results"]])
        self.assertEqual(self.client.patch(f"/api/v1/management/people/{self.outsider.pk}/", {"first_name": "Changed"}).status_code, 404)
        self.assertEqual(self.client.patch(f"/api/v1/management/people/{self.users['student'].pk}/", {"department": self.other_department.pk}).status_code, 403)

    def test_public_registration_cannot_elevate_role(self):
        self.client.force_authenticate(None)
        response = self.client.post("/api/v1/auth/register/", {"username": "attacker", "password": "SomePassword123", "role": "admin"})
        self.assertEqual(response.status_code, 400)
