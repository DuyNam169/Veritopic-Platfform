import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
os.environ.setdefault("POSTGRES_HOST", "db")
django.setup()

sys.stdout.reconfigure(encoding="utf-8")

from apps.accounts.models import User
from apps.academics.models import Department, Field, Cohort, AcademicYear, Semester
from apps.topics.models import Topic, TopicAssignment
from apps.topics.services.similarity import get_embedding

print("Bắt đầu khởi tạo & mở rộng dữ liệu hệ thống (Seed Full Data)...")

# 1. Tạo Năm học
years_data = [
    ("2024-2025", False),
    ("2025-2026", True),
    ("2026-2027", False),
]
years = {}
for yname, is_cur in years_data:
    y, _ = AcademicYear.objects.get_or_create(name=yname, defaults={"is_current": is_cur})
    years[yname] = y

# 2. Tạo Học kỳ
semesters = {}
for yname, yobj in years.items():
    s1, _ = Semester.objects.get_or_create(
        academic_year=yobj,
        name="Học kỳ 1",
        defaults={"start_date": f"{yname[:4]}-09-01", "end_date": f"{yname[:4]}-12-31"}
    )
    s2, _ = Semester.objects.get_or_create(
        academic_year=yobj,
        name="Học kỳ 2",
        defaults={"start_date": f"{int(yname[:4])+1}-01-15", "end_date": f"{int(yname[:4])+1}-05-30"}
    )
    semesters[(yname, "Học kỳ 1")] = s1
    semesters[(yname, "Học kỳ 2")] = s2

# 3. Tạo Khóa học
cohorts_data = [
    ("K64", 2019, 2024),
    ("K65", 2020, 2025),
    ("K66", 2021, 2026),
    ("K67", 2022, 2027),
]
cohorts = {}
for cname, sy, ey in cohorts_data:
    c, _ = Cohort.objects.get_or_create(name=cname, defaults={"start_year": sy, "end_year": ey})
    cohorts[cname] = c

# 4. Tạo Bộ môn
depts_data = [
    ("CĐT", "Bộ môn Cơ điện tử"),
    ("ĐTVT", "Bộ môn Điện tử viễn thông"),
    ("CNPM", "Bộ môn Công nghệ phần mềm"),
    ("HTTT", "Bộ môn Hệ thống thông tin"),
    ("ATTT", "Bộ môn An toàn thông tin"),
]
departments = {}
for code, dname in depts_data:
    d, _ = Department.objects.get_or_create(code=code, defaults={"name": dname})
    if d.name != dname:
        d.name = dname
        d.save()
    departments[code] = d

# 5. Tạo Lĩnh vực
fields_data = [
    "Kỹ thuật phần mềm",
    "Trí tuệ nhân tạo (AI)",
    "Internet of Things (IoT)",
    "An toàn thông tin",
    "Khoa học dữ liệu",
    "Blockchain",
]
fields = {}
for fname in fields_data:
    f, _ = Field.objects.get_or_create(name=fname)
    fields[fname] = f

# 6. Giảng viên phụ trách
gv01 = User.objects.get(username="gv01") if User.objects.filter(username="gv01").exists() else User.objects.filter(role="teacher").first()
truongbomon = User.objects.get(username="truongbomon") if User.objects.filter(username="truongbomon").exists() else gv01

# 7. Cập nhật các Topic hiện tại phân bổ lại cho đa dạng Bộ môn, Năm học, Học kỳ, Khóa học
existing_topics = list(Topic.objects.all())
print(f"Tổng số đề tài hiện có trong DB: {len(existing_topics)}")

# Ma trận phân bổ để gán cho đề tài mới & đề tài cũ
topic_templates = [
    # Điện tử viễn thông
    {
        "title": "Nghiên cứu và thiết kế hệ thống truyền tin LoRaWAN cho nông nghiệp thông minh",
        "dept": departments["ĐTVT"],
        "field": fields["Internet of Things (IoT)"],
        "year": years["2025-2026"],
        "sem": semesters[("2025-2026", "Học kỳ 1")],
        "cohort": cohorts["K65"],
        "status": Topic.Status.APPROVED,
        "keywords": ["LoRaWAN", "IoT", "Cảm biến", "Nông nghiệp"],
        "desc": "Xây dựng mạng lưới cảm biến thu thập độ ẩm đất, nhiệt độ và truyền dữ liệu tầm xa bằng chuẩn LoRaWAN về Gateway trung tâm."
    },
    {
        "title": "Ứng dụng xử lý tín hiệu số DSP trong lọc nhiễu tín hiệu y sinh ECG",
        "dept": departments["ĐTVT"],
        "field": fields["Trí tuệ nhân tạo (AI)"],
        "year": years["2024-2025"],
        "sem": semesters[("2024-2025", "Học kỳ 2")],
        "cohort": cohorts["K64"],
        "status": Topic.Status.APPROVED,
        "keywords": ["DSP", "ECG", "Xử lý tín hiệu", "Y tế"],
        "desc": "Áp dụng bộ lọc thích nghi LMS và Wavelet transform để loại bỏ nhiễu đường dây điện và nhiễu cơ học trong điện tâm đồ."
    },
    {
        "title": "Thiết kế và mô phỏng ăng-ten vi dải băng rộng cho mạng di động 5G",
        "dept": departments["ĐTVT"],
        "field": fields["Internet of Things (IoT)"],
        "year": years["2026-2027"],
        "sem": semesters[("2026-2027", "Học kỳ 1")],
        "cohort": cohorts["K66"],
        "status": Topic.Status.PENDING,
        "keywords": ["5G", "Ăng-ten", "HFSS", "Vi dải"],
        "desc": "Nghiên cứu cấu trúc Ăng-ten Microstrip Patch hoạt động ở dải tần 28GHz phục vụ truyền dữ liệu tốc độ cao."
    },

    # Công nghệ phần mềm
    {
        "title": "Xây dựng Nền tảng quản lý dự án Agile/Scrum dựa trên kiến trúc Microservices",
        "dept": departments["CNPM"],
        "field": fields["Kỹ thuật phần mềm"],
        "year": years["2025-2026"],
        "sem": semesters[("2025-2026", "Học kỳ 2")],
        "cohort": cohorts["K65"],
        "status": Topic.Status.APPROVED,
        "keywords": ["Microservices", "React", "NestJS", "Docker", "DevOps"],
        "desc": "Phát triển công cụ hỗ trợ các đội ngũ dev theo dõi Kanban board, Sprint planning và tự động hóa CI/CD."
    },
    {
        "title": "Phát triển ứng dụng di động hỗ trợ quản lý tài chính cá nhân tích hợp AI",
        "dept": departments["CNPM"],
        "field": fields["Kỹ thuật phần mềm"],
        "year": years["2024-2025"],
        "sem": semesters[("2024-2025", "Học kỳ 1")],
        "cohort": cohorts["K64"],
        "status": Topic.Status.APPROVED,
        "keywords": ["Flutter", "FastAPI", "AI Budgeting", "Mobile App"],
        "desc": "Ứng dụng giúp người dùng tự động phân loại hóa đơn qua OCR và đưa ra gợi ý tiết kiệm dựa trên mô hình phân tích hành vi."
    },
    {
        "title": "Hệ thống kiểm thử tự động phần mềm Web dựa trên Selenium và AI Generative",
        "dept": departments["CNPM"],
        "field": fields["Kỹ thuật phần mềm"],
        "year": years["2025-2026"],
        "sem": semesters[("2025-2026", "Học kỳ 1")],
        "cohort": cohorts["K66"],
        "status": Topic.Status.RENAME_REQUESTED,
        "review_note": "Cần làm rõ cách tích hợp AI Generative trong kịch bản sinh testcase.",
        "keywords": ["Software Testing", "Selenium", "LLM", "Automation"],
        "desc": "Tự động phát sinh Test script từ mô tả bằng ngôn ngữ tự nhiên của tester."
    },

    # Hệ thống thông tin
    {
        "title": "Xây dựng kho dữ liệu (Data Warehouse) và hệ thống báo cáo BI cho chuỗi bán lẻ",
        "dept": departments["HTTT"],
        "field": fields["Khoa học dữ liệu"],
        "year": years["2025-2026"],
        "sem": semesters[("2025-2026", "Học kỳ 1")],
        "cohort": cohorts["K65"],
        "status": Topic.Status.APPROVED,
        "keywords": ["Data Warehouse", "ETL", "Power BI", "SQL Server"],
        "desc": "Thiết kế mô hình Kimball Star Schema, xây dựng các pipeline ETL tự động để tổng hợp dữ liệu doanh số từ nhiều chi nhánh."
    },
    {
        "title": "Hệ thống gợi ý sản phẩm thương mại điện tử dựa trên lọc cộng tác (Collaborative Filtering)",
        "dept": departments["HTTT"],
        "field": fields["Khoa học dữ liệu"],
        "year": years["2024-2025"],
        "sem": semesters[("2024-2025", "Học kỳ 2")],
        "cohort": cohorts["K64"],
        "status": Topic.Status.APPROVED,
        "keywords": ["Recommendation System", "Matrix Factorization", "Python"],
        "desc": "Xây dựng thuật toán phân tích hành vi duyệt web và lịch sử mua hàng để cá nhân hóa danh sách gợi ý sản phẩm."
    },

    # An toàn thông tin
    {
        "title": "Nghiên cứu phát triển hệ thống phát hiện xâm nhập mạng (IDS) dựa trên Deep Learning",
        "dept": departments["ATTT"],
        "field": fields["An toàn thông tin"],
        "year": years["2025-2026"],
        "sem": semesters[("2025-2026", "Học kỳ 2")],
        "cohort": cohorts["K65"],
        "status": Topic.Status.APPROVED,
        "keywords": ["IDS", "Cybersecurity", "Deep Learning", "NSL-KDD"],
        "desc": "Huấn luyện mô hình CNN-LSTM phân tích lưu lượng gói tin mạng để cảnh báo các cuộc tấn công DDoS và Port Scanning."
    },
    {
        "title": "Giải pháp xác thực sinh trắc học khuôn mặt chống giả mạo (Anti-spoofing) cho ứng dụng eKYC",
        "dept": departments["ATTT"],
        "field": fields["An toàn thông tin"],
        "year": years["2026-2027"],
        "sem": semesters[("2026-2027", "Học kỳ 1")],
        "cohort": cohorts["K67"],
        "status": Topic.Status.PENDING,
        "keywords": ["eKYC", "Face Anti-spoofing", "Computer Vision", "Security"],
        "desc": "Phân tích chuyển động mắt và kết cấu da để phát hiện các chiêu thức giả mạo khuôn mặt qua màn hình di động."
    },

    # Thêm cho Cơ điện tử khác năm & khóa
    {
        "title": "Thiết kế và chế tạo Robot di động tự hành (AGV) ứng dụng trong kho hàng thông minh",
        "dept": departments["CĐT"],
        "field": fields["Internet of Things (IoT)"],
        "year": years["2024-2025"],
        "sem": semesters[("2024-2025", "Học kỳ 1")],
        "cohort": cohorts["K64"],
        "status": Topic.Status.APPROVED,
        "keywords": ["AGV", "ROS", "SLAM", "Lidar", "Cơ điện tử"],
        "desc": "Xây dựng robot vận chuyển hàng hóa tự động quét bản đồ bằng Lidar và di chuyển tránh vật cản trong nhà xưởng."
    },
    {
        "title": "Xây dựng cánh tay Robot 6 bậc tự do điều khiển qua giao diện thực tế ảo (VR)",
        "dept": departments["CĐT"],
        "field": fields["Trí tuệ nhân tạo (AI)"],
        "year": years["2025-2026"],
        "sem": semesters[("2025-2026", "Học kỳ 2")],
        "cohort": cohorts["K66"],
        "status": Topic.Status.APPROVED,
        "keywords": ["Robotics", "VR", "Unity", "Kinematics"],
        "desc": "Điều khiển cánh tay robot gắp sản phẩm chính xác theo góc nhìn VR của người vận hành từ xa."
    },
]

# Phân bổ lại 1 số đề tài cũ nếu cần để thêm phong phú
if existing_topics:
    # Cập nhật topic cũ dàn trải ra các bộ môn khác nhau
    dept_keys = list(departments.keys())
    year_keys = list(years.keys())
    cohort_keys = list(cohorts.keys())

    for idx, t in enumerate(existing_topics):
        # Đổi bộ môn cho các đề tài cũ để không bị gom hết vào Cơ điện tử
        selected_dept_code = dept_keys[idx % len(dept_keys)]
        selected_year_name = year_keys[idx % len(year_keys)]
        selected_cohort_name = cohort_keys[idx % len(cohort_keys)]
        selected_sem_name = "Học kỳ 1" if idx % 2 == 0 else "Học kỳ 2"

        t.department = departments[selected_dept_code]
        t.academic_year = years[selected_year_name]
        t.semester = semesters[(selected_year_name, selected_sem_name)]
        t.cohort = cohorts[selected_cohort_name]

        # Thêm field nếu chưa có
        if not t.field:
            if "ai" in t.title.lower() or "trợ lý" in t.title.lower():
                t.field = fields["Trí tuệ nhân tạo (AI)"]
            elif "iot" in t.title.lower():
                t.field = fields["Internet of Things (IoT)"]
            elif "blockchain" in t.title.lower():
                t.field = fields["Blockchain"]
            else:
                t.field = fields["Kỹ thuật phần mềm"]
        t.save()
    print("Đã cập nhật phân bổ đa dạng cho các đề tài cũ!")

# Tạo thêm các Topic mẫu mới
for tmpl in topic_templates:
    topic, created = Topic.objects.get_or_create(
        title=tmpl["title"],
        defaults={
            "description": tmpl["desc"],
            "department": tmpl["dept"],
            "field": tmpl["field"],
            "academic_year": tmpl["year"],
            "semester": tmpl["sem"],
            "cohort": tmpl["cohort"],
            "status": tmpl["status"],
            "proposed_by": gv01,
            "reviewed_by": truongbomon if tmpl["status"] in [Topic.Status.APPROVED, Topic.Status.REJECTED] else None,
            "review_note": tmpl.get("review_note", "")
        }
    )
    if created:
        text = f"{topic.title} {topic.description}"
        topic.embedding = get_embedding(text)
        topic.save()
        print(f"Đã tạo đề tài mới #{topic.id}: {topic.title} ({tmpl['dept'].name})")

print("HOÀN THÀNH SEED DỮ LIỆU ĐẦY ĐỦ CHO BỘ LỌC!")
