# Smoke test trên gói phát hành v1.0.0

Ngày chạy: 29/10/2026. Issue #38.

## Môi trường

| Mục | Giá trị |
|---|---|
| Gói | `hiu-youth-e-office-v1.0.0.zip`, tải bằng `gh release download v1.0.0` |
| SHA-256 | `067ddf5361bdbc9065d4752f79a8586c73d4d33ee8c4ab3726f6ebd47bb9c8bf`, khớp file `.sha256` trên Release |
| Build | Tag `v1.0.0`, commit `fe2b984`, build ngày 20/10/2026 (theo `BUILD-INFO.txt` trong gói). Không build lại |
| Thư mục cài | `~/Developer/eoffice-smoke-v1.0.0/app`, ngoài repo |
| Node / npm | v24.16.0 / 12.0.2 |
| Supabase | CLI 2.117.0, stack tách biệt `project_id = "eoffice-v100"`, cổng 563xx. Không đụng stack `hiu-youth-e-office` (543xx) và `hiu-eoffice-demo` (553xx) |
| Dữ liệu | Danh mục từ `data/` của gói, dữ liệu demo bằng `npm run demo:seed -- --confirm-demo`. Mọi họ tên, MSSV, email là dữ liệu giả |
| Web | `PORT=3300 npm start`, `BASE=http://localhost:3300` |

## Kết quả

| # | Bước | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Ứng dụng khởi động | PASS. `Ready in 257ms`, không có `MISSING_ENV` | `07-npm-start.log` |
| 2 | Trang chủ trả lời | PASS. `200`, có "Văn phòng điện tử Đoàn – Hội HIU" | `08-smoke-buoc-2-4.log` |
| 3 | Kết nối Supabase/DB | PASS. Stack `eoffice-v100` chạy; `/forms` trả `200`, hiện 2 biểu mẫu đang mở lấy từ DB | `08-smoke-buoc-2-4.log` |
| 4 | Trang bảo vệ chặn khách | PASS. `307` về `/login?next=%2Fprograms` | `08-smoke-buoc-2-4.log` |
| 5 | Đăng nhập | PASS. Thanh trên hiện họ tên và MSSV | `09-smoke-buoc-5-8-lan2.log` |
| 6 | Mở màn hình chính | PASS. Có "Việc của tôi"; bảng chương trình có cột "Đăng ký của tôi" | `09-smoke-buoc-5-8-lan2.log` |
| 7 | Giao dịch chính (UC-C) | PASS. "Đăng ký thành công. Bạn đã được xác nhận tham gia."; trạng thái đổi từ "Đang mở đăng ký" sang "Đã xác nhận" | `09-smoke-buoc-5-8-lan2.log`, `07-npm-start.log` (sự kiện `program_registration.registered`) |
| 8 | Đăng xuất | PASS. Về trang chủ khách; mở `/programs` bị chuyển tới `/login?next=%2Fprograms` | `09-smoke-buoc-5-8-lan2.log` |

Bước 1–4 chạy bằng `curl`. Bước 5–8 chạy bằng `smoke-ui.mjs` (Playwright 1.49.1 trong Docker).

## Ghi chú

- **Lần 1 của bước 5–8** (`09-smoke-buoc-5-8-lan1.log`, tài khoản 2241110104): bước 5–7 PASS. Bước 8 dừng với `net::ERR_ABORTED`, vì script mở `/programs` khi điều hướng sau đăng xuất chưa xong. Đây là lỗi của script. Đã thêm `waitForLoadState("networkidle")` và chạy lại bằng tài khoản 2211110103 (`lan2`), vì 2241110104 đã đăng ký ở lần 1.
- **Thứ tự nạp dữ liệu:** lần đầu chạy `catalog:import` trước khi tạo `.env.local` nên gặp `ENOENT: ... '.env.local'` (đầu `05-nap-du-lieu.log`). Script này đọc `.env.local`. Hướng dẫn triển khai đã đặt bước "Cấu hình" trước "Khởi tạo dữ liệu"; làm đúng thứ tự thì chạy được. `demo:seed` lần đầu báo lỗi vì chưa có danh mục, chưa ghi tài khoản nào.
- **`npm audit` ngày 29/10/2026** (`10-npm-audit.log`): 7 lỗ hổng (3 moderate, 3 high, 1 critical). Riêng dependency production (`--omit=dev`) có 2: `next` 16.0.0–16.4.0 (critical) và `zod` <4.6.6 (high). Lúc phát hành (20/10), `docs/TH2/evidence/config/npm-audit-after.txt` ghi 5 high, đều ở công cụ dev. Các advisory mới công bố sau ngày phát hành. Chưa xử lý trong issue này; cần issue riêng để nâng `next` và `zod`.
- Log đã che khóa, pepper và IP mạng LAN. `.env.local` không đưa vào repo.
