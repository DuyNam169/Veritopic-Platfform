import io

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase
from apps.academics.models import Cohort, Department

User = get_user_model()


class ProfileManagementTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_user",
            email="admin@veritopic.edu.vn",
            password="InitialPassword@123",
            first_name="Quản trị",
            last_name="Viên",
            role=User.Role.ADMIN,
            phone_number="0912345678",
        )
        self.teacher = User.objects.create_user(
            username="teacher_user",
            email="teacher@veritopic.edu.vn",
            password="InitialPassword@123",
            first_name="Giảng",
            last_name="Viên",
            role=User.Role.TEACHER,
            phone_number="0987654321",
        )

    def test_get_me(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "admin_user")
        self.assertEqual(response.data["role"], "admin")
        self.assertEqual(response.data["first_name"], "Quản trị")
        self.assertEqual(response.data["last_name"], "Viên")
        self.assertEqual(response.data["phone_number"], "0912345678")
        self.assertIn("created_at", response.data)

    def test_update_me_profile(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "first_name": "Admin",
            "last_name": "Super",
            "phone_number": "0999888777",
            "email": "newadmin@veritopic.edu.vn",
        }
        response = self.client.patch(reverse("auth-me"), payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.first_name, "Admin")
        self.assertEqual(self.admin.last_name, "Super")
        self.assertEqual(self.admin.phone_number, "0999888777")
        self.assertEqual(self.admin.email, "newadmin@veritopic.edu.vn")

    def _avatar_file(self, name="avatar.png", color="teal"):
        buffer = io.BytesIO()
        Image.new("RGB", (64, 64), color=color).save(buffer, format="PNG")
        return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")

    def test_user_can_upload_replace_and_delete_avatar(self):
        self.client.force_authenticate(user=self.admin)
        me_url = reverse("auth-me")

        uploaded = self.client.patch(me_url, {"avatar": self._avatar_file()}, format="multipart")
        self.assertEqual(uploaded.status_code, status.HTTP_200_OK, uploaded.data)
        self.assertIn("/media/avatars/", uploaded.data["avatar"])
        self.admin.refresh_from_db()
        first_name = self.admin.avatar.name
        storage = self.admin.avatar.storage
        self.assertTrue(storage.exists(first_name))

        replaced = self.client.patch(
            me_url,
            {"avatar": self._avatar_file("avatar-moi.png", "navy")},
            format="multipart",
        )
        self.assertEqual(replaced.status_code, status.HTTP_200_OK, replaced.data)
        self.admin.refresh_from_db()
        second_name = self.admin.avatar.name
        self.assertNotEqual(first_name, second_name)
        self.assertFalse(storage.exists(first_name))
        self.assertTrue(storage.exists(second_name))

        deleted = self.client.delete(reverse("auth-avatar-delete"))
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertIsNone(deleted.data["avatar"])
        self.assertFalse(storage.exists(second_name))

    def test_avatar_rejects_unsupported_file(self):
        self.client.force_authenticate(user=self.admin)
        invalid = SimpleUploadedFile("avatar.txt", b"not an image", content_type="text/plain")

        response = self.client.patch(reverse("auth-me"), {"avatar": invalid}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("avatar", response.data)

    def test_update_me_rejects_duplicate_email(self):
        self.client.force_authenticate(user=self.admin)
        payload = {"email": "teacher@veritopic.edu.vn"}
        response = self.client.patch(reverse("auth-me"), payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_update_me_cannot_change_role_or_username(self):
        self.client.force_authenticate(user=self.admin)
        payload = {"role": User.Role.STUDENT, "username": "hacked_admin"}
        response = self.client.patch(reverse("auth-me"), payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.role, User.Role.ADMIN)
        self.assertEqual(self.admin.username, "admin_user")

    def test_change_password_success(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "old_password": "InitialPassword@123",
            "new_password": "NewSecretPassword@456",
            "confirm_password": "NewSecretPassword@456",
        }
        response = self.client.post(reverse("auth-change-password"), payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password("NewSecretPassword@456"))

    def test_change_password_wrong_old_password(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "old_password": "WrongPassword@123",
            "new_password": "NewSecretPassword@456",
            "confirm_password": "NewSecretPassword@456",
        }
        response = self.client.post(reverse("auth-change-password"), payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("old_password", response.data)

    def test_change_password_mismatched_confirmation(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "old_password": "InitialPassword@123",
            "new_password": "NewSecretPassword@456",
            "confirm_password": "DifferentPassword@456",
        }
        response = self.client.post(reverse("auth-change-password"), payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("confirm_password", response.data)

    def test_change_password_same_as_old(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "old_password": "InitialPassword@123",
            "new_password": "InitialPassword@123",
            "confirm_password": "InitialPassword@123",
        }
        response = self.client.post(reverse("auth-change-password"), payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)

    def test_admin_reset_user_password(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("management-users-reset-password", kwargs={"pk": self.teacher.pk})
        response = self.client.post(url, {"password": "TeacherReset@2026"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.teacher.refresh_from_db()
        self.assertTrue(self.teacher.check_password("TeacherReset@2026"))

    def test_non_admin_cannot_reset_user_password(self):
        self.client.force_authenticate(user=self.teacher)
        url = reverse("management-users-reset-password", kwargs={"pk": self.admin.pk})
        response = self.client.post(url, {"password": "HackerPassword@123"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_admin_can_attach_cohort_only_to_student_account(self):
        cohort = Cohort.objects.create(name="K66", start_year=2026, end_year=2030)
        self.client.force_authenticate(user=self.admin)
        list_url = reverse("management-users-list")

        student_response = self.client.post(list_url, {
            "username": "student_k66",
            "email": "student_k66@veritopic.edu.vn",
            "password": "InitialPassword@123",
            "role": User.Role.STUDENT,
            "cohort": cohort.pk,
        })
        self.assertEqual(student_response.status_code, status.HTTP_201_CREATED, student_response.data)
        self.assertEqual(student_response.data["cohort"], cohort.pk)

        teacher_response = self.client.patch(
            reverse("management-users-detail", kwargs={"pk": self.teacher.pk}),
            {"cohort": cohort.pk},
        )
        self.assertEqual(teacher_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cohort", teacher_response.data)

    def test_cannot_demote_an_assigned_department_head(self):
        head = User.objects.create_user(username="assigned_head", role=User.Role.DEPARTMENT_HEAD)
        Department.objects.create(name="Hệ thống thông tin", code="HTTT", head=head)
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            reverse("management-users-detail", kwargs={"pk": head.pk}),
            {"role": User.Role.TEACHER},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)
        head.refresh_from_db()
        self.assertEqual(head.role, User.Role.DEPARTMENT_HEAD)

    def test_management_endpoints_are_admin_only(self):
        self.client.force_authenticate(user=self.teacher)
        list_url = reverse("management-users-list")
        detail_url = reverse("management-users-detail", kwargs={"pk": self.admin.pk})

        self.assertEqual(self.client.get(list_url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post(list_url, {}).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.patch(detail_url, {"first_name": "Sai"}).status_code, status.HTTP_403_FORBIDDEN)

    def test_duplicate_username_and_email_are_case_insensitive(self):
        self.client.force_authenticate(user=self.admin)
        list_url = reverse("management-users-list")
        base_payload = {
            "password": "InitialPassword@123",
            "first_name": "Test",
            "last_name": "User",
            "role": User.Role.STUDENT,
        }

        username_response = self.client.post(list_url, {
            **base_payload,
            "username": " TEACHER_USER ",
            "email": "unique@veritopic.edu.vn",
        })
        email_response = self.client.post(list_url, {
            **base_payload,
            "username": "unique_user",
            "email": "TEACHER@VERITOPIC.EDU.VN",
        })

        self.assertEqual(username_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", username_response.data)
        self.assertEqual(email_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", email_response.data)

    def test_last_active_admin_cannot_be_locked_or_demoted(self):
        self.client.force_authenticate(user=self.admin)
        detail_url = reverse("management-users-detail", kwargs={"pk": self.admin.pk})

        lock_response = self.client.patch(detail_url, {"is_active": False})
        demote_response = self.client.patch(detail_url, {"role": User.Role.TEACHER})

        self.assertEqual(lock_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is_active", lock_response.data)
        self.assertEqual(demote_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", demote_response.data)

    def test_admin_can_lock_account_when_another_active_admin_exists(self):
        User.objects.create_user(
            username="backup_admin",
            email="backup_admin@veritopic.edu.vn",
            password="InitialPassword@123",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.patch(
            reverse("management-users-detail", kwargs={"pk": self.admin.pk}),
            {"is_active": False},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        login_response = self.client.post(reverse("auth-login"), {
            "username": self.admin.username,
            "password": "InitialPassword@123",
        })
        self.assertEqual(login_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_edit_profile_and_filter_or_search_users(self):
        department = Department.objects.create(name="Khoa học máy tính", code="KHMT")
        self.teacher.department = department
        self.teacher.save(update_fields=["department"])
        self.client.force_authenticate(user=self.admin)
        detail_url = reverse("management-users-detail", kwargs={"pk": self.teacher.pk})

        update_response = self.client.patch(detail_url, {
            "first_name": "Giảng viên",
            "last_name": "Đã sửa",
            "phone_number": "0900000000",
        })
        department_response = self.client.get(reverse("management-users-list"), {"department": department.pk})
        search_response = self.client.get(reverse("management-users-list"), {"search": "Đã sửa"})

        self.assertEqual(update_response.status_code, status.HTTP_200_OK, update_response.data)
        self.assertEqual(department_response.data["count"], 1)
        self.assertEqual(department_response.data["results"][0]["id"], self.teacher.pk)
        self.assertEqual(search_response.data["count"], 1)
        self.assertEqual(search_response.data["results"][0]["id"], self.teacher.pk)


class PeopleDirectoryTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="directory_admin", role=User.Role.ADMIN)
        self.head = User.objects.create_user(username="directory_head", role=User.Role.DEPARTMENT_HEAD)
        self.teacher = User.objects.create_user(
            username="directory_teacher",
            first_name="Nguyễn",
            last_name="An",
            role=User.Role.TEACHER,
        )
        self.student = User.objects.create_user(
            username="directory_student",
            role=User.Role.STUDENT,
            student_code="SV001",
        )
        self.url = reverse("management-people-list")

    def test_admin_and_department_head_can_read_teacher_and_student_profiles(self):
        for manager in (self.admin, self.head):
            self.client.force_authenticate(user=manager)
            response = self.client.get(self.url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            people = response.data["results"]
            self.assertEqual({person["role"] for person in people}, {"teacher", "student"})
            student = next(person for person in people if person["id"] == self.student.pk)
            self.assertEqual(student["student_code"], "SV001")

    def test_directory_supports_filtering_by_role(self):
        self.client.force_authenticate(user=self.head)

        response = self.client.get(self.url, {"role": "teacher"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([person["id"] for person in response.data["results"]], [self.teacher.pk])

    def test_manager_can_create_profile_without_login_credentials_and_edit_it(self):
        self.client.force_authenticate(user=self.head)

        created = self.client.post(self.url, {
            "username": "new_student",
            "first_name": "Sinh",
            "last_name": "Viên",
            "role": "student",
            "student_code": "SV002",
        })

        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        profile = User.objects.get(pk=created.data["id"])
        self.assertFalse(profile.has_usable_password())

        updated = self.client.patch(
            f"{self.url}{profile.pk}/",
            {"first_name": "Sinh viên mới"},
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK, updated.data)
        self.assertEqual(updated.data["first_name"], "Sinh viên mới")

    def test_directory_rejects_role_changes_and_student_write_access(self):
        self.client.force_authenticate(user=self.head)
        role_change = self.client.patch(f"{self.url}{self.student.pk}/", {"role": "teacher"})
        self.assertEqual(role_change.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", role_change.data)

        self.client.force_authenticate(user=self.student)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_profile_directory_does_not_delete_accounts(self):
        self.client.force_authenticate(user=self.head)
        self.assertEqual(self.client.delete(f"{self.url}{self.student.pk}/").status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
