from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.academics.models import AcademicYear, Cohort, Department, Field, Semester
from apps.topics.models import Topic, TopicAssignment, TopicHistory


DEMO_PASSWORD = "Veritopic@2026"


class Command(BaseCommand):
    help = "Tạo dữ liệu demo giả lập theo bối cảnh Khoa CNTT - Trường Đại học Công nghệ GTVT (UTT)."

    @transaction.atomic
    def handle(self, *args, **options):
        departments = self._seed_departments()
        cohorts = self._seed_cohorts()
        years, semesters = self._seed_academic_periods()
        fields = self._seed_fields()
        users = self._seed_users(departments, cohorts)
        self._assign_department_heads(departments, users)
        topics = self._seed_topics(departments, cohorts, years, semesters, fields, users)

        self.stdout.write(self.style.SUCCESS(
            "Đã seed dữ liệu demo UTT: "
            f"{len(departments)} bộ môn, {len(cohorts)} khóa, {len(fields)} lĩnh vực, "
            f"{len(users)} tài khoản và {len(topics)} đề tài."
        ))
        self.stdout.write(f"Mật khẩu chung của tài khoản demo: {DEMO_PASSWORD}")

    def _seed_departments(self):
        # Tên đơn vị dựa trên cơ cấu công khai của Khoa CNTT UTT; mã là mã nội bộ của dữ liệu demo.
        rows = [
            ("HTTT", "Bộ môn Hệ thống thông tin"),
            ("CNPM", "Bộ môn Công nghệ phần mềm"),
            ("TTMMT", "Bộ môn Truyền thông và Mạng máy tính"),
            ("DTVT", "Bộ môn Điện tử viễn thông"),
            ("CDT", "Bộ môn Cơ điện tử"),
        ]
        result = {}
        for code, name in rows:
            department, _ = Department.objects.update_or_create(code=code, defaults={"name": name})
            result[code] = department
        return result

    def _seed_cohorts(self):
        rows = [
            ("K72", 2021, 2026),
            ("K73", 2022, 2027),
            ("K74", 2023, 2028),
            ("K75", 2024, 2029),
            ("K76", 2025, 2030),
        ]
        result = {}
        for name, start, end in rows:
            cohort, _ = Cohort.objects.update_or_create(
                name=name, defaults={"start_year": start, "end_year": end}
            )
            result[name] = cohort
        return result

    def _seed_academic_periods(self):
        year_rows = ["2023-2024", "2024-2025", "2025-2026", "2026-2027"]
        years = {}
        semesters = {}
        for year_name in year_rows:
            start_year = int(year_name[:4])
            year, _ = AcademicYear.objects.update_or_create(
                name=year_name,
                defaults={"is_current": year_name == "2026-2027"},
            )
            years[year_name] = year
            semester_rows = [
                ("Học kỳ 1", f"{start_year}-08-15", f"{start_year + 1}-01-15"),
                ("Học kỳ 2", f"{start_year + 1}-01-20", f"{start_year + 1}-06-30"),
            ]
            for name, start_date, end_date in semester_rows:
                semester, _ = Semester.objects.update_or_create(
                    academic_year=year,
                    name=name,
                    defaults={"start_date": start_date, "end_date": end_date},
                )
                semesters[(year_name, name)] = semester
        return years, semesters

    def _seed_fields(self):
        names = [
            "Trí tuệ nhân tạo và học máy",
            "Khoa học dữ liệu",
            "Hệ thống thông tin",
            "Công nghệ phần mềm",
            "Ứng dụng Web",
            "Ứng dụng di động",
            "An toàn thông tin",
            "Mạng máy tính và điện toán đám mây",
            "Internet vạn vật (IoT)",
            "Hệ thống nhúng",
            "Robot và tự động hóa",
            "Giao thông thông minh",
        ]
        result = {}
        for name in names:
            field, _ = Field.objects.get_or_create(name=name)
            result[name] = field
        return result

    def _seed_users(self, departments, cohorts):
        User = get_user_model()
        rows = [
            ("admin_test", "Nguyễn", "Hải Đăng", "admin", None, None, "", "0900000001"),
            ("tbm_test", "Trần", "Minh Đức", "department_head", "HTTT", None, "", "0900000011"),
            ("tbm_cnpm", "Lê", "Thu Hương", "department_head", "CNPM", None, "", "0900000012"),
            ("tbm_mang", "Phạm", "Quang Vinh", "department_head", "TTMMT", None, "", "0900000013"),
            ("tbm_dtvt", "Đỗ", "Thanh Hà", "department_head", "DTVT", None, "", "0900000014"),
            ("tbm_cdt", "Vũ", "Mạnh Cường", "department_head", "CDT", None, "", "0900000015"),
            ("gv_test", "Nguyễn", "Hoàng Minh", "teacher", "HTTT", None, "", "0900000101"),
            ("gv_thanhson", "Trịnh", "Thanh Sơn", "teacher", "HTTT", None, "", "0900000102"),
            ("gv_ngocanh", "Lê", "Ngọc Anh", "teacher", "CNPM", None, "", "0900000103"),
            ("gv_minhquan", "Phan", "Minh Quân", "teacher", "CNPM", None, "", "0900000104"),
            ("gv_thuha", "Nguyễn", "Thu Hà", "teacher", "TTMMT", None, "", "0900000105"),
            ("gv_quanghuy", "Bùi", "Quang Huy", "teacher", "TTMMT", None, "", "0900000106"),
            ("gv_hoangnam", "Đặng", "Hoàng Nam", "teacher", "DTVT", None, "", "0900000107"),
            ("gv_kimngan", "Hoàng", "Kim Ngân", "teacher", "DTVT", None, "", "0900000108"),
            ("gv_ducanh", "Đỗ", "Đức Anh", "teacher", "CDT", None, "", "0900000109"),
            ("gv_phuongthao", "Vũ", "Phương Thảo", "teacher", "CDT", None, "", "0900000110"),
            ("sv_test", "Nguyễn", "Tuấn Anh", "student", "HTTT", "K73", "73DCHT001", "0900001001"),
            ("sv_73_02", "Trần", "Khánh Linh", "student", "HTTT", "K73", "73DCHT002", "0900001002"),
            ("sv_73_03", "Lê", "Quang Huy", "student", "CNPM", "K73", "73DCCN003", "0900001003"),
            ("sv_73_04", "Phạm", "Ngọc Mai", "student", "CNPM", "K73", "73DCCN004", "0900001004"),
            ("sv_73_05", "Đỗ", "Minh Khang", "student", "TTMMT", "K73", "73DCMM005", "0900001005"),
            ("sv_73_06", "Vũ", "Thu Trang", "student", "TTMMT", "K73", "73DCMM006", "0900001006"),
            ("sv_74_01", "Bùi", "Đức Long", "student", "CNPM", "K74", "74DCCN001", "0900001101"),
            ("sv_74_02", "Hoàng", "Hà My", "student", "CNPM", "K74", "74DCCN002", "0900001102"),
            ("sv_74_03", "Đặng", "Nhật Minh", "student", "HTTT", "K74", "74DCHT003", "0900001103"),
            ("sv_74_04", "Ngô", "Phương Anh", "student", "HTTT", "K74", "74DCHT004", "0900001104"),
            ("sv_74_05", "Dương", "Gia Bảo", "student", "DTVT", "K74", "74DCDT005", "0900001105"),
            ("sv_74_06", "Đinh", "Thảo Vy", "student", "DTVT", "K74", "74DCDT006", "0900001106"),
            ("sv_75_01", "Mai", "Tiến Dũng", "student", "CDT", "K75", "75DCCD001", "0900001201"),
            ("sv_75_02", "Lý", "Bảo Ngọc", "student", "CDT", "K75", "75DCCD002", "0900001202"),
            ("sv_75_03", "Tạ", "Anh Tú", "student", "TTMMT", "K75", "75DCMM003", "0900001203"),
            ("sv_75_04", "Hồ", "Yến Nhi", "student", "TTMMT", "K75", "75DCMM004", "0900001204"),
            ("sv_76_01", "Chu", "Quốc Việt", "student", "CNPM", "K76", "76DCCN001", "0900001301"),
            ("sv_76_02", "Đào", "Minh Châu", "student", "HTTT", "K76", "76DCHT002", "0900001302"),
        ]
        result = {}
        for username, first_name, last_name, role, dept_code, cohort_name, student_code, phone in rows:
            defaults = {
                "first_name": first_name,
                "last_name": last_name,
                "email": f"{username}@demo.utt.edu.vn",
                "role": role,
                "department": departments.get(dept_code),
                "cohort": cohorts.get(cohort_name),
                "student_code": student_code,
                "phone_number": phone,
                "is_active": True,
                "is_staff": role == "admin",
                "is_superuser": role == "admin",
            }
            user, _ = User.objects.update_or_create(username=username, defaults=defaults)
            user.set_password(DEMO_PASSWORD)
            user.save(update_fields=["password"])
            result[username] = user
        return result

    def _assign_department_heads(self, departments, users):
        mappings = {
            "HTTT": "tbm_test",
            "CNPM": "tbm_cnpm",
            "TTMMT": "tbm_mang",
            "DTVT": "tbm_dtvt",
            "CDT": "tbm_cdt",
        }
        for code, username in mappings.items():
            department = departments[code]
            if department.head_id != users[username].id:
                department.head = users[username]
                department.save(update_fields=["head"])

    def _seed_topics(self, departments, cohorts, years, semesters, fields, users):
        # Mọi tên người và dữ liệu liên hệ đều là giả lập; nội dung đề tài mô phỏng hướng ứng dụng tại UTT.
        rows = [
            ("VT001", "Xây dựng hệ thống quản lý ngân hàng đề tài đồ án và phát hiện tương đồng ngữ nghĩa", "Ứng dụng web hỗ trợ đề xuất, phê duyệt, phân công đề tài và cảnh báo nội dung gần trùng bằng mô hình embedding.", "HTTT", "Trí tuệ nhân tạo và học máy", "K73", "2025-2026", "Học kỳ 2", "gv_test", "approved", "tbm_test", "Đề tài phù hợp định hướng chuyển đổi số của khoa.", "2026-02-18", ["sv_test", "sv_73_02"]),
            ("VT002", "Hệ thống quản lý đề tài tốt nghiệp tích hợp kiểm tra trùng lặp bằng trí tuệ nhân tạo", "Số hóa quy trình quản lý đề tài và sử dụng xử lý ngôn ngữ tự nhiên để so sánh đề xuất mới với kho dữ liệu lịch sử.", "HTTT", "Trí tuệ nhân tạo và học máy", "K74", "2026-2027", "Học kỳ 1", "gv_thanhson", "pending", None, "", "2026-09-22", []),
            ("VT003", "Nền tảng cố vấn học tập và cảnh báo nguy cơ học vụ cho sinh viên", "Phân tích kết quả học tập, tiến độ tích lũy tín chỉ và đưa ra cảnh báo sớm cho cố vấn học tập.", "HTTT", "Khoa học dữ liệu", "K73", "2025-2026", "Học kỳ 2", "gv_thanhson", "approved", "tbm_test", "Đã làm rõ phạm vi dữ liệu và tiêu chí cảnh báo.", "2026-02-25", ["sv_73_03"]),
            ("VT004", "Kho dữ liệu phục vụ phân tích tuyển sinh và kết quả học tập", "Thiết kế data warehouse, quy trình ETL và dashboard hỗ trợ phân tích tuyển sinh theo ngành, khu vực và khóa học.", "HTTT", "Khoa học dữ liệu", "K72", "2024-2025", "Học kỳ 2", "gv_test", "approved", "tbm_test", "Đạt yêu cầu chuyên môn.", "2025-02-12", []),
            ("VT005", "Hệ thống hỏi đáp quy chế đào tạo sử dụng kiến trúc RAG", "Xây dựng trợ lý hỏi đáp tiếng Việt dựa trên quy chế, kế hoạch học tập và các thông báo đã được kiểm chứng.", "HTTT", "Trí tuệ nhân tạo và học máy", "K74", "2026-2027", "Học kỳ 1", "gv_test", "rename_requested", "tbm_test", "Tên đề tài cần nêu rõ phạm vi tài liệu và đối tượng sử dụng.", "2026-09-28", []),
            ("VT006", "Cổng thông tin thực tập doanh nghiệp dành cho sinh viên Khoa CNTT", "Quản lý vị trí thực tập, hồ sơ ứng tuyển, nhật ký thực tập và đánh giá giữa doanh nghiệp với giảng viên hướng dẫn.", "CNPM", "Ứng dụng Web", "K73", "2025-2026", "Học kỳ 2", "gv_ngocanh", "approved", "tbm_cnpm", "Đề tài có khả năng triển khai thử nghiệm.", "2026-02-20", ["sv_73_03", "sv_73_04"]),
            ("VT007", "Ứng dụng di động hỗ trợ sinh viên theo dõi lịch học và tiến độ tín chỉ", "Đồng bộ lịch học, lịch thi, thời hạn học vụ và hiển thị tiến độ hoàn thành chương trình đào tạo.", "CNPM", "Ứng dụng di động", "K73", "2025-2026", "Học kỳ 2", "gv_minhquan", "approved", "tbm_cnpm", "Thông qua sau khi bổ sung cơ chế nhắc lịch.", "2026-02-22", ["sv_74_01", "sv_74_02"]),
            ("VT008", "Nền tảng quản lý câu lạc bộ và hoạt động ngoại khóa sinh viên", "Quản lý sự kiện, đăng ký tham gia, điểm rèn luyện và minh chứng hoạt động trên nền web.", "CNPM", "Ứng dụng Web", "K74", "2026-2027", "Học kỳ 1", "gv_ngocanh", "pending", None, "", "2026-09-18", []),
            ("VT009", "Hệ thống chấm bài lập trình trực tuyến hỗ trợ nhiều ngôn ngữ", "Xây dựng sandbox chạy mã nguồn, bộ chấm theo test case và dashboard theo dõi kết quả học tập.", "CNPM", "Công nghệ phần mềm", "K74", "2026-2027", "Học kỳ 1", "gv_minhquan", "approved", "tbm_cnpm", "Cần bảo đảm cách ly tiến trình khi triển khai.", "2026-09-12", ["sv_74_01"]),
            ("VT010", "Website thương mại điện tử cho sản phẩm OCOP tích hợp gợi ý cá nhân hóa", "Xây dựng quy trình bán hàng đa nhà cung cấp và mô hình gợi ý sản phẩm theo hành vi người dùng.", "CNPM", "Ứng dụng Web", "K74", "2026-2027", "Học kỳ 1", "gv_ngocanh", "rejected", "tbm_cnpm", "Phạm vi quá rộng; cần thu hẹp bài toán và nguồn dữ liệu gợi ý.", "2026-09-08", []),
            ("VT011", "Hệ thống quản lý bãi đỗ xe thông minh sử dụng nhận dạng biển số", "Kết hợp camera, nhận dạng ký tự và ứng dụng quản lý lượt xe, vị trí trống, doanh thu theo thời gian thực.", "TTMMT", "Giao thông thông minh", "K73", "2025-2026", "Học kỳ 2", "gv_thuha", "approved", "tbm_mang", "Phù hợp hướng giao thông thông minh.", "2026-02-10", ["sv_73_05", "sv_73_06"]),
            ("VT012", "Giám sát chất lượng mạng không dây trong khuôn viên trường theo thời gian thực", "Thu thập chỉ số Wi-Fi, xây dựng bản đồ vùng phủ và cảnh báo điểm nghẽn hoặc suy giảm chất lượng dịch vụ.", "TTMMT", "Mạng máy tính và điện toán đám mây", "K74", "2026-2027", "Học kỳ 1", "gv_quanghuy", "pending", None, "", "2026-09-27", []),
            ("VT013", "Mô hình Zero Trust cho hệ thống dịch vụ nội bộ trường đại học", "Thiết kế xác thực liên tục, phân quyền tối thiểu và giám sát truy cập cho cụm dịch vụ nội bộ giả lập.", "TTMMT", "An toàn thông tin", "K74", "2026-2027", "Học kỳ 1", "gv_thuha", "approved", "tbm_mang", "Đã bổ sung kịch bản đánh giá an toàn.", "2026-09-05", ["sv_75_03"]),
            ("VT014", "Phát hiện bất thường lưu lượng mạng bằng học máy", "Trích xuất đặc trưng luồng mạng và so sánh các mô hình học máy để nhận diện hành vi quét cổng, DDoS và botnet.", "TTMMT", "An toàn thông tin", "K73", "2025-2026", "Học kỳ 2", "gv_quanghuy", "approved", "tbm_mang", "Thông qua với bộ dữ liệu công khai.", "2026-02-16", ["sv_73_05"]),
            ("VT015", "Triển khai hạ tầng điện toán đám mây riêng phục vụ phòng thực hành", "Xây dựng cụm ảo hóa, cấp phát tài nguyên theo lớp học và giám sát mức sử dụng tài nguyên.", "TTMMT", "Mạng máy tính và điện toán đám mây", "K72", "2024-2025", "Học kỳ 2", "gv_thuha", "approved", "tbm_mang", "Đã nghiệm thu mô hình thử nghiệm.", "2025-02-08", []),
            ("VT016", "Thiết bị giám sát hành trình xe buýt sử dụng GNSS và mạng di động", "Thiết kế thiết bị gửi vị trí, vận tốc và trạng thái phương tiện về máy chủ để hiển thị trên bản đồ.", "DTVT", "Giao thông thông minh", "K73", "2025-2026", "Học kỳ 2", "gv_hoangnam", "approved", "tbm_dtvt", "Bổ sung chế độ lưu đệm khi mất kết nối.", "2026-02-14", ["sv_74_05", "sv_74_06"]),
            ("VT017", "Mạng cảm biến IoT quan trắc chất lượng không khí trên tuyến giao thông", "Thiết kế nút đo bụi mịn, nhiệt độ, độ ẩm; truyền dữ liệu LoRa và trực quan hóa theo vị trí.", "DTVT", "Internet vạn vật (IoT)", "K74", "2026-2027", "Học kỳ 1", "gv_kimngan", "pending", None, "", "2026-09-24", []),
            ("VT018", "Hệ thống cảnh báo điểm mù cho xe tải bằng cảm biến siêu âm", "Xây dựng nguyên mẫu nhúng đo khoảng cách hai bên xe, phân loại mức nguy hiểm và cảnh báo cho người lái.", "DTVT", "Hệ thống nhúng", "K74", "2026-2027", "Học kỳ 1", "gv_hoangnam", "rename_requested", "tbm_dtvt", "Tên cần thể hiện rõ loại phương tiện và phạm vi nguyên mẫu.", "2026-09-25", []),
            ("VT019", "Khóa cửa phòng thí nghiệm sử dụng RFID và nhận diện khuôn mặt", "Quản lý quyền ra vào, lưu nhật ký và cảnh báo truy cập bất thường trên thiết bị biên.", "DTVT", "Internet vạn vật (IoT)", "K73", "2025-2026", "Học kỳ 2", "gv_kimngan", "rejected", "tbm_dtvt", "Chưa làm rõ yêu cầu bảo vệ dữ liệu sinh trắc học.", "2026-02-26", []),
            ("VT020", "Robot tự hành vận chuyển vật tư trong môi trường nhà xưởng", "Thiết kế cơ khí, điều khiển chuyển động, lập bản đồ và tránh vật cản cho robot di động cỡ nhỏ.", "CDT", "Robot và tự động hóa", "K73", "2025-2026", "Học kỳ 2", "gv_ducanh", "approved", "tbm_cdt", "Thông qua phương án nguyên mẫu quy mô phòng thí nghiệm.", "2026-02-11", ["sv_75_01", "sv_75_02"]),
            ("VT021", "Cánh tay robot phân loại sản phẩm bằng thị giác máy tính", "Nhận dạng màu sắc và hình dạng sản phẩm, tính toán tọa độ gắp và điều khiển tay máy phân loại.", "CDT", "Robot và tự động hóa", "K74", "2026-2027", "Học kỳ 1", "gv_phuongthao", "approved", "tbm_cdt", "Đề tài có mục tiêu và tiêu chí đánh giá rõ ràng.", "2026-09-11", ["sv_75_01"]),
            ("VT022", "Mô hình đèn giao thông thích ứng theo mật độ phương tiện", "Ước lượng lưu lượng từ camera và điều chỉnh chu kỳ tín hiệu trên mô hình nút giao giả lập.", "CDT", "Giao thông thông minh", "K74", "2026-2027", "Học kỳ 1", "gv_ducanh", "pending", None, "", "2026-10-01", []),
            ("VT023", "Hệ thống giám sát rung động động cơ và cảnh báo bảo trì dự đoán", "Thu thập tín hiệu gia tốc, trích xuất đặc trưng phổ và dự báo trạng thái bất thường của động cơ.", "CDT", "Hệ thống nhúng", "K74", "2026-2027", "Học kỳ 1", "gv_phuongthao", "pending", None, "", "2026-09-30", []),
            ("VT024", "Ứng dụng nhận diện biển báo giao thông hỗ trợ người lái", "Huấn luyện mô hình thị giác máy tính nhận diện biển báo Việt Nam và triển khai thử nghiệm trên thiết bị biên.", "HTTT", "Giao thông thông minh", "K72", "2023-2024", "Học kỳ 2", "gv_test", "approved", "tbm_test", "Đề tài đã hoàn thành và lưu trong ngân hàng đề tài.", "2024-02-19", []),
            ("VT025", "Phân tích dữ liệu hành trình để dự báo thời gian đến của xe buýt", "Làm sạch dữ liệu GPS lịch sử, xây dựng đặc trưng tuyến và dự báo ETA tại các điểm dừng.", "HTTT", "Khoa học dữ liệu", "K72", "2024-2025", "Học kỳ 1", "gv_thanhson", "approved", "tbm_test", "Đạt yêu cầu lưu trữ tham khảo.", "2024-09-16", []),
            ("VT026", "Hệ thống quản lý và đặt lịch sử dụng phòng thí nghiệm", "Quản lý thiết bị, lịch đăng ký, phê duyệt ca sử dụng và ghi nhận sự cố phòng thực hành.", "CNPM", "Hệ thống thông tin", "K72", "2023-2024", "Học kỳ 2", "gv_minhquan", "approved", "tbm_cnpm", "Đã nghiệm thu.", "2024-02-08", []),
            ("VT027", "Ứng dụng phản ánh sự cố hạ tầng giao thông từ cộng đồng", "Cho phép gửi phản ánh có vị trí và hình ảnh, phân loại sự cố, theo dõi trạng thái xử lý trên bản đồ.", "CNPM", "Ứng dụng di động", "K72", "2024-2025", "Học kỳ 1", "gv_ngocanh", "approved", "tbm_cnpm", "Đạt yêu cầu.", "2024-09-10", []),
            ("VT028", "Phát hiện tấn công DDoS trong mạng SDN sử dụng học sâu", "Thu thập thống kê luồng từ bộ điều khiển SDN và đánh giá mô hình học sâu trong phát hiện lưu lượng tấn công.", "TTMMT", "An toàn thông tin", "K72", "2024-2025", "Học kỳ 2", "gv_quanghuy", "approved", "tbm_mang", "Đã lưu vào ngân hàng đề tài.", "2025-02-15", []),
            ("VT029", "Thiết bị cảnh báo buồn ngủ cho người điều khiển phương tiện", "Kết hợp camera hồng ngoại và cảm biến để nhận biết nhắm mắt kéo dài, đưa ra cảnh báo âm thanh tại chỗ.", "DTVT", "Hệ thống nhúng", "K72", "2024-2025", "Học kỳ 2", "gv_hoangnam", "approved", "tbm_dtvt", "Đã nghiệm thu nguyên mẫu.", "2025-02-17", []),
            ("VT030", "Mô hình bãi đỗ xe tự động dùng PLC và cảm biến", "Điều khiển cơ cấu nâng hạ, nhận biết vị trí xe và xây dựng giao diện giám sát trạng thái mô hình.", "CDT", "Robot và tự động hóa", "K72", "2024-2025", "Học kỳ 2", "gv_ducanh", "approved", "tbm_cdt", "Đã nghiệm thu.", "2025-02-21", []),
        ]
        result = {}
        for code, title, description, dept_code, field_name, cohort_name, year_name, semester_name, teacher_name, status, reviewer_name, review_note, created_date, student_names in rows:
            defaults = {
                "description": description,
                "department": departments[dept_code],
                "field": fields[field_name],
                "cohort": cohorts[cohort_name],
                "academic_year": years[year_name],
                "semester": semesters[(year_name, semester_name)],
                "proposed_by": users[teacher_name],
                "status": status,
                "reviewed_by": users.get(reviewer_name),
                "review_note": review_note,
            }
            topic, created = Topic.objects.update_or_create(title=title, defaults=defaults)
            created_at = timezone.make_aware(datetime.fromisoformat(f"{created_date}T09:00:00"))
            Topic.objects.filter(pk=topic.pk).update(created_at=created_at, updated_at=created_at)
            topic.refresh_from_db()
            result[code] = topic

            action = TopicHistory.Action.CREATED
            history, _ = TopicHistory.objects.get_or_create(
                topic=topic,
                action=action,
                note="Đề tài được tạo trong bộ dữ liệu demo UTT.",
                defaults={"actor": users[teacher_name]},
            )
            TopicHistory.objects.filter(pk=history.pk).update(created_at=created_at)

            if status != Topic.Status.PENDING and reviewer_name:
                action_by_status = {
                    Topic.Status.APPROVED: TopicHistory.Action.APPROVED,
                    Topic.Status.REJECTED: TopicHistory.Action.REJECTED,
                    Topic.Status.RENAME_REQUESTED: TopicHistory.Action.RENAME_REQUESTED,
                }
                review_history, _ = TopicHistory.objects.get_or_create(
                    topic=topic,
                    action=action_by_status[status],
                    note=review_note,
                    defaults={"actor": users[reviewer_name]},
                )
                TopicHistory.objects.filter(pk=review_history.pk).update(
                    created_at=created_at + timedelta(days=3)
                )

            if student_names:
                assignment, _ = TopicAssignment.objects.get_or_create(
                    topic=topic,
                    defaults={
                        "assigned_by": users[teacher_name],
                        "note": "Phân công nhóm sinh viên thực hiện đồ án.",
                    },
                )
                assignment.assigned_by = users[teacher_name]
                assignment.note = "Phân công nhóm sinh viên thực hiện đồ án."
                assignment.save(update_fields=["assigned_by", "note"])
                assignment.students.set([users[name] for name in student_names])
                TopicAssignment.objects.filter(pk=assignment.pk).update(
                    assigned_at=created_at + timedelta(days=7)
                )
                assigned_history, _ = TopicHistory.objects.get_or_create(
                    topic=topic,
                    action=TopicHistory.Action.ASSIGNED,
                    note="Đã phân công sinh viên/nhóm sinh viên thực hiện.",
                    defaults={"actor": users[teacher_name]},
                )
                TopicHistory.objects.filter(pk=assigned_history.pk).update(
                    created_at=created_at + timedelta(days=7)
                )
        return result
