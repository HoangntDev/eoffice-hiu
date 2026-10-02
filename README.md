# HIU Youth E-Office

Đồ án cá nhân môn Software Development, Operations and Maintenance. Nhánh này triển khai nền tảng và hai use case Prompt 01; chưa phải đồ án hoàn chỉnh hay release v1.0/v1.1. Xem [phạm vi, kiến trúc và ERD](docs/requirements/mvp-scope.md).

## Yêu cầu và chạy local

Node.js 24, npm 12, Docker và Supabase CLI. Vercel CLI chưa có trong môi trường hiện tại; cài `npm i -g vercel` để dùng `vercel env pull`, deploy và logs.

```bash
npm ci
supabase start
supabase db reset
cp .env.example .env.local
npm run dev
```

Điền `.env.local` từ Supabase local/cloud và không commit. `SUPABASE_SERVICE_ROLE_KEY`/`AUTH_RATE_LIMIT_PEPPER` chỉ dùng server. Local Auth bật email confirmation; xem email thử bằng Mailpit của `supabase start`.

Luồng tài khoản local:

1. `/register`: nhập MSSV 10 số + Gmail, rồi mở email “Xác thực Gmail” trong Mailpit.
2. `/signup/create-pin`: tạo và xác nhận PIN đúng 6 chữ số; sau đó hoàn tất profile cơ bản.
3. `/login`: chỉ dùng MSSV + PIN. `/auth/recover` dùng MSSV để gửi email khôi phục PIN, không biến Gmail thành tên đăng nhập.
4. `/account/security`: người đã đăng nhập có thể đổi PIN (phải nhập PIN hiện tại) hoặc yêu cầu xác minh Gmail mới.

## Kiểm tra

```bash
npm run lint
npm run typecheck
npm test
supabase test db
npm run build
```

## Import danh mục

CSV phải đúng header và thứ tự `Khoa chủ quản,Tên lớp học,Khóa học,Bậc đào tạo,Loại đào tạo,Ngành`. Importer giữ nguyên mã Lớp, không suy đoán giá trị trống và mặc định chặn URL Supabase không phải local. Nạp biến local mà không in khóa, rồi chạy dry-run trước:

```bash
eval "$(supabase status -o env 2>/dev/null)"
NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  npm run catalog:import -- "data/DSN LOPWS - Sheet1 (1).csv"
NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  npm run catalog:import -- "data/DSN LOPWS - Sheet1 (1).csv" --apply
```

Chạy lại lệnh `--apply` phải trả về `alreadyApplied: true` và số thêm/cập nhật bằng 0. Cờ `--allow-remote` chỉ dùng khi có phê duyệt riêng, backup và dry-run đã được kiểm tra. Không đưa workbook chứa hồ sơ cá nhân vào repo.

## Bootstrap Đoàn Trường

1. Đăng ký tài khoản cá nhân và xác minh Gmail.
2. Lấy UUID tại Supabase Studio → Authentication → Users.
3. Chạy đúng một lần:

```bash
npm run admin:bootstrap -- --user-id <UUID> --confirm
```

Sau đó Đoàn Trường quản lý quyền tại `/organization`. Hàm từ chối nếu đã có school admin hoạt động.

## Cloud/Vercel — chỉ khi được ủy quyền

```bash
npm i -g vercel
vercel link
vercel env pull .env.local --yes
supabase link --project-ref <PROJECT_REF>
supabase db push --linked --dry-run
# xem kỹ, backup rồi mới chạy: supabase db push --linked
```

Dashboard checklist:

- Supabase Auth Site URL `https://doanhoihiu.io.vn`; thêm `https://doanhoihiu.io.vn/auth/confirm` và preview URL cần thiết.
- Bật Confirm email và double confirmation khi đổi email. Supabase Auth lưu PIN trong trường credential nội bộ; ứng dụng chỉ nhận PIN đúng 6 chữ số và không lưu PIN trong bảng nghiệp vụ/log.
- Cấu hình SMTP Resend thật, sender domain đã verify, template confirmation/recovery về `/auth/confirm`.
- Vercel khai báo bốn biến trong `.env.example`; không đưa service-role key ra client.
- Smoke test đăng ký → email → profile và restore drill trước khi gắn release.

## Vận hành

- [Backup/restore](docs/operations/backup-restore.md)
- [Test evidence](docs/testing/test-report.md)
- Không tự tạo INC-01/CR-01; chỉ ghi sau sự kiện và phê duyệt thật.
