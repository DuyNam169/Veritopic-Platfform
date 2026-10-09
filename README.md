# Veritopic — Hệ thống Quản lý Ngân hàng Đề tài Đồ án Sinh viên

Hệ thống Web hỗ trợ quản lý ngân hàng đề tài đồ án sinh viên qua nhiều khóa học, đồng thời tự động
**phát hiện đề tài trùng lặp/tương đồng** dựa trên AI, giúp Trưởng bộ môn kiểm duyệt đề tài mới nhanh
và chính xác hơn.

## 1. Mô tả chức năng

**Quản lý danh mục dữ liệu nền**
- Quản lý khóa / năm học / học kỳ
- Quản lý giảng viên, sinh viên
- Tra cứu sinh viên theo đề tài và giảng viên hướng dẫn; tra cứu giảng viên theo sinh viên/đề tài phụ trách
- Quản lý chuyên ngành / bộ môn
- Quản lý danh mục lĩnh vực đề tài (Web, Mobile, AI, Nhúng...)

**Quản lý vòng đời đề tài**
- Quản lý danh mục đề tài; giao đề tài cho sinh viên hoặc nhóm sinh viên
- Quản lý công nghệ, chức năng chính và tài liệu PDF/DOCX gắn với đề tài
- Lưu lịch sử đề tài của tất cả các khóa
- Tìm kiếm đề tài theo tên, từ khóa, giảng viên, sinh viên, khóa, năm học

**Phát hiện trùng lặp / tương đồng (chức năng lõi)**
- Kiểm tra trùng tên chính xác
- Trích xuất gợi ý tiêu đề từ tài liệu PDF/DOCX (PDF scan cần OCR hiện chưa được hỗ trợ)
- Tính mức độ tương đồng ngữ nghĩa giữa các tiêu đề đề tài bằng embedding PhoBERT service riêng,
  lưu trữ bằng PostgreSQL + pgvector
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

Hồ sơ giảng viên/sinh viên trong Veritopic dùng tài khoản `User` hiện có theo role. Trang **Giảng viên &
sinh viên** (`/people`) cho phép Admin/Trưởng bộ môn tra cứu phân công và thêm/sửa hồ sơ; hồ sơ tạo từ
trang này được lưu với mật khẩu không thể đăng nhập. Việc gán sinh viên/đề tài tiếp tục dùng
`TopicAssignment`; giảng viên hướng dẫn được lấy từ giảng viên đề xuất đề tài (`proposed_by`).

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | TypeScript + React + Vite + Tailwind CSS |
| Backend | Django + Django REST Framework (RESTful API) |
| Database | PostgreSQL + pgvector |
| AI | PhoBERT service riêng (embedding 768 chiều qua HTTP API) |
| Trích xuất tài liệu | pypdf (PDF) + thư viện chuẩn Python (DOCX) |
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
/api/v1/topics/technologies/          CRUD  — danh mục công nghệ (chỉ Admin được ghi)
/api/v1/topics/topic-technologies/    CRUD  — công nghệ của đề tài
/api/v1/topics/topic-functions/       CRUD  — chức năng chính của đề tài
/api/v1/topics/topic-documents/       CRUD  — tài liệu PDF/DOCX của đề tài
/api/v1/topics/topic-documents/{id}/download/ GET — tải tài liệu (cần đăng nhập)
/api/v1/topics/similarity/checks/check/       POST — so khớp tên đề tài với PhoBERT
/api/v1/topics/similarity/checks/extract-file/ POST — trích xuất tiêu đề từ PDF/DOCX

/api/v1/statistics/overview/           GET   — số liệu thống kê
/api/v1/statistics/export/?export_format=excel|pdf    GET  — xuất báo cáo
```

**Route quản lý riêng** (tách biệt, chỉ Admin/Trưởng bộ môn — xem `apps/common/management_urls.py`):
```
/api/v1/management/users/              CRUD  — quản lý tài khoản (chỉ Admin)
/api/v1/management/people/             GET/POST/PATCH hồ sơ — Admin/Trưởng bộ môn; hồ sơ tạo mới không có mật khẩu đăng nhập
/api/v1/management/topics/pending/     GET   — danh sách đề tài chờ duyệt
/api/v1/management/topics/{id}/approve/        POST — duyệt đề tài
/api/v1/management/topics/{id}/reject/         POST — từ chối đề tài
/api/v1/management/topics/{id}/request-rename/ POST — yêu cầu sửa tên đề tài
```

Quản lý công nghệ trên giao diện tại `/technologies` (Admin); trang `/topics/similarity` cho
Admin/Trưởng bộ môn/Giảng viên kiểm tra tiêu đề hoặc trích xuất tiêu đề từ tệp. Trong trang chi tiết
đề tài, Admin và giảng viên đề xuất có thể quản lý công nghệ, chức năng và tài liệu; các vai trò đã
đăng nhập khác chỉ xem/tải tài liệu.

API docs (Swagger UI) tự sinh tại: `http://localhost:8000/api/docs/`

## 4. Hướng dẫn cài đặt

### 4.1. Yêu cầu

- Docker & Docker Compose đã cài sẵn
- Checkpoint PhoBERT `AI_KiemTraTrung_TruongBoMon/models/tier1_best.pt` có sẵn. Checkpoint bị loại khỏi Git vì dung lượng; cần đặt/copy file đã huấn luyện vào đúng đường dẫn trên trước khi khởi chạy.
- Máy cần Internet lần đầu chạy để tải model gốc `vinai/phobert-base-v2` vào Docker volume cache. Compose dùng CPU cho dịch vụ AI; lần tải model đầu tiên có thể mất vài phút.

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
- `PHOBERT_API_URL`: địa chỉ AI service. Khi chạy bằng Compose, `backend` tự kết nối tới service `ai` ở `http://ai:8001`; khi chạy Django trực tiếp trên máy host, đặt thành `http://127.0.0.1:8001`.
- `PHOBERT_API_TIMEOUT`: timeout gọi model (mặc định 60 giây để tính đến lần khởi động model đầu tiên).

Frontend, backend, PostgreSQL và PhoBERT đều chạy trong Compose. PhoBERT được mở ở
`http://localhost:8001` để kiểm tra trực tiếp; backend gọi nó qua tên service nội bộ `ai`.
Model Hugging Face được cache trong volume `huggingface_cache`; checkpoint riêng được mount chỉ đọc,
không đóng gói vào image.

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
Lần đầu chạy sẽ build cả bốn dịch vụ, tải PhoBERT về cache, chờ PostgreSQL sẵn sàng và tự chạy migrate.
Nếu cần chạy nền, dùng `docker compose up --build -d`; xem trạng thái bằng `docker compose ps` và log bằng
`docker compose logs -f ai backend frontend`.

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

# Tính lại toàn bộ vector PhoBERT (cần AI service đang chạy)
docker compose exec backend python manage.py rebuild_phobert_embeddings --batch-size 32

# Cài thêm package Python mới -> nhớ thêm vào requirements/base.txt (hoặc dev.txt) rồi build lại
docker compose up --build backend

# Cài thêm package npm mới ở Frontend
docker compose exec frontend npm install <tên-package>
```

## 5. Cách bảo mật thông tin khi đưa lên Git (đọc kỹ trước khi push)

Dự án này đã cấu hình sẵn để **không có thông tin nhạy cảm nào lọt vào Git**:

1. **`.env` bị chặn hoàn toàn** bởi `.gitignore` (gốc dự án) — chỉ có `.env.example` (không chứa giá trị
   thật, chỉ có tên biến) mới được commit.
2. Toàn bộ mật khẩu DB và `SECRET_KEY` chỉ được đọc qua biến môi trường trong
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
- Phải **đổi lại (rotate) toàn bộ key/mật khẩu đã lộ**: đổi `POSTGRES_PASSWORD`, sinh lại
  `DJANGO_SECRET_KEY` mới và kiểm tra lại các thông tin xác thực dịch vụ bên ngoài.
- Nếu cần xóa hẳn khỏi lịch sử Git, dùng `git filter-repo` hoặc BFG Repo-Cleaner — nhưng ưu tiên rotate
  key trước, đó là bước quan trọng nhất.

## 6. Những điều cần lưu ý khi code (đọc trước khi bắt đầu)

1. **Không viết logic nghiệp vụ trong `views.py`.** Toàn bộ logic tính similarity, logic duyệt/từ chối
   đề tài đã được tách vào `apps/topics/services/`. Khi thêm chức năng mới, viết vào `services/`, view
   chỉ gọi service rồi trả response — giữ view mỏng, dễ test.
2. **PhoBERT service phải hoạt động** thì chức năng tạo đề tài mới và kiểm tra tương đồng mới tính được
   embedding. Nếu service chưa chạy hoặc trả dữ liệu không hợp lệ, API trả lỗi 503 thay vì tạo vector giả.
3. Khi chạy Django trong Docker, bảo đảm `PHOBERT_API_URL` trỏ tới máy chứa PhoBERT API và AI server
   bind vào `0.0.0.0:8001`. Không đưa checkpoint hoặc dependency PyTorch/Transformers vào backend.
4. Khi chuyển database đang có vector cũ/mock, chạy `python manage.py rebuild_phobert_embeddings` một
   lần sau khi khởi động PhoBERT để lập chỉ mục lại embedding tiêu đề của các đề tài hiện có.
5. **Mỗi khi sửa `models.py`** trong bất kỳ app nào, phải chạy `makemigrations` rồi `migrate` (xem mục
   4.3), nếu không DB sẽ không khớp với code. Schema công nghệ/chức năng/tài liệu được thêm ở migration
   `topics.0006_topic_resources`.
6. **Ngưỡng cảnh báo tương đồng (`SIMILARITY_THRESHOLD_*`) đọc từ `.env`**, không hard-code trong code —
   muốn đổi ngưỡng chỉ cần sửa `.env` rồi restart backend, không cần sửa `similarity.py`.
7. **Route quản lý riêng** (`/api/v1/management/...`) tách hẳn khỏi route nghiệp vụ thông thường — khi
   thêm chức năng chỉ dành cho Admin/Trưởng bộ môn (ví dụ: khóa tài khoản, xem log hệ thống), thêm vào
   `apps/common/management_urls.py` và app tương ứng, không gộp chung với route CRUD bình thường để dễ
   quản lý permission.
8. **Frontend gọi API quản lý riêng** qua `features/approval/api.ts` và `features/academics/api.ts` —
   các route này được chặn thêm ở Frontend bằng `RoleGuard` (`shared/components/RoleGuard.tsx`) để ẩn UI,
   nhưng **bảo mật thật sự nằm ở Backend** (`IsAdminOrDepartmentHead`, `IsAdmin` trong
   `apps/common/permissions.py`) — không được xóa permission ở Backend dù đã chặn UI ở Frontend.
9. **pgvector**: dùng image `pgvector/pgvector:pg16` thay vì `postgres:16` thường (đã cấu hình sẵn trong
   `docker-compose.yml`). Nếu đổi sang model embedding khác (số chiều vector khác 768), phải sửa
   `EMBEDDING_DIM` trong `apps/topics/models.py` rồi tạo lại migration.
10. **WeasyPrint (xuất PDF)** cần system dependencies đã cài sẵn trong `backend/Dockerfile`. Nếu chạy
   Backend ngoài Docker (không khuyến khích), phải tự cài `libpango`, `libcairo`, `libgdk-pixbuf` theo hệ
   điều hành đang dùng.
11. **Trước khi commit**, luôn chạy `git status` kiểm tra không có file `.env`, `node_modules/`,
    `__pycache__/`, `staticfiles/` bị lọt vào — xem mục 5.

## 7. TODO gợi ý (phần mở rộng)

- Biểu đồ trực quan cho trang Thống kê (gợi ý dùng `recharts`, dữ liệu đã có sẵn ở `/statistics/overview/`)
- CRUD UI đầy đủ cho trang Danh mục hệ thống (`features/academics/pages/AcademicsPage.tsx` hiện mới có khung)
- Trang đăng ký tài khoản (`RegisterView` đã có ở Backend, Frontend chưa có UI)
- Thông báo (notification) khi đề tài được duyệt/từ chối/yêu cầu sửa tên
