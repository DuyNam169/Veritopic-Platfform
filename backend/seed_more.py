import django
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from apps.accounts.models import User
from apps.academics.models import Department, Field, Cohort, AcademicYear, Semester
from apps.topics.models import Topic, TopicAssignment
from apps.progress.models import ProgressReport, ProgressFeedback
from apps.topics.services.similarity import get_embedding

dept = Department.objects.first()
field = Field.objects.first()
cohort = Cohort.objects.first()
year = AcademicYear.objects.first()
sem = Semester.objects.first()

gv01 = User.objects.get(username='gv01')
truongbomon = User.objects.get(username='truongbomon')

# 1. Create students sv02 to sv10
student_names = [
    ('sv02', 'Trần Thị', 'Sinh Viên 2', 'SV002'),
    ('sv03', 'Lê Văn', 'Sinh Viên 3', 'SV003'),
    ('sv04', 'Phạm Hoàng', 'Sinh Viên 4', 'SV004'),
    ('sv05', 'Vũ Thị', 'Sinh Viên 5', 'SV005'),
    ('sv06', 'Đặng Minh', 'Sinh Viên 6', 'SV006'),
    ('sv07', 'Bùi Đức', 'Sinh Viên 7', 'SV007'),
    ('sv08', 'Đỗ Phương', 'Sinh Viên 8', 'SV008'),
    ('sv09', 'Hồ Thanh', 'Sinh Viên 9', 'SV009'),
    ('sv10', 'Ngô Nam', 'Sinh Viên 10', 'SV010'),
]

students_map = {}
for username, first_name, last_name, st_code in student_names:
    u, created = User.objects.get_or_create(username=username)
    u.role = 'student'
    u.email = f'{username}@st.huce.edu.vn'
    u.first_name = first_name
    u.last_name = last_name
    u.student_code = st_code
    u.department = dept
    u.cohort = cohort
    u.is_active = True
    u.set_password('Password123!')
    u.save()
    students_map[username] = u
    print(f'Created/Updated student {username}')

# Assign sv10 to existing unassigned approved topic
existing_blockchain = Topic.objects.filter(title__icontains='Blockchain').first()
if existing_blockchain and not existing_blockchain.assignments.exists():
    assign = TopicAssignment.objects.create(
        topic=existing_blockchain,
        assigned_by=gv01,
        status='active',
        note='Phân công sinh viên làm đồ án Blockchain'
    )
    assign.students.add(students_map['sv10'])
    print(f'Assigned existing topic "{existing_blockchain.title}" to sv10')

# 2. Create 5 new topics for gv01
new_topics_data = [
    {
        'title': 'Xây dựng hệ thống phát hiện gian lận trong giao dịch tài chính bằng AI',
        'description': 'Sử dụng mô hình Anomaly Detection và Random Forest để phân tích hàng triệu giao dịch ngân hàng theo thời gian thực nhằm cảnh báo rủi ro gian lận.',
        'keywords': 'AI, Machine Learning, Anomaly Detection, Fraud Detection, Python',
        'max_students': 2,
        'assigned_students': ['sv02', 'sv03'],
        'reports': [
            {'stage': 'Khảo sát bài toán & Thu thập dataset', 'percent': 30, 'submitted_by': 'sv02', 'score': 8.5, 'comment': 'Tập dữ liệu thu thập đầy đủ. Cần tiền xử lý loại bỏ outlier tốt hơn.'},
            {'stage': 'Xây dựng mô hình Random Forest & XGBoost', 'percent': 60, 'submitted_by': 'sv03', 'score': 9.2, 'comment': 'Mô hình đạt độ chính xác (Precision) trên 94%. Tiến độ rất ấn tượng.'}
        ]
    },
    {
        'title': 'Ứng dụng IoT và Machine Learning trong giám sát môi trường thông minh',
        'description': 'Hệ thống kết hợp cảm biến ESP32 thu thập chỉ số AQI, nhiệt độ, độ ẩm và gửi dữ liệu về Server phân tích, dự báo ô nhiễm môi trường.',
        'keywords': 'IoT, ESP32, MQTT, Machine Learning, Dashboard',
        'max_students': 1,
        'assigned_students': ['sv04'],
        'reports': [
            {'stage': 'Thiết kế phần cứng & Lập trình nhúng', 'percent': 40, 'submitted_by': 'sv04', 'score': 8.8, 'comment': 'Mạch điều khiển hoạt động ổn định, truyền nhận dữ liệu MQTT tốt.'}
        ]
    },
    {
        'title': 'Nghiên cứu và phát triển trợ lý ảo AI hỗ trợ học tập trực tuyến',
        'description': 'Xây dựng Chatbot AI sử dụng Retrieval-Augmented Generation (RAG) tích hợp tài liệu môn học để giải đáp thắc mắc tự động cho sinh viên.',
        'keywords': 'AI, RAG, LLM, OpenAI API, LangChain, React',
        'max_students': 2,
        'assigned_students': ['sv05', 'sv06'],
        'reports': [
            {'stage': 'Tích hợp Vector DB & RAG Pipeline', 'percent': 80, 'submitted_by': 'sv05', 'score': 9.5, 'comment': 'Chatbot trả lời chính xác, độ trễ thấp. Chuẩn bị hoàn thiện báo cáo đồ án tốt nghiệp.'}
        ]
    },
    {
        'title': 'Hệ thống quản lý chuỗi cung ứng logistics dựa trên microservices',
        'description': 'Xây dựng hệ thống quản lý kho và vận chuyển với kiến trúc Microservices (Spring Boot + Docker + RabbitMQ).',
        'keywords': 'Microservices, Spring Boot, Docker, RabbitMQ, Vue.js',
        'max_students': 1,
        'assigned_students': ['sv07'],
        'reports': [
            {'stage': 'Thiết kế kiến trúc Service & Database', 'percent': 25, 'submitted_by': 'sv07', 'score': 8.0, 'comment': 'Khảo sát kiến trúc kỹ lưỡng. Chú ý cấu hình Docker-Compose đúng cổng.'}
        ]
    },
    {
        'title': 'Phát triển ứng dụng nhận dạng chữ viết tay Tiếng Việt từ ảnh tài liệu',
        'description': 'Ứng dụng mô hình OCR (Transformer-based CRNN) để trích xuất văn bản Tiếng Việt từ tài liệu scan và ảnh chụp.',
        'keywords': 'Computer Vision, OCR, CRNN, PyTorch, FastApi',
        'max_students': 2,
        'assigned_students': ['sv08', 'sv09'],
        'reports': []
    }
]

for tdata in new_topics_data:
    st_list = tdata.pop('assigned_students')
    reports_list = tdata.pop('reports')
    
    t = Topic.objects.create(
        department=dept,
        field=field,
        cohort=cohort,
        academic_year=year,
        semester=sem,
        status=Topic.Status.APPROVED,
        proposed_by=gv01,
        reviewed_by=truongbomon,
        **tdata
    )
    
    # Calculate embedding
    text = f'{t.title} {t.description} {t.keywords}'
    t.embedding = get_embedding(text)
    t.save()
    
    print(f'Created Topic ID #{t.id}: {t.title}')
    
    if st_list:
        assignment = TopicAssignment.objects.create(
            topic=t,
            assigned_by=gv01,
            status='active',
            note='Phân công đồ án kỳ này'
        )
        for st_user in st_list:
            assignment.students.add(students_map[st_user])
        
        for i, rdata in enumerate(reports_list, start=1):
            report = ProgressReport.objects.create(
                assignment=assignment,
                submitted_by=students_map[rdata['submitted_by']],
                period_label=f'Đợt {i}',
                stage=rdata['stage'],
                percent=rdata['percent'],
                content=f'Báo cáo tiến độ {rdata["percent"]}% cho giai đoạn {rdata["stage"]}.',
                is_late=False
            )
            ProgressFeedback.objects.create(
                report=report,
                teacher=gv01,
                comment=rdata['comment'],
                score=rdata['score'],
                result='PASSED'
            )
        print(f'  -> Assigned to {st_list} with {len(reports_list)} progress reports.')

print('COMPLETED SEEDING 5 NEW TOPICS AND STUDENTS SV02-SV10!')
