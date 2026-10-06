from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

from apps.academics.models import AcademicYear, Cohort, Department, Field, Semester

from .models import (
    Topic,
    TopicAssignment,
    TopicDeletionAudit,
    TopicHistory,
    TopicSimilarityResult,
)


class AdminTopicManagementTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username="topic_admin", role="admin")
        self.owner = User.objects.create_user(username="topic_owner", role="teacher")
        self.other_teacher = User.objects.create_user(username="other_teacher", role="teacher")
        self.student = User.objects.create_user(username="topic_student", role="student")
        self.department = Department.objects.create(name="Công nghệ thông tin", code="CNTT")
        self.cohort = Cohort.objects.create(name="K70", start_year=2030, end_year=2034)
        self.year = AcademicYear.objects.create(name="2030-2031", is_current=True)
        self.semester = Semester.objects.create(
            name="Học kỳ 1",
            academic_year=self.year,
            start_date="2030-09-01",
            end_date="2031-01-31",
        )
        self.field = Field.objects.create(name="Trí tuệ nhân tạo")
        self.topic = Topic.objects.create(
            title="Đề tài quản trị",
            description="Mô tả ban đầu",
            department=self.department,
            field=self.field,
            cohort=self.cohort,
            academic_year=self.year,
            semester=self.semester,
            proposed_by=self.owner,
            status=Topic.Status.APPROVED,
        )
        self.assignment = TopicAssignment.objects.create(
            topic=self.topic,
            assigned_by=self.owner,
        )
        self.assignment.students.add(self.student)

    def detail_url(self, topic=None):
        return reverse("topic-detail", kwargs={"pk": (topic or self.topic).pk})

    def test_admin_can_view_and_update_any_approved_assigned_topic(self):
        self.client.force_authenticate(self.admin)

        detail = self.client.get(self.detail_url())
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["assignment_count"], 1)
        self.assertEqual(detail.data["department_name"], self.department.name)

        response = self.client.patch(self.detail_url(), {
            "title": "Đề tài đã được quản trị viên sửa",
            "description": "Thông tin đã hiệu chỉnh",
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.topic.refresh_from_db()
        self.assertEqual(self.topic.title, "Đề tài đã được quản trị viên sửa")
        history = self.topic.history.get(action=TopicHistory.Action.UPDATED)
        self.assertEqual(history.actor, self.admin)

    def test_non_owner_teacher_cannot_update_or_delete_topic(self):
        self.client.force_authenticate(self.other_teacher)
        self.assertEqual(self.client.patch(self.detail_url(), {"title": "Không hợp lệ"}).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.delete(self.detail_url()).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(self.detail_url(), {"title": "Không hợp lệ"}).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.delete(self.detail_url()).status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_delete_cascades_related_data_and_keeps_audit(self):
        similar_topic = Topic.objects.create(
            title="Đề tài tương đồng",
            department=self.department,
            cohort=self.cohort,
            academic_year=self.year,
            semester=self.semester,
            proposed_by=self.other_teacher,
        )
        TopicHistory.objects.create(topic=self.topic, action=TopicHistory.Action.ASSIGNED, actor=self.owner)
        TopicSimilarityResult.objects.create(
            topic=self.topic,
            similar_topic=similar_topic,
            similarity_percent=75,
            warning_level="high",
        )
        topic_id = self.topic.pk
        self.client.force_authenticate(self.admin)

        response = self.client.delete(self.detail_url())

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Topic.objects.filter(pk=topic_id).exists())
        self.assertFalse(TopicHistory.objects.filter(topic_id=topic_id).exists())
        self.assertFalse(TopicSimilarityResult.objects.filter(topic_id=topic_id).exists())
        self.assertFalse(TopicAssignment.objects.filter(topic_id=topic_id).exists())
        audit = TopicDeletionAudit.objects.get(original_topic_id=topic_id)
        self.assertEqual(audit.deleted_by, self.admin)
        self.assertTrue(audit.had_assignments)
        self.assertEqual(audit.snapshot["assignment_count"], 1)
        self.assertEqual(self.client.get(self.detail_url()).status_code, status.HTTP_404_NOT_FOUND)

    def test_stored_similarity_results_endpoint(self):
        similar_topic = Topic.objects.create(
            title="Đề tài tham chiếu",
            department=self.department,
            cohort=self.cohort,
            academic_year=self.year,
            semester=self.semester,
            proposed_by=self.other_teacher,
        )
        TopicSimilarityResult.objects.create(
            topic=self.topic,
            similar_topic=similar_topic,
            similarity_percent=88.5,
            warning_level="duplicate",
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse("topic-similarity-results", kwargs={"pk": self.topic.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["similar_topic_title"], similar_topic.title)

    def test_admin_can_search_all_topics_with_combined_filters(self):
        other_department = Department.objects.create(name="Hệ thống thông tin", code="HTTT")
        matching_topic = Topic.objects.create(
            title="Nền tảng quản lý học tập",
            description="Ứng dụng có chức năng tìm kiếm thông minh",
            department=other_department,
            field=self.field,
            cohort=self.cohort,
            academic_year=self.year,
            semester=self.semester,
            proposed_by=self.other_teacher,
            status=Topic.Status.PENDING,
        )
        Topic.objects.create(
            title="Đề tài không phù hợp",
            description="Có từ khóa tìm kiếm nhưng sai bộ môn",
            department=self.department,
            field=self.field,
            cohort=self.cohort,
            academic_year=self.year,
            semester=self.semester,
            proposed_by=self.other_teacher,
            status=Topic.Status.PENDING,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse("topic-list"), {
            "search": "tìm kiếm",
            "department": other_department.pk,
            "cohort": self.cohort.pk,
            "academic_year": self.year.pk,
            "semester": self.semester.pk,
            "status": Topic.Status.PENDING,
            "proposed_by": self.other_teacher.pk,
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], matching_topic.pk)

    def test_topic_search_results_are_paginated(self):
        Topic.objects.bulk_create([
            Topic(
                title=f"Đề tài phân trang {index}",
                department=self.department,
                field=self.field,
                cohort=self.cohort,
                academic_year=self.year,
                semester=self.semester,
                proposed_by=self.owner,
            )
            for index in range(21)
        ])
        self.client.force_authenticate(self.admin)
        url = reverse("topic-list")

        first_page = self.client.get(url)
        second_page = self.client.get(url, {"page": 2})

        self.assertEqual(first_page.status_code, status.HTTP_200_OK)
        self.assertEqual(first_page.data["count"], 22)
        self.assertEqual(len(first_page.data["results"]), 20)
        self.assertIsNotNone(first_page.data["next"])
        self.assertEqual(len(second_page.data["results"]), 2)
        self.assertIsNotNone(second_page.data["previous"])

    def test_admin_sees_complete_history_newest_first_with_actor_fallback(self):
        created = TopicHistory.objects.create(
            topic=self.topic,
            action=TopicHistory.Action.CREATED,
            actor=self.owner,
            note="Đề tài được tạo.",
        )
        reviewed = TopicHistory.objects.create(
            topic=self.topic,
            action=TopicHistory.Action.APPROVED,
            actor=self.admin,
            note="Đủ điều kiện phê duyệt.",
        )
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse("topic-history", kwargs={"pk": self.topic.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([entry["id"] for entry in response.data], [reviewed.pk, created.pk])
        self.assertEqual(response.data[0]["action"], TopicHistory.Action.APPROVED)
        self.assertEqual(response.data[0]["actor_name"], self.admin.username)
        self.assertEqual(response.data[0]["note"], "Đủ điều kiện phê duyệt.")
        self.assertIn("created_at", response.data[0])

    def test_history_of_missing_topic_returns_not_found(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse("topic-history", kwargs={"pk": 999999}))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_review_pending_topic_once_and_is_recorded_as_actor(self):
        other_department = Department.objects.create(name="Khoa học dữ liệu", code="KHDL")
        pending_topic = Topic.objects.create(
            title="Đề tài cần duyệt thay",
            department=other_department,
            field=self.field,
            cohort=self.cohort,
            academic_year=self.year,
            semester=self.semester,
            proposed_by=self.other_teacher,
            status=Topic.Status.PENDING,
        )
        url = reverse("management-topic-approve", kwargs={"pk": pending_topic.pk})
        self.client.force_authenticate(self.admin)

        response = self.client.post(url, {"note": "Quản trị viên duyệt thay."})
        duplicate_response = self.client.post(url, {"note": "Xử lý lần hai."})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pending_topic.refresh_from_db()
        self.assertEqual(pending_topic.status, Topic.Status.APPROVED)
        self.assertEqual(pending_topic.reviewed_by, self.admin)
        history = pending_topic.history.get(action=TopicHistory.Action.APPROVED)
        self.assertEqual(history.actor, self.admin)
        self.assertEqual(history.note, "Quản trị viên duyệt thay.")
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("không còn ở trạng thái chờ duyệt", str(duplicate_response.data))
        self.assertEqual(pending_topic.history.filter(action=TopicHistory.Action.APPROVED).count(), 1)

    def test_admin_can_request_rename_with_note(self):
        pending_topic = Topic.objects.create(
            title="Tên cần điều chỉnh",
            department=self.department,
            field=self.field,
            cohort=self.cohort,
            academic_year=self.year,
            semester=self.semester,
            proposed_by=self.owner,
            status=Topic.Status.PENDING,
        )
        self.client.force_authenticate(self.admin)

        response = self.client.post(
            reverse("management-topic-request-rename", kwargs={"pk": pending_topic.pk}),
            {"note": "Tên đang quá chung chung."},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pending_topic.refresh_from_db()
        self.assertEqual(pending_topic.status, Topic.Status.RENAME_REQUESTED)
        self.assertEqual(pending_topic.reviewed_by, self.admin)
        self.assertEqual(
            pending_topic.history.get(action=TopicHistory.Action.RENAME_REQUESTED).note,
            "Tên đang quá chung chung.",
        )

    @patch("apps.topics.services.workflow.get_embedding", return_value=[0.1] * 768)
    @patch("apps.topics.services.workflow.find_similar_topics")
    def test_only_admin_can_refresh_and_persist_similarity_at_any_status(self, find_mock, _embedding_mock):
        similar_topic = Topic.objects.create(
            title="Đề tài đối chiếu mới",
            department=self.department,
            field=self.field,
            cohort=self.cohort,
            academic_year=self.year,
            semester=self.semester,
            proposed_by=self.other_teacher,
            status=Topic.Status.PENDING,
        )
        find_mock.return_value = [{
            "topic": similar_topic,
            "similarity_percent": 73.5,
            "warning_level": "high",
        }]
        url = reverse("topic-refresh-similarity", kwargs={"pk": self.topic.pk})

        self.client.force_authenticate(self.other_teacher)
        self.assertEqual(self.client.post(url).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["similar_topic"], similar_topic.pk)
        self.assertEqual(response.data[0]["similarity_percent"], 73.5)
        audit = self.topic.history.get(action=TopicHistory.Action.SIMILARITY_REFRESHED)
        self.assertEqual(audit.actor, self.admin)
