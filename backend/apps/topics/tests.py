from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models import Value
from django.test import SimpleTestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.test import APITestCase
from unittest.mock import Mock, patch
import requests

from apps.academics.models import AcademicYear, Cohort, Department, Field, Semester

from .models import (
    Technology,
    Topic,
    TopicAssignment,
    TopicDeletionAudit,
    TopicDocument,
    TopicHistory,
    TopicSimilarityResult,
    TopicTechnology,
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

    def test_assignment_directory_includes_topic_title_and_advisor_details(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get(reverse("topic-assignment-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        assignment = response.data["results"][0]
        self.assertEqual(assignment["topic_title"], self.topic.title)
        self.assertEqual(assignment["proposed_by_detail"]["id"], self.owner.pk)
        self.assertEqual(assignment["students_detail"][0]["id"], self.student.pk)

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

    @patch("apps.topics.services.workflow.find_similar_topics")
    def test_only_admin_can_refresh_and_persist_similarity_at_any_status(self, find_mock):
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
            "groq_score": 91.0,
            "groq_explanation": "Cùng bài toán quản lý.",
            "assessment_status": "completed",
        }]
        url = reverse("topic-refresh-similarity", kwargs={"pk": self.topic.pk})

        self.client.force_authenticate(self.other_teacher)
        self.assertEqual(self.client.post(url).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["similar_topic"], similar_topic.pk)
        self.assertEqual(response.data[0]["similarity_percent"], 73.5)
        self.assertEqual(response.data[0]["groq_score"], 91.0)
        self.assertEqual(response.data[0]["assessment_status"], "completed")
        self.assertEqual(self.topic.similarity_results.get().groq_explanation, "Cùng bài toán quản lý.")
        audit = self.topic.history.get(action=TopicHistory.Action.SIMILARITY_REFRESHED)
        self.assertEqual(audit.actor, self.admin)


class TopicResourceAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user(username="resource_admin", role="admin")
        self.owner = User.objects.create_user(username="resource_owner", role="teacher")
        self.other_teacher = User.objects.create_user(username="resource_other", role="teacher")
        self.student = User.objects.create_user(username="resource_student", role="student")
        department = Department.objects.create(name="Khoa học máy tính", code="KHMT")
        cohort = Cohort.objects.create(name="K71", start_year=2031, end_year=2035)
        year = AcademicYear.objects.create(name="2031-2032", is_current=True)
        semester = Semester.objects.create(
            name="Học kỳ 1",
            academic_year=year,
            start_date="2031-09-01",
            end_date="2032-01-31",
        )
        self.topic = Topic.objects.create(
            title="Ứng dụng học máy trong quản lý thư viện",
            description="Đề tài thử nghiệm",
            department=department,
            cohort=cohort,
            academic_year=year,
            semester=semester,
            proposed_by=self.owner,
            status=Topic.Status.APPROVED,
        )

    def test_topic_function_edits_are_limited_to_topic_owner_or_admin(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(reverse("topic-function-list"), {
            "topic": self.topic.pk,
            "function_name": "Quản lý đầu sách",
            "description": "Thêm và cập nhật đầu sách",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        function_id = response.data["id"]
        other_topic = Topic.objects.create(
            title="Đề tài khác của giảng viên",
            department=self.topic.department,
            cohort=self.topic.cohort,
            academic_year=self.topic.academic_year,
            semester=self.topic.semester,
            proposed_by=self.other_teacher,
        )
        reassignment = self.client.patch(
            reverse("topic-function-detail", kwargs={"pk": function_id}),
            {"topic": other_topic.pk},
        )
        self.assertEqual(reassignment.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.other_teacher)
        denied = self.client.patch(
            reverse("topic-function-detail", kwargs={"pk": function_id}),
            {"function_name": "Thay đổi trái phép"},
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.student)
        denied = self.client.post(reverse("topic-function-list"), {
            "topic": self.topic.pk,
            "function_name": "Không được thêm",
        })
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_manages_technology_catalog_but_teacher_is_read_only(self):
        self.client.force_authenticate(self.owner)
        denied = self.client.post(reverse("technology-list"), {
            "name": "Django",
            "category": "Framework",
        })
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        created = self.client.post(reverse("technology-list"), {
            "name": "Django",
            "category": "Framework",
        })
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertEqual(Technology.objects.get(pk=created.data["id"]).name, "Django")

    def test_topic_owner_can_link_catalog_technology(self):
        technology = Technology.objects.create(name="Django", category="Framework")
        self.client.force_authenticate(self.owner)
        response = self.client.post(reverse("topic-technology-list"), {
            "topic": self.topic.pk,
            "technology": technology.pk,
            "is_primary": True,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(TopicTechnology.objects.get(pk=response.data["id"]).is_primary)

    def test_document_upload_and_download_require_authenticated_access(self):
        import tempfile

        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            self.client.force_authenticate(self.owner)
            uploaded = SimpleUploadedFile(
                "thuyet-minh.pdf",
                b"%PDF-1.4 test",
                content_type="application/pdf",
            )
            response = self.client.post(
                reverse("topic-document-list"),
                {"topic": self.topic.pk, "file": uploaded},
                format="multipart",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
            document = TopicDocument.objects.get(pk=response.data["id"])
            self.assertIn("download/", response.data["file_url"])

            self.client.force_authenticate(self.student)
            downloaded = self.client.get(
                reverse("topic-document-download", kwargs={"pk": document.pk})
            )
            self.assertEqual(downloaded.status_code, status.HTTP_200_OK)
            self.assertEqual(downloaded["Content-Type"], "application/pdf")
            self.assertIn("attachment", downloaded["Content-Disposition"])
            self.assertEqual(b"".join(downloaded.streaming_content), b"%PDF-1.4 test")

    @patch("apps.topics.views.find_title_candidates", return_value=[{
        "title": "Ứng dụng học máy trong quản lý thư viện",
        "confidence": 0.9,
    }])
    @patch("apps.topics.views.extract_document_text", return_value="Nội dung tài liệu")
    def test_extract_file_returns_title_suggestions(self, _extract_text, _find_titles):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            reverse("similarity-check-extract-file"),
            {"file": SimpleUploadedFile("de-tai.pdf", b"%PDF-1.4")},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["suggested_title"], "Ứng dụng học máy trong quản lý thư viện")
        self.assertEqual(len(response.data["title_candidates"]), 1)

    def test_similarity_check_returns_named_exact_duplicate(self):
        self.topic.embedding = [0.1] * 768
        self.topic.save(update_fields=["embedding"])
        self.client.force_authenticate(self.owner)

        response = self.client.post(reverse("similarity-check-check"), {
            "title": self.topic.title,
            "top_k": 5,
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        result = response.data["results"][0]
        self.assertEqual(result["title"], self.topic.title)
        self.assertEqual(result["percent"], 100.0)
        self.assertEqual(result["warning_level"], "duplicate")

    @patch("apps.topics.views.find_similar_topics", return_value=[])
    def test_custom_source_title_does_not_overwrite_source_embedding(self, finder):
        self.topic.embedding = [0.1] * 768
        self.topic.save(update_fields=["embedding"])
        self.client.force_authenticate(self.owner)
        response = self.client.post(reverse("similarity-check-check"), {
            "source_topic_id": self.topic.pk, "title": "Một tên hoàn toàn mới", "top_k": 5,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        query = finder.call_args.args[0]
        self.assertIsNone(query.pk)
        self.assertIsNone(query.embedding)
        self.assertEqual(finder.call_args.kwargs["exclude_topic_id"], self.topic.pk)
        self.topic.refresh_from_db()
        self.assertAlmostEqual(float(self.topic.embedding[0]), 0.1)

    @patch("apps.topics.views.find_similar_topics", return_value=[])
    def test_title_check_passes_optional_description_to_shared_pipeline(self, finder):
        self.client.force_authenticate(self.owner)
        response = self.client.post(reverse("similarity-check-check"), {
            "title": "Đề tài thử", "description": "Mục tiêu và công nghệ",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(finder.call_args.args[0].description, "Mục tiêu và công nghệ")

    def test_postgres_hybrid_query_and_snapshot_preserve_separate_scores_and_rank(self):
        from django.db import connection
        from .services.similarity import SemanticScores
        if connection.vendor != "postgresql":
            self.skipTest("Requires real pgvector cosine queries")
        vector = [1.0] + [0.0] * 767
        self.topic.embedding = vector
        self.topic.save(update_fields=["embedding"])
        related = Topic.objects.create(
            title="Ngân hàng đề tài bằng học máy", description="Quản lý đề tài",
            department=self.topic.department, cohort=self.topic.cohort,
            academic_year=self.topic.academic_year, semester=self.topic.semester,
            proposed_by=self.owner, embedding=[0.8, 0.6] + [0.0] * 766,
        )
        scores = SemanticScores()
        scores.update({self.topic.id: 10.0, related.id: 90.0})
        scores.explanations = {related.id: "Cùng mục tiêu quản lý."}
        self.client.force_authenticate(self.owner)
        with override_settings(SIMILARITY_GROQ_ENABLED=True), \
                patch("apps.topics.services.similarity.get_embedding", return_value=vector), \
                patch("apps.topics.services.similarity.score_candidates_semantically", return_value=scores):
            response = self.client.post(reverse("similarity-check-check"), {
                "title": "Quản lý đề tài nghiên cứu", "description": "Dùng học máy", "top_k": 2,
            })
            self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
            self.assertEqual(response.data["results"][0]["topic_id"], related.id)
            self.assertAlmostEqual(response.data["results"][0]["percent"], 80.0)
            self.assertEqual(response.data["results"][0]["groq_score"], 90.0)
            self.client.force_authenticate(self.admin)
            refresh = self.client.post(reverse("topic-refresh-similarity", kwargs={"pk": self.topic.id}))
            self.assertEqual(refresh.status_code, status.HTTP_200_OK, refresh.data)
            snapshot = self.topic.similarity_results.get()
            self.assertAlmostEqual(snapshot.similarity_percent, 80.0)
            self.assertEqual(snapshot.groq_score, 90.0)
            self.assertEqual(snapshot.rank, 1)
            self.assertEqual(snapshot.groq_explanation, "Cùng mục tiêu quản lý.")


class PhoBERTEmbeddingTests(SimpleTestCase):
    @override_settings(PHOBERT_API_URL="http://pho:8001/", PHOBERT_API_TIMEOUT=7)
    @patch("apps.topics.services.similarity.requests.post")
    def test_requests_and_returns_a_768_value_phobert_embedding(self, post):
        from apps.topics.services.similarity import get_embedding

        embedding = [0.25] * 768
        response = Mock()
        response.json.return_value = {"model_name": "tier1_best.pt", "embeddings": [embedding]}
        post.return_value = response

        result = get_embedding("Quản lý dữ liệu sinh viên")

        self.assertEqual(result, embedding)
        post.assert_called_once_with(
            "http://pho:8001/api/v1/encode-titles",
            json={"titles": ["Quản lý dữ liệu sinh viên"]},
            timeout=7,
        )

    @patch("apps.topics.services.similarity.requests.post")
    def test_rejects_invalid_phobert_embedding_shape(self, post):
        from apps.topics.services.similarity import get_embedding

        response = Mock()
        response.json.return_value = {"embeddings": [[0.1, 0.2]]}
        post.return_value = response

        with self.assertRaises(APIException) as error:
            get_embedding("Đề tài kiểm thử")

        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("768", str(error.exception.detail))

    @patch("apps.topics.services.similarity.requests.post")
    def test_reports_unavailable_when_phobert_cannot_be_reached(self, post):
        from apps.topics.services.similarity import get_embedding, SimilarityServiceUnavailable

        post.side_effect = requests.exceptions.ConnectionError("connection refused")

        with self.assertRaises(SimilarityServiceUnavailable) as error:
            get_embedding("Đề tài kiểm thử")

        self.assertIn("PHOBERT_API_URL", str(error.exception.detail))

    @patch("apps.topics.services.similarity.requests.post")
    def test_batch_embedding_rejects_a_response_with_missing_vectors(self, post):
        from apps.topics.services.similarity import get_embeddings, SimilarityServiceUnavailable

        response = Mock()
        response.json.return_value = {"embeddings": [[0.1] * 768]}
        post.return_value = response

        with self.assertRaises(SimilarityServiceUnavailable) as error:
            get_embeddings(["Đề tài một", "Đề tài hai"])

        self.assertIn("Số lượng embedding", str(error.exception.detail))
