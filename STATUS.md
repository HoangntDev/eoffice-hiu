# Cập nhật — 16/10/2026 (UC7: sửa theo review PR #3)

**Trạng thái:**
- PR #3 (`feat/program-registrations`). Commit mới `d4c92af`, đã push.
- CI của PR sẽ chạy toàn repo sau lần push này; mình không xem được kết quả vì máy không có `gh`.
- **Chưa merge.** Chưa đụng Supabase cloud.

## Đã sửa
1. **Học kỳ cấu hình được** (migration `202610150002_academic_terms_reputation_pool.sql`, đã áp lên DB local bằng `migration up`):
   - Bỏ `semester_key_for` (HK1 tháng 8–12, HK2 tháng 1–5, HK3 tháng 6–7).
   - Thêm bảng `academic_terms`: năm học, mã, tên, ngày bắt đầu, ngày kết thúc. Hai học kỳ không được chồng ngày.
   - Sổ uy tín gắn `term_id`. Chưa có học kỳ bao trùm thời điểm xét thì không tính khoản trừ.
   - **Quyết định (ghi trong `docs/requirements/program-registrations.md`):** UC7 vẫn cần học kỳ, vì điểm reset theo học kỳ và BTC xét theo học kỳ hiện tại. Nhưng UC7 chỉ đọc; màn hình và quyền cấu hình học kỳ thuộc UC điểm danh/uy tín. Hiện chỉ ghi được bằng `service_role`/SQL.
2. **Lý do duyệt ngoại lệ chỉ khi cùng suất:**
   - Chỉ bắt buộc khi người điểm cao hơn đang chờ được xếp vào đúng suất người được duyệt sẽ chiếm (cùng nhóm chỉ tiêu, hoặc cùng chỉ tiêu chung).
   - Người thuộc nhóm khác còn chỗ, hoặc không thể nhận suất đó, không tính.
   - Danh sách BTC có cột "Suất / gợi ý" và xếp hạng gợi ý theo từng suất.
3. **Lỗi hiển thị** phát hiện khi xem ảnh chụp luồng UI: lặp chữ "Khoa Khoa"; checkbox bị kéo rộng.

## Kết quả chạy thật
| Kiểm thử | Kết quả |
|---|---|
| pgTAP `007` (+17 assertion cho học kỳ cấu hình và cạnh tranh cùng suất) | 67/67 PASS |
| Vitest `program-registrations` | 15/15 PASS |
| Luồng UI trên Chrome: BTC cấu hình/mở → 2 SV đăng ký → BTC duyệt/hết chỗ/từ chối → SV xem kết quả → CSV | 15/15 PASS (2 lần, 2 chương trình) |
| Lint, typecheck toàn repo (1 lần) | PASS |

## Giới hạn còn lại
- Chưa có màn hình quản lý học kỳ và chưa có luồng ghi sổ uy tín (UC sau). Hiện mọi sinh viên 100 điểm trừ khi có dữ liệu chèn bằng SQL.
- Phải đóng đăng ký mới sửa được cấu hình. Người bị từ chối không đăng ký lại được. Văn phòng không xem danh sách đăng ký của Khoa.
- Script UI nằm ở scratchpad, không commit. Luồng UI để lại dữ liệu đăng ký thử trên 2 chương trình CNKT trong DB local (không có trong repo).
- Chưa chạy lại Playwright/pgTAP UC6, chưa chạy toàn bộ Vitest/build ở máy local, chưa chạy lại script tranh chấp. Phần duyệt chỉ đổi điều kiện so sánh; cơ chế khóa giữ nguyên.

## Bạn cần làm
- Xem CI của PR #3 sau lần push này. Chỉ merge khi xanh.

---

# Cập nhật — 15/10/2026 (UC7 đăng ký tham gia chương trình)

**Trạng thái:**
- Nhánh `feat/program-registrations` tạo từ `main` mới nhất (sau khi PR #2 UC6 đã merge), đã push. Commit tính năng: `c1f40fb`.
- **Chưa mở PR** vì máy không có `gh`, nên **CI chưa chạy**.
- Chưa merge, chưa đụng Supabase cloud.
- Không gọi đây là CR-01 hoặc v1.1.

## Đã làm
- **Migration `202610150001_program_registrations.sql`** (đã áp lên DB local chính bằng `supabase migration up --local`; dữ liệu cũ giữ nguyên):
  - Bảng `program_registration_settings`, `program_registration_quotas`, `program_registrations`, `program_registration_history` (append-only), `reputation_adjustments` (sổ uy tín nội bộ).
  - RPC `save_program_registration_settings`, `set_program_registration_status`, `register_for_program`, `decide_program_registration`, `program_registration_summary`, `list_program_registrations`.
  - Mọi thao tác chiếm chỗ đều khóa hàng cấu hình `FOR UPDATE`.
  - Tái sử dụng `forms`/`form_responses`: thân `submit_form_response` cũ chuyển sang `submit_form_response_internal`. Mẫu đã gắn chương trình không nhận phản hồi rời.
  - `evaluate_audience_rule` thêm loại `major` (ngành). Điều kiện Đoàn viên giờ chỉ tính người có `status = 'recognized'`; trước đây tính cả người đã bị thu hồi.
- **API:**
  - `PUT /api/event-programs/{id}/registration`
  - `POST …/registration/status`
  - `GET|POST …/registrations`
  - `POST …/registrations/{rid}/decision`
  - `GET …/registrations/export?status=`
- **Giao diện:**
  - Phần "Đăng ký tham gia" trên `/programs/{id}`: BTC cấu hình, mở và đóng đăng ký; sinh viên xem điều kiện, điền mẫu (dùng lại `FormViewer`) và xem kết quả.
  - Trang `/programs/{id}/registrations`: BTC duyệt hoặc từ chối, xem gợi ý theo uy tín và lịch sử, xuất CSV.
- **Tài liệu:**
  - `docs/requirements/program-registrations.md` (mới)
  - UC7 trong `mvp-scope.md`
  - Mục UC7 trong `docs/testing/test-report.md`

## Kết quả chạy thật
| Kiểm thử | Kết quả |
|---|---|
| pgTAP `007_program_registrations.sql` (sai quyền/đơn vị, chưa duyệt, sai đối tượng, trùng, nhóm chỉ tiêu, chuyển chỉ tiêu dư, lý do duyệt ngoại lệ, riêng tư uy tín, mẫu, audit) | 50/50 PASS |
| pgTAP hồi quy `004_forms`, `002_authorization_workflow` | 24/24 PASS |
| `scripts/race-program-registration.sh` trên stack tách biệt `uc7-race` (19/19 migration chạy từ đầu, đã gỡ) | 7/7 PASS: 20 phiên tranh 5 chỗ → đúng 5; 5 lần gửi trùng đồng thời → 1 bản ghi; 2 BTC duyệt suất cuối → 1 được, phiên sau chờ khóa rồi `QUOTA_FULL` |
| Vitest `program-registrations` + `forms-validation` | 31/31 PASS |
| Lint, typecheck toàn repo (1 lần) | PASS |

## Chưa làm / chưa chạy
- Chưa kiểm thử UI UC7 trên trình duyệt hay qua E2E HTTP; mới qua typecheck và lint. Toàn bộ Vitest và build để CI chạy.
- Chưa chạy lại Playwright, test UC6 và pgTAP 001/003/005/006.
- Chưa chạy đối chứng âm: bỏ khóa để chứng minh script phát hiện vượt chỉ tiêu.
- Điểm uy tín: chưa có luồng ghi. Việc trừ 5 điểm và hoàn điểm thuộc UC điểm danh/nghiệm thu, nên hiện mọi sinh viên có 100 điểm.
- Giả định học kỳ cần xác nhận: HK1 tháng 8–12, HK2 tháng 1–5, HK3 tháng 6–7.
- Giới hạn hiện tại:
  - Không sửa cấu hình khi đang mở; phải đóng trước.
  - Người bị từ chối không đăng ký lại được.
  - Văn phòng không xem danh sách đăng ký của Khoa.
  - Phần kiểm tra ngoại lệ uy tín so với mọi người chờ duyệt còn có thể xếp chỗ, kể cả khác nhóm.

## Bạn cần làm
1. Mở PR tại https://github.com/HoangntDev/eoffice-hiu/pull/new/feat/program-registrations (base `main`), dán tiêu đề và nội dung bên dưới. Hoặc chạy `brew install gh && gh auth login` để Claude tự mở PR và theo dõi CI.
2. Chờ CI (lint, typecheck, Vitest toàn repo, build). Chỉ merge khi CI xanh.
3. Xác nhận giả định học kỳ ở trên.

**Tiêu đề PR:** `feat: UC7 đăng ký tham gia chương trình`

**Nội dung PR:**

````markdown
## Tóm tắt
- BTC (Đoàn Khoa sở hữu chương trình đã được Văn phòng duyệt) cấu hình và mở/đóng đăng ký: đối tượng, số chỗ hoặc không giới hạn, nhận theo thứ tự hoặc xét duyệt, chỉ tiêu Khoa/ngành/Đoàn viên với hạn chuyển chỉ tiêu dư, mẫu đăng ký lấy từ biểu mẫu đã có.
- Sinh viên xem điều kiện, điền mẫu, nhận xác nhận hoặc chờ duyệt. Không có chức năng tự hủy.
- DB chặn trùng, sai đối tượng, vượt chỉ tiêu, kể cả khi đồng thời (khóa hàng cấu hình).
- BTC duyệt/từ chối, xem danh sách, xuất CSV. Duyệt vượt người uy tín cao hơn phải có lý do. Sinh viên không xem được điểm hay lịch sử uy tín.
- Đăng ký chưa phải điểm danh: không ghi tham gia/hoàn thành, không trừ điểm.

## Kiểm thử
- [x] pgTAP `007_program_registrations.sql` 50/50; hồi quy `004`, `002` PASS (local)
- [x] Tranh chấp đồng thời `scripts/race-program-registration.sh` 7/7 trên stack local tách biệt
- [x] Vitest UC7 + biểu mẫu 31/31; lint, typecheck PASS
- [ ] CI của PR (Vitest toàn repo, build)
- [ ] Kiểm thử trình duyệt UC7
- [ ] Supabase cloud

Tài liệu: `docs/requirements/program-registrations.md`, `docs/testing/test-report.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
````

---

# Cập nhật — 14/10/2026 (mô tả PR UC6)

**Trạng thái:** nhánh `feat/event-program-plans` đã push. **Chưa mở PR** vì máy không có `gh` CLI → **CI chưa chạy**. Chưa merge, chưa đụng cloud.

**Cách mở PR:** vào https://github.com/HoangntDev/eoffice-hiu/pull/new/feat/event-program-plans (base `main`), dán tiêu đề và nội dung dưới đây. Hoặc chạy `brew install gh && gh auth login` để Claude tự mở PR và theo dõi CI.

**Tiêu đề PR:** `feat: UC6 kế hoạch chương trình sự kiện + quy tắc email sinh viên`

**Nội dung PR:**

````markdown
## Tóm tắt
- Đoàn Khoa lập, tải PDF và nộp kế hoạch chương trình; Văn phòng Đoàn – Hội xét duyệt.
- Hoàn thiện giao diện tài khoản và quy tắc email @student.hiu.vn đã chốt.
- Đồng bộ migration, seed mẫu Cảm tình Đoàn sau bootstrap bằng tài khoản Đoàn Trường thật.
- Đã xác minh dựng database từ đầu trên stack local tách biệt; lint và typecheck PASS.
- Chưa kiểm thử Supabase cloud hoặc triển khai production.

## Kiểm thử
- [x] pgTAP UC6 (`005_event_programs.sql`) 35/35; 002, 003, 006 PASS trên DB dựng mới
- [x] Vitest UC6 18/18; `auth-ui` + `validation` 11/11
- [x] E2E HTTP UC6 28/28, Playwright UC6 14/14 (local, 13/10)
- [x] `npm run lint`, `tsc --noEmit` PASS
- [ ] CI trên PR này (lint, typecheck, toàn bộ Vitest, build)
- [ ] Supabase cloud / production — chưa thực hiện

Chi tiết: `docs/requirements/event-programs.md`, `docs/testing/test-report.md`, `docs/operations/local-environment.md`, `STATUS.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
````

**Bước tiếp theo:** mở PR, gửi số PR để theo dõi CI; chỉ merge khi CI xanh.

---

# Cập nhật — 14/10/2026 (chuẩn bị PR UC6)

Nhánh `feat/event-program-plans` **đã push** lên origin. Chưa merge; không đụng Supabase cloud.

| Việc | Kết quả |
|---|---|
| Lịch sử migration local | `migration repair --status applied` cho 6 version (chỉ ghi metadata) → `migration list --local`: 18/18 khớp. Migration mới `202610140001` được áp bằng `migration up --local`. |
| Seed mẫu Cảm tình Đoàn | Commit `eee68e0`: `seed_camtinh_doan_template(p_creator)` (idempotent, chỉ service_role) được gọi trong `bootstrap_school_admin`, người tạo là tài khoản Đoàn Trường thật; DB đã bootstrap được seed một lần. Sửa luôn lỗi 0003 lấy `accounts limit 1` (có thể là sinh viên) làm người tạo. Test `supabase/tests/006_bootstrap_template_seed.sql`. |
| Dựng từ đầu (stack tách biệt `uc6-iso-check`, cổng 553xx, đã xóa sau khi kiểm) | 18/18 migration chạy sạch; 0 mẫu trước bootstrap → 1 mẫu `published`, 19 câu hỏi, người tạo đúng tài khoản bootstrap; danh mục đủ (dân tộc 61, tôn giáo 14, tỉnh 34, phường 3321); không còn CHECK Gmail; upload PDF qua Storage API: 200; pgTAP 002, 003, 005, 006 PASS (lỗi trùng email lần đầu do tài khoản bootstrap tạo tay trùng fixture 002, đã đổi và chạy lại PASS). |
| Storage `42P10` | Nguyên nhân bổ sung: container Storage stack chính tạo 09/10 từ `v1.79.36`, còn CLI v2.117.0 dựng mới bằng `v1.72.1`; volume DB tạo 05/10 với `v1.72.1`. Stack sạch không lỗi. Hướng dẫn trong `docs/operations/local-environment.md`. |
| Dữ liệu local | Giữ nguyên: 7 tài khoản, 5 chương trình, 3479 reference options, 5 mẫu (mẫu Cảm tình Đoàn không bị tạo lại). |
| Lint / typecheck | PASS / PASS |
| PR / CI | **Chưa mở PR**: máy không có `gh` CLI. CI chỉ chạy trên `pull_request` và push `main`, nên **CI chưa chạy**. |

**Blocker:** cần mở PR. Link tạo PR: https://github.com/HoangntDev/eoffice-hiu/pull/new/feat/event-program-plans (hoặc cài `gh` và `gh auth login`).

**Bước tiếp theo:** mở PR vào `main`, chờ CI (lint, typecheck, toàn bộ Vitest, build) rồi mới merge.

---

# Cập nhật — 13/10/2026 lượt 3 (commit WIP + đối chiếu migration)

Nhánh `feat/event-program-plans`. Không push, merge, deploy, migration repair, db reset; không đụng cloud.

**Commit mới:** `52a0594` feat(ui,auth): redesign giao diện portal, danh mục tỉnh/phường, quy tắc email sinh viên. Gồm WIP UI, 4 migration seed (`202610090012`, `202610100001`–`0003`), migration `202610130002_student_email_domain.sql`, test phụ thuộc (auth-ui, validation, pgTAP 002/003), `config.toml` (redirect local cổng 3001), sửa chữ "Gmail" trong API đổi email, tài liệu quy tắc email trong `mvp-scope.md`. Đã rà: không có secret hay dữ liệu cá nhân thật, chỉ có fixture tổng hợp.

**File chưa commit:** không còn (trước commit STATUS này).

**Lint / typecheck:** PASS / PASS. Không chạy Playwright, toàn bộ pgTAP, toàn bộ Vitest hay build. Lượt này chỉ sửa chuỗi thông báo, không sửa logic.

**Tình trạng 6 migration áp tay** (`schema_migrations` không có bản nào từ `202610090012` trở đi):

| Migration | Có trong DB | Thiếu | Ghi chú khi chạy lại |
|---|---|---|---|
| `202610090012_reference_options_seed` | CHECK category mở rộng (đã được 0002 thay bằng bản có `ward`); các nhóm education_level 8, specialization 7, political_theory 4, it_level 4, foreign_language 18, occupation 8 | Chỉ thiếu bản ghi lịch sử | Có `on conflict`; ethnicity/religion/province bị 0001 thay thế |
| `202610100001_reference_options_source_data` | ethnicity 61, religion 14, province 34 (`source_note` DAN_TOC/TON_GIAO/DIA_CHI.csv) | Chỉ thiếu bản ghi lịch sử | **Không idempotent**: xóa rồi chèn lại, không có `on conflict` |
| `202610100002_reference_options_ward` | Cột `parent_code`; CHECK có `ward`; 3321 phường/xã, tất cả có `parent_code` trỏ đúng tỉnh | Chỉ thiếu bản ghi lịch sử | Chèn không có `on conflict` → chạy lại sẽ lỗi trùng khóa |
| `202610100003_seed_camtinh_doan_template` | Template `f0000000-…0001` + version `…0002` (19 câu hỏi) | Chỉ thiếu bản ghi lịch sử | Có guard theo id; **bỏ qua khi `accounts` rỗng** (sau db reset sẽ không có template) |
| `202610130001_event_program_plans` | 3 bảng, 10 function, 5 policy, trigger, bucket riêng tư 5MB; reviewer chỉ `office` | Chỉ thiếu bản ghi lịch sử | Idempotent (`if not exists`, `drop … if exists`, `create or replace`) |
| `202610130002_student_email_domain` | 3 CHECK `*_student_email` (NOT VALID), không còn CHECK `*_gmail`; RPC kiểm `@student.hiu.vn` + khớp MSSV | Chỉ thiếu bản ghi lịch sử | Idempotent; 7 dòng Gmail cũ vẫn tồn tại hợp lệ |

Đề xuất đồng bộ lịch sử: `supabase migration repair --status applied 202610090012 202610100001 202610100002 202610100003 202610130001 202610130002 --local`. Lệnh chỉ ghi metadata, không chạy SQL, nên không đụng tới 0001/0002 không idempotent. Sau đó dùng `supabase migration list --local` để xác nhận local = remote.

**Rủi ro còn lại:**
- Chưa chạy CI, toàn bộ Vitest/pgTAP hay build sau commit `52a0594`. Lần build gần nhất có WIP là PASS, nhưng chưa xác nhận lại.
- `db reset` từ đầu chưa kiểm; sau reset sẽ mất template Cảm tình Đoàn (0003 cần có `accounts`) và tài khoản test.
- 7 tài khoản Gmail cũ chỉ dùng được nhờ NOT VALID; không thể chạy `VALIDATE CONSTRAINT` cho tới khi chuyển hết.
- Đổi email chỉ kiểm tên miền, chưa kiểm số khớp MSSV.
- Index Storage đã sửa chỉ ở local; cloud chưa kiểm.

**Bước tiếp theo (một bước):** chạy `supabase migration repair` như trên để đồng bộ lịch sử migration local.

---

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
