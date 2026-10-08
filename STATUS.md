# Kết quả — 09/10/2026

### ✅ v1.0-local RELEASED

Tag: `v1.0-local` trên `main` — https://github.com/HoangntDev/eoffice-hiu/releases/tag/v1.0-local

---

### Gate status (v1.0-local) — TẤT CẢ HOÀN THÀNH

| Gate | Trạng thái | Ghi chú |
|---|---|---|
| G1 | ✅ COMPLETE | lint/typecheck/test/build PASS local |
| G2 | ✅ COMPLETE | CI main xanh trong 54s — run #37826633229 |
| G3 | ✅ COMPLETE | `supabase db reset` + catalog import idempotent |
| G4 | ➡️ DEFERRED | Cloud/SMTP/Vercel — giai đoạn sau v1.0-local |
| G5 | ✅ COMPLETE | Restore drill: docker exec psql → restore_test DB → 11/11 bảng khớp |
| G6 | ✅ COMPLETE | Playwright 12/12 PASS: write flow đầy đủ qua UI |
| G7 | ✅ COMPLETE | Secret scan: .env.local chưa commit; migrations dùng service_role là Postgres role |
| G8 | ✅ COMPLETE | release-checklist, mvp-scope, test-report, backup-restore đầy đủ |

---

### GitHub

| | |
|---|---|
| Repo | https://github.com/HoangntDev/eoffice-hiu (private) |
| Tag v1.0-local | https://github.com/HoangntDev/eoffice-hiu/releases/tag/v1.0-local |
| PR #1 | https://github.com/HoangntDev/eoffice-hiu/pull/1 — merged |
| CI main | ✅ https://github.com/HoangntDev/eoffice-hiu/actions/runs/37826633229 (54s) |

---

### Giai đoạn tiếp theo (sau v1.0-local)

| Việc | Mô tả |
|---|---|
| **G4 Cloud** | Supabase cloud + SMTP/Resend + Vercel deploy + smoke test Gmail thật |
| **INC-01** | Ghi nhận sau sự kiện thật đầu tiên (chưa bắt đầu) |
| **CR-01** | Cần giảng viên chấp thuận trước khi thực hiện |

---

### Tài liệu

- [Release checklist v1.0-local](docs/operations/release-checklist-v1.0-local.md)
- [MVP scope + ERD](docs/requirements/mvp-scope.md)
- [Test report](docs/testing/test-report.md)
- [Backup/restore runbook](docs/operations/backup-restore.md)
