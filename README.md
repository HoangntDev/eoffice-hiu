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
| UC9 | Đoàn phí theo tháng, đóng gộp năm qua cổng sandbox và đối chiếu theo lớp | `/payments`, `/admin/payments` |

Bốn use case chính của bản phát hành v1.0.0 (dùng thống nhất trong test case và CHANGELOG): **UC-A** Hồ sơ Đoàn viên (thuộc UC2), **UC-B** Kế hoạch chương trình (UC6), **UC-C** Đăng ký tham gia (UC7), **UC-D** Điểm danh QR và điểm dự kiến đề nghị (UC8). Các UC còn lại là phần nền.

Tài liệu nghiệp vụ nằm ở [`docs/requirements/`](docs/requirements/). Báo cáo bài thực hành nằm trong `docs/TH1/` đến `docs/TH4/`. Lịch sử phiên bản: [`CHANGELOG.md`](CHANGELOG.md).

## Công nghệ

| Thành phần | Phiên bản (theo `package-lock.json` / `supabase/config.toml`) |
|---|---|
| Node.js / npm | 24 / 12 (CI dùng Node 24) |
| Next.js (App Router, `src/proxy.ts`) | 16.4.5 |
| React / React DOM | 19.2.8 |
| TypeScript | 5.9.3 |
| Tailwind CSS | 4.3.3 |
| Supabase JS / `@supabase/ssr` | 2.117.2 / 0.12.7 |
| PostgreSQL (Supabase local) | 17 |
| Zod / React Hook Form | 4.6.7 / 7.89.0 |
| `qrcode` (QR SVG phía server) | 1.5.4 |
| Vitest / jsdom / Testing Library React | 5.0.2 / 30.1.1 / 16.3.3 |
| pgTAP (`supabase test db`) | đi kèm Supabase CLI |
| ESLint | 9.39.5 |
| Supabase CLI / Docker | ≥ 2.117 / Docker Desktop đang chạy |

Phần lớn nghiệp vụ nằm trong các hàm PostgreSQL (RPC) và chính sách RLS ở `supabase/migrations/`. Phía Next.js chủ yếu kiểm tra dữ liệu vào bằng Zod, gọi RPC và hiển thị.

## Cài đặt và chạy từ môi trường mới

Cần cài trước:

| Công cụ | Phiên bản | Kiểm tra |
|---|---|---|
| Git | bất kỳ | `git --version` |
| Node.js / npm | 24 / 12 | `node -v`, `npm -v` |
| Docker Desktop (đang chạy) | bản hiện hành | `docker info` |
| Supabase CLI | ≥ 2.117 | `supabase --version` |

Các bước (macOS/Linux; trên Windows dùng Git Bash hoặc WSL):

```bash
# 1. Lấy mã nguồn đúng phiên bản phát hành
git clone https://github.com/HoangntDev/eoffice-hiu.git && cd eoffice-hiu
git switch --detach v1.2.0            # bỏ bước này nếu muốn chạy bản mới nhất trên main

# 2. Cài dependency đúng theo package-lock.json
npm ci

# 3. Dựng Supabase local: Postgres, Auth, Storage, Mailpit; áp toàn bộ supabase/migrations
supabase start

# 4. Tạo file cấu hình từ file mẫu rồi điền giá trị (xem mục "Biến môi trường")
cp .env.example .env.local
supabase status -o env                # API_URL, PUBLISHABLE_KEY, SERVICE_ROLE_KEY

# 5a. Chạy chế độ phát triển
npm run dev                           # http://localhost:3000

# 5b. Hoặc build và chạy bản production
npm run build && npm start            # http://localhost:3000 (đổi cổng: PORT=3100 npm start)
```

Sau khi app chạy:

1. Tạo tài khoản đầu tiên tại `/register`. Mở email xác thực trong Mailpit (http://127.0.0.1:54324), rồi tạo PIN.
2. Tạo tài khoản tổ chức Đoàn Trường đầu tiên (mục "Bootstrap Đoàn Trường" bên dưới).
3. Import danh mục học vụ (mục "Import danh mục học vụ").
4. Hoặc, để có ngay dữ liệu mẫu, dựng một stack demo riêng theo [`docs/TH2/demo-data.md`](docs/TH2/demo-data.md).

Kiểm tra nhanh sau khi cài: [`docs/testing/smoke-test.md`](docs/testing/smoke-test.md). Cài từ gói phát hành (artifact) của GitHub Release, không cần build: [`docs/release/huong-dan-trien-khai.md`](docs/release/huong-dan-trien-khai.md).

Nếu máy đã có một stack Supabase khác chạy ở cổng 543xx, đổi `project_id` và các cổng trong `supabase/config.toml` như ở `docs/TH2/demo-data.md`, rồi sửa `NEXT_PUBLIC_SUPABASE_URL` cho khớp.

`supabase db reset` xóa toàn bộ dữ liệu local. Chỉ dùng khi bạn chủ động muốn dựng lại DB từ đầu.

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
| `LOG_LEVEL` | chỉ server | Mức log JSON: `debug`, `info`, `warn`, `error`. Để trống thì theo môi trường: dev → `debug`, production → `info`, test → `warn`. Log ghi ra console và file `logs/app-YYYY-MM-DD.log` (xoay theo ngày, giữ 7 file) |
| `DB_SLOW_MS` | chỉ server | Ngưỡng (ms) ghi log `db.slow` khi lời gọi database chậm. Trống thì 1000 |
| `PAYMENT_PROVIDER` | chỉ server | Cổng thanh toán: `vnpay` (mặc định) hoặc `paypal` |
| `VNP_TMN_CODE` | chỉ server | Mã website/merchant do VNPay sandbox cấp |
| `VNP_HASH_SECRET` | chỉ server | Khóa HMAC-SHA512 của VNPay sandbox; không ghi log hoặc đưa ra trình duyệt |
| `VNP_URL` | chỉ server | URL cổng thanh toán VNPay sandbox |
| `VNP_RETURN_URL` | chỉ server | URL đưa trình duyệt về `/payments/return`; trang này chỉ đọc trạng thái database |
| `PAYPAL_CLIENT_ID` | chỉ server | Client ID của ứng dụng PayPal sandbox |
| `PAYPAL_CLIENT_SECRET` | chỉ server | Client secret PayPal sandbox; không ghi log hoặc đưa ra trình duyệt |
| `PAYPAL_API_URL` | chỉ server | REST API base URL của PayPal sandbox |
| `PAYPAL_RETURN_URL` | chỉ server | URL server `/api/payments/paypal/return` thực hiện capture rồi chuyển sang trang kết quả |
| `PAYPAL_CANCEL_URL` | chỉ server | URL server `/api/payments/paypal/cancel` ghi nhận hủy và cho tạo đơn mới |
| `PAYPAL_VND_PER_USD` | chỉ server | Tỷ giá VND cho 1 USD được chốt cho đợt thử; database vẫn giữ số tiền nghiệp vụ bằng VND |
| `PORT` | chỉ server | Cổng của `npm start` / `next start` (mặc định 3000) |

Tạo file cấu hình từ file mẫu:

```bash
cp .env.example .env.local
supabase status -o env      # lấy API_URL, PUBLISHABLE_KEY (ANON_KEY), SERVICE_ROLE_KEY của stack local
openssl rand -hex 32        # giá trị cho AUTH_RATE_LIMIT_PEPPER
```

Mọi biến được đọc qua `src/lib/env.ts`. Thiếu biến bắt buộc thì server báo `MISSING_ENV:<tên>`. Mọi biến, kể cả `NEXT_PUBLIC_*`, được đọc **lúc chạy** ở server (app không có Supabase client phía trình duyệt). Vì vậy một bản build dùng được cho mọi môi trường: chỉ cần đổi `.env.local` rồi khởi động lại. Bảng kê cấu hình và dependency: [`docs/TH2/config-dependency.md`](docs/TH2/config-dependency.md).

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

Script hỏi PIN tổ chức mới hai lần bằng đầu vào ẩn, tạo đúng một tài khoản tổ chức
Đoàn Trường và thêm tài khoản sinh viên đã chọn làm thành viên. Script không ghi PIN
ra log và từ chối chạy lại khi tài khoản đã được khởi tạo.

Sau đó đăng nhập tại `/admin/login`: chọn Đoàn Trường, nhập PIN tổ chức, rồi nhập
MSSV + PIN cá nhân của thành viên. Đoàn Trường quản lý cơ cấu tại
`/admin/organization` và tài khoản tổ chức tại `/admin/accounts`.

### Công tắc tài khoản tổ chức

`ORG_ACCOUNTS_ENABLED` nằm trong bảng cấu hình database, không phải biến môi trường
Next.js. Chỉ phiên tổ chức Đoàn Trường có cán bộ mới đổi được công tắc tại
`/admin/accounts`; database ghi audit cho mỗi lần đổi.

- **TẮT (mặc định sau migration):** `/admin` và đăng nhập tổ chức không dùng được;
  các grant quản lý cá nhân tiếp tục hoạt động như v1.0.0.
- **BẬT:** chỉ phiên tổ chức có cán bộ còn hiệu lực được quản lý; bốn grant quản lý
  cá nhân (`school_admin`, `office`, `faculty_manager`, `faculty_executive`) vẫn được
  lưu nhưng bị RPC/RLS bỏ qua. `collaborator` và `committee_manager` vẫn là vai trò cá nhân.

Trình tự nâng cấp an toàn: sao lưu, áp migration, chạy test/smoke khi công tắc còn
TẮT, bootstrap Đoàn Trường nếu cần, đăng nhập Đoàn Trường và bật công tắc. Nếu cần
quay lui hành vi, tắt công tắc; không xóa grant hay chạy migration ngược.

### Thanh toán Đoàn phí qua cổng sandbox

`PAYMENT_ENABLED` nằm trong bảng `feature_flags` và mặc định **TẮT** sau migration.
Khi tắt, menu, trang và API khởi tạo thanh toán không hoạt động; các chức năng v1.1.0
vẫn giữ nguyên. Phiên tổ chức Đoàn Trường có cán bộ bật hoặc tắt công tắc tại
`/admin/accounts`; database ghi audit cho mỗi lần đổi. Chọn cổng bằng
`PAYMENT_PROVIDER=vnpay|paypal`; để trống dùng VNPay.

Luồng nghiệp vụ:

1. Đoàn Khoa tạo khoản thu cho một năm dương lịch tại `/admin/payments`; nếu
   `ORG_ACCOUNTS_ENABLED` tắt thì cán bộ dùng tài khoản cá nhân tại `/payments/manage`.
2. Mỗi Khoa chọn đúng một mức 2.000, 5.000, 10.000 hoặc 20.000 đồng/tháng. Database
   tính số tiền cả năm bằng mức × 12; sinh viên không nhập hoặc sửa số tiền.
3. Sinh viên mở `/payments` và chuyển sang cổng đã cấu hình. Với VNPay, chỉ
   `/api/payments/ipn` có HMAC-SHA512 hợp lệ mới ghi nhận. Với PayPal, server gọi
   Orders API v2 để capture khi trình duyệt quay về, rồi đối chiếu `COMPLETED`,
   `custom_id`, USD và số tiền đã tính trước khi dùng RPC chung ghi đủ tháng 1–12.
   Trang `/payments/return` chỉ đọc trạng thái database; callback lặp không ghi trùng.
4. Đoàn Khoa lọc danh sách theo lớp và xuất CSV để nhập lại hệ thống Trung ương.

#### Chạy PayPal sandbox

1. Tạo ứng dụng sandbox trong PayPal Developer Dashboard và đặt Client ID/secret
   chỉ trong `.env.local`. Đặt `PAYMENT_PROVIDER=paypal`, REST API base URL sandbox,
   tỷ giá thử và hai URL quay về ứng dụng local tương ứng
   `/api/payments/paypal/return` và `/api/payments/paypal/cancel`.
2. Khởi động lại ứng dụng, bật `PAYMENT_ENABLED`, tạo khoản thu rồi đăng nhập tài
   khoản Personal sandbox trên trang PayPal. Luồng return chạy capture server-to-server,
   nên kiểm thử local không cần mở tunnel.
3. Không ghi Client ID, secret, OAuth token, header `Authorization`, email sandbox
   hoặc dữ liệu thẻ vào Git, log hay ảnh bằng chứng.

Trang đăng ký VNPay sandbox `sandbox.vnpayment.vn/devreg/` được quan sát trả 404 từ
ngày 11/11/2026 đến 12/11/2026. `VnpayGateway` vẫn được giữ nguyên để dùng lại khi
có mã merchant. VNPay cần IPN URL công khai; chỉ mở tunnel tạm sau khi được người
phụ trách môi trường cho phép và không ghi URL có thông tin truy cập vào Git/log.

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
  lib/            Supabase client phía server, env (cấu hình), log, HTTP helper, rate limit
  proxy.ts        Kiểm tra phiên đăng nhập và chặn trang cần đăng nhập
supabase/
  migrations/     Schema, RLS, RPC theo thứ tự version (nguồn sự thật của nghiệp vụ)
  tests/          pgTAP
  templates/      Mẫu email Auth
  config.toml     Cấu hình stack local
tests/            Vitest (schema, component, importer)
scripts/          Import danh mục, bootstrap admin, script kiểm thử đồng thời
docs/             requirements/, operations/, testing/, release/, reports/, TH1/, TH2/
data/             CSV danh mục học vụ chính thức
.github/workflows CI
```

## Triển khai cloud

Chưa triển khai. Việc dùng Supabase cloud hoặc Vercel cần được phê duyệt riêng. Xem [`docs/operations/`](docs/operations/) (môi trường local, release checklist) và runbook sao lưu/phục hồi [`docs/runbooks/backup-restore.md`](docs/runbooks/backup-restore.md).
