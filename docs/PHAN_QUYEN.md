# Phân quyền và luồng đề tài

Hệ thống dùng chung tài khoản, JWT, dữ liệu đề tài và dữ liệu tiến độ. Backend kiểm tra quyền độc lập với menu và route frontend.

| Vai trò | Phạm vi và thao tác |
| --- | --- |
| Admin | Quản lý tài khoản, danh mục, đề tài, duyệt đề tài, thống kê; theo dõi mọi nhóm đồ án và báo cáo. |
| Trưởng bộ môn | Tổng quan, duyệt đề tài, quản lý hồ sơ và xem tiến độ thuộc bộ môn gắn với tài khoản. Không sửa quyền tài khoản hoặc nhận xét thay giảng viên. |
| Giảng viên | Tra cứu ngân hàng đề tài, đề xuất, sửa/gửi lại đề tài của mình chưa được duyệt/giao, giao đề tài đã duyệt, quản lý nhóm hướng dẫn, nhận xét báo cáo. |
| Sinh viên | Tra cứu ngân hàng đề tài; xem nhóm được giao, nộp báo cáo khi nhóm đang thực hiện, xem nhận xét và tải tài liệu của nhóm. |

Luồng chung: giảng viên đề xuất → trưởng bộ môn/admin duyệt hoặc yêu cầu sửa → giảng viên giao sinh viên → sinh viên nộp báo cáo → giảng viên nhận xét → giảng viên kết thúc lượt giao. Mọi người dùng cùng dữ liệu, không sao chép dữ liệu giữa các giao diện.

## Ràng buộc

- Trưởng bộ môn chưa được gắn bộ môn sẽ không thấy dữ liệu quản lý bộ môn.
- Giảng viên có bộ môn chỉ đề xuất trong bộ môn đó.
- Sinh viên có thông tin bộ môn/khóa học phải phù hợp với đề tài được giao.
- Mỗi sinh viên chỉ có một lượt giao đang thực hiện trong cùng học kỳ; nhóm không vượt số sinh viên tối đa của đề tài (1–5).
- Điểm nhận xét từ 0 đến 10; phần trăm tiến độ từ 0 đến 100. Nhận xét chỉ thêm mới.
- Báo cáo hỗ trợ PDF, DOC, DOCX, ZIP tối đa 20 MB. Tải qua API có JWT.
- Đăng ký công khai chỉ tạo vai trò sinh viên; admin cấp quyền quản lý tại màn hình tài khoản.
- Đăng nhập/đăng xuất xóa bộ nhớ truy vấn; bản nháp đề xuất tách theo mã người dùng.

## Điểm vào giao diện

- `/`: tổng quan theo vai trò (giảng viên chuyển tới `/teacher`).
- `/teacher/*`: đề xuất, đề tài của tôi, sinh viên hướng dẫn.
- `/projects`, `/projects/:assignmentId`: giao diện tiến độ chung, nội dung và thao tác tùy quyền.
- `/approval`, `/people`: admin và trưởng bộ môn.
- `/users`, `/academics`, `/technologies`, `/statistics`: admin.

Kiểm thử tích hợp ở `backend/apps/progress/tests.py` bao gồm phạm vi dữ liệu của bốn vai trò, nộp báo cáo, nhận xét, tải tài liệu, giao đề tài và ngăn nâng quyền qua đăng ký.
