Bản vá của HIU Youth E-Office sau sự cố **INC-01-ThieuCauHinh**, kèm nâng cấp bảo mật `next`/`zod`.

**Cài đặt:** tải `hiu-youth-e-office-v1.0.1.zip` bên dưới và làm theo [hướng dẫn triển khai](https://github.com/HoangntDev/eoffice-hiu/blob/v1.0.1/docs/release/huong-dan-trien-khai.md) (gói đã build sẵn, cấu hình lúc chạy bằng `.env.local`). Nâng từ v1.0.0: không có migration mới; sao lưu trước theo [runbook](https://github.com/HoangntDev/eoffice-hiu/blob/v1.0.1/docs/runbooks/backup-restore.md), thay gói, `npm ci`, dùng lại `.env.local`. Sau khi chạy, kiểm tra `GET /api/health` trả `{"app":"ok","db":"ok","config":"ok"}` và chạy [smoke test](https://github.com/HoangntDev/eoffice-hiu/blob/v1.0.1/docs/testing/smoke-test.md).

**SHA-256** `hiu-youth-e-office-v1.0.1.zip`: `0f4a744b738fca7313772795c2d8336890c372a6bc683b4eb4ba5d7e613020e5`

> Gói đã được thay lúc 10:20 ngày 06/11/2026 (+07). Gói tải lên lần đầu (SHA-256 `b3ba52894b46b66eba7e4507ce27d06bd16c158059953729d0388d839ec9d24b`) bị thiếu 2 symlink `.next/node_modules/winston-*`, nên `npm start` báo `Cannot find module 'winston-…'`. Smoke test trên gói đã phát hiện lỗi này; mã nguồn và tag không đổi, chỉ đóng gói lại bằng `zip -y`.

Bản vá sau sự cố INC-01-ThieuCauHinh, kèm nâng cấp bảo mật. Không đổi cơ sở dữ liệu (không có migration mới); nâng từ 1.0.0 chỉ cần thay gói và chạy `npm ci`.

## Fixed

- **INC-01-ThieuCauHinh** (#59): thiếu hoặc sai cấu hình bắt buộc nay bị phát hiện ngay lúc khởi động, thay vì chỉ lộ ra khi người dùng thao tác.
  - Lúc khởi động, hệ thống kiểm tra 4 biến `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_RATE_LIMIT_PEPPER` và thử service role key. Lỗi được ghi `config.invalid` kèm tên biến (không ghi giá trị); `/api/health` trả 503 với `config: "error"`.
  - Thiếu `NEXT_PUBLIC_SUPABASE_URL` hoặc publishable key: trước đây mọi trang trả "Internal Server Error" thô, do bản build bỏ mất phép kiểm tra cấu hình trong proxy. Nay trả trang 503 "Hệ thống tạm thời chưa sẵn sàng" kèm mã tham chiếu.
  - Service role key sai: đăng nhập trước đây trả 500 "Không thể xử lý yêu cầu", nay trả 503 kèm mã tham chiếu và có log.
- Điểm danh QR (#61): token sai định dạng UUID trả 422 `QR_INVALID` ("Mã QR không hợp lệ…") thay vì 500, và không gửi xuống database.
- Trang chủ khách không còn hai cặp nút Đăng nhập/Tạo tài khoản: hai nút chỉ nằm ở thanh đầu trang, và nay hiện cả trên điện thoại. Banner có nút "Xem biểu mẫu đang mở". Hướng dẫn rút còn 3 bước, không lặp ý với thẻ chức năng (#36).

## Security

- Nâng `next` 16.3.8 → 16.4.5 (critical: GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, GHSA-673q-mjm6-r5xr) và `eslint-config-next` theo cùng (#63).
- Nâng `zod` 4.6.5 → 4.6.7 (high: GHSA-mrhx-c7xc-m3w5) (#63).
- `npm audit --omit=dev`: 0 lỗ hổng. Các lỗ hổng còn lại chỉ nằm trong công cụ phát triển (vitest, vite, undici qua jsdom, minimatch qua typescript-eslint).

## Added

Cải tiến vận hành, không đổi hành vi nghiệp vụ của người dùng:

- Log JSON ra file `logs/app-YYYY-MM-DD.log` (winston, xoay theo ngày, giữ 7 file), vẫn ghi console; mỗi dòng có `ts`, `level`, `source`, `event`, `requestId`. Ghi khởi động/dừng, lỗi chưa xử lý, giao dịch chính, lỗi/chậm khi gọi database (ngưỡng `DB_SLOW_MS`), đăng nhập sai và truy cập bị từ chối (MSSV đã che, IP). Không ghi PIN, token, cookie, email đầy đủ (#55).
- `GET /api/health` trả `{app, db, config, version}` cho giám sát và smoke test (#55, #59).
- Lỗi chưa xử lý hiện trang thân thiện kèm mã tham chiếu khớp với log; lỗi API 500/503 có thêm mã tham chiếu trong thông báo (#55).
- `scripts/backup.sh` và `scripts/restore.sh`: sao lưu/phục hồi Postgres (public, auth, storage) và file PDF kế hoạch bằng một lệnh, có checksum; runbook `docs/runbooks/backup-restore.md`, RPO 1 giờ, RTO 30 phút (#57).

