# HIU Youth E-Office

Văn phòng Đoàn – Hội điện tử cho Trường Đại học Quốc tế Hồng Bàng (HIU). Đây là Final Project môn *Phát triển, vận hành, bảo trì phần mềm*. Baseline của môn là tag `course-baseline` trên `main`, gồm 8 use case:

| UC | Chức năng | Trang chính |
|---|---|---|
| UC1 | Danh mục học vụ (Khoa/Ngành/Lớp/Khóa) và cơ cấu tổ chức Đoàn – Hội | `/organization` |
| UC2 | Tài khoản MSSV + PIN, hồ sơ sinh viên, hồ sơ Đoàn viên và xét duyệt | `/register`, `/login`, `/onboarding/profile`, `/union-membership`, `/office/membership` |
| UC3 | Thư viện mẫu biểu mẫu (Đoàn Trường quản lý) | `/forms/templates` |
| UC4 | Vòng đời biểu mẫu động: tạo, phát hành, đóng, lưu trữ | `/forms/new`, `/forms/{id}/edit` |
| UC5 | Thu nhận phản hồi, xem và xuất CSV | `/forms/{id}`, `/forms/{id}/responses` |
| UC6 | Kế hoạch chương trình sự kiện; chỉ Văn phòng Đoàn – Hội duyệt | `/programs`, `/programs/new`, `/programs/{id}` |
| UC7 | Đăng ký tham gia chương trình | `/programs/{id}`, `/programs/{id}/registrations` |
| UC8 | Điểm danh QR theo lượt, điểm rèn luyện dự kiến đề nghị | `/programs/{id}/attendance`, `/attend/{sessionId}?t=…` |

Tài liệu nghiệp vụ nằm ở [`docs/requirements/`](docs/requirements/). Báo cáo bài thực hành nằm ở [`docs/TH1/`](docs/TH1/).

## Công nghệ

| Thành phần | Phiên bản (theo `package-lock.json` / `supabase/config.toml`) |
|---|---|
| Node.js / npm | 24 / 12 (CI dùng Node 24) |
| Next.js (App Router, `src/proxy.ts`) | 16.3.6 |
| React / React DOM | 19.2.8 |
| TypeScript | 5.9.3 |
| Tailwind CSS | 4.3.3 |
| Supabase JS / `@supabase/ssr` | 2.117.2 / 0.12.7 |
| PostgreSQL (Supabase local) | 17 |
| Zod / React Hook Form | 4.6.5 / 7.89.0 |
| `qrcode` (QR SVG phía server) | 1.5.4 |
| Vitest / jsdom / Testing Library React | 5.0.2 / 30.1.1 / 16.3.3 |
| pgTAP (`supabase test db`) | đi kèm Supabase CLI |
| ESLint | 9.39.5 |
| Supabase CLI / Docker | ≥ 2.117 / Docker Desktop đang chạy |

Phần lớn nghiệp vụ nằm trong các hàm PostgreSQL (RPC) và chính sách RLS ở `supabase/migrations/`. Phía Next.js chủ yếu kiểm tra dữ liệu vào bằng Zod, gọi RPC và hiển thị.

## Chạy local

Yêu cầu: Node.js 24, npm 12, Docker đang chạy và Supabase CLI.

```bash
npm ci
supabase start                 # dựng Postgres/Auth/Storage/Mailpit, áp toàn bộ supabase/migrations
cp .env.example .env.local     # rồi điền key từ: supabase status -o env
npm run dev                    # http://localhost:3000
```

`supabase db reset` xóa toàn bộ dữ liệu local. Chỉ dùng khi bạn chủ động muốn dựng lại DB từ đầu.

Mailpit (http://127.0.0.1:54324) nhận email xác thực và khôi phục PIN khi chạy local.

## Build và kiểm thử

```bash
npm ci                # cài dependency đúng theo package-lock.json
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm test              # Vitest (tests/)
npm run test:ci       # Vitest + JUnit (test-results/junit.xml) + coverage (coverage/)
supabase test db      # pgTAP (supabase/tests/), cần Postgres local: supabase start hoặc supabase db start
npm run build         # next build (bản production vào .next/)
npm start             # chạy bản build
```

CI (`.github/workflows/ci.yml`) chạy trên `ubuntu-latest` khi có pull request vào `main` và khi push lên `main`, gồm hai job:

| Job | Các bước | Artifact (giữ 7 ngày) |
|---|---|---|
| `build-test` | Node 24, `npm ci` → lint → typecheck → `npm run test:ci` → build | `vitest-results`: JUnit, coverage |
| `pgtap` | Supabase CLI 2.117.0, `supabase db start` (Postgres + migrations + seed) → `supabase test db` | `pgtap-results`: log TAP |

Hai job chạy độc lập; PR chỉ được merge khi cả hai xanh.

## Biến môi trường

Sao chép từ [`.env.example`](.env.example) sang `.env.local`. Không commit `.env.local`.

| Biến | Phạm vi | Ý nghĩa |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | trình duyệt + server | URL API Supabase (local: `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | trình duyệt + server | Publishable/anon key; quyền thật do RLS quyết định |
| `SUPABASE_SERVICE_ROLE_KEY` | chỉ server | Service-role key; không bao giờ thêm tiền tố `NEXT_PUBLIC_` |
| `AUTH_RATE_LIMIT_PEPPER` | chỉ server | Chuỗi ngẫu nhiên dài để băm định danh khi giới hạn tần suất đăng nhập/khôi phục |
| `NEXT_PUBLIC_APP_URL` | trình duyệt + server | Origin của app, dùng trong link xác thực/khôi phục |

## Tài khoản và email sinh viên

- Đăng nhập bằng **MSSV (10 chữ số) + PIN (đúng 6 chữ số)**.
- Email xác thực **bắt buộc là email sinh viên `@student.hiu.vn`**. Phần trước `@` phải kết thúc bằng 3 chữ số đầu và 4 chữ số cuối của MSSV. Ví dụ: MSSV `2026990102` đi với `…2020102@student.hiu.vn`.
  - Ứng dụng kiểm tra quy tắc này trong `src/modules/auth-account/schemas.ts`.
  - DB kiểm tra lại trong migration `202610130002_student_email_domain.sql`.
  - Tên cột và tham số còn là `gmail` vì lý do lịch sử, nhưng không còn nhận Gmail.
- Luồng tạo tài khoản:
  1. `/register`: nhập MSSV và email sinh viên.
  2. Mở email xác thực.
  3. `/signup/create-pin`: tạo PIN.
  4. `/onboarding/profile`: điền hồ sơ.
- Quên PIN: yêu cầu tại `/auth/recover` (theo MSSV), mở email rồi đặt PIN mới tại `/account/recover-pin`. Đổi PIN và đổi email tại `/account/security`.

### Bootstrap Đoàn Trường (một lần)

1. Đăng ký một tài khoản như trên.
2. Lấy UUID của tài khoản đó: Supabase Studio → Authentication → Users.
3. Chạy lệnh:

```bash
npm run admin:bootstrap -- --user-id <UUID> --confirm
```

Hàm sẽ từ chối nếu đã có school admin đang hoạt động. Sau bước này, Đoàn Trường phân quyền tại `/organization`.

### Import danh mục học vụ

CSV phải có đúng header và thứ tự `Khoa chủ quản,Tên lớp học,Khóa học,Bậc đào tạo,Loại đào tạo,Ngành`. Mặc định importer chặn mọi URL Supabase không phải local. Luôn chạy thử (dry-run) trước:

```bash
eval "$(supabase status -o env 2>/dev/null)"
NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  npm run catalog:import -- "data/DSN LOPWS - Sheet1 (1).csv"            # dry-run
NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  npm run catalog:import -- "data/DSN LOPWS - Sheet1 (1).csv" --apply
```

## Cấu trúc thư mục

```
src/
  app/            Trang và route handler (App Router); src/app/api/** là API JSON
  components/     Component React dùng chung (form, console, QR…)
  modules/        Schema Zod và mã lỗi theo nghiệp vụ (auth-account, event-programs,
                  program-registrations, program-attendance, forms, …)
  lib/            Supabase client (server/browser), env, HTTP helper, rate limit
  proxy.ts        Kiểm tra phiên đăng nhập và chặn trang cần đăng nhập
supabase/
  migrations/     Schema, RLS, RPC theo thứ tự version (nguồn sự thật của nghiệp vụ)
  tests/          pgTAP
  templates/      Mẫu email Auth
  config.toml     Cấu hình stack local
tests/            Vitest (schema, component, importer)
scripts/          Import danh mục, bootstrap admin, script kiểm thử đồng thời
docs/             requirements/, operations/, testing/, reports/, TH1/
data/             CSV danh mục học vụ chính thức
.github/workflows CI
```

## Triển khai cloud

Chưa triển khai. Việc dùng Supabase cloud hoặc Vercel cần được phê duyệt riêng. Xem [`docs/operations/`](docs/operations/) (backup/restore, môi trường local, release checklist).
