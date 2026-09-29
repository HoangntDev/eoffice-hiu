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

## Kiểm tra

```bash
npm run lint
npm run typecheck
npm test
supabase test db
npm run build
```

## Import danh mục

CSV phải đúng header `STT,Khoa,Ngành,Lớp,Khóa,Số hiệu,Thứ tự khoa`. Dry-run mặc định:

```bash
npm run catalog:import -- /absolute/path/KHOA_NGANH_KHOA_CHI_DOAN.csv
npm run catalog:import -- /absolute/path/KHOA_NGANH_KHOA_CHI_DOAN.csv --apply
```

Không dùng sheet XLSX ngoài `KHOA_NGANH_KHOA_CHI_DOAN`; repo chưa có bộ chuyển XLSX. Không đưa workbook chứa hồ sơ cá nhân vào repo.

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
- Bật Confirm email và double confirmation khi đổi email; giữ mật khẩu tối thiểu 6 ký tự cho đến khi có quyết định khác.
- Cấu hình SMTP Resend thật, sender domain đã verify, template confirmation/recovery về `/auth/confirm`.
- Vercel khai báo bốn biến trong `.env.example`; không đưa service-role key ra client.
- Smoke test đăng ký → email → profile và restore drill trước khi gắn release.

## Vận hành

- [Backup/restore](docs/operations/backup-restore.md)
- [Test evidence](docs/testing/test-report.md)
- Không tự tạo INC-01/CR-01; chỉ ghi sau sự kiện và phê duyệt thật.
