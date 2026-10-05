# Kết quả — 06/10/2026

### Gate status (v1.0-local)

| Gate | Trạng thái | Ghi chú |
|---|---|---|
| G1 | ✅ COMPLETE | lint/typecheck/test/build PASS local |
| G2 | ⚠️ CẦN LÀM | Chưa có remote GitHub — xem thao tác dưới |
| G3 | ✅ COMPLETE | `supabase db reset` + catalog import idempotent |
| G4 | ➡️ DEFERRED | Cloud/SMTP/Vercel — giai đoạn sau v1.0-local; không phải điều kiện bắt buộc |
| G5 | ✅ COMPLETE | Restore drill 06/10: docker exec psql → restore_test DB → 11/11 bảng khớp |
| G6 | ✅ COMPLETE | Playwright 12/12 PASS: tạo template → phát hành → tạo form → phát hành → nộp → nhãn "Có" → CSV |
| G7 | ✅ COMPLETE | Rà secret 06/10: .env.local chưa commit; migrations dùng service_role là Postgres role; .env.example chỉ có placeholder |
| G8 | ✅ COMPLETE | release-checklist-v1.0-local.md, mvp-scope, test-report, backup-restore cập nhật 06/10 |

**Blocker duy nhất:** G2 — cần tạo repo GitHub private + push + CI xanh + merge + tag.

---

### Thao tác bạn cần làm để tag v1.0-local

1. Tạo repo GitHub **private** tên `hiu-youth-e-office`
2. Chạy trong terminal:
   ```bash
   git remote add origin https://github.com/<USERNAME>/hiu-youth-e-office.git
   git push -u origin feat/prompt-01-foundation main
   ```
3. Mở PR `feat/prompt-01-foundation → main` trên GitHub
4. Chờ CI xanh (Actions: lint + typecheck + test + build)
5. Merge PR
6. Gửi cho tôi URL repo → tôi sẽ tag `v1.0-local`

---

### Chi tiết các gate đã hoàn thành

**G5 — Restore drill (06/10/2026)**
- Tool: `docker exec -i supabase_db_hiu-youth-e-office psql -U postgres` (không cần brew install libpq)
- Schema 255K + data 369K → `restore_test` DB tách biệt → DROP sau drill
- Lỗi không nghiêm trọng: `supabase_functions.hooks_id_seq` (internal Supabase sequence, public schema không bị ảnh hưởng)
- 11/11 bảng khớp: faculties=10, programs=51, classes=347, cohorts=6, accounts=3, forms=2 ✓

**G6 — Playwright write flow (06/10/2026)**
- 12/12 PASS (ổn định qua 3 lần chạy)
- school_admin tạo + phát hành template; committee_manager tạo + phát hành form
- Student nộp phản hồi "Có" → manager thấy "Có" trong bảng → CSV header `Bạn có muốn tham gia?`

**G7 — Secret scan (06/10/2026)**
- `.env.local`: chưa bao giờ commit; `.env*` trong .gitignore từ commit đầu
- `.env.example`: chỉ chuỗi `replace-with-...`
- Migrations: `service_role` là tên PostgreSQL role trong `GRANT`, không phải key
- `config.toml`: không có jwt_secret hay key value
- `git log -S "AUTH_RATE_LIMIT_PEPPER="`: chỉ tìm thấy commit tạo .env.example placeholder

**CI (06/10/2026)**
- `.github/workflows/ci.yml` cập nhật: thêm env placeholder cho CI build
- Ghi rõ: `supabase test db` (41 pgTAP) chạy local only — PostgreSQL không có trong GitHub Actions

---

### Tài liệu liên quan

- [Release checklist v1.0-local](docs/operations/release-checklist-v1.0-local.md)
- [MVP scope + gate table](docs/requirements/mvp-scope.md)
- [Test report](docs/testing/test-report.md)
- [Backup/restore runbook](docs/operations/backup-restore.md)
