# Ảnh giao diện trước/sau (issue #17)

## Cách chụp

- **Trước:** commit `2713860` (`main` trước PR này), DB local đang dùng (dữ liệu test cũ). Đăng nhập bằng tài khoản test có sẵn.
- **Sau:** nhánh `fix/17-ui-polish`, chạy trên stack demo tách biệt đã seed bằng `scripts/seed-demo.mjs` (xem `docs/TH2/demo-data.md`).
- **Chung cho cả hai:** bản build production (`next start`), Playwright 1.49.1 (Chromium) trong Docker. Desktop 1366×860, mobile 390×844, chụp toàn trang.
- **Font:** container không có font giao diện của macOS, nên chữ trong ảnh hơi khác so với trên máy thật.

## Đối chiếu

| Màn hình | Trước | Sau | Thay đổi chính |
|---|---|---|---|
| Điền biểu mẫu | `truoc/dien-bieu-mau-*.png` | `sau/dien-bieu-mau-*.png` | Radio/checkbox nằm sát nhãn bên trái (trước: nút bị kéo giãn hết bề ngang, nhãn bị đẩy sang phải). Hạn nhận phản hồi hiển thị theo giờ Việt Nam. |
| Trang chủ (khách) | `truoc/trang-chu-khach-*.png` | `sau/trang-chu-khach-*.png` | Giữ trang giới thiệu. Bỏ cột "Chức năng chính" lặp với menu. Đăng nhập chỉ còn ở góc trên và trong banner. |
| Trang chủ sinh viên | `truoc/trang-chu-sinh-vien-*.png` | `sau/trang-chu-sinh-vien-*.png` | Khối "Việc của tôi": đăng ký chương trình kèm trạng thái, hồ sơ Đoàn viên. Thanh trên hiện họ tên, chữ viết tắt và MSSV. |
| Menu tài khoản | (trước: mục "Tài khoản" nằm trên thanh menu) | `sau/menu-tai-khoan-*.png` | Menu thả xuống ở góc trên phải: họ tên, MSSV, email, Tổng quan, Hồ sơ sinh viên, Hồ sơ Đoàn viên, Đổi PIN, Đăng xuất. |
| Trang chủ Đoàn Khoa | `truoc/trang-chu-doan-khoa-desktop.png` | `sau/trang-chu-doan-khoa-*.png` | Số kế hoạch theo trạng thái, đăng ký chờ duyệt kèm liên kết tới chương trình. |
| Trang chủ Văn phòng | `truoc/trang-chu-van-phong-desktop.png` | `sau/trang-chu-van-phong-*.png`, `sau/trang-chu-quan-tri-desktop.png` | Kế hoạch chờ xét, hồ sơ Đoàn viên chờ xử lý. Menu chỉ có mục đúng vai trò (trước: mọi tài khoản đều thấy Cơ cấu và Xử lý hồ sơ). |
| Danh sách chương trình | `truoc/chuong-trinh-danh-sach-*.png` | `sau/chuong-trinh-danh-sach-*.png`, `sau/chuong-trinh-danh-sach-sai-doi-tuong-desktop.png` | Cột "Đăng ký của tôi". Trên điện thoại hiển thị dạng thẻ (trước: bảng bị bóp, mất nút Xem). Tên đơn vị không lặp "Khoa Khoa". |
| Chi tiết chương trình | `truoc/chuong-trinh-chi-tiet-*.png` | `sau/chuong-trinh-het-cho-*.png`, `sau/chuong-trinh-sai-doi-tuong-desktop.png`, `sau/chuong-trinh-da-dong-desktop.png`, `sau/chuong-trinh-dang-mo-*.png`, `sau/chuong-trinh-da-dang-ky-desktop.png` | Lý do không đăng ký được (hết chỗ, sai đối tượng, đã đóng) thay cho câu chung "không nhận đăng ký". Trạng thái đăng ký có màu. |
| Danh sách biểu mẫu | — | `sau/bieu-mau-danh-sach-*.png` | Sinh viên không còn thấy "Tạo biểu mẫu" và "Quản lý". Dạng thẻ trên điện thoại. |
| Hồ sơ Đoàn viên | — | `sau/ho-so-doan-vien-can-bo-sung-desktop.png` | Trạng thái hiển thị tiếng Việt ("Cần bổ sung"; trước là mã `needs_changes`). |

Ảnh "trước" cho thấy cả **dữ liệu rác** trong DB đang dùng: "G6 UI Write Test Form", "Hội trại kỹ năng CNKT 01182", "Hội trại kỹ năng CNKT 74567". Ảnh "sau" dùng dữ liệu demo tiếng Việt, tất cả là dữ liệu giả.
