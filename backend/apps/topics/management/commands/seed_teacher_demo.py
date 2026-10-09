from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.academics.models import Department, Field, Cohort, AcademicYear, Semester
from apps.topics.models import Topic, TopicAssignment, TopicHistory
from apps.progress.models import ProgressReport, ProgressFeedback

User = get_user_model()


class Command(BaseCommand):
    help = "Seed dữ liệu mẫu cho Giảng viên thử nghiệm hệ thống Veritopic"

    def handle(self, *args, **options):
        self.stdout.write("Bắt đầu tạo dữ liệu mẫu Giảng viên...")

        # 1. Tạo Bộ môn & Lĩnh vực
        dept, _ = Department.objects.get_or_create(code="CNTT", defaults={"name": "Công nghệ thông tin"})
        field1, _ = Field.objects.get_or_create(name="Kỹ thuật phần mềm")
        field2, _ = Field.objects.get_or_create(name="Khoa học máy tính")

        # 2. Tạo Khóa, Năm học, Học kỳ
        cohort, _ = Cohort.objects.get_or_create(name="K64", defaults={"start_year": 2023, "end_year": 2027})
        ay, _ = AcademicYear.objects.get_or_create(name="2025-2026", defaults={"is_current": True})
        sem, _ = Semester.objects.get_or_create(name="Học kỳ 1", academic_year=ay, defaults={"start_date": "2025-09-01", "end_date": "2026-01-15"})

        # 3. Tạo Giảng viên & Sinh viên
        gv1, _ = User.objects.get_or_create(
            username="gv_nguyenvana",
            defaults={
                "email": "nguyenvana@gmail.com",
                "first_name": "Nguyễn Văn",
                "last_name": "A",
                "role": "teacher",
                "department": dept,
                "phone_number": "0912345678",
            },
        )
        gv1.set_password("Teacher@123")
        gv1.save()

        gv2, _ = User.objects.get_or_create(
            username="gv_tranthib",
            defaults={
                "email": "tranthib@gmail.com",
                "first_name": "Trần Thị",
                "last_name": "B",
                "role": "teacher",
                "department": dept,
                "phone_number": "0987654321",
            },
        )
        gv2.set_password("Teacher@123")
        gv2.save()

        students = []
        for i in range(1, 7):
            sv, _ = User.objects.get_or_create(
                username=f"sv202600{i}",
                defaults={
                    "email": f"sv202600{i}@st.huce.edu.vn",
                    "first_name": f"Sinh Viên",
                    "last_name": f"Số {i}",
                    "role": "student",
                    "student_code": f"202600{i}",
                    "class_name": "64KTPM1" if i <= 3 else "64KTPM2",
                    "cohort": cohort,
                    "department": dept,
                },
            )
            sv.set_password("Student@123")
            sv.save()
            students.append(sv)

        # 4. Tạo Các Đề Tài với đủ 4 Trạng Thái
        t1, _ = Topic.objects.get_or_create(
            title="Xây dựng hệ thống quản lý ngân hàng đề tài Veritopic",
            defaults={
                "description": "Nghiên cứu áp dụng AI Groq Embeddings và PgVector để phát hiện đề tài đồ án trùng lặp.",
                "keywords": ["React", "Django", "pgvector", "Groq AI"],
                "max_students": 2,
                "requirements": "Sinh viên nắm chắc Django, React và Postgres.",
                "department": dept,
                "field": field1,
                "cohort": cohort,
                "academic_year": ay,
                "semester": sem,
                "proposed_by": gv1,
                "status": Topic.Status.APPROVED,
            },
        )

        t2, _ = Topic.objects.get_or_create(
            title="Ứng dụng máy học trong dự đoán giá bất động sản",
            defaults={
                "description": "Thu thập dữ liệu bất động sản và huấn luyện mô hình dự đoán.",
                "keywords": ["Machine Learning", "Python", "Scikit-Learn"],
                "max_students": 1,
                "requirements": "Thành thạo Python và xử lý dữ liệu.",
                "department": dept,
                "field": field2,
                "cohort": cohort,
                "academic_year": ay,
                "semester": sem,
                "proposed_by": gv1,
                "status": Topic.Status.PENDING,
            },
        )

        t3, _ = Topic.objects.get_or_create(
            title="Phần mềm quản lý tiệm thuốc tây thông minh",
            defaults={
                "description": "Quản lý tồn kho thuốc và bán hàng.",
                "keywords": ["VueJS", "Laravel"],
                "max_students": 1,
                "requirements": "Cần sửa tiêu đề để thể hiện rõ tính thông minh.",
                "department": dept,
                "field": field1,
                "cohort": cohort,
                "academic_year": ay,
                "semester": sem,
                "proposed_by": gv1,
                "status": Topic.Status.RENAME_REQUESTED,
                "review_note": "Tiêu đề quá chung chung. Yêu cầu làm rõ ứng dụng AI/IoT ở điểm nào.",
            },
        )

        t4, _ = Topic.objects.get_or_create(
            title="Ứng dụng Blockchain trong quản lý văn bằng",
            defaults={
                "description": "Xây dựng Smart Contract trên Ethereum.",
                "keywords": ["Blockchain", "Solidity"],
                "max_students": 1,
                "department": dept,
                "field": field2,
                "cohort": cohort,
                "academic_year": ay,
                "semester": sem,
                "proposed_by": gv1,
                "status": Topic.Status.REJECTED,
                "review_note": "Đề tài đã có sinh viên thực hiện ở năm trước.",
            },
        )

        # 5. Giao đề tài t1 cho 2 sinh viên
        assign1, created = TopicAssignment.objects.get_or_create(
            topic=t1,
            defaults={
                "assigned_by": gv1,
                "status": TopicAssignment.Status.ACTIVE,
                "note": "Nhóm thực hiện nghiêm túc báo cáo hàng tuần.",
            },
        )
        if created:
            assign1.students.set(students[:2])

        # 6. Tạo Báo cáo Tiến độ & Feedback mẫu
        rep1, _ = ProgressReport.objects.get_or_create(
            assignment=assign1,
            period_label="Tuần 1",
            defaults={
                "submitted_by": students[0],
                "stage": "Phân tích yêu cầu",
                "percent": 25,
                "content": "Đã hoàn thành phân tích yêu cầu bài toán và vẽ sơ đồ use case.",
            },
        )

        ProgressFeedback.objects.get_or_create(
            report=rep1,
            teacher=gv1,
            defaults={
                "comment": "Sơ đồ use case cần bổ sung thêm luồng nộp lại đề tài.",
                "score": 8.5,
                "result": ProgressFeedback.Result.PASSED,
            },
        )

        self.stdout.write(self.style.SUCCESS("Đã seed xong dữ liệu mẫu cho Giảng viên!"))
        self.stdout.write(self.style.SUCCESS("Tài khoản GV 1: gv_nguyenvana / Teacher@123"))
        self.stdout.write(self.style.SUCCESS("Tài khoản GV 2: gv_tranthib / Teacher@123"))
