# Checklist smoke test

Chạy nhanh sau mỗi lần phát hành hoặc triển khai (dùng lại ở TH3 và TH4). Mục tiêu là xác nhận bản vừa cài **khởi động được và làm được một giao dịch chính**. Đây không phải kiểm thử đầy đủ.

Chuẩn bị:
- Bản build hoặc artifact đã cài theo README.
- `.env.local` trỏ vào một stack Supabase **không phải DB đang dùng**, ví dụ stack demo theo `docs/TH2/demo-data.md`.
- Đặt `BASE=http://localhost:<cổng>`.

| # | Bước | Lệnh / thao tác | Kết quả đạt |
|---|---|---|---|
| 1 | Ứng dụng khởi động | `npm start` (hoặc `npx next start -p <cổng>`) | Log có `Ready`, không có `MISSING_ENV` |
| 2 | Trang chủ trả lời | `curl -s -o /dev/null -w '%{http_code}' $BASE/` | `200`; trình duyệt thấy "Văn phòng điện tử Đoàn – Hội HIU" |
| 3 | Kết nối Supabase/DB | `supabase status --workdir <stack>`, rồi mở `$BASE/forms` | Stack đang chạy; `/forms` trả `200` và hiện danh sách biểu mẫu lấy từ DB |
| 4 | Trang bảo vệ chặn khách | `curl -s -o /dev/null -w '%{http_code} %{redirect_url}' $BASE/programs` | `307` về `/login?next=%2Fprograms` |
| 5 | Đăng nhập | Đăng nhập bằng một tài khoản demo (MSSV 10 số, PIN 6 số) | Đăng nhập thành công; thanh trên hiện họ tên và MSSV |
| 6 | Mở màn hình chính | Mở Trang chủ và trang Chương trình | Có khối "Việc của tôi"; danh sách chương trình có cột "Đăng ký của tôi" |
| 7 | Một giao dịch chính (UC-C) | Sinh viên mở một chương trình đang nhận đăng ký và bấm "Đăng ký" | Báo đăng ký thành công hoặc đang chờ duyệt; trạng thái hiện ở trang chương trình và ở "Việc của tôi" |
| 8 | Đăng xuất | Menu tài khoản → Đăng xuất | Quay về trang chủ khách; mở lại `/programs` thì bị chuyển tới `/login` |

Ghi kết quả vào bảng dưới (sao chép cho mỗi lần chạy) và lưu log hoặc ảnh vào `docs/TH<n>/evidence/`.

| Ngày | Phiên bản / commit | Môi trường | Bước Fail | Người chạy |
|---|---|---|---|---|
| 29/10/2026 | Gói `v1.0.0` (`fe2b984`) | Gói Release cài ngoài repo, stack Supabase `eoffice-v100` (563xx), cổng 3300 | Không (8/8 PASS) – [log](../TH2/evidence/smoke-artifact/README.md) | Nguyễn Thanh Hoàng |
| 06/11/2026 | Gói `v1.0.1` (`fb5eb99`) | Gói tải từ Release v1.0.1 (SHA-256 `0f4a744b…`), cài ngoài repo, stack `eoffice-v100`, cổng 3500 | Không (8/8 PASS), thêm `/api/health` = `config: ok`. Lần cài đầu với gói tải lên trước đó không khởi động được (thiếu symlink `.next/node_modules`), đã thay gói – [log](../TH3/INC-01-ThieuCauHinh/evidence/c-v1.0.1-phat-hanh/05-smoke.log) | Nguyễn Thanh Hoàng |
| 10/11/2026 | Nhánh CR-01, bản build production (`4c6ae7a` + seed `a9d406a`) | Stack tách biệt `eoffice-cr01-spike` (573xx), cổng 3200, công tắc TẮT | Không (8/8 PASS) – [log và ảnh](../TH4/evidence/README.md) | Nguyễn Thanh Hoàng |
| 13/11/2026 | Gói `v1.2.1` (`2baaf97`) | Gói tải từ Release v1.2.1 (SHA-256 `142baec4…` khớp), cài ngoài repo, stack tách biệt `eoffice-smoke-v120` (584xx), cổng 3600, công tắc TẮT; bước 1–4 bằng `curl`, bước 5–8 bằng Playwright (Chromium headless) | Không (8/8 PASS), `/api/health` = `version: 1.2.1`, không có phản hồi 5xx; bước 8 đăng xuất về `/login` sau 425 ms – [log và ảnh](../Final/evidence/v1.2.1/smoke/smoke.log) | Nguyễn Thanh Hoàng (script Playwright) |
