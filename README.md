# Veritopic — Hệ thống Quản lý Ngân hàng Đề tài Đồ án Sinh viên

Hệ thống Web hỗ trợ quản lý ngân hàng đề tài đồ án sinh viên qua nhiều khóa học, đồng thời tự động
**phát hiện đề tài trùng lặp/tương đồng** dựa trên AI, giúp Trưởng bộ môn kiểm duyệt đề tài mới nhanh
và chính xác hơn.

## 1. Mô tả chức năng

**Quản lý danh mục dữ liệu nền**
- Quản lý khóa / năm học / học kỳ
- Quản lý giảng viên, sinh viên
- Quản lý chuyên ngành / bộ môn
- Quản lý danh mục lĩnh vực đề tài (Web, Mobile, AI, Nhúng...)

**Quản lý vòng đời đề tài**
- Quản lý danh mục đề tài; giao đề tài cho sinh viên hoặc nhóm sinh viên
- Lưu lịch sử đề tài của tất cả các khóa
- Tìm kiếm đề tài theo tên, từ khóa, giảng viên, sinh viên, khóa, năm học

**Phát hiện trùng lặp / tương đồng (chức năng lõi)**
- Kiểm tra trùng tên chính xác
- Kiểm tra đề tài gần giống theo từ khóa (TF-IDF + Cosine Similarity)
- Tính mức độ tương đồng ngữ nghĩa giữa đề tài mới và đề tài cũ (Vector Embedding qua Groq API,
  lưu trữ bằng PostgreSQL + pgvector)
- Hiển thị Top đề tài tương đồng nhất kèm tỉ lệ %
- Cảnh báo theo ngưỡng:

  | Khoảng tương đồng | Mức cảnh báo |
  |---|---|
  | 0% – 50% | Bình thường |
  | 50% – 70% | Cần xem xét |
  | 70% – 85% | Tương đồng cao |
  | > 85% | Có khả năng trùng đề tài |

- Trưởng bộ môn phê duyệt / từ chối / yêu cầu sửa tên đề tài

**Thống kê & báo cáo**
- Thống kê số đề tài theo năm học, khóa, giảng viên, lĩnh vực, trạng thái
- Xuất danh sách đề tài ra Excel (openpyxl) / PDF (WeasyPrint)

**Phân quyền (RBAC) — 4 vai trò**
- Quản trị viên (`admin`)
- Trưởng bộ môn (`department_head`)
- Giảng viên (`teacher`)
- Sinh viên (`student`)

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | TypeScript + React + Vite + Tailwind CSS |
| Backend | Django + Django REST Framework (RESTful API) |
| Database | PostgreSQL + pgvector |
| AI | Groq API (Embeddings — model `nomic-embed-text-v1_5`) |
| Đóng gói / triển khai | Docker + Docker Compose |
| Auth | JWT (`djangorestframework-simplejwt`) |
| Export | openpyxl (Excel), WeasyPrint (PDF) |

## 3. Cấu trúc thư mục

```
veritopic/
├── backend/                     # Django + DRF
│   ├── config/                  # settings (base/dev/prod), urls, wsgi, asgi
│   ├── apps/
│   │   ├── accounts/            # User, Role, JWT auth
│   │   ├── academics/           # Khóa/năm học/học kỳ/bộ môn/lĩnh vực
│   │   ├── topics/              # Core domain: đề tài, similarity, workflow duyệt
│   │   ├── statistics/          # Thống kê, export Excel/PDF
│   │   └── common/              # permission dùng chung, pagination, route quản lý riêng
│   ├── requirements/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── .env.example
│
├── frontend/                    # React + TS + Vite
│   ├── src/
│   │   ├── app/                 # App.tsx, router.tsx, providers.tsx
│   │   ├── features/            # auth, topics, approval, statistics, academics
│   │   ├── shared/               # components/lib/utils dùng chung
│   │   └── types/
│   ├── Dockerfile
│   └── .env.example
│
├── docker-compose.yml           # Môi trường DEV (hot reload)
├── docker-compose.prod.yml      # Môi trường PRODUCTION (Gunicorn + Nginx)
└── .gitignore
```

### Route API (RESTful, prefix `/api/v1/`)

Route nghiệp vụ thông thường (mọi role đã đăng nhập tùy theo permission):
```
/api/v1/auth/login/                    POST  — đăng nhập, trả JWT (access + refresh)
/api/v1/auth/login/refresh/            POST  — làm mới access token
/api/v1/auth/register/                 POST  — đăng ký tài khoản
/api/v1/auth/me/                       GET/PATCH — hồ sơ bản thân

/api/v1/academics/cohorts/             CRUD  — khóa học
/api/v1/academics/academic-years/      CRUD  — năm học
/api/v1/academics/semesters/           CRUD  — học kỳ
/api/v1/academics/departments/         CRUD  — bộ môn
/api/v1/academics/fields/              CRUD  — lĩnh vực đề tài

/api/v1/topics/topics/                 CRUD  — đề tài (tạo mới tự động chạy kiểm tra tương đồng)
/api/v1/topics/topics/{id}/similarity-check/   GET  — Top đề tài tương đồng
/api/v1/topics/topics/{id}/history/            GET  — lịch sử thao tác đề tài
/api/v1/topics/topics/{id}/assign/             POST — giao đề tài cho sinh viên/nhóm
/api/v1/topics/assignments/            GET   — tra cứu lượt giao đề tài

/api/v1/statistics/overview/           GET   — số liệu thống kê
/api/v1/statistics/export/?export_format=excel|pdf    GET  — xuất báo cáo
```

**Route quản lý riêng** (tách biệt, chỉ Admin/Trưởng bộ môn — xem `apps/common/management_urls.py`):
```
/api/v1/management/users/              CRUD  — quản lý tài khoản (chỉ Admin)
/api/v1/management/topics/pending/     GET   — danh sách đề tài chờ duyệt
/api/v1/management/topics/{id}/approve/        POST — duyệt đề tài
/api/v1/management/topics/{id}/reject/         POST — từ chối đề tài
/api/v1/management/topics/{id}/request-rename/ POST — yêu cầu sửa tên đề tài
```

API docs (Swagger UI) tự sinh tại: `http://localhost:8000/api/docs/`

## 4. Hướng dẫn cài đặt

### 4.1. Yêu cầu

- Docker & Docker Compose đã cài sẵn
- Tài khoản Groq (miễn phí) để lấy API key: https://console.groq.com/keys

### 4.2. Các bước cài đặt

**Bước 1 — Clone dự án**
```bash
git clone <đường-dẫn-repo-của-bạn>
cd veritopic
```

**Bước 2 — Tạo file `.env` cho Backend**
```bash
cp backend/.env.example backend/.env
```
Mở `backend/.env` và điền các giá trị thật:
- `DJANGO_SECRET_KEY`: chuỗi ngẫu nhiên dài (có thể sinh bằng lệnh bên dưới)
- `POSTGRES_PASSWORD`: đặt mật khẩu riêng, không dùng giá trị mẫu
- `GROQ_API_KEY`: lấy tại https://console.groq.com/keys

Sinh `SECRET_KEY` ngẫu nhiên:
```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

**Bước 3 — Tạo file `.env` cho Frontend**
```bash
cp frontend/.env.example frontend/.env
```
Giữ nguyên `VITE_API_BASE_URL=http://localhost:8000/api/v1` nếu chạy local bằng Docker Compose ở bước dưới.

**Bước 4 — Khởi chạy toàn bộ hệ thống**
```bash
docker compose up --build
```
Lần đầu chạy sẽ tự động: build image, chờ Postgres sẵn sàng, cài extension `vector`, chạy migrate.

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1/
- Swagger docs: http://localhost:8000/api/docs/
- Django Admin: http://localhost:8000/admin/

**Bước 5 — Tạo tài khoản Admin đầu tiên**
```bash
docker compose exec backend python manage.py createsuperuser
```

### 4.3. Lệnh thường dùng khi phát triển

```bash
# Xem log riêng của backend
docker compose logs -f backend

# Tạo migration mới sau khi sửa models.py
docker compose exec backend python manage.py makemigrations

# Chạy migration
docker compose exec backend python manage.py migrate

# Vào shell Django
docker compose exec backend python manage.py shell

# Cài thêm package Python mới -> nhớ thêm vào requirements/base.txt (hoặc dev.txt) rồi build lại
docker compose up --build backend

# Cài thêm package npm mới ở Frontend
docker compose exec frontend npm install <tên-package>
```

## 5. Cách bảo mật thông tin khi đưa lên Git (đọc kỹ trước khi push)

Dự án này đã cấu hình sẵn để **không có thông tin nhạy cảm nào lọt vào Git**:

1. **`.env` bị chặn hoàn toàn** bởi `.gitignore` (gốc dự án) — chỉ có `.env.example` (không chứa giá trị
   thật, chỉ có tên biến) mới được commit.
2. Toàn bộ mật khẩu DB, `SECRET_KEY`, `GROQ_API_KEY` chỉ được đọc qua biến môi trường trong
   `config/settings/base.py` (dùng `django-environ`) — **không có giá trị thật nào hard-code trong code**.
3. `docker-compose.yml` chỉ tham chiếu `env_file: ./backend/.env` — bản thân file compose không chứa
   giá trị nhạy cảm nào, an toàn để commit.

**Trước khi `git push` lần đầu, kiểm tra lại:**
```bash
git status
```
Đảm bảo **không thấy** `backend/.env` hay `frontend/.env` xuất hiện trong danh sách file sẽ commit.
Nếu thấy — nghĩa là `.gitignore` chưa được áp dụng đúng (thường do `.env` đã được add trước khi có
`.gitignore`), chạy:
```bash
git rm --cached backend/.env frontend/.env
```

**Nếu lỡ đã commit và push `.env` lên Git rồi:**
- Xóa file khỏi commit mới nhất là *không đủ* — lịch sử commit cũ vẫn còn lưu giá trị thật.
- Phải **đổi lại (rotate) toàn bộ key/mật khẩu đã lộ**: đổi `GROQ_API_KEY` mới trên console Groq, đổi
  `POSTGRES_PASSWORD`, sinh lại `DJANGO_SECRET_KEY` mới.
- Nếu cần xóa hẳn khỏi lịch sử Git, dùng `git filter-repo` hoặc BFG Repo-Cleaner — nhưng ưu tiên rotate
  key trước, đó là bước quan trọng nhất.

## 6. Những điều cần lưu ý khi code (đọc trước khi bắt đầu)

1. **Không viết logic nghiệp vụ trong `views.py`.** Toàn bộ logic tính similarity, logic duyệt/từ chối
   đề tài đã được tách vào `apps/topics/services/`. Khi thêm chức năng mới, viết vào `services/`, view
   chỉ gọi service rồi trả response — giữ view mỏng, dễ test.
2. **`GROQ_API_KEY` bắt buộc phải có** trong `backend/.env` thì chức năng tạo đề tài mới (tự động chạy
   kiểm tra tương đồng) mới hoạt động. Nếu chưa có key, `apps/topics/services/similarity.py` sẽ raise lỗi
   rõ ràng thay vì lỗi khó hiểu.
3. **Groq free tier có giới hạn rate limit.** Nếu viết script test tạo hàng loạt đề tài (seed data), nên
   thêm `time.sleep()` giữa các lần gọi hoặc cache lại embedding đã tính, tránh bị chặn request giữa lúc
   demo.
4. **Mỗi khi sửa `models.py`** trong bất kỳ app nào, phải chạy `makemigrations` rồi `migrate` (xem mục
   4.3), nếu không DB sẽ không khớp với code.
5. **Ngưỡng cảnh báo tương đồng (`SIMILARITY_THRESHOLD_*`) đọc từ `.env`**, không hard-code trong code —
   muốn đổi ngưỡng chỉ cần sửa `.env` rồi restart backend, không cần sửa `similarity.py`.
6. **Route quản lý riêng** (`/api/v1/management/...`) tách hẳn khỏi route nghiệp vụ thông thường — khi
   thêm chức năng chỉ dành cho Admin/Trưởng bộ môn (ví dụ: khóa tài khoản, xem log hệ thống), thêm vào
   `apps/common/management_urls.py` và app tương ứng, không gộp chung với route CRUD bình thường để dễ
   quản lý permission.
7. **Frontend gọi API quản lý riêng** qua `features/approval/api.ts` và `features/academics/api.ts` —
   các route này được chặn thêm ở Frontend bằng `RoleGuard` (`shared/components/RoleGuard.tsx`) để ẩn UI,
   nhưng **bảo mật thật sự nằm ở Backend** (`IsAdminOrDepartmentHead`, `IsAdmin` trong
   `apps/common/permissions.py`) — không được xóa permission ở Backend dù đã chặn UI ở Frontend.
8. **pgvector**: dùng image `pgvector/pgvector:pg16` thay vì `postgres:16` thường (đã cấu hình sẵn trong
   `docker-compose.yml`). Nếu đổi sang model embedding khác của Groq (số chiều vector khác 768), phải sửa
   `EMBEDDING_DIM` trong `apps/topics/models.py` rồi tạo lại migration.
9. **WeasyPrint (xuất PDF)** cần system dependencies đã cài sẵn trong `backend/Dockerfile`. Nếu chạy
   Backend ngoài Docker (không khuyến khích), phải tự cài `libpango`, `libcairo`, `libgdk-pixbuf` theo hệ
   điều hành đang dùng.
10. **Trước khi commit**, luôn chạy `git status` kiểm tra không có file `.env`, `node_modules/`,
    `__pycache__/`, `staticfiles/` bị lọt vào — xem mục 5.

## 7. TODO gợi ý (phần mở rộng, chưa triển khai đầy đủ trong khung này)

- Biểu đồ trực quan cho trang Thống kê (gợi ý dùng `recharts`, dữ liệu đã có sẵn ở `/statistics/overview/`)
- CRUD UI đầy đủ cho trang Danh mục hệ thống (`features/academics/pages/AcademicsPage.tsx` hiện mới có khung)
- Trang đăng ký tài khoản (`RegisterView` đã có ở Backend, Frontend chưa có UI)
- Thông báo (notification) khi đề tài được duyệt/từ chối/yêu cầu sửa tên

## 8. Lịch sử cập nhật — Chức năng gửi mã OTP qua email thật

#### ✅ Các bước để chạy được chức năng gửi OTP
**Bước 1 — Bật 2-Step Verification trên Gmail**

> ⚠️ Bước này **bắt buộc** — nếu chưa bật 2FA thì không tạo được App Password.

1. Truy cập [myaccount.google.com](https://myaccount.google.com)
2. Chọn **Security** (Bảo mật) ở thanh bên trái
3. Tìm mục **How you sign in to Google** → chọn **2-Step Verification**
4. Làm theo hướng dẫn để kích hoạt

---

**Bước 2 — Tạo Gmail App Password**

1. Vẫn trong trang **Security**, sau khi đã bật 2FA
2. Tìm mục **App Passwords** (Mật khẩu ứng dụng)  
   *(Nếu không thấy, tìm kiếm "App Passwords" trong thanh tìm kiếm của myaccount.google.com)*
3. Nhấn **Create** → đặt tên: `Veritopic` → nhấn **Create**
4. Google hiển thị mã **16 ký tự** dạng `xxxx xxxx xxxx xxxx`  
   → **Lưu ngay lập tức** — Google chỉ hiển thị một lần duy nhất

---

**Bước 3 — Điền thông tin vào `backend/.env`**

Mở file `backend/.env` và thêm / cập nhật các dòng sau:

```env
# ===== Gmail SMTP Configuration =====
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False

# Địa chỉ Gmail dùng để gửi OTP
EMAIL_HOST_USER=your_gmail@gmail.com

# App Password vừa tạo ở Bước 2 (bỏ dấu cách, chỉ 16 ký tự liên tiếp)
EMAIL_HOST_PASSWORD=xxxxxxxxxxxxxxxx

# Tên hiển thị trong hộp thư người nhận
DEFAULT_FROM_EMAIL=Veritopic <your_gmail@gmail.com>
```

**Bước 4 — Khởi động lại toàn bộ hệ thống**

```bash
docker compose down
docker compose up --build
```

> Lần đầu `--build` để Docker nạp lại các biến môi trường từ `.env` mới.

---

**Bước 5 — Kiểm tra chức năng**

1. Mở trình duyệt vào `http://localhost:5173`
2. Ở trang đăng nhập, nhấn **"Quên mật khẩu?"**
3. Nhập địa chỉ email đã đăng ký trong hệ thống
4. Kiểm tra hộp thư Gmail — sẽ nhận được email chứa mã OTP 6 chữ số
5. Nhập mã OTP + mật khẩu mới → nhấn xác nhận

---
#### 🔒 Lưu ý bảo mật

- Nếu lộ App Password hoặc nghi ngờ bị lộ, thu hồi ngay tại:  
  [myaccount.google.com → Security → App Passwords](https://myaccount.google.com/apppasswords) → xóa mã cũ → tạo mã mới → cập nhật lại `.env`.
- OTP có thời hạn sử dụng và chỉ dùng được **một lần** (được kiểm tra qua trường `is_used` trong model `OTPRecord`).


