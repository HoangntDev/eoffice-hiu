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
| | | | | |
