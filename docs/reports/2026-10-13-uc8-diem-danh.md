# Báo cáo UC8 — Điểm danh QR lượt (13/10/2026)

UC8 đã làm trọn và đã push nhánh `feat/program-attendance` (tạo từ `main` mới nhất, đã có UC7 merge). Các test nhắm vào rủi ro và luồng UI đều đạt.
- Chưa có PR nên CI chưa chạy. Chưa merge, không gọi là release/CR-01, không đụng cloud.
- Luồng đăng ký UC7 không bị sửa; trang chương trình chỉ có thêm mục "Điểm danh".

**Commit:** `aa3457a` (tính năng), `81c1337` (STATUS.md, mục mới ở đầu file).

## Kết quả thực tế

| Kiểm thử | Kết quả |
|---|---|
| pgTAP 008 | 55/55 |
| Vitest UC8 | 7/7 |
| Luồng UI trên Chrome | 14/14 |
| Lint, typecheck (một lần) | PASS |

pgTAP 008 phủ:
- **QR:** còn hạn thì nhận; quá 30 giây theo giờ server thì hết hiệu lực; mã của lượt khác bị từ chối; chữ ký sai bị từ chối, kể cả khi sửa thời điểm phát để kéo dài hạn.
- **Lượt và đăng ký:** lượt chưa mở hoặc đã đóng bị từ chối; chưa có đăng ký được nhận thì không điểm danh được.
- **Quét trùng:** bị chặn.
- **Mở lại lượt:** phải có lý do; vẫn là lượt cũ; mã của lần mở trước hết hiệu lực; bản ghi được đánh dấu bổ sung; không ghi hai lần.
- **Giới hạn điểm tối đa:** đúng ở cả 4 quy tắc.
- **Khóa quy tắc:** sau khi đã bắt đầu điểm danh, chỉ BCH Đoàn Khoa được điều chỉnh, phải có lý do, có lịch sử.
- **Uy tín:** không phát sinh trừ điểm uy tín.

Luồng UI chạy như sau:
1. BTC lập kế hoạch, mở lượt, chiếu QR.
2. Sinh viên dùng viewport điện thoại "quét" QR: mã được giải mã từ ảnh chụp màn hình QR của BTC, không đọc link từ trang.
3. Các tình huống đã kiểm:
   - được nhận;
   - quét lại bị chặn;
   - người bị từ chối đăng ký không điểm danh được;
   - QR đổi sau 30 giây: mã cũ báo hết hiệu lực, mã mới được nhận;
   - đóng lượt thì mã còn hạn cũng bị từ chối.
4. BTC xem bảng xem trước: "Đầu giờ, Cuối giờ · Hoàn thành · 3 điểm".
5. Sinh viên chỉ thấy các lượt mình đã điểm danh.

Lỗi phát hiện trong lúc chạy UI, đã sửa:
- Lần chạy đầu: trang QR và trang quét trả 404 do truy vấn sai quan hệ khóa ngoại.
- Ảnh chụp: QR lệch trái, ô điểm của lượt bị rơi xuống dòng.

## Giới hạn còn lại

- QR là mã chung: trong 30 giây, người có mặt vẫn có thể gửi mã cho người vắng. Muốn chặn hẳn phải dùng QR cá nhân, mà phương án đó đã bị loại.
- Trang đăng nhập bỏ qua tham số `next`. Sinh viên chưa đăng nhập khi quét sẽ phải đăng nhập rồi quét lại.
- Chưa xuất CSV điểm dự kiến và chưa có Đơn đề nghị cấp điểm (UC sau). BTC không sửa tay được bản ghi điểm danh.
- Chưa kiểm thử nhiều phiên đồng thời cho điểm danh; hiện chỉ dựa vào ràng buộc duy nhất và khóa hàng của database.
- Đã thêm thư viện `qrcode@1.5.4`.
- DB local có thêm dữ liệu điểm danh thử trên 2 chương trình của Khoa CNKT.
- Tên migration `202610150003` lệch ngày thực tế (13/10) để xếp đúng sau migration đã merge. Ngày trong STATUS lượt này đã ghi đúng; các mục trước ghi 14–16/10 là sai ngày.

## Bạn cần làm

Mở PR tại https://github.com/HoangntDev/eoffice-hiu/pull/new/feat/program-attendance (base `main`), chờ CI xanh rồi mới merge.
