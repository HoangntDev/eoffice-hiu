# UC8 — Điểm danh QR lượt và điểm rèn luyện dự kiến đề nghị

Trạng thái: nhánh `feat/program-attendance` (13/10/2026). Đã kiểm bằng pgTAP và một luồng UI trên trình duyệt local. Chưa deploy.

## Quy tắc đã chốt và cách hiện thực

| Quy tắc | Nguồn | Hiện thực |
|---|---|---|
| BTC cấu hình nhiều lượt, mở/đóng từng lượt; QR chung của lượt đổi mỗi 30 giây | 12.3, yêu cầu UC8 | `program_attendance_sessions`; `set_attendance_session_status`; màn hình QR gọi `issue_attendance_qr` mỗi 30 giây |
| Sinh viên đăng nhập, có đăng ký được nhận, tự quét | 12.3 | `check_in_attendance` yêu cầu `program_registrations.status = 'accepted'` |
| Kiểm chữ ký, đúng lượt, lượt đang mở, hạn theo giờ server; mã hết hạn báo quét mã mới | 12.3 | Token HMAC-SHA256 ký bằng bí mật riêng của lượt; `QR_INVALID`, `WRONG_SESSION`, `SESSION_NOT_OPEN`, `QR_EXPIRED` (HTTP 410) |
| Một lần/sinh viên/lượt; mở lại đúng lượt cũ để bổ sung, không cộng hai lần | 12.3, yêu cầu UC8 | `unique (session_id, user_id)`; mở lại tăng `open_count`, bản ghi đánh dấu `is_supplementary`; điểm tính trên các lượt khác nhau |
| Có tham gia = ≥1 lượt (kể cả lượt 0 điểm); Hoàn thành = có điểm ≥1; không lượt nào = đăng ký nhưng không tham gia | 14.1 | `program_attendance_preview.participation`: `participated` / `completed` / `absent` |
| Điểm tối đa nguyên do BTC nhập; quy tắc theo lượt; không vượt tối đa | 11.1, 11.2, 12.1, 12.2 | `max_points` 0–100; 4 quy tắc; `attendance_expected_points` luôn `least(…, max_points)` |
| Không sửa quy tắc tùy tiện sau khi bắt đầu | Yêu cầu UC8 | Lượt nào đã mở thì khóa: chỉ `faculty_manager`, lý do ≥10 ký tự, lịch sử `plan_amended` lưu trước/sau |
| Điểm dự kiến đề nghị, không phải Thư ký Khoa cấp | 12.2 | Chỉ có bảng xem trước, không có trạng thái "đã cấp" |
| Chưa trừ 5 điểm uy tín | 15.1, 16.1 | UC8 không ghi `reputation_adjustments`; sinh viên không xem điểm dự kiến hay uy tín |

## Mã QR

Token có dạng `<session_id>.<generation>.<issued_ms>.<chữ ký>`, trong đó:
- `generation` là số lần lượt đã được mở (`open_count`);
- `issued_ms` là thời điểm phát theo đồng hồ database;
- chữ ký là 128 bit đầu của HMAC-SHA256, tính trên ba phần trước và khóa bằng bí mật 32 byte của lượt (`program_attendance_secrets`, không cấp quyền đọc cho client).

Liên kết trong QR có dạng `NEXT_PUBLIC_APP_URL/attend/{session_id}?t={token}`.

Thứ tự kiểm tra trong `check_in_attendance`:
1. Đúng định dạng.
2. Lượt trong token khớp lượt trên đường dẫn (`WRONG_SESSION`).
3. Chữ ký đúng (`QR_INVALID`). Vì thế không sửa được thời điểm phát để kéo dài hạn.
4. Lượt đang mở (`SESSION_NOT_OPEN`).
5. Mã thuộc lần mở hiện tại và chưa quá 30 giây theo giờ server, cho lệch tối đa 5 giây về tương lai (`QR_EXPIRED`).
6. Đăng ký được nhận (`REGISTRATION_NOT_ACCEPTED`).
7. Chưa điểm danh lượt này (`ALREADY_CHECKED_IN`).

Mở lại lượt làm tăng `generation`, nên mã của lần mở trước không dùng lại được. Bảng lượt được khóa `FOR SHARE` khi ghi nhận, nên BTC không thể đóng lượt chen giữa.

QR là mã chung của lượt. Trong 30 giây hiệu lực, một người có mặt có thể chụp mã gửi cho người vắng mặt; hệ thống không chặn được việc này (giống mọi phương án QR chung). Cách chặn duy nhất là QR cá nhân, mà phương án này đã bị loại.

## Quy tắc điểm

| `rule_type` | Điểm dự kiến (luôn ≤ `max_points`) |
|---|---|
| `all_required` | Có mặt đủ mọi lượt bắt buộc → `max_points`, ngược lại 0 |
| `any_session` | Có mặt ≥ 1 lượt → `max_points` |
| `sum_sessions` | Tổng `points` của các lượt có mặt (mỗi lượt ≤ tối đa; tổng bị chặn ở tối đa) |
| `tiers` | Điểm của bậc cao nhất có `min_sessions` ≤ số lượt có mặt; nếu `tiers_require_required` mà thiếu lượt bắt buộc → 0 |

## Lịch sử và khóa quy tắc

`program_attendance_history` lưu các sự kiện:
- `plan_saved` / `plan_amended`, kèm `before_data`/`after_data` và lý do;
- `session_opened` / `session_reopened` (có lý do) / `session_closed`.

Mỗi lần điểm danh là một bản ghi trong `program_attendance_records` (cờ bổ sung, generation, `request_id`) và có thêm một dòng audit. Lượt đã từng mở thì không xóa được (`SESSION_IN_USE`).

## API và trang

```
PUT  /api/event-programs/{id}/attendance           BTC lưu/điều chỉnh kế hoạch
POST /api/attendance/sessions/{sid}/status         {status: open|closed, reason}
POST /api/attendance/sessions/{sid}/qr             BTC lấy QR mới (SVG + hạn), no-store
POST /api/attendance/check-in                      {sessionId, token}
```

Trang:
- `/programs/{id}/attendance` (BTC): lượt, mở/đóng/mở lại, bảng xem trước, kế hoạch, lịch sử.
- `/programs/{id}/attendance/{sid}/qr`: màn hình chiếu QR.
- `/attend/{sid}?t=…`: trang sinh viên mở sau khi quét.
- `/programs/{id}`: sinh viên thấy mục "Điểm danh của bạn".

## Giới hạn hiện tại

- Trang đăng nhập hiện bỏ qua tham số `next` và luôn chuyển tới hồ sơ. Sinh viên chưa đăng nhập phải đăng nhập rồi quét lại (mã cũ có thể đã hết hạn). Luồng đăng nhập không đổi trong UC8.
- Chưa có xuất CSV bảng điểm dự kiến; Đơn đề nghị cấp điểm thuộc UC sau.
- BTC không thể tự điểm danh hộ hay sửa tay bản ghi. Người quên quét chỉ được bổ sung bằng cách mở lại lượt và quét.
- Chưa xử lý khiếu nại hay hoàn điểm uy tín (UC nghiệm thu/uy tín).
