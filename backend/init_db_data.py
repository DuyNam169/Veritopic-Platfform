import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
os.environ.setdefault("POSTGRES_HOST", "db")
django.setup()

from apps.accounts.models import User
from apps.academics.models import Department, Field, Cohort, AcademicYear, Semester
from apps.topics.models import Topic

print("🚀 Đang khởi tạo dữ liệu Database...")

# 1. Tạo Năm học
y24, _ = AcademicYear.objects.get_or_create(name="2024-2025", defaults={"is_current": False})
y25, _ = AcademicYear.objects.get_or_create(name="2025-2026", defaults={"is_current": True})
y26, _ = AcademicYear.objects.get_or_create(name="2026-2027", defaults={"is_current": False})

# 2. Tạo Học kỳ
s1, _ = Semester.objects.get_or_create(academic_year=y25, name="Học kỳ 1", defaults={"start_date": "2025-09-01", "end_date": "2025-12-31"})
s2, _ = Semester.objects.get_or_create(academic_year=y25, name="Học kỳ 2", defaults={"start_date": "2026-01-15", "end_date": "2026-05-30"})

# 3. Tạo Khóa học
c64, _ = Cohort.objects.get_or_create(name="K64", defaults={"start_year": 2019, "end_year": 2024})
c65, _ = Cohort.objects.get_or_create(name="K65", defaults={"start_year": 2020, "end_year": 2025})
c66, _ = Cohort.objects.get_or_create(name="K66", defaults={"start_year": 2021, "end_year": 2026})

# 4. Tạo Bộ môn
dept_cdt, _ = Department.objects.get_or_create(code="CĐT", defaults={"name": "Bộ môn Cơ điện tử"})
dept_cnpm, _ = Department.objects.get_or_create(code="CNPM", defaults={"name": "Bộ môn Công nghệ phần mềm"})
dept_httt, _ = Department.objects.get_or_create(code="HTTT", defaults={"name": "Bộ môn Hệ thống thông tin"})
dept_attt, _ = Department.objects.get_or_create(code="ATTT", defaults={"name": "Bộ môn An toàn thông tin"})

# 5. Tạo Lĩnh vực
f_ai, _ = Field.objects.get_or_create(name="Trí tuệ nhân tạo (AI)")
f_se, _ = Field.objects.get_or_create(name="Kỹ thuật phần mềm")
f_iot, _ = Field.objects.get_or_create(name="Internet of Things (IoT)")
f_ds, _ = Field.objects.get_or_create(name="Khoa học dữ liệu")

# 6. Tạo Tài khoản Test (Admin, Trưởng bộ môn, Giảng viên, Sinh viên)
def create_user(username, email, first_name, last_name, role, dept=None, cohort=None, is_staff=False, is_superuser=False):
    u, created = User.objects.get_or_create(
        username=username,
        defaults={
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "role": role,
            "department": dept,
            "cohort": cohort,
            "is_staff": is_staff,
            "is_superuser": is_superuser,
            "is_active": True,
        }
    )
    if created:
        u.set_password("Password123!")
        u.save()
        print(f"  + Tạo tài khoản: {username} ({role})")
    return u

admin_user = create_user("admin", "admin@huce.edu.vn", "Quản trị", "Hệ thống", User.Role.ADMIN, dept=dept_cnpm, is_staff=True, is_superuser=True)
head_user = create_user("truongbomon", "tbm@huce.edu.vn", "Nguyễn Văn", "Trưởng BM", User.Role.DEPARTMENT_HEAD, dept=dept_cnpm, is_staff=True)
gv01 = create_user("gv01", "gv01@huce.edu.vn", "Trần Thị", "Giảng Viên 1", User.Role.TEACHER, dept=dept_cnpm)
gv02 = create_user("gv02", "gv02@huce.edu.vn", "Lê Văn", "Giảng Viên 2", User.Role.TEACHER, dept=dept_cdt)

sv01 = create_user("sv01", "sv01@st.huce.edu.vn", "Phạm Minh", "Sinh Viên 1", User.Role.STUDENT, dept=dept_cnpm, cohort=c65)
sv02 = create_user("sv02", "sv02@st.huce.edu.vn", "Hoàng Anh", "Sinh Viên 2", User.Role.STUDENT, dept=dept_cnpm, cohort=c65)

# 7. Tạo một số Topic mẫu
topics_data = [
    {
        "title": "Nghiên cứu và phát triển trợ lý ảo AI hỗ trợ học tập trực tuyến",
        "description": "Xây dựng Chatbot AI sử dụng RAG tích hợp tài liệu môn học để giải đáp thắc mắc tự động cho sinh viên.",
        "department": dept_cnpm,
        "field": f_ai,
        "cohort": c65,
        "academic_year": y25,
        "semester": s1,
        "status": Topic.Status.APPROVED,
        "proposed_by": gv01,
        "reviewed_by": head_user,
    },
    {
        "title": "Xây dựng Nền tảng quản lý dự án Agile/Scrum dựa trên kiến trúc Microservices",
        "description": "Phát triển công cụ hỗ trợ các đội ngũ dev theo dõi Kanban board, Sprint planning và tự động hóa CI/CD.",
        "department": dept_cnpm,
        "field": f_se,
        "cohort": c65,
        "academic_year": y25,
        "semester": s1,
        "status": Topic.Status.APPROVED,
        "proposed_by": gv01,
        "reviewed_by": head_user,
    },
    {
        "title": "Ứng dụng IoT và Machine Learning trong giám sát môi trường thông minh",
        "description": "Hệ thống kết hợp cảm biến ESP32 thu thập chỉ số AQI và dự báo ô nhiễm môi trường.",
        "department": dept_cdt,
        "field": f_iot,
        "cohort": c66,
        "academic_year": y25,
        "semester": s2,
        "status": Topic.Status.PENDING,
        "proposed_by": gv02,
    }
]

for t_info in topics_data:
    t, created = Topic.objects.get_or_create(
        title=t_info["title"],
        defaults=t_info
    )
    if created:
        print(f"  + Tạo đề tài mẫu: {t.title}")

print("✅ ĐÃ KHỞI TẠO DỮ LIỆU THÀNH CÔNG!")
