# Kết quả — 06/10/2026

### Gate status (v1.0-local)

| Gate | Trạng thái | Ghi chú |
|---|---|---|
| G1 | ✅ COMPLETE | lint/typecheck/test/build PASS local |
| G2 | ✅ PR CI XANH; MAIN CHỜ MERGE | PR #1: CI run #2 thành công; cần merge và xác minh CI trên main |
| G3 | ✅ COMPLETE | `supabase db reset` + catalog import idempotent |
| G4 | ➡️ DEFERRED | Cloud/SMTP/Vercel — giai đoạn sau v1.0-local |
| G5 | ✅ COMPLETE | Restore drill 06/10: docker exec psql → restore_test DB → 11/11 bảng khớp |
| G6 | ✅ COMPLETE | Playwright 12/12 PASS: tạo template → phát hành → tạo form → phát hành → nộp → nhãn "Có" → CSV |
| G7 | ✅ COMPLETE | Secret scan 06/10: .env.local chưa commit; migrations dùng service_role là Postgres role; .env.example chỉ có placeholder |
| G8 | ✅ COMPLETE | release-checklist-v1.0-local.md, mvp-scope, test-report, backup-restore cập nhật 06/10 |

---

### GitHub

| | |
|---|---|
| Repo | https://github.com/HoangntDev/effice-hiu (private) |
| PR #1 | https://github.com/HoangntDev/effice-hiu/pull/1 — `feat/prompt-01-foundation → main` |
| CI | ✅ PR run #2 thành công (lint + typecheck + test + build); CI trên main chờ merge |

---

### Bước tiếp theo để tag v1.0-local

1. ✅ CI xanh trên PR #1 (run #2)
2. Merge PR #1
3. `git tag -a v1.0-local` trên `main`
4. `git push origin v1.0-local`

---

### Chi tiết các gate đã hoàn thành

**G5 — Restore drill (06/10/2026)**
- Tool: `docker exec -i supabase_db_hiu-youth-e-office psql -U postgres`
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

**CI workflow (06/10/2026)**
- `.github/workflows/ci.yml`: thêm env placeholder cho CI build
- `supabase test db` (41 pgTAP) chạy local only — không có trong CI

---

### Tài liệu liên quan

- [Release checklist v1.0-local](docs/operations/release-checklist-v1.0-local.md)
- [MVP scope + gate table](docs/requirements/mvp-scope.md)
- [Test report](docs/testing/test-report.md)
- [Backup/restore runbook](docs/operations/backup-restore.md)
