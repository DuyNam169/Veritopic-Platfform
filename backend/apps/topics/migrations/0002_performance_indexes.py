"""
Bổ sung 2 index quan trọng cho hiệu năng khi dữ liệu đề tài tích lũy qua nhiều khóa học
(đúng tinh thần "lưu lịch sử đề tài của tất cả các khóa" — dữ liệu sẽ tăng dần, không phải
chỉ vài chục bản ghi như lúc demo):

1. pg_trgm + GIN index trên (title, description) — tăng tốc chức năng "Tìm kiếm đề tài theo
   tên, từ khóa" (search_fields ở TopicViewSet). Không có index này, SearchFilter của DRF sinh
   ra câu lệnh SQL "LIKE '%...%'" chạy full table scan — chấp nhận được với vài trăm bản ghi,
   nhưng chậm dần rõ rệt khi vượt qua vài nghìn bản ghi (nhiều khóa cộng dồn).

2. ivfflat index trên cột `embedding` — tăng tốc việc xếp hạng Top N đề tài tương đồng
   (find_similar_topics dùng CosineDistance). Không có index này, mỗi lần kiểm tra tương đồng
   pgvector phải quét tuần tự (sequential scan) toàn bộ bảng Topic để tính khoảng cách.

LƯU Ý khi seed dữ liệu demo: ivfflat cần có sẵn dữ liệu mới tạo index hiệu quả (số lists nên
~ sqrt(số dòng)). Với đồ án môn học dữ liệu ít, index này ảnh hưởng không nhiều, nhưng vẫn nên
có sẵn migration để đúng chuẩn khi dữ liệu thật tăng lên.
"""
from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("topics", "0001_initial"),
    ]

    operations = [
        # Bật extension pg_trgm (cần quyền superuser hoặc CREATEDB trên DB — ảnh image
        # pgvector/pgvector:pg16 mặc định cho phép việc này với user chủ sở hữu DB).
        TrigramExtension(),
        migrations.RunSQL(
            sql="""
                CREATE INDEX IF NOT EXISTS topic_title_trgm_idx
                ON topics_topic USING GIN (title gin_trgm_ops);

                CREATE INDEX IF NOT EXISTS topic_description_trgm_idx
                ON topics_topic USING GIN (description gin_trgm_ops);
            """,
            reverse_sql="""
                DROP INDEX IF EXISTS topic_title_trgm_idx;
                DROP INDEX IF EXISTS topic_description_trgm_idx;
            """,
        ),
        migrations.RunSQL(
            sql="""
                CREATE INDEX IF NOT EXISTS topic_embedding_ivfflat_idx
                ON topics_topic USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """,
            reverse_sql="""
                DROP INDEX IF EXISTS topic_embedding_ivfflat_idx;
            """,
        ),
    ]
