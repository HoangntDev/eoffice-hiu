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
