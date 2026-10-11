from django.core.management.base import BaseCommand
from django.db import transaction
from apps.academics.models import Field
from apps.topics.models import Technology


FIELDS = {
    "quản lí đề tài": "Quản lý ngân hàng đề tài, quy trình đề xuất, phê duyệt, phân công và theo dõi đồ án.",
    "Trí tuệ nhân tạo và học máy": "Xây dựng mô hình học máy, xử lý ngôn ngữ tự nhiên, thị giác máy tính và hệ thống gợi ý.",
    "Khoa học dữ liệu": "Thu thập, làm sạch, phân tích và trực quan hóa dữ liệu; xây dựng mô hình dự báo hỗ trợ quyết định.",
    "Hệ thống thông tin": "Thiết kế hệ thống quản lý, số hóa quy trình nghiệp vụ và tổ chức dữ liệu cho đơn vị.",
    "Công nghệ phần mềm": "Phân tích yêu cầu, kiến trúc, kiểm thử, quản lý chất lượng và quy trình phát triển phần mềm.",
    "Ứng dụng Web": "Phát triển website, cổng thông tin và ứng dụng trực tuyến với giao diện, API và cơ sở dữ liệu.",
    "Ứng dụng di động": "Xây dựng ứng dụng Android, iOS hoặc đa nền tảng, tích hợp dịch vụ và trải nghiệm trên thiết bị di động.",
    "An toàn thông tin": "Bảo vệ hệ thống, kiểm soát truy cập, phát hiện tấn công và đánh giá rủi ro bảo mật.",
    "Mạng máy tính và điện toán đám mây": "Thiết kế, triển khai và giám sát hạ tầng mạng, máy chủ, dịch vụ đám mây và hệ thống phân tán.",
    "Internet vạn vật (IoT)": "Kết nối cảm biến và thiết bị; thu thập, truyền và theo dõi dữ liệu để phục vụ các ứng dụng thông minh.",
    "Hệ thống nhúng": "Thiết kế phần cứng và phần mềm điều khiển trên vi điều khiển, xử lý tín hiệu và giám sát thiết bị.",
    "Robot và tự động hóa": "Điều khiển robot, tự động hóa dây chuyền, định vị, tránh vật cản và tích hợp hệ thống cơ điện.",
    "Giao thông thông minh": "Ứng dụng công nghệ vào quản lý giao thông, bãi đỗ xe, vận tải, định vị và hỗ trợ an toàn cho người lái.",
}

TECHNOLOGIES = [
    ("Python", "Ngôn ngữ lập trình", "Phát triển backend, xử lý dữ liệu và xây dựng mô hình AI."),
    ("Java", "Ngôn ngữ lập trình", "Xây dựng dịch vụ backend và ứng dụng doanh nghiệp."),
    ("JavaScript", "Ngôn ngữ lập trình", "Phát triển giao diện web và dịch vụ chạy trên Node.js."),
    ("TypeScript", "Ngôn ngữ lập trình", "JavaScript có hệ thống kiểu, hỗ trợ phát triển ứng dụng web dễ bảo trì."),
    ("C/C++", "Ngôn ngữ lập trình", "Lập trình hệ thống, vi điều khiển và ứng dụng cần hiệu năng cao."),
    ("React", "Framework & thư viện", "Xây dựng giao diện web theo thành phần."),
    ("Vue.js", "Framework & thư viện", "Xây dựng giao diện và ứng dụng web tương tác."),
    ("Django", "Framework & thư viện", "Phát triển backend Python, quản lý dữ liệu và API."),
    ("FastAPI", "Framework & thư viện", "Xây dựng HTTP API bằng Python, phù hợp triển khai dịch vụ AI."),
    ("Spring Boot", "Framework & thư viện", "Phát triển dịch vụ backend Java và ứng dụng doanh nghiệp."),
    ("Flutter", "Ứng dụng di động", "Xây dựng ứng dụng đa nền tảng từ một mã nguồn Dart."),
    ("React Native", "Ứng dụng di động", "Phát triển ứng dụng Android và iOS với React."),
    ("PostgreSQL", "Cơ sở dữ liệu", "Cơ sở dữ liệu quan hệ cho ứng dụng và phân tích dữ liệu."),
    ("MySQL", "Cơ sở dữ liệu", "Quản lý và truy vấn dữ liệu quan hệ."),
    ("MongoDB", "Cơ sở dữ liệu", "Lưu trữ dữ liệu dạng tài liệu JSON linh hoạt."),
    ("Redis", "Cơ sở dữ liệu", "Lưu trữ trong bộ nhớ, bộ đệm và hàng đợi tác vụ."),
    ("PyTorch", "AI & dữ liệu", "Xây dựng, huấn luyện và triển khai mô hình học sâu."),
    ("scikit-learn", "AI & dữ liệu", "Tiền xử lý dữ liệu và xây dựng mô hình học máy truyền thống."),
    ("OpenCV", "AI & dữ liệu", "Xử lý ảnh, video và thị giác máy tính."),
    ("Pandas", "AI & dữ liệu", "Làm sạch, biến đổi và phân tích dữ liệu dạng bảng."),
    ("PhoBERT", "AI & dữ liệu", "Mô hình ngôn ngữ phục vụ các tác vụ xử lý tiếng Việt."),
    ("ESP32", "IoT & nhúng", "Vi điều khiển tích hợp Wi-Fi và Bluetooth cho thiết bị IoT."),
    ("Arduino", "IoT & nhúng", "Nền tảng phát triển nguyên mẫu điều khiển và đọc cảm biến."),
    ("Raspberry Pi", "IoT & nhúng", "Máy tính đơn bo phục vụ gateway, điều khiển và xử lý tại thiết bị."),
    ("MQTT", "IoT & nhúng", "Giao thức truyền thông publish/subscribe cho dữ liệu thiết bị."),
    ("LoRa", "IoT & nhúng", "Truyền dữ liệu không dây khoảng cách xa với mức tiêu thụ điện thấp."),
    ("Docker", "Hạ tầng & công cụ", "Đóng gói và chạy ứng dụng trong container."),
    ("Git", "Hạ tầng & công cụ", "Quản lý phiên bản mã nguồn và phối hợp phát triển."),
    ("ROS 2", "Robot & tự động hóa", "Nền tảng xây dựng các thành phần giao tiếp và điều khiển robot."),
    ("PLC", "Robot & tự động hóa", "Bộ điều khiển lập trình cho các hệ thống tự động hóa công nghiệp."),
]


class Command(BaseCommand):
    help = "Bổ sung danh mục admin; không ghi đè mô tả đã có và không tạo bản ghi trùng."

    @transaction.atomic
    def handle(self, *args, **options):
        fields_updated = technologies_created = 0
        for name, description in FIELDS.items():
            field = Field.objects.filter(name__iexact=name).first()
            if field is None:
                field = Field.objects.create(name=name)
            if not field.description.strip():
                field.description = description
                field.save(update_fields=["description"])
                fields_updated += 1
        for name, category, description in TECHNOLOGIES:
            technology = Technology.objects.filter(name__iexact=name).first()
            if technology is None:
                Technology.objects.create(name=name, category=category, description=description)
                technologies_created += 1
            elif not technology.description.strip():
                technology.description = description
                technology.save(update_fields=["description"])
        self.stdout.write(self.style.SUCCESS(
            f"Đã bổ sung mô tả {fields_updated} lĩnh vực, tạo {technologies_created} công nghệ."
        ))
