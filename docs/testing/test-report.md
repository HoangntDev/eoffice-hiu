# Báo cáo kiểm thử Prompt 01 — 29/09/2026

Không dùng dữ liệu cá nhân thật.

| ID | Expected | Actual | Kết quả |
|---|---|---|---|
| DB-01 | 10 số/số 0 đầu hợp lệ; 11 số bị chặn | đúng | PASS |
| DB-02 | Import lại không nhân đôi | còn 1 Lớp, 1 Chi đoàn | PASS |
| DB-03 | CTV không duyệt cuối | `COLLABORATOR_CANNOT_FINALIZE` | PASS |
| DB-04 | Chưa nhận Sổ không công nhận | `PAPER_BOOK_NOT_RECEIVED` | PASS |
| DB-05 | Nhận Sổ rồi Văn phòng công nhận | membership `recognized` | PASS |
| DB-06 | Sinh viên không tự đổi MSSV/status | `FORBIDDEN`/42501 | PASS |
| UT-01 | CSV giữ tiếng Việt/dấu phẩy/số 0 | giữ nguyên | PASS |
| UT-02 | Header sai/Lớp trùng bị chặn | parser báo lỗi | PASS |
| UT-03 | Chặn 11 số/non-Gmail/field tổ chức tiêm vào profile | Zod từ chối | PASS |
| HTTP-01 | Landing/register render, API profile chưa login bị chặn | 200/200/401 | PASS |
| HTTP-02 | Đăng ký → Mailpit → callback PKCE → session | 201 → email → 200 → profile 200, Gmail verified | PASS |
| HTTP-03 | Đăng nhập bằng MSSV; 11 số bị chặn | 200; 422 | PASS |
| HTTP-04 | Import dry-run/apply rồi lưu profile bằng Lớp hợp lệ | 0 conflict, 1 dòng; profile 200 | PASS |

Bằng chứng: `supabase test db` (17 test), `npm test` (9 test) và HTTP local. Browser backend không khả dụng nên chưa có kiểm thử/ảnh trực quan. Email cloud thật, SMTP/Resend production và deployment chưa chạy; không ghi PASS.

## Bổ sung import danh mục — 02/10/2026

| ID | Expected | Actual | Kết quả |
|---|---|---|---|
| CSV-01 | Nguồn đúng 6 cột, giữ nguyên mã Lớp, không thiếu/trùng | 347/347 dòng hợp lệ; 0 lỗi; 0 xung đột | PASS |
| CSV-02 | Dry-run báo số dự kiến trước khi ghi | +10 Khoa, +51 Ngành, +6 Khóa, +347 Lớp; cập nhật 0 | PASS |
| CSV-03 | Apply local đúng quan hệ nguồn | DB có 10/51/6/347; đối chiếu 347 dòng, sai lệch 0 | PASS |
| CSV-04 | Chạy lại idempotent | thêm 0, cập nhật 0, `alreadyApplied: true` | PASS |
| DB-07 | Server chỉ nhận Lớp thuộc danh mục hiện hành | Lớp hợp lệ sống; UUID ngoài danh mục trả `INVALID_OR_INACTIVE_CLASS` | PASS |
| UI-01 | Dropdown Khoa → Ngành → Khóa → Lớp lọc và reset đúng | React test qua 2 Khoa, 2 Khóa; lựa chọn con được lọc/reset | PASS |
| UI-02 | Nhấp kiểm tra bằng trình duyệt tích hợp | Không có browser session khả dụng (`[]`) | NOT RUN |

Lệnh đã chạy: `npm run lint`, `npm run typecheck`, `npm test` (11 test), `supabase test db` (19 test), `npm run build`. Tất cả lệnh đã chạy đều PASS. Không reset database, không push cloud và không deploy.

## Bổ sung vòng đời tài khoản PIN — 02/10/2026

Kiểm thử dùng tài khoản tổng hợp, không dùng dữ liệu cá nhân thật và không ghi PIN/token vào bằng chứng.

| ID | Expected | Actual | Kết quả |
|---|---|---|---|
| AUTH-01 | SIGN UP chỉ MSSV + Gmail → Mailpit → xác minh → tạo PIN → profile | 201 → email local → `/signup/create-pin` → create PIN 200 → profile 200 | PASS |
| AUTH-02 | Profile tải đủ danh mục sau SIGN IN | API trả 10 Khoa, 51 Ngành, 6 Khóa, 347 Lớp | PASS |
| AUTH-03 | SIGN OUT hủy session; URL/API bảo vệ không mở lại | logout 200; trang trả 307 về `/login`; API profile trả 401 | PASS |
| AUTH-04 | SIGN IN chỉ MSSV + PIN; PIN cũ/sai bị từ chối | sai 401; đúng 200; schema từ chối Gmail/role thừa | PASS |
| AUTH-05 | Giới hạn thử PIN ở server | 8 lần sai trả 401; lần thứ 9 cùng MSSV/IP trả 429 trong cửa sổ 15 phút | PASS |
| AUTH-06 | Trạng thái chờ PIN không làm lộ tài khoản | MSSV chờ PIN và MSSV không tồn tại cùng trả 401, cùng thông báo; email hoàn tất vẫn được gửi | PASS |
| AUTH-07 | Email chưa xác minh không đăng nhập; liên kết hết hạn có thể gửi lại | login 401; link hết hạn về `/register?error=confirmation`; resend 200 và Mailpit nhận email mới | PASS |
| AUTH-08 | Đổi PIN phải xác minh PIN hiện tại | PIN hiện tại sai 400; đúng 200; PIN cũ login 401, PIN mới login 200 | PASS |
| AUTH-09 | Khôi phục PIN là email riêng và chứng cứ dùng một lần | email “Khôi phục PIN”; callback vào `/account/recover-pin`; token hash chỉ claim một lần | PASS |
| AUTH-10 | Gmail hiện tại chỉ đổi sau xác nhận Gmail mới | yêu cầu 200; local double-confirm gửi 2 email; mapping chỉ cập nhật sau callback cuối | PASS |
| AUTH-11 | Không đăng ký trùng MSSV/Gmail | lần đăng ký trùng trả 409 | PASS |
| UI-03 | Ba form tách biệt và có nút Đăng xuất rõ ràng | test component kiểm SIGN UP không có PIN, SIGN IN không có Gmail, đổi PIN có PIN hiện tại, có nút Đăng xuất | PASS |

E2E trên là HTTP + Supabase Auth/PostgreSQL + Mailpit local thực tế. Kiểm tra trực quan bằng trình duyệt tích hợp chưa chạy, nên không ghi PASS cho bố cục/hình ảnh. Không reset database, không nhập lại CSV, không push cloud và không deploy.

Lệnh xác nhận cuối: `npm run lint`, `npm run typecheck`, `npm test` (17 test), `supabase test db` (27 test), `supabase db lint --local`, `npm run build`.
