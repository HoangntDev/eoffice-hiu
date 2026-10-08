# Release checklist — v1.0 LOCAL

Chỉ tag `v1.0-local` khi tất cả ô dưới đây được kiểm tra. G4 cloud/SMTP/domain là giai đoạn triển khai thật sau release local này; không phải điều kiện bắt buộc của v1.0-local.

---

## Use case và bằng chứng nghiệp vụ

- [x] **UC1 — Danh mục và cơ cấu:** 10 Khoa / 51 Ngành / 347 Lớp / 6 Khóa import idempotent. Xem `docs/testing/test-report.md` → CSV-01..04, DB-07.
- [x] **UC2 — Tiếp nhận/công nhận Đoàn viên:** Vòng đời SIGN UP → Gmail verify → PIN → profile → union-app → review → recognized. Xem test-report.md → AUTH-01..11, DB-01..06.
- [x] **UC3 — Thư viện mẫu biểu mẫu:** `school_admin` tạo/sửa/phát hành `form_templates` + versions bất biến. Xem test-report.md → F-DB-09..10, F-E2E-01..02, F-UI-10..11.
- [x] **UC4 — Vòng đời biểu mẫu động:** `committee_manager`/`office` tạo/phát hành/đóng form, audience rule server-side. Xem test-report.md → F-DB-11..13, F-E2E-03..04, F-UI-12..13.
- [x] **UC5 — Thu nhận phản hồi + xuất CSV:** Submit qua RPC, questions_snapshot bất biến, CSV UTF-8 BOM + nhãn tiếng Việt resolved. Xem test-report.md → F-SNAP-01..05, F-E2E-05..08, F-UI-14..21.

## Kiểm thử

- [x] `npm run lint` — 0 errors
- [x] `npm run typecheck` — clean
- [x] `npm test` — 34 Vitest PASS
- [x] `supabase test db` — 41 pgTAP PASS (local only; không chạy trong CI — xem ghi chú CI bên dưới)
- [x] `supabase db lint --local` — no errors
- [x] `npm run build` — PASS (05/10/2026)
- [ ] **CI GitHub Actions xanh** — xem G2 bên dưới

## Kiến trúc và ERD

- [x] `docs/requirements/mvp-scope.md` — UC1..UC5, ERD (Mermaid), API route list, NFR, gate table
- [x] `next.config.ts`, `supabase/config.toml` — cấu hình đơn giản, không config tùy chỉnh phức tạp
- [x] Module: `auth-account`, `organization-catalog`, `student-profile`, `union-membership`, `forms`; `lib/auth` và audit SQL là lớp cắt ngang

## Chạy từ môi trường mới

- [x] `README.md` — yêu cầu (Node.js 24, Docker, Supabase CLI), `npm ci && supabase start && supabase db reset && cp .env.example .env.local && npm run dev`
- [x] `.env.example` — 4 biến, tất cả placeholder rõ ràng, không có giá trị thật
- [x] Bootstrap school admin: `npm run admin:bootstrap -- --user-id <UUID> --confirm`
- [x] Import danh mục: dry-run → apply → idempotent check

## Backup và restore

- [x] `docs/operations/backup-restore.md` — runbook đầy đủ
- [x] Backup artifact: `schema_20261005T223312.sql` (255K) + `data_20261005T223312.sql` (369K) — lưu ngoài repo
- [x] Restore drill: `docker exec -i supabase_db_hiu-youth-e-office psql` → `restore_test` DB → 11/11 bảng khớp (06/10/2026)
- [x] **Giới hạn đã ghi nhận:** Lỗi `supabase_functions.hooks_id_seq does not exist` trong quá trình restore là không nghiêm trọng — đây là sequence internal của stack Supabase không có trong plain PostgreSQL. Public schema restore không bị ảnh hưởng. Drill chưa chạy trên Supabase instance thứ hai (chỉ dùng DB tách biệt trong cùng container); chưa xác minh pgTAP pass sau restore.

## Đóng gói / artifact

- [ ] `git tag v1.0-local` trên `main` sau khi merge và CI main xanh
- [ ] Tag có chú thích release notes (xem phần dưới)
- [ ] **Cần:** PR merged vào `main` → CI main xanh → tag tạo trên `main`

## Release notes (draft)

```
v1.0-local — HIU Youth E-Office — 2026-10

PHẠM VI: Release local. Chưa triển khai cloud/SMTP/domain thật.

Tính năng:
- UC1: Danh mục học vụ (10 Khoa / 51 Ngành / 347 Lớp / 6 Khóa), cơ cấu tổ chức, phân quyền
- UC2: Vòng đời tài khoản MSSV+PIN, xác minh Gmail, hồ sơ Đoàn viên, luồng công nhận
- UC3: Thư viện mẫu biểu mẫu có phiên bản (form_templates + versions bất biến)
- UC4: Biểu mẫu động theo vòng đời draft→published→paused→closed, audience rule đệ quy
- UC5: Thu phản hồi với questions_snapshot bất biến; xuất CSV UTF-8 BOM, nhãn tiếng Việt

Kiểm thử local: 34 Vitest + 41 pgTAP PASS; Playwright 12/12 write-flow PASS.
CI: GitHub Actions lint+typecheck+test+build PASS (G2).

Giới hạn đã biết:
- pgTAP (41 tests) chỉ chạy local; CI không có PostgreSQL.
- G4 cloud (SMTP/Resend, Supabase cloud, Vercel deploy) là giai đoạn tiếp theo.
- Restore drill chưa xác minh pgTAP pass trên instance khôi phục.
```

## Release gate tóm tắt

| Gate | Trạng thái |
|---|---|
| G1 lint/typecheck/test/build | ✅ COMPLETE |
| G2 CI GitHub Actions | ✅ PR run #2 xanh; ⬜ chờ merge và CI trên main |
| G3 db reset idempotent | ✅ COMPLETE |
| G4 cloud smoke test | ➡️ DEFERRAL — giai đoạn sau v1.0-local |
| G5 backup + restore drill | ✅ COMPLETE |
| G6 Playwright write flow | ✅ COMPLETE |
| G7 no secrets in repo | ✅ COMPLETE |
| G8 docs đầy đủ | ✅ COMPLETE |

**Thao tác còn lại để tag v1.0-local:**
1. Rà PR #1 tại `HoangntDev/effice-hiu` và merge vào `main` khi sẵn sàng.
2. Xác minh GitHub Actions trên commit `main` sau merge xanh.
3. Đồng bộ nhánh `main` về máy Mac, xác minh HEAD là commit sau merge.
4. Tạo annotated tag bằng release notes trong mục trên, rồi push tag lên `origin`.
5. Lưu URL tag, commit SHA và CI run vào test report/release evidence.
