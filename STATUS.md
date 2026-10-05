# Kết quả — 06/10/2026

### Gate status

| Gate | Trạng thái | Ghi chú |
|---|---|---|
| G1 | ✅ COMPLETE | lint/typecheck/test/build PASS |
| G2 | ⚠️ CẦN LÀM | Chưa có remote GitHub; cần `git remote add origin <URL>` + push |
| G3 | ✅ COMPLETE | `supabase db reset` + catalog import idempotent |
| G4 | ⚠️ CẦN LÀM | Cloud: Supabase cloud + SMTP/Resend + Vercel chưa cấu hình |
| G5 | ✅ COMPLETE | Restore drill 06/10: docker exec psql → restore_test DB → 11/11 bảng khớp |
| G6 | ✅ COMPLETE | Playwright 12/12 PASS: tạo template → phát hành → tạo form → phát hành → nộp → xem nhãn "Có" → CSV |
| G7 | ✅ COMPLETE | .env.local trong .gitignore |
| G8 | ✅ COMPLETE | mvp-scope.md + test-report.md cập nhật 06/10 |

---

### G5 — Restore drill (06/10/2026)

- Dùng `docker exec -i supabase_db_hiu-youth-e-office psql -U postgres` (không cần `brew install libpq`)
- Schema 255K + data 369K restore vào `restore_test` DB tách biệt
- Lỗi không nghiêm trọng: `supabase_functions.hooks_id_seq` (internal Supabase sequence, không phải public schema)
- Row count: faculties=10, programs=51, classes=347, cohorts=6, accounts=3, forms=2 ✓
- Business query: catalog join, form_template, RPC tồn tại → tất cả đúng
- Đã DROP DATABASE restore_test sau drill

### G6 — Playwright write flow (06/10/2026)

12/12 PASS (chạy 3 lần, ổn định):

1. Template tạo + phát hành qua UI (school_admin)
2. Form tạo + phát hành qua UI (committee_manager)
3. Student nộp phản hồi: chọn radio "Có" → "Đã nộp thành công!"
4. Manager xem bảng responses: "Có" hiển thị (không phải UUID)
5. CSV `fetch()` từ browser context: chứa "Có", header `Bạn có muốn tham gia?`

---

### Bạn cần tự làm

| Gate | Lệnh / Thao tác | Kết quả mong đợi |
|---|---|---|
| **G2 CI** | `git remote add origin <URL>` → `git push -u origin feat/prompt-01-foundation` → mở PR vào `main` | GitHub Actions xanh (lint + typecheck + test + build) |
| **G4 Cloud** | Cấu hình Supabase dashboard: Auth Site URL, Confirm email. Cài SMTP/Resend thật. `vercel link && vercel env pull` → deploy | Đăng ký → Gmail thật xác minh → PIN → profile trên domain thật |

**Note G4:** Mailpit là local-only. Cloud phải kiểm tra email qua SMTP/Resend thật.

**Note CI:** `.github/workflows/ci.yml` chạy `lint + typecheck + test + build` — không chạy `supabase test db` (PostgreSQL không có trong GitHub Actions). pgTAP chỉ xác minh local.
