# Kết quả — 13/10/2026 (UC6: Quản lý kế hoạch chương trình sự kiện)

Nhánh: `feat/event-program-plans` (chưa push, chưa PR, chưa deploy, không gọi là release).

### Use case nghiệp vụ đã chạy đầu cuối (không tính sign up/in/out)

| UC | Nội dung | Bằng chứng |
|---|---|---|
| UC1 | Danh mục học vụ + cơ cấu tổ chức | CSV-01…04, DB-07, UI-01 (test-report) |
| UC2 | Tiếp nhận/công nhận hồ sơ Đoàn viên | DB-03…05, pgTAP 002 |
| UC3 | Thư viện mẫu theo đối tượng | F-DB-09/10, F-E2E-01/02, G6 F-UI-10/11 |
| UC4 | Vòng đời biểu mẫu động | F-E2E-03/04/12, G6 F-UI-12/13 |
| UC5 | Thu nhận phản hồi + CSV | F-E2E-05…08, F-SNAP-01…05, G6 F-UI-14…21 |
| **UC6** | **Kế hoạch chương trình: Đoàn Khoa lập → PDF đã ký → Văn phòng duyệt/yêu cầu sửa/từ chối** | **pgTAP 33, unit 18, E2E HTTP 28, browser 14 — tất cả PASS** |

### UC6 — đã làm

| Hạng mục | Chi tiết |
|---|---|
| Migration | `202610130001_event_program_plans.sql`: `event_programs`, `event_program_documents`, `event_program_history` (append-only), 4 RPC, RLS, bucket riêng tư `event-program-plans` + storage policy |
| Trạng thái | `draft → submitted → (needs_changes → submitted)* → approved \| rejected` |
| Quyền | Đoàn Khoa chỉ trong Khoa mình; Văn phòng/Đoàn Trường xét; không tự duyệt hồ sơ mình nộp; sinh viên chỉ thấy chương trình `approved` |
| Server check | Đủ 7 trường + PDF mới được gửi; PDF ≤ 5MB, đúng đuôi/MIME/magic `%PDF-`, SHA-256; lý do ≥ 10 ký tự khi từ chối/yêu cầu sửa |
| Logging | `src/lib/log.ts` JSON + `x-request-id`, nối với `audit_events.request_id` |
| UI | `/programs`, `/programs/new`, `/programs/[id]` |
| Tài liệu | `docs/requirements/event-programs.md`, test-report mục UC6 |

### Kết quả lệnh

| Lệnh | Kết quả |
|---|---|
| typecheck | ✅ PASS |
| ESLint file UC6 | ✅ PASS |
| `npm run lint` toàn repo | ❌ 10 lỗi **có sẵn** trong `account-security-panel.tsx`, `union-application-form.tsx` (WIP UI chưa commit) |
| vitest | 48/52 — 4 fail **có sẵn** trong `auth-ui.test.tsx`, `validation.test.ts` (WIP UI chưa commit) |
| pgTAP | ✅ 74/74 |
| build | ✅ PASS |

### Rủi ro / việc còn lại

- Storage local `storage-api v1.79.36` lỗi `42P10` khi upload (index thiếu `COLLATE "C"`); đã thêm index workaround **chỉ ở local**. Cần kiểm lại trên cloud.
- Chưa chạy `supabase db reset` từ đầu (giữ dữ liệu local). 4 migration 202610090012/202610100001-3 đã apply tay nhưng chưa ghi `schema_migrations`.
- WIP UI/CSV ngày 09–10/10 vẫn chưa commit, gây đỏ lint/test toàn repo → cần sửa trước khi mở PR.

---

# Kết quả — 10/10/2026 (dữ liệu nguồn CSV + UI trước đó)

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

### UI Redesign — 09/10/2026

| Thay đổi | Chi tiết |
|---|---|
| Palette | Xanh Đoàn Thanh niên: `--blue #0055b3`, dark `#003380`, tint `#eef4fc` |
| Header | Hai tầng: brand bar (navy) + nav bar (blue) — giống vanphong.tuoitreiuh.vn |
| `page.tsx` | Portal layout: banner strip + sidebar (chức năng/liên kết) + content (cards + hướng dẫn) |
| `globals.css` | Portal utilities: `.portal-*`, `.sidebar-*`, `.guide-list` — bỏ dark hero/CTA strip quảng cáo |
| Buttons nội bộ | `.button.primary` → xanh solid; `.button.secondary` → tint border |
| Typography | Font size nhỏ hơn (14px base), spacing compact hơn — phù hợp giao diện văn phòng |

---

### Fix email xác thực — 09/10/2026

| Vấn đề | Root cause | Trạng thái |
|---|---|---|
| Email link `redirect_to` sai (port 3000, không có `/auth/confirm`) | `site_url = "http://127.0.0.1:3000"` trong `config.toml` → Supabase dùng site_url thay vì `emailRedirectTo` | ✅ Fixed |
| **Fix áp dụng** | `site_url` → `"http://localhost:3001"` + restart Supabase | ✅ |
| **Verify** | Email mới có `redirect_to=http://localhost:3001/auth/confirm?flow=signup` | ✅ |
| **Để test đầy đủ** | Mở `/register` trên browser thật → nhập MSSV + Gmail → check Mailpit → bấm link | ⏳ Chờ user test |

---

### Cập nhật dữ liệu nguồn CSV — 10/10/2026

Migrations mới:
- `supabase/migrations/202610100001_reference_options_source_data.sql`
- `supabase/migrations/202610100002_reference_options_ward.sql`

| Category | Rows cũ | Rows mới | Nguồn |
|---|---|---|---|
| `ethnicity` | 54 (placeholder UBDT) | **61** | `[YUM] CẢM TÌNH ĐOÀN - DAN_TOC.csv` |
| `religion` | 16 (placeholder Ban TGCP) | **14** | `[YUM] CẢM TÌNH ĐOÀN - TON_GIAO.csv` |
| `province` | 63 (toàn quốc ĐVHCVN) | **34** | `[YUM] CẢM TÌNH ĐOÀN - DIA_CHI.csv` (sinh viên HIU) |

Thay đổi đáng chú ý:
- **Phường/xã**: text input → dropdown lọc theo tỉnh đã chọn; thêm cột `parent_code` vào `reference_options`; seed 3321 phường/xã từ `DIA_CHI.csv`; `WardSelect` component tự reset khi đổi tỉnh; disabled khi chưa chọn tỉnh


- Ethnicity: thêm Cadong, Cao Lan, Jarai/Jrai, Mèo, Sán Chỉ, T'Rin, Không xác định; bỏ Khmer/H'Mông/Gia Rai (đã thay bằng Khơ Me/Mông/Jarai theo CSV)
- Religion: bỏ Cơ Đốc Phục Lâm, Hội Thánh Chúa Giê-su, Khác; thêm Bà La Môn; "Không (không tôn giáo)" → "Không"
- Province: 63 tỉnh toàn quốc → 34 tỉnh có trong dữ liệu thực tế sinh viên HIU; codes vẫn dùng mã ĐVHCVN; "Thành phố Huế" (code 46) thay "Thừa Thiên Huế"
- DB đã apply: DELETE 133, INSERT 109 ✅

---

### Import mẫu Cảm tình Đoàn — 10/10/2026

| Thay đổi | Chi tiết |
|---|---|
| Migration mới | `supabase/migrations/202610100003_seed_camtinh_doan_template.sql` |
| Template seed | "Đăng ký Lớp bồi dưỡng nhận thức Đoàn TNCS Hồ Chí Minh" — 19 câu hỏi, status=published, v1 |
| DB | INSERT 1 form_template + 1 form_template_version (19 questions) ✅ |
| Prefill mở rộng | `page.tsx` bổ sung: gender, class_code, faculty_name, program_name, cohort_code từ current_academic_catalog |

Câu hỏi trong template:

| # | Label | Loại | Prefill |
|---|---|---|---|
| 1 | Họ và tên | short_text | profile.full_name |
| 2 | Mã số sinh viên | short_text | profile.student_code |
| 3 | Số điện thoại | short_text | profile.phone |
| 4 | Giới tính | single_choice (Nam/Nữ/Khác) | profile.gender |
| 5 | Ngày sinh | date | — |
| 6 | Dân tộc | dropdown (61 mục DAN_TOC) | — |
| 7 | Tôn giáo | dropdown (14 mục TON_GIAO) | — |
| 8 | Số CCCD | short_text | — |
| 9 | Ngày cấp CCCD | date | — |
| 10 | Nơi cấp CCCD | short_text | — |
| 11 | Quê quán — Tỉnh/thành | short_text | — |
| 12 | Quê quán — Phường/xã | short_text | — |
| 13 | Thường trú — Tỉnh/thành | short_text | — |
| 14 | Thường trú — Phường/xã | short_text | — |
| 15 | Khoa | short_text | profile.faculty_name |
| 16 | Ngành học | short_text | profile.program_name |
| 17 | Lớp | short_text | profile.class_code |
| 18 | Khóa | short_text | profile.cohort_code |
| 19 | Nguyện vọng / Lý do | long_text | — |

**Lưu ý:** Migration dùng DO block — bỏ qua nếu `accounts` trống (supabase db reset trước khi đăng ký). Để tạo form thật từ template này: vào `/forms/templates` → tìm template → tạo form mới với lịch cụ thể (ca đăng ký, ngày mở/đóng).

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
