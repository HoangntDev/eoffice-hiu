# Smoke test gói Release v1.1.0

Ngày chạy: 10/11/2026. Gói được tải từ GitHub Release vào thư mục tạm ngoài
repository, kiểm tra SHA-256 rồi giải nén. Ứng dụng chạy ở cổng 3600 với stack
Supabase tách biệt `eoffice-v110-smoke` ở dải cổng 583xx. Stack đã được dừng bằng
`supabase stop --workdir … --no-backup` sau khi kiểm thử; không áp migration lên
stack đang dùng.

## Gói phát hành

- Tag annotated: `v1.1.0`, trỏ tới merge commit `1bcdda18fb1fe03cb4b8372b066a4497bf05d1a1`.
- Asset: `hiu-youth-e-office-v1.1.0.zip`, 9.913.327 byte.
- SHA-256 kiểm tra lại từ file tải về:
  `322ecb146b3e437c5781f8135e63779f99095372e019918a7b17a54ce1a66d0f`.
- `/api/health` trên gói đã cài:
  `{"app":"ok","db":"ok","config":"ok","version":"1.1.0"}`.

## Kết quả smoke test

| Bước | Kết quả |
|---|---|
| 1. Khởi động gói | PASS, Next.js 16.4.5 báo `Ready` |
| 2. Trang chủ | PASS, HTTP 200 và có tiêu đề ứng dụng |
| 3. Database và biểu mẫu | PASS, stack chạy; `/forms` HTTP 200 và có dữ liệu demo |
| 4. Route bảo vệ | PASS, `/programs` trả 307 về `/login?next=%2Fprograms` |
| 5. Đăng nhập | PASS, thanh tài khoản hiện họ tên và MSSV demo |
| 6. Màn hình chính | PASS, có `Việc của tôi` và `Đăng ký của tôi` |
| 7. Giao dịch UC-C | PASS, đăng ký chương trình trả 201 và trạng thái `Đã xác nhận` |
| 8. Đăng xuất | PASS, về `/login`; route bảo vệ tiếp tục chuyển hướng |

Kết quả máy đọc được và hai ảnh của bước 7–8 nằm ở `../smoke/`.

## Trường hợp công tắc TẮT

Database trả `ORG_ACCOUNTS_ENABLED=false` ngay sau migration và seed tạo ba tài
khoản tổ chức nhưng giữ ba grant quản lý cá nhân. Playwright kiểm tra:

1. Mở `/admin/login` bị chuyển về `/login`, nên đăng nhập tổ chức không dùng được.
2. Tài khoản cá nhân quản trị Đoàn Trường đăng nhập bằng luồng cũ và mở được
   `/organization`, có đầy đủ màn hình `Danh mục và phân quyền`.

Kết quả: `FLAG_OFF_RELEASE_OK admin_redirect=/login personal_management=/organization`.
Ảnh `flag-off-personal-fallback.png` đã được mở xem lại sau khi chụp. Script kiểm
thử là `playwright-flag-off.mjs`; PIN chỉ truyền qua biến môi trường và không ghi
vào log hoặc ảnh.
