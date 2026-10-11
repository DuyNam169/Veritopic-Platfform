# Đối chiếu schema với D:\KiemTraTrung

Ngày đối chiếu: 11/10/2026. Nguồn là dump PostgreSQL 18 (`KiemTraTrungLap`); ứng dụng đang dùng PostgreSQL 16 với pgvector. Người dùng chọn giữ schema Django và bổ sung nghiệp vụ còn thiếu, chỉ đồng bộ cấu trúc.

## Ánh xạ cấu trúc

| File nguồn | Django hiện tại | Xử lý |
| --- | --- | --- |
| `departments` | `academics_department` | Bổ sung mô tả; mở rộng độ dài tên/mã. Giữ quan hệ trưởng bộ môn và phân quyền hiện tại. |
| `majors` | `academics_major` | Bổ sung chuyên ngành, mã duy nhất, tên, mô tả và khóa ngoại đến bộ môn. API `/api/v1/academics/majors/`, admin quản lý tại Danh mục hệ thống. |
| `cohorts` | `academics_cohort` | Bổ sung mã khóa học và chuyên ngành; năm nhập học/tốt nghiệp tương ứng `start_year`/`end_year`. |
| `academic_years` | `academics_academicyear` | Bổ sung ngày bắt đầu/kết thúc và `is_active`. Giữ `is_current` riêng: đang sử dụng khác với năm hiện hành. |
| `semesters` | `academics_semester` | Bổ sung số học kỳ 1–3, duy nhất trong năm học khi có giá trị. Giữ ngày bắt đầu/kết thúc bắt buộc theo API hiện tại. |
| `users`, `lecturers`, `students` | `accounts_user` | Giữ tài khoản và hồ sơ gộp; bổ sung mã giảng viên, học vị, chuyên môn, chuyên ngành, năm học hồ sơ, ngày sinh, giới tính, trạng thái học tập. `full_name` tính từ họ/tên; mật khẩu tiếp tục dùng Django. |
| `topics` | `topics_topic` | Bổ sung mã đề tài, chuyên ngành, loại dự án, kiến trúc và người tạo. Giữ lĩnh vực là danh mục, từ khóa là JSON, quy trình duyệt hiện tại. Chuỗi tên chuẩn hóa được tính khi kiểm tra tương đồng. |
| `topic_students` | `topics_topicassignment` + bảng M2M sinh viên | Giữ lượt giao nhóm, giảng viên giao, trạng thái, ngày giao, hạn nộp; năm học lấy qua đề tài. Không tạo bảng giao đề tài song song. |
| `topic_approvals` | `topics_topichistory`, trường duyệt trên `topics_topic` | Giữ lịch sử có người thao tác, hành động, ghi chú và thời điểm; không tách quy trình duyệt thứ hai. |
| `topic_embeddings` | Vector và chữ ký embedding trên `topics_topic` | Tiếp tục dùng pgvector 768 chiều và chữ ký gắn với nội dung/model hiện tại. Không đổi model hoặc sao chép vector trong dump. |
| `similarity_checks` | `topics_topicsimilarityresult` và API kiểm tra | Giữ kết quả tương đồng đã lưu, mức cảnh báo, đánh giá bổ sung và thứ hạng; không thay thế pipeline hiện tại. |
| `technologies` | `topics_technology`, `topics_topictechnology` | Đã có danh mục và liên kết với đề tài. Giữ nhóm công nghệ linh hoạt đang dùng. |
| `django_migrations` | Lịch sử migrations của ứng dụng | Mỗi codebase có lịch sử riêng; không nhập lịch sử migrations từ file nguồn. |

Các bảng tài liệu/chức năng đề tài, báo cáo tiến độ, nhận xét, audit xóa, JWT và OTP vẫn được giữ vì frontend và backend hiện tại sử dụng chúng.

Hai schema tương thích về nghiệp vụ theo ánh xạ này, **không giống hệt tên bảng, nullability, enum và mọi cột metadata**. Ví dụ vai trò nguồn `LECTURER` tương ứng `teacher`, `HEAD_DEPARTMENT` tương ứng `department_head`; mã enum hiện tại được giữ để không làm hỏng API. Trạng thái hồ sơ sinh viên độc lập với quyền đăng nhập `is_active`.

## Tính toàn vẹn và kiểm tra

- Mã chuyên ngành, khóa học, đề tài và giảng viên được kiểm tra trùng; mã tùy chọn để trống không xung đột các bản ghi cũ.
- Chuyên ngành phải thuộc bộ môn; khóa học có chuyên ngành phải phù hợp với chuyên ngành/bộ môn hồ sơ và đề tài.
- Chặn đổi bộ môn chuyên ngành hoặc đổi chuyên ngành khóa học đang được sử dụng; khóa ngoại dùng `PROTECT`.
- Chỉ sinh viên đang học mới được chọn cho phân công mới; hồ sơ cá nhân không tự sửa các trường học vụ được quản lý.
- Không nhập, xóa, ánh xạ lại ID hay thay mật khẩu của dữ liệu nguồn/hiện tại. Các giá trị mặc định của cột mới chỉ phục vụ migration.

Kiểm tra lệch migrations: `python manage.py makemigrations --check --dry-run`.

Kiểm tra trực tiếp bảng, kiểu cột, nullability, khóa ngoại và constraints của DB đang chạy: `python manage.py check_database_schema`.

Bản sao lưu trước thay đổi được giữ cục bộ tại `.backups/db-sync-20261011/before-sync.dump`; thư mục này đã được loại khỏi Git.
