# Cập nhật — 13/10/2026 lượt 2 (ổn định UC6)

Nhánh `feat/event-program-plans`. Không push, merge, deploy, db reset; không đụng cloud.

| Việc | File | Nguyên nhân / thay đổi | Kiểm tra |
|---|---|---|---|
| Chỉ Văn phòng xét duyệt | `202610130001_event_program_plans.sql` (`event_program_reviewer_grant`), `modules/event-programs/viewer.ts`, `tests/005` (+2), docs | Bản trước cho `school_admin` quyền tương đương. Nay chỉ role `office` trên đơn vị `office`; `school_admin` không duyệt và không thấy hồ sơ đang chờ | pgTAP 005: 35/35 PASS |
| 9 lỗi lint | `components/account-security-panel.tsx` | `onChange={handleChange(...)}` gọi factory ngay lúc render → React Compiler coi truy cập ref là trong render. Đổi sang `onChange={(e) => handleChange(e, …)}`, hành vi giữ nguyên | lint PASS |
| 1 lỗi lint | `components/union-application-form.tsx` (`WardSelect`) | `setState` trong `useEffect` để reset phường khi đổi tỉnh → đổi sang so sánh prop trước đó trong render | lint PASS |
| 3 test UI fail | `tests/auth-ui.test.tsx` | Test cũ theo UI trước redesign (nhãn "Gmail", "PIN" cùng màn). Viết lại theo luồng WIP: đăng nhập 2 bước MSSV → PIN, ô PIN dạng chấm; giữ ý định (đăng ký không hỏi PIN, đăng nhập không hỏi email, đổi PIN phải qua PIN hiện tại) | 4/4 PASS |
| 1 test validation fail + **lỗi thật** | `supabase/migrations/202610130002_student_email_domain.sql` (mới), `tests/validation.test.ts`, `supabase/tests/002`, `003` (+2) | WIP yêu cầu `@student.hiu.vn` nhưng DB chỉ nhận `@gmail.com` → đăng ký qua UI luôn lỗi. **Người dùng chọn chuyển sang `@student.hiu.vn`** (thay quy tắc Gmail của Prompt 01). Migration đổi 3 CHECK (NOT VALID, giữ tài khoản Gmail cũ) + `reserve_account_registration` kiểm số email khớp MSSV (3 số đầu + 4 số cuối) | vitest 11/11, pgTAP 002+003 PASS |
| Storage `42P10` | chỉ DB local | **Đã xác minh:** `storage-api v1.72.1` (05/10) tạo `idx_objects_current_version` không `COLLATE "C"`; `v1.79.36` (09/10) đổi nội dung cùng migration 0066 thành có `COLLATE "C"` nhưng không chạy lại → code mới dùng `ON CONFLICT … COLLATE "C"` không khớp. Đã thay index local bằng đúng định nghĩa upstream (bỏ index vá tạm) | `ON CONFLICT` thử trong transaction: OK |
| Lịch sử migration | — | 4 migration `202610090012`, `202610100001`–`0003` (+ `202610130001`, `202610130002` của UC6) có hiệu lực trong DB nhưng chưa có trong `schema_migrations` vì apply tay bằng psql | Chưa sửa (xem tồn đọng) |

**Lệnh cuối:** `npm run lint` PASS · `tsc --noEmit` PASS.

**Commit:** chỉ commit phần UC6 (quyền Văn phòng + docs). Migration email, sửa lint 2 file WIP và test auth/validation/002/003 **để chưa commit cùng WIP UI**, vì chúng phụ thuộc WIP (commit riêng sẽ làm CI đỏ).

**Tồn đọng:**
1. Commit WIP UI + migration email + test liên quan thành một commit/PR riêng.
2. Đồng bộ lịch sử migration local: `supabase migration repair --status applied 202610090012 202610100001 202610100002 202610100003 202610130001 202610130002 --local` (chỉ ghi metadata, không chạy SQL); sau đó thử `db reset` ở lượt riêng để kiểm áp từ đầu. Lưu ý: `202610100001` xóa rồi seed lại `reference_options`, không idempotent; `202610100003` bỏ qua seed template nếu `accounts` trống.
3. Tài khoản test cũ dùng Gmail vẫn đăng nhập được (constraint NOT VALID); tài khoản mới phải dùng `@student.hiu.vn`. Cần cập nhật Prompt/tài liệu yêu cầu cho quyết định đổi email.
4. Trước PR: một lượt kiểm tra toàn repo (vitest toàn bộ, pgTAP toàn bộ, build, Playwright).

---

# Kết quả — 13/10/2026 (UC6: Quản lý kế hoạch chương trình sự kiện)

UC6 đã chạy trọn luồng ở local và qua toàn bộ test đã viết. Code nằm trên nhánh `feat/event-program-plans` (3 commit: `e122b81` DB, `8947553` UI/API, `cec202f` docs). **Chưa push, chưa PR, chưa deploy, không gọi là release v1.0.**

## 1. Use case nghiệp vụ đã chạy đầu cuối (không tính sign up/in/out)

| UC | Nội dung | Bằng chứng (`docs/testing/test-report.md`) |
|---|---|---|
| UC1 | Danh mục học vụ + cơ cấu tổ chức | CSV-01…04, DB-07, UI-01 |
| UC2 | Tiếp nhận, công nhận hồ sơ Đoàn viên | DB-03…05, pgTAP 002 |
| UC3 | Thư viện mẫu theo đối tượng | F-DB-09/10, F-E2E-01/02, Playwright F-UI-10/11 |
| UC4 | Vòng đời biểu mẫu động | F-E2E-03/04/12, F-UI-12/13 |
| UC5 | Thu nhận phản hồi + xuất CSV | F-E2E-05…08, F-SNAP-01…05, F-UI-14…21 |
| **UC6** | **Kế hoạch chương trình (lượt này)** | **pgTAP 33, unit 18, E2E HTTP 28, browser 14: tất cả PASS** |

## 2. UC6 — đã làm

| Hạng mục | Chi tiết |
|---|---|
| Migration | `202610130001_event_program_plans.sql`: `event_programs`, `event_program_documents` (mỗi lần tải là bản mới + SHA-256), `event_program_history` (append-only, snapshot tên + vai trò người thao tác), 4 RPC, RLS, bucket riêng tư `event-program-plans` (5MB, chỉ PDF) + storage policy |
| Quyền | Đoàn Khoa (`faculty_manager`/`faculty_executive` trên `faculty_union`) chỉ trong Khoa mình; **chỉ Văn phòng (`office`) xét duyệt** (lượt 2: bỏ quyền mặc nhiên của `school_admin`); không tự duyệt hồ sơ mình nộp; sinh viên chỉ thấy chương trình `approved` |
| Kiểm tra ở server | Đủ 7 trường (nội dung, địa điểm, bắt đầu, kết thúc, số người, số kế hoạch, ngày ký) + PDF mới được gửi; PDF ≤ 5MB, đúng đuôi/MIME/magic `%PDF-`; lý do ≥ 10 ký tự khi từ chối/yêu cầu sửa |
| Logging | `src/lib/log.ts` log JSON + `x-request-id`, lưu cả vào `audit_events.request_id` |
| UI | `/programs` (hàng đợi Văn phòng, kế hoạch của Khoa, danh sách đã chấp thuận), `/programs/new`, `/programs/[id]` |
| Tài liệu | `docs/requirements/event-programs.md` (quy tắc, quyền, sơ đồ trạng thái, luồng dữ liệu, ERD, API, NFR), test-report mục UC6, mvp-scope |

## 3. Kết quả kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| pgTAP (`supabase test db`) | ✅ 74/74 (41 cũ + 33 mới) |
| Vitest UC6 | ✅ 18/18 |
| E2E HTTP qua 4 vai trò | ✅ 28/28; PDF tải về có SHA-256 trùng bản gốc; `request_id` trong log khớp `audit_events` |
| Browser (Chrome headless, thao tác UI thật) | ✅ 14/14, gồm màn hình 390px không cuộn ngang |
| typecheck, build | ✅ PASS, kể cả trên cây commit sạch giống CI (vitest 52/52, ESLint 0 lỗi) |
| `npm run lint` toàn repo | ❌ 10 lỗi **có sẵn** trong `account-security-panel.tsx`, `union-application-form.tsx` (WIP UI chưa commit 09–10/10) |
| vitest toàn repo (working tree) | 48/52 — 4 fail **có sẵn** trong `auth-ui.test.tsx`, `validation.test.ts` (WIP UI chưa commit) |

Expected/actual tiêu biểu:

| Kịch bản | Expected | Actual |
|---|---|---|
| Đoàn Khoa B sửa hồ sơ Khoa A | 403 | 403 |
| Sinh viên duyệt | 403 | 403 |
| Gửi khi chưa có PDF | 422 | 422 |
| Tệp DOCX đổi đuôi `.pdf` | 422 | 422 |
| Văn phòng tự duyệt hồ sơ mình nộp | `SELF_REVIEW_FORBIDDEN` | đúng |
| Nộp lại sau yêu cầu chỉnh sửa | cùng id, `submission_count = 2` | đúng |

**Test đã bắt được 3 lỗi thật:**
- Lỗi SQL trong RPC gửi kế hoạch: `text[] || 'summary'` bị hiểu thành array literal → sửa bằng `array_append`.
- Một test pgTAP không cô lập dữ liệu (đếm toàn bảng) → sửa test.
- Lỗi môi trường Storage local: `storage-api v1.79.36` báo `42P10` với mọi upload do index nội bộ thiếu `COLLATE "C"` → tạo index workaround `idx_objects_current_version_c` **chỉ trên DB local** (không đưa vào migration; sẽ mất nếu `db reset`).

## 4. Luồng dữ liệu (để học và thuyết trình)

```
draft ──gửi──▶ submitted ──VP chấp thuận──▶ approved
  ▲               │ └──VP từ chối (lý do)──▶ rejected
  └─sửa tiếp──────┴──VP yêu cầu sửa (lý do)──▶ needs_changes ──nộp lại──▶ submitted
```

Ví dụ khi Đoàn Khoa tải PDF:
1. Trình duyệt gửi tệp lên Route Handler.
2. Route Handler kiểm tra tệp (≤ 5MB, đúng đuôi, đúng MIME, 5 byte đầu là `%PDF-`) và tính SHA-256.
3. Tệp được upload vào Storage bằng chính session người dùng, nên policy Storage tự chặn Khoa khác.
4. RPC `attach_event_program_document` khóa dòng hồ sơ, kiểm tra quyền, trạng thái và tệp đã tồn tại, rồi ghi tài liệu, lịch sử và audit trong một transaction.

Ba lớp bảo vệ:
- **Zod** kiểm tra định dạng dữ liệu đầu vào.
- **RPC** kiểm tra quyền và chuyển trạng thái, có khóa dòng (`for update`) để tránh hai người thao tác cùng lúc.
- **RLS + thu hồi INSERT/UPDATE/DELETE** chặn mọi đường ghi trực tiếp vào bảng.

Nút bấm trên UI chỉ là gợi ý; quyền thật luôn được kiểm tra ở server.

## 5. Quyết định cần xác nhận

- **Quy trình ký:** tài liệu chỉ ghi Văn phòng "kiểm tra kế hoạch đã ký" (Q&A 12.2), nên hệ thống bắt buộc **Số kế hoạch + Ngày ký + PDF**. Không xác minh chữ ký số; Văn phòng đối chiếu bằng mắt.
- ~~Đoàn Trường cũng được xét duyệt~~ → đã đổi ở lượt 2: chỉ Văn phòng.
- **Không dùng hệ thống biểu mẫu động:** kế hoạch là thực thể có trường cố định kèm PDF.
- Ngoài phạm vi lượt này: QR điểm danh, điểm rèn luyện, mượn phòng.

## 6. Chưa kiểm thử

- `supabase db reset` từ đầu (chưa chạy để giữ dữ liệu local). 4 migration `202610090012`, `202610100001`–`0003` đã apply tay nhưng chưa ghi `schema_migrations`.
- Storage trên Supabase cloud.
- Xem PDF trực tiếp trong trình duyệt (mới kiểm tra SHA-256 khi tải về).

## 7. Dữ liệu test local

Tài khoản thêm (PIN 123456, Gmail `e2e.*@gmail.com`): `2026990004` BCH Đoàn Khoa CNKT, `2026990005` BCH Đoàn Khoa Dược, `2026990006` Văn phòng. Tài khoản cũ: `2026990001` school_admin, `2026990002` committee_manager, `2026990003` sinh viên.

## 8. Bước tiếp theo

1. Sửa và commit phần WIP UI để lint/test toàn repo xanh.
2. Chạy `supabase db reset` để kiểm tra áp migration từ đầu (cần tạo lại index workaround Storage và tài khoản test sau reset).
3. Push nhánh, mở PR, chờ CI xanh rồi merge.
4. G4 cloud (Supabase cloud + SMTP + Vercel), kiểm lại Storage trên cloud.

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
