# Hướng dẫn triển khai gói phát hành

Áp dụng cho gói `hiu-youth-e-office-v<phiên bản>.zip`, đính kèm ở trang GitHub Release (ví dụ <https://github.com/HoangntDev/eoffice-hiu/releases/tag/v1.0.0>).

## 1. Gói gồm những gì

| Thành phần | Mô tả |
|---|---|
| Mã nguồn tại tag | Lấy bằng `git archive` từ đúng commit được gắn tag: `src/`, `supabase/` (migrations, config, mẫu email), `scripts/`, `data/`, `docs/`, `package.json`, `package-lock.json`, `.env.example` |
| `.next/` | Bản build production (`npm run build`) tạo từ đúng commit đó. Đã bỏ `.next/cache` |
| `BUILD-INFO.txt` | Tag, commit, ngày build, phiên bản Node/npm dùng để build, SHA-256 của gói |
| `HUONG-DAN-TRIEN-KHAI.md` | Bản sao của tài liệu này |

Gói **không** chứa `node_modules`, `.env.local`, secret hay dữ liệu cá nhân.

**Build một lần, cấu hình lúc chạy.** Gói được build với giá trị giữ chỗ. Ứng dụng không có Supabase client phía trình duyệt, và mọi biến, kể cả `NEXT_PUBLIC_*`, được đọc lúc chạy qua `src/lib/env.ts`. Vì vậy cùng một gói dùng được cho mọi môi trường: chỉ cần đặt `.env.local` phù hợp, **không phải build lại**. Nếu sau này thêm code đọc `process.env.NEXT_PUBLIC_*` ở component phía trình duyệt, điều này sẽ không còn đúng. Khi đó phải build lại theo từng môi trường bằng `npm run build`.

## 2. Yêu cầu máy đích

- Node.js 24 và npm 12.
- Docker đang chạy.
- Supabase CLI ≥ 2.117, dùng cho DB local. Môi trường dùng Supabase cloud cần được phê duyệt riêng; xem `docs/operations/`.
- Cổng trống: 3000 cho web (đổi được bằng `PORT`) và 543xx cho Supabase (đổi được trong `supabase/config.toml`).

## 3. Cài đặt

```bash
# 1. Giải nén vào thư mục mới và kiểm tra checksum (giá trị ghi ở trang Release)
mkdir eoffice-v1.0.0 && cd eoffice-v1.0.0
unzip ../hiu-youth-e-office-v1.0.0.zip
shasum -a 256 ../hiu-youth-e-office-v1.0.0.zip

# 2. Cài dependency đúng theo package-lock.json
npm ci

# 3. Dựng database: Supabase local áp toàn bộ supabase/migrations
supabase start
#    Máy đã có stack khác ở 543xx? Đổi project_id và cổng trước khi start:
#    sed -i '' -e 's/^project_id = .*/project_id = "eoffice-v100"/' -e 's/= 543\([0-9][0-9]\)$/= 563\1/' \
#              -e 's/^inspector_port = 8083/inspector_port = 8283/' supabase/config.toml

# 4. Cấu hình
cp .env.example .env.local
supabase status -o env      # chép API_URL, PUBLISHABLE_KEY, SERVICE_ROLE_KEY vào .env.local
openssl rand -hex 32        # giá trị AUTH_RATE_LIMIT_PEPPER
#    NEXT_PUBLIC_APP_URL = địa chỉ người dùng mở web, ví dụ http://localhost:3000

# 5. Chạy bản build có sẵn (không cần npm run build)
npm start                   # hoặc: PORT=3100 npm start
```

Bảng biến môi trường xem ở README, mục "Biến môi trường".

## 4. Khởi tạo dữ liệu

- **Môi trường thật:**
  1. Tạo tài khoản đầu tiên tại `/register`.
  2. Chạy `npm run admin:bootstrap -- --user-id <UUID> --confirm`.
  3. Import danh mục: `npm run catalog:import -- <file.csv>`, chạy thử trước rồi thêm `--apply`.

  Chi tiết các bước ở README.
- **Môi trường demo hoặc kiểm thử:** dùng `npm run demo:seed -- --confirm-demo` theo `docs/TH2/demo-data.md`. Script chỉ chạy trên DB local còn trống.

## 5. Kiểm tra sau triển khai

Chạy checklist [`docs/testing/smoke-test.md`](../testing/smoke-test.md), rồi lưu kết quả (log, ảnh) vào thư mục bằng chứng của đợt phát hành.

## 6. Quay lại phiên bản trước (rollback)

1. Dừng web.
2. Giải nén gói của phiên bản trước vào một thư mục khác, chạy `npm ci`, rồi dùng lại `.env.local` cũ.
3. Chỉ rollback được khi phiên bản trước **không** cần gỡ migration. Migration đã áp không tự gỡ được, nên trước khi nâng cấp phải sao lưu DB theo `docs/operations/`.
