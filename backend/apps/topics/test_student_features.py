from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.academics.models import AcademicYear, Cohort, Department, Field, Semester
from apps.accounts.models import AdvisorRequest, Notification
from apps.topics.models import StudentTopicProposal, Topic, TopicAssignment, TopicRegistration

User = get_user_model()


class StudentFeaturesTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(name="Bộ môn HTTT", code="HTTT")
        self.cohort = Cohort.objects.create(name="K65", start_year=2020, end_year=2024)
        self.academic_year = AcademicYear.objects.create(name="2023-2024", is_current=True)
        self.semester = Semester.objects.create(
            academic_year=self.academic_year,
            name="Học kỳ 1",
            start_date="2023-09-01",
            end_date="2024-01-15",
        )
        self.field = Field.objects.create(name="Trí tuệ nhân tạo")

        # Giảng viên
        self.teacher = User.objects.create_user(
            username="gv_huongdan",
            password="Password@123",
            role="teacher",
            first_name="Nguyễn",
            last_name="Văn Thầy",
            email="gv@example.com",
            department=self.dept,
        )

        # Sinh viên 1 (K65)
        self.student1 = User.objects.create_user(
            username="sv_k65_01",
            password="Password@123",
            role="student",
            first_name="Trần",
            last_name="Văn Trò",
            email="sv1@example.com",
            department=self.dept,
            cohort=self.cohort,
            student_code="65DCHT001",
        )

        # Sinh viên 2 (K65)
        self.student2 = User.objects.create_user(
            username="sv_k65_02",
            password="Password@123",
            role="student",
            first_name="Lê",
            last_name="Thị Bạn",
            email="sv2@example.com",
            department=self.dept,
            cohort=self.cohort,
            student_code="65DCHT002",
        )

        # Đề tài có sẵn đã duyệt
        self.topic = Topic.objects.create(
            title="Đề tài mẫu nghiên cứu học máy",
            description="Mô tả đề tài mẫu",
            department=self.dept,
            field=self.field,
            cohort=self.cohort,
            academic_year=self.academic_year,
            semester=self.semester,
            proposed_by=self.teacher,
            status=Topic.Status.APPROVED,
        )

    def test_student_request_advisor_and_teacher_receives_notification(self):
        """Sinh viên gửi yêu cầu chọn GVHD và Giảng viên nhận được thông báo."""
        self.client.force_authenticate(user=self.student1)
        res = self.client.post("/api/v1/auth/advisor-requests/", {
            "teacher_id": self.teacher.id,
            "message": "Em chào thầy, em muốn xin thầy hướng dẫn đồ án tốt nghiệp.",
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "pending")

        # Kiểm tra notification tạo cho giảng viên
        teacher_notif = Notification.objects.filter(recipient=self.teacher).first()
        self.assertIsNotNone(teacher_notif)
        self.assertEqual(teacher_notif.notification_type, "advisor_request")
        self.assertIn("Yêu cầu hướng dẫn đồ án mới", teacher_notif.title)

        # Giảng viên đồng ý hướng dẫn
        req_id = res.data["id"]
        self.client.force_authenticate(user=self.teacher)
        resp_res = self.client.post(f"/api/v1/auth/advisor-requests/{req_id}/respond/", {
            "action": "accept",
            "response_note": "Thầy đồng ý nhận hướng dẫn em.",
        })
        self.assertEqual(resp_res.status_code, 200)
        self.assertEqual(resp_res.data["status"], "accepted")

        # Kiểm tra notification gửi lại cho sinh viên
        student_notif = Notification.objects.filter(recipient=self.student1).first()
        self.assertIsNotNone(student_notif)
        self.assertEqual(student_notif.notification_type, "advisor_response")
        self.assertIn("đồng ý", student_notif.message)

    def test_student_proposes_topic_and_teacher_approves(self):
        """Sinh viên đề xuất đề tài lên GVHD và GVHD xử lý phê duyệt."""
        self.client.force_authenticate(user=self.student1)
        res = self.client.post("/api/v1/topics/student-proposals/", {
            "teacher": self.teacher.id,
            "title": "Nghiên cứu ứng dụng xử lý ngôn ngữ tự nhiên cho tiếng Việt",
            "description": "Xây dựng chatbot hỗ trợ tư vấn tuyển sinh",
            "expected_technologies": "Python, Django, React, PhoBERT",
            "department": self.dept.id,
            "field": self.field.id,
            "cohort": self.cohort.id,
            "academic_year": self.academic_year.id,
            "semester": self.semester.id,
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "pending")

        # Notification cho giảng viên
        notif = Notification.objects.filter(recipient=self.teacher, notification_type="topic_proposal").first()
        self.assertIsNotNone(notif)

        # Giảng viên phê duyệt đề tài
        proposal_id = res.data["id"]
        self.client.force_authenticate(user=self.teacher)
        resp_res = self.client.post(f"/api/v1/topics/student-proposals/{proposal_id}/respond/", {
            "action": "approve",
            "teacher_note": "Đề tài có tính thực tiễn cao, thầy thông qua.",
        })
        self.assertEqual(resp_res.status_code, 200)
        self.assertEqual(resp_res.data["status"], "approved")

        # Kiểm tra Topic đã được tạo với created_by là sinh viên
        created_topic_id = resp_res.data["created_topic"]
        self.assertIsNotNone(created_topic_id)
        created_topic = Topic.objects.get(pk=created_topic_id)
        self.assertEqual(created_topic.created_by, self.student1)

        # Kiểm tra sinh viên được tự động gán vào đề tài
        assignment = TopicAssignment.objects.filter(topic=created_topic, students=self.student1).first()
        self.assertIsNotNone(assignment)

    def test_rule_one_student_can_only_choose_one_topic(self):
        """Quy tắc: 1 sinh viên chỉ được chọn 1 đề tài đồ án."""
        # Giả sử student1 đã có 1 topic assignment
        assignment = TopicAssignment.objects.create(
            topic=self.topic,
            assigned_by=self.teacher,
            status=TopicAssignment.Status.ACTIVE,
        )
        assignment.students.set([self.student1])

        # Sinh viên 1 cố gắng đăng ký thêm một đề tài khác
        other_topic = Topic.objects.create(
            title="Đề tài thứ hai",
            department=self.dept,
            cohort=self.cohort,
            academic_year=self.academic_year,
            semester=self.semester,
            proposed_by=self.teacher,
            status=Topic.Status.APPROVED,
        )
        self.client.force_authenticate(user=self.student1)
        res = self.client.post("/api/v1/topics/registrations/", {
            "topic_id": other_topic.id,
            "note": "Em muốn làm thêm đề tài này nữa",
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("đã có một đề tài đồ án", str(res.data))

    def test_rule_no_two_students_of_same_cohort_can_choose_same_topic(self):
        """Quy tắc: Không sinh viên nào cùng khóa (K65) chọn chung 1 đề tài."""
        # Sinh viên 1 (K65) đăng ký đề tài
        self.client.force_authenticate(user=self.student1)
        res1 = self.client.post("/api/v1/topics/registrations/", {
            "topic_id": self.topic.id,
            "note": "Em xin đăng ký đề tài này",
        })
        self.assertEqual(res1.status_code, 201)

        # Sinh viên 2 (cùng K65) cố gắng đăng ký cùng đề tài đó
        self.client.force_authenticate(user=self.student2)
        res2 = self.client.post("/api/v1/topics/registrations/", {
            "topic_id": self.topic.id,
            "note": "Em cũng muốn đăng ký đề tài này",
        })
        self.assertEqual(res2.status_code, 400)
        self.assertIn("cùng khóa K65", str(res2.data))
