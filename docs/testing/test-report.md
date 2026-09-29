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
