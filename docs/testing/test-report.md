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

## Bổ sung vòng đời tài khoản PIN — 02/10/2026

Kiểm thử dùng tài khoản tổng hợp, không dùng dữ liệu cá nhân thật và không ghi PIN/token vào bằng chứng.

| ID | Expected | Actual | Kết quả |
|---|---|---|---|
| AUTH-01 | SIGN UP chỉ MSSV + Gmail → Mailpit → xác minh → tạo PIN → profile | 201 → email local → `/signup/create-pin` → create PIN 200 → profile 200 | PASS |
| AUTH-02 | Profile tải đủ danh mục sau SIGN IN | API trả 10 Khoa, 51 Ngành, 6 Khóa, 347 Lớp | PASS |
| AUTH-03 | SIGN OUT hủy session; URL/API bảo vệ không mở lại | logout 200; trang trả 307 về `/login`; API profile trả 401 | PASS |
| AUTH-04 | SIGN IN chỉ MSSV + PIN; PIN cũ/sai bị từ chối | sai 401; đúng 200; schema từ chối Gmail/role thừa | PASS |
| AUTH-05 | Giới hạn thử PIN ở server | 8 lần sai trả 401; lần thứ 9 cùng MSSV/IP trả 429 trong cửa sổ 15 phút | PASS |
| AUTH-06 | Trạng thái chờ PIN không làm lộ tài khoản | MSSV chờ PIN và MSSV không tồn tại cùng trả 401, cùng thông báo; email hoàn tất vẫn được gửi | PASS |
| AUTH-07 | Email chưa xác minh không đăng nhập; liên kết hết hạn có thể gửi lại | login 401; link hết hạn về `/register?error=confirmation`; resend 200 và Mailpit nhận email mới | PASS |
| AUTH-08 | Đổi PIN phải xác minh PIN hiện tại | PIN hiện tại sai 400; đúng 200; PIN cũ login 401, PIN mới login 200 | PASS |
| AUTH-09 | Khôi phục PIN là email riêng và chứng cứ dùng một lần | email “Khôi phục PIN”; callback vào `/account/recover-pin`; token hash chỉ claim một lần | PASS |
| AUTH-10 | Gmail hiện tại chỉ đổi sau xác nhận Gmail mới | yêu cầu 200; local double-confirm gửi 2 email; mapping chỉ cập nhật sau callback cuối | PASS |
| AUTH-11 | Không đăng ký trùng MSSV/Gmail | lần đăng ký trùng trả 409 | PASS |
| UI-03 | Ba form tách biệt và có nút Đăng xuất rõ ràng | test component kiểm SIGN UP không có PIN, SIGN IN không có Gmail, đổi PIN có PIN hiện tại, có nút Đăng xuất | PASS |

E2E trên là HTTP + Supabase Auth/PostgreSQL + Mailpit local thực tế. Kiểm tra trực quan bằng trình duyệt tích hợp chưa chạy, nên không ghi PASS cho bố cục/hình ảnh. Không reset database, không nhập lại CSV, không push cloud và không deploy.

Lệnh xác nhận cuối: `npm run lint`, `npm run typecheck`, `npm test` (17 test), `supabase test db` (27 test), `supabase db lint --local`, `npm run build`.

## Prompt 02 — Thư viện mẫu và biểu mẫu động — 05/10/2026

| ID | Expected | Actual | Kết quả |
|---|---|---|---|
| F-DB-01 | `evaluate_audience_rule("any", null)` trả true | true | PASS |
| F-DB-02 | `evaluate_audience_rule("hiu_student", null)` trả false | false | PASS |
| F-DB-03 | `evaluate_audience_rule("hiu_student", active_user_id)` trả true | true | PASS |
| F-DB-04 | `evaluate_audience_rule("union_member", student_without_membership)` trả false | false | PASS |
| F-DB-05 | `evaluate_audience_rule("or",[hiu_student,any], user_id)` trả true | true | PASS |
| F-DB-06 | `evaluate_audience_rule("and",[hiu_student,union_member], user_id)` trả false | false | PASS |
| F-DB-07 | `user_can_manage_forms_for_org(school_union)` của school_admin trả true | true | PASS |
| F-DB-08 | `user_can_manage_forms_for_org(school_union)` của sinh viên thường trả false | false | PASS |
| F-DB-09 | school_admin tạo template thành công | lives_ok | PASS |
| F-DB-10 | Non-school_admin tạo template bị từ chối FORBIDDEN | throws FORBIDDEN | PASS |
| F-DB-11 | committee_manager tạo form cho đơn vị mình | lives_ok | PASS |
| F-DB-12 | committee_manager tạo form cho đơn vị khác bị FORBIDDEN | throws FORBIDDEN | PASS |
| F-DB-13 | Direct INSERT vào form_responses bị từ chối | throws | PASS |
| F-UT-01 | audienceRuleSchema chấp nhận "any", "hiu_student", "faculty" với UUID, nested "and"/"or" | parse OK | PASS |
| F-UT-02 | audienceRuleSchema từ chối type không hợp lệ và "faculty" thiếu faculty_id | throws | PASS |
| F-UT-03 | questionSchema từ chối label rỗng | throws | PASS |
| F-UT-04 | submitResponseSchema từ chối email không hợp lệ | throws | PASS |

Lệnh xác nhận: `npm test` (34 test), `supabase test db` (41 test), `supabase db lint --local` (no errors), `npm run build` (PASS).
Kiểm tra trực quan browser chưa chạy; không push cloud, không deploy.

## Bổ sung E2E HTTP — Prompt 02 — 05/10/2026

BROWSER NOT RUN. Kiểm thử dùng 3 tài khoản tổng hợp local (e2e_admin/e2e_manager/e2e_student), không dùng dữ liệu cá nhân thật.

| ID | Expected | Actual | Kết quả |
|---|---|---|---|
| F-E2E-01 | school_admin tạo template draft → 201 + id | `{"id":"2e90..."}` 201 | PASS |
| F-E2E-02 | school_admin phát hành phiên bản template → version_id + template chuyển published | version_id trả về; GET `/templates/[id]` trả `status=published, versions=1` | PASS |
| F-E2E-03 | committee_manager tạo form cho đơn vị mình (Ban TC-KT 003) → 201 | `{"id":"6f65..."}` 201 | PASS |
| F-E2E-04 | committee_manager phát hành form → `{"status":"published"}` | 200 đúng | PASS |
| F-E2E-05 | Sinh viên xem form đã publish → status=published, 3 câu hỏi | `status=published questions=3` | PASS |
| F-E2E-06 | Sinh viên nộp phản hồi hợp lệ → response_id | `{"response_id":"87f2..."}` 201 | PASS |
| F-E2E-07 | committee_manager xem phản hồi → 1 kết quả, answers đủ 3 | `total=1 answers=3` | PASS |
| F-E2E-08 | Xuất CSV → UTF-8 BOM, header tiếng Việt, nhãn lựa chọn được giải mã (Có không phải opt1) | BOM=EF BB BF; `Có` thay `opt1` sau bản sửa | PASS (sau fix) |
| F-E2E-09 | Non-admin tạo template → 403 FORBIDDEN | `FORBIDDEN` | PASS |
| F-E2E-10 | Manager tạo form cho đơn vị khác → 403 FORBIDDEN | `FORBIDDEN` | PASS |
| F-E2E-11 | Sinh viên nộp lần 2 (allow_multiple=false) → 409 ALREADY_SUBMITTED | `ALREADY_SUBMITTED` | PASS |
| F-E2E-12 | Chuyển trạng thái không hợp lệ (closed → published) → INVALID_STATUS_TRANSITION | 422 `INVALID_STATUS_TRANSITION` | PASS |
| F-E2E-13 | audience_rule type không hợp lệ → 400 VALIDATION_ERROR | `VALIDATION_ERROR` | PASS |
| F-E2E-14 | Nộp thiếu câu hỏi bắt buộc → 422 REQUIRED_QUESTION_MISSING | `REQUIRED_QUESTION_MISSING` | PASS |
| F-E2E-15 | Unauthenticated tạo form → 401 UNAUTHENTICATED | `UNAUTHENTICATED` | PASS |

**Sửa lỗi phát hiện:** CSV export xuất option ID thô (`opt1`) thay vì nhãn (`Có`). Sửa trong `src/app/api/forms/[id]/export/route.ts`: build option lookup map từ `questions`, resolve single_choice/dropdown sang label, multi_choice sang `"; "`-joined labels.

Lệnh xác nhận sau sửa: `npm run lint` (0 errors), `npm run typecheck` (clean), `npm test` (34 test PASS), `supabase test db` (41 test PASS), `npm run build` (PASS).

## Bổ sung snapshot isolation — 05/10/2026

Xác minh yêu cầu cốt lõi Prompt 02: sửa form sau khi nhận phản hồi không làm đổi cách đọc phản hồi cũ.

| ID | Expected | Actual | Kết quả |
|---|---|---|---|
| F-SNAP-01 | Nộp phản hồi V1 → `questions_snapshot` lưu đúng 2 câu hỏi V1 (`Câu hỏi V1`, `Điểm V1`) | `form_version=1`, `snapshot_count=2`, labels khớp V1 | PASS |
| F-SNAP-02 | Sửa form (đổi tên 2 câu hỏi + thêm Q3 mới) → `form_version` tăng lên 2 | `form_version=2`, title đổi, 3 câu hỏi trong form hiện tại | PASS |
| F-SNAP-03 | Nộp phản hồi V2 → `questions_snapshot` lưu đúng 3 câu hỏi V2 | `form_version=2`, labels `Câu hỏi V2`, `Điểm V2`, `Câu hỏi mới Q3` | PASS |
| F-SNAP-04 | GET responses → phản hồi V1 vẫn đọc labels V1; phản hồi V2 đọc labels V2 | Mỗi response trả về `questions_snapshot` riêng — không bị ghi đè | PASS |
| F-SNAP-05 | Phản hồi V1 không có câu hỏi Q3 (được thêm ở V2) | V1 snapshot có 2 items; Q3 không xuất hiện trong V1 | PASS |

Cơ chế: RPC `submit_form_response` capture `questions jsonb` từ `forms` vào `form_responses.questions_snapshot` tại thời điểm nộp. Snapshot bất biến sau khi lưu. `form_version int` tăng mỗi lần `save_form` được gọi — không phải auto-increment trigger.

## Bổ sung backup drill — 05/10/2026

Không reset database đang dùng, không tạo instance mới, không push cloud.

**Artifacts tạo:**
- Schema dump: `supabase db dump --local -f schema_20261005T223312.sql` → 255K, pg_dump version 17.6
- Data dump: `supabase db dump --local --data-only -f data_20261005T223312.sql` → 369K, 1780 dòng

**Kiểm tra integrity (row count trong dump vs. live DB):**

| Bảng | Live DB | Trong dump | Khớp |
|---|---|---|---|
| faculties | 10 | 10 | ✓ |
| programs | 51 | 51 | ✓ |
| classes | 347 | 347 | ✓ |
| cohorts | 6 | 6 | ✓ |
| accounts | 3 | 3 | ✓ |
| role_grants | 2 | 2 | ✓ |
| form_templates | 1 | 1 | ✓ |
| form_template_versions | 1 | 1 | ✓ |
| forms | 2 | 2 | ✓ |
| form_responses | 1 | 1 | ✓ |
| form_response_answers | 3 | 3 | ✓ |

**Restore drill chưa chạy end-to-end:** `pg_dump`/`pg_restore`/`psql` không có trong system PATH. `supabase db dump --local` dùng Docker pg_dump nội bộ nhưng không expose binary trực tiếp. Restore hoàn chỉnh cần một trong: (a) cài `postgresql-client` (`brew install libpq`), (b) `docker exec` vào container Supabase PostgreSQL, hoặc (c) spin up second Supabase project ở ports khác.

**Lệnh restore đầy đủ (để operator chạy):**
```bash
# Trên một Supabase local instance mới (sau supabase start + supabase db reset):
psql postgres://postgres:postgres@127.0.0.1:54322/postgres -f schema_20261005T223312.sql
psql postgres://postgres:postgres@127.0.0.1:54322/postgres -f data_20261005T223312.sql
# Verify:
curl -s http://127.0.0.1:54321/rest/v1/faculties?select=id -H "apikey: ANON_KEY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"  # expect 10
```

## Bổ sung Playwright UI — 05/10/2026

Playwright 1.63.0 + headless Chrome (`/Applications/Google Chrome.app`). Không cài thêm dependency vào project — chạy từ scratchpad tạm.

| ID | Expected | Actual | Kết quả |
|---|---|---|---|
| F-UI-01 | Landing page render với title đúng và 4 feature cards | title="HIU Youth E-Office", cards 01–04 hiện | PASS |
| F-UI-02 | Login bằng MSSV+PIN (2026990001/123456) → redirect về `/onboarding/profile` | 200, URL chuyển sang profile page | PASS |
| F-UI-03 | `/forms/templates` load: heading "Thư viện mẫu đối tượng", có template E2E, nút "Tạo mẫu mới" | Đúng | PASS |
| F-UI-04 | `/forms/templates/new` render form editor (Tiêu đề, audience, câu hỏi) | Editor form hiện | PASS |
| F-UI-05 | `/forms` render danh sách biểu mẫu | Page text chứa "form/biểu mẫu" | PASS |
| F-UI-06 | `/forms/[id]` render form đã đóng đúng (page content > 200 chars) | content=11038 chars | PASS |
| F-UI-07 | `/forms/[id]/responses` render bảng phản hồi + nút "Xuất CSV" | content=13496 chars, bảng hiện | PASS |
| F-UI-08 | Link xuất CSV có trên trang responses | `a[href*="/export"]` tồn tại | PASS |
| F-UI-09 | Sau login, trang chủ render authenticated state (Đăng xuất visible) | len=12141 | PASS |

**Sửa lỗi thứ hai phát hiện qua screenshot:** Trang responses UI cũng xuất option ID thô (`opt1`). Sửa trong `src/app/forms/[id]/responses/page.tsx`: build `optionLabels Map`, resolve trong `getAnswer()`. Re-run Playwright sau fix: 9/9 PASS, column "Đã tham gia CLB?" hiển thị `Có`.

Lệnh xác nhận cuối: `npm run lint` (0 errors), `npm run typecheck` (clean), `npm test` (34 PASS), `supabase test db` (41 PASS), `npm run build` (PASS).

## G5 — Restore drill tách biệt — 06/10/2026

Dùng `docker exec -i supabase_db_hiu-youth-e-office psql -U postgres` (PostgreSQL 17.6 trong container) — không cần cài `libpq` hệ thống, không dùng đường dẫn `/opt/homebrew` cố định.

**Các bước đã thực hiện:**

```bash
# Tạo DB tách biệt trong cùng PostgreSQL instance
docker exec supabase_db_hiu-youth-e-office psql -U postgres -c "CREATE DATABASE restore_test"

# Restore schema (255K)
docker exec -i supabase_db_hiu-youth-e-office psql -U postgres restore_test < schema_20261005T223312.sql

# Restore data (369K)
docker exec -i supabase_db_hiu-youth-e-office psql -U postgres restore_test < data_20261005T223312.sql

# Dọn dẹp
docker exec supabase_db_hiu-youth-e-office psql -U postgres -c "DROP DATABASE restore_test"
```

**Lỗi không nghiêm trọng:** `ERROR: relation "supabase_functions.hooks_id_seq" does not exist` — đây là sequence nội bộ Supabase không có trong plain PostgreSQL instance; không ảnh hưởng public schema.

**Xác minh row count sau restore:**

| Bảng | Trong backup | Restore_test | Khớp |
|---|---|---|---|
| faculties | 10 | 10 | ✓ |
| programs | 51 | 51 | ✓ |
| classes | 347 | 347 | ✓ |
| cohorts | 6 | 6 | ✓ |
| accounts | 3 | 3 | ✓ |
| role_grants | 2 | 2 | ✓ |
| form_templates | 1 | 1 | ✓ |
| form_template_versions | 1 | 1 | ✓ |
| forms | 2 | 2 | ✓ |
| form_responses | 1 | 1 | ✓ |
| form_response_answers | 3 | 3 | ✓ |

**Business query xác minh:**
- Catalog join: Khoa Kinh Tế 12 ngành / 80 lớp ✓
- form_template: title "Mẫu đăng ký hoạt động E2E", audience=hiu_student, status=published, 1 version, 3 câu hỏi ✓
- RPCs: `evaluate_audience_rule`, `save_form_template`, `submit_form_response` đều tồn tại ✓

**Kết quả: G5 COMPLETE** — 11/11 bảng khớp, 3 business query PASS.

## G6 — Write flow qua UI (Playwright) — 06/10/2026

Playwright 1.63.0 + headless Chrome. Script: `pw_write_flow.mjs` trong scratchpad. Chạy lại 3 lần: kết quả 12/12 PASS ổn định.

| ID | Bước | Kết quả |
|---|---|---|
| F-UI-10 | school_admin tạo template "G6 UI Write Test Template" với câu hỏi single_choice "Bạn có muốn tham gia?" → saved, redirect đến `/forms/templates/[id]` | PASS |
| F-UI-11 | school_admin phát hành phiên bản template → notice "Đã phát hành phiên bản mới." | PASS |
| F-UI-12 | committee_manager tạo form "G6 UI Write Test Form" với câu hỏi thủ công → saved, redirect đến `/forms/[id]/edit` | PASS |
| F-UI-13 | committee_manager phát hành form → notice "Đã chuyển sang: published" | PASS |
| F-UI-14 | student xem form: câu hỏi "Bạn có muốn tham gia?" hiển thị đúng | PASS |
| F-UI-15 | student chọn option "Có" (radio label đúng tiếng Việt) | PASS |
| F-UI-16 | student nộp → "Đã nộp thành công!" | PASS |
| F-UI-17 | committee_manager xem `/responses`: bảng hiển thị "Có" (không phải option UUID) | PASS |
| F-UI-18 | Không có UUID thô trong cột answer của bảng responses | PASS |
| F-UI-19 | CSV qua `fetch()` trong browser context: chứa "Có" | PASS |
| F-UI-20 | CSV không chứa option UUID thô trong data rows | PASS |
| F-UI-21 | CSV header: `Thời gian nộp,Email người nộp,Bạn có muốn tham gia?` | PASS |

**Kết quả: G6 COMPLETE** — 12/12 PASS. Toàn bộ write flow qua UI xác minh thành công.

## UC6 — Quản lý kế hoạch chương trình sự kiện — 13/10/2026

Nhánh `feat/event-program-plans`. Dữ liệu tổng hợp: tài khoản `2026990003` (sinh viên), `2026990004` (BCH Đoàn Khoa CNKT), `2026990005` (BCH Đoàn Khoa Dược), `2026990006` (Văn phòng), Gmail `e2e.*@gmail.com`, PIN chỉ dùng local. Không deploy, không push cloud, không `db reset`.

### pgTAP — `supabase/tests/005_event_programs.sql` (35 assertion)

| ID | Expected | Actual | Kết quả |
|---|---|---|---|
| EP-DB-01 | Đoàn Khoa A tạo bản nháp cho Khoa mình | lives_ok | PASS |
| EP-DB-02 | Đoàn Khoa A tạo cho Khoa B → `FORBIDDEN` | `FORBIDDEN` | PASS |
| EP-DB-03 | Đoàn Khoa B sửa hồ sơ Khoa A → `FORBIDDEN` | `FORBIDDEN` | PASS |
| EP-DB-04 | RLS: Khoa B không đọc bản nháp Khoa A | 0 dòng | PASS |
| EP-DB-05 | Sinh viên tạo kế hoạch → `FORBIDDEN` | `FORBIDDEN` | PASS |
| EP-DB-06 | RLS: sinh viên không thấy hồ sơ chưa chấp thuận | 0 dòng | PASS |
| EP-DB-07 | RLS: Văn phòng không thấy bản nháp chưa gửi | 0 dòng | PASS |
| EP-DB-08 | Gửi khi thiếu trường → `MISSING_REQUIRED_FIELDS:…` | đúng | PASS (sau sửa lỗi, xem dưới) |
| EP-DB-09 | Kết thúc trước bắt đầu → `ENDS_BEFORE_STARTS` | đúng | PASS |
| EP-DB-10 | Khai đủ thông tin | lives_ok | PASS |
| EP-DB-11 | Gửi khi chưa có PDF → `PLAN_DOCUMENT_REQUIRED` | đúng | PASS |
| EP-DB-12 | Storage RLS: Khoa B tải PDF vào hồ sơ Khoa A → 42501 | 42501 | PASS |
| EP-DB-13 | Storage RLS: Khoa A tải PDF vào hồ sơ mình | lives_ok | PASS |
| EP-DB-14 | Ghi nhận tệp không có trong Storage → `DOCUMENT_NOT_UPLOADED` | đúng | PASS |
| EP-DB-15 | Ghi nhận PDF đã ký | lives_ok | PASS |
| EP-DB-16 | `UPDATE event_programs SET status='approved'` trực tiếp → 42501 | 42501 | PASS |
| EP-DB-17 | `INSERT` lịch sử giả trực tiếp → 42501 | 42501 | PASS |
| EP-DB-18 | Văn phòng duyệt bản nháp chưa gửi → `INVALID_TRANSITION` | đúng | PASS |
| EP-DB-19 | Đoàn Khoa gửi → `submitted` | `submitted` | PASS |
| EP-DB-20 | Sửa khi chờ duyệt → `PROGRAM_NOT_EDITABLE` | đúng | PASS |
| EP-DB-21 | Sinh viên duyệt → `FORBIDDEN` | `FORBIDDEN` | PASS |
| EP-DB-22 | Yêu cầu sửa với lý do ngắn → `REASON_REQUIRED` | đúng | PASS |
| EP-DB-23 | Văn phòng yêu cầu chỉnh sửa → `needs_changes` | `needs_changes` | PASS |
| EP-DB-24 | Đoàn Khoa sửa tiếp hồ sơ `needs_changes` | lives_ok | PASS |
| EP-DB-25 | Nộp lại cùng hồ sơ → `submission_count = 2` | 2 | PASS |
| EP-DB-26 | Từ chối không lý do → `REASON_REQUIRED` | đúng | PASS |
| EP-DB-27 | Văn phòng chấp thuận → `approved` | `approved` | PASS |
| EP-DB-28 | Xét lại hồ sơ đã chấp thuận → `INVALID_TRANSITION` | đúng | PASS |
| EP-DB-29 | Lịch sử chuyển trạng thái `{draft,submitted,needs_changes,submitted,approved}` | khớp | PASS |
| EP-DB-30 | Lịch sử ghi vai trò `office` của người chấp thuận | `office` | PASS |
| EP-DB-31 | Sinh viên thấy chương trình đã chấp thuận | 1 dòng | PASS |
| EP-DB-32 | Sinh viên không đọc PDF của chương trình đã chấp thuận | 0 dòng | PASS |
| EP-DB-33 | Người vừa là Đoàn Khoa vừa là Văn phòng tự duyệt hồ sơ mình nộp → `SELF_REVIEW_FORBIDDEN` | đúng | PASS |
| EP-DB-34 | `school_admin` xét duyệt kế hoạch → `FORBIDDEN` (chỉ Văn phòng, 13/10) | `FORBIDDEN` | PASS |
| EP-DB-35 | RLS: `school_admin` không thấy hồ sơ đang chờ Văn phòng | 0 dòng | PASS |

**Lỗi phát hiện nhờ test:** EP-DB-08 lần đầu trả `malformed array literal: "summary"` vì `text[] || 'summary'` bị hiểu là array literal; sửa bằng `array_append`. EP-DB-06 ban đầu đếm toàn bảng nên fail sau khi chạy E2E (sinh viên được phép thấy 3 chương trình đã chấp thuận); sửa test để chỉ đếm hồ sơ chưa chấp thuận.

### Unit — `tests/event-programs.test.ts` (18 test)

Schema chặn trường trạng thái do client tự gửi, kết thúc trước bắt đầu, tiêu đề ngắn; lý do bắt buộc ≥ 10 ký tự khi yêu cầu sửa/từ chối; PDF phải đúng đuôi + MIME + magic `%PDF-`, ≤ 5MB, tên tệp bỏ thư mục/ký tự điều khiển; quy đổi giờ Việt Nam; quy tắc hiển thị thao tác; ánh xạ mã lỗi RPC và không lộ lỗi DB lạ. 18/18 PASS.

### E2E HTTP — `next start` cổng 3001 + Supabase local (28 bước)

| ID | Expected | Actual | Kết quả |
|---|---|---|---|
| E01 | Đoàn Khoa A tạo nháp → 201 | 201 | PASS |
| E02–E03 | Khoa B sửa → 403; xem → 404 | 403; 404 | PASS |
| E04 | Sinh viên tạo → 403 | 403 | PASS |
| E05 | Gửi thiếu trường → 422 liệt kê 7 trường bằng tiếng Việt | 422 | PASS |
| E06 | Kết thúc trước bắt đầu → 422 gắn trường `endsAt` | 422 | PASS |
| E07–E08 | Khai đủ → 200; gửi chưa PDF → 422 | 200; 422 | PASS |
| E09 | Tệp ZIP/DOCX đổi đuôi `.pdf` → 422 `NOT_PDF` | 422 | PASS |
| E10 | Khoa B tải PDF vào hồ sơ Khoa A → 403 (Storage RLS) | 403 | PASS |
| E11 | PDF 6MB → 413 trước khi đọc body | 413 | PASS |
| E12 | Khoa A tải PDF hợp lệ → 201 + SHA-256 | 201 | PASS (sau workaround môi trường, xem dưới) |
| E13 | Văn phòng xem nháp chưa gửi → 404 | 404 | PASS |
| E14–E15 | Gửi → 200 `submitted`; sửa khi chờ → 409 | 200; 409 | PASS |
| E16–E17 | Sinh viên / Đoàn Khoa khác duyệt → 403 | 403; 403 | PASS |
| E18–E19 | Yêu cầu sửa không lý do → 422; có lý do → 200 `needs_changes` | 422; 200 | PASS |
| E20–E21 | Sửa tiếp → 200; nộp lại → 200 `submitted` | 200; 200 | PASS |
| E22–E24 | Từ chối lý do ngắn → 422; chấp thuận → 200; xét lại → 409 | 422; 200; 409 | PASS |
| E25 | Sinh viên xem chi tiết đã duyệt: `approved`, 0 PDF, 0 lịch sử | `approved 2 docs 0 history 0` | PASS |
| E26 | Văn phòng mở PDF → 307 signed URL; tải về SHA-256 trùng bản gốc | 307; SHA khớp `c896da11e829…` | PASS |
| E27 | Sinh viên mở PDF → 404 | 404 | PASS |
| E28 | Lịch sử 8 mục, đủ người thao tác + vai trò | khớp | PASS |
| LOG-01 | `request_id` trong log JSON khớp `audit_events.request_id` (actor, role grant, org) | khớp `77486fea…` | PASS |

**Sự cố môi trường khi kiểm thử (không phải lỗi UC6):** E12 lần đầu trả 403; log JSON + log container `storage-api v1.79.36` cho thấy lỗi `42P10 there is no unique or exclusion constraint matching the ON CONFLICT specification`. Storage API dùng `ON CONFLICT (bucket_id, name COLLATE "C") WHERE archived_at IS NULL` nhưng index nội bộ `idx_objects_current_version` không có `COLLATE "C"` trên DB `en_US.UTF-8`, nên mọi upload ở local đều hỏng. Workaround **chỉ ở local**, không đưa vào migration: `create unique index if not exists idx_objects_current_version_c on storage.objects (bucket_id, name collate "C") where archived_at is null;` (chạy bằng `supabase_admin`). Cần kiểm lại trên Supabase cloud trước khi dùng thật.

### Browser — Playwright 1.60 + Google Chrome headless (14 bước, thao tác qua UI)

| ID | Expected | Kết quả |
|---|---|---|
| UI-01–02 | Tạo nháp qua form → trang chi tiết; giờ hiển thị đúng giờ Việt Nam | PASS |
| UI-03 | Bấm gửi khi chưa có PDF → thông báo lỗi PDF | PASS |
| UI-04 | Tải PDF + gửi → form sửa biến mất | PASS |
| UI-05 | Đoàn Khoa B mở URL hồ sơ Khoa A → 404 | PASS |
| UI-06–07 | Hàng đợi Văn phòng có hồ sơ; yêu cầu sửa không lý do bị chặn | PASS |
| UI-08–09 | Đoàn Khoa thấy lý do, sửa tiếp, nộp lại cùng URL, "Đã nộp 2 lần" | PASS |
| UI-10 | Lịch sử hiển thị người thao tác, vai trò, lý do | PASS |
| UI-11–13 | Sinh viên thấy chương trình đã duyệt; không có nút lập kế hoạch, PDF, lịch sử, form duyệt | PASS |
| UI-14 | Viewport 390px không cuộn ngang | PASS |

Ảnh chụp và script (`uc6.sh`, `uc6-browser.mjs`) nằm trong scratchpad của phiên, không commit.

### Lệnh xác nhận cuối

`npx tsc --noEmit` PASS · ESLint trên toàn bộ file UC6 PASS · `vitest` 48/52 (4 fail có sẵn trong `auth-ui.test.tsx`/`validation.test.ts` thuộc thay đổi UI chưa commit, không liên quan UC6) · `supabase test db` 74/74 PASS · `supabase db lint --local` không còn cảnh báo về UC6 · `npm run build` PASS. `npm run lint` toàn repo còn 10 lỗi có sẵn trong `account-security-panel.tsx` và `union-application-form.tsx` (thay đổi chưa commit, có từ trước UC6).

**Chưa kiểm thử:** `supabase db reset` từ đầu với migration mới (không chạy để giữ dữ liệu local); Storage trên Supabase cloud; PDF > 10MB đi qua proxy thật trên Vercel; đọc PDF bằng trình xem trong trình duyệt (chỉ kiểm tra SHA-256 khi tải về).


## Ổn định UC6 + email sinh viên — 13/10/2026 (lượt 2)

| ID | Expected | Actual | Kết quả |
|---|---|---|---|
| EP-DB-34/35 | Chỉ role `office` trên đơn vị `office` xét duyệt; `school_admin` bị từ chối và không thấy hồ sơ chờ | đúng | PASS (`supabase test db supabase/tests/005_event_programs.sql` 35/35) |
| ACC-01 | `reserve_account_registration`: email `@student.hiu.vn` khớp MSSV (3 số đầu + 4 số cuối) → nhận; Gmail → từ chối; sai số → từ chối | t / f / f | PASS |
| ACC-02 | pgTAP 002, 003 với fixture email sinh viên (+2 assertion Gmail/sai MSSV) | ok | PASS |
| UT-AUTH | `auth-ui.test.tsx` theo luồng WIP (đăng nhập 2 bước MSSV → PIN, ô PIN dạng chấm); `validation.test.ts` theo quy tắc email sinh viên | 11/11 | PASS |
| STG-01 | Câu `ON CONFLICT (bucket_id, name COLLATE "C") WHERE archived_at IS NULL` của Storage chạy được sau khi đưa index local về định nghĩa upstream | `ON_CONFLICT_OK` (rollback) | PASS |

`npm run lint` toàn repo PASS; `tsc --noEmit` PASS. Không chạy lại Playwright, toàn bộ pgTAP, build, db reset theo yêu cầu.

**Nguyên nhân Storage (đã xác minh):** `storage-api v1.72.1` (05/10) tạo `idx_objects_current_version` trên `(bucket_id, name)`; CLI nâng lên `v1.79.36` (09/10) có cùng migration 0066 nhưng nội dung mới `(bucket_id, name COLLATE "C")`. Migration 66 đã ghi là chạy nên không chạy lại (và có `IF NOT EXISTS`), DB giữ index cũ trong khi code mới dùng `ON CONFLICT … COLLATE "C"` → `42P10`. Đã thay index local bằng đúng định nghĩa upstream. DB tạo mới bằng image hiện tại không bị lỗi này; cloud do Supabase quản lý.

## UC7 — Đăng ký tham gia chương trình — 15/10/2026

| Kiểm thử | Lệnh | Kết quả |
|---|---|---|
| pgTAP UC7 (`007_program_registrations.sql`) | `supabase test db supabase/tests/007_program_registrations.sql` | 50/50 PASS (DB local, rollback) |
| pgTAP hồi quy biểu mẫu + quyền (`004`, `002`) vì `evaluate_audience_rule`/`submit_form_response` thay đổi | `supabase test db supabase/tests/004_forms.sql supabase/tests/002_authorization_workflow.sql` | 24/24 PASS |
| Tranh chấp đồng thời (nhiều phiên commit thật) | `scripts/race-program-registration.sh supabase_db_uc7-race` trên stack tách biệt `uc7-race` (19/19 migration chạy từ đầu), đã gỡ sau khi chạy | 7/7 PASS |
| Vitest UC7 + biểu mẫu | `npx vitest run tests/program-registrations.test.ts tests/forms-validation.test.ts` | 31/31 PASS |
| Lint, typecheck (toàn repo) | `npm run lint`, `npm run typecheck` | PASS |

Rủi ro được nhắm:
- **Sai quyền theo đơn vị:** BTC Khoa khác, Văn phòng, sinh viên không cấu hình/mở/duyệt; BTC Khoa khác không thấy đăng ký (`REGISTRATION_NOT_FOUND`); không INSERT trực tiếp (42501).
- **Chương trình chưa duyệt:** không cấu hình/mở được.
- **Sai đối tượng:** sinh viên Khoa khác bị `AUDIENCE_NOT_MET`.
- **Trùng:** `ALREADY_REGISTERED`, kể cả 5 lần gửi đồng thời (chỉ 1 bản ghi).
- **Suất cuối:** 20 phiên đồng thời tranh 5 chỗ cho đúng 5 người được nhận. Hai BTC duyệt đồng thời cho 1 chỗ: phiên sau chờ khóa rồi nhận `QUOTA_FULL`.
- **Giới hạn nhóm:** chỗ dành cho ngành A2 không cấp cho ngành A1. Sau `quota_release_at`, chỗ dư được cấp; vẫn không vượt tổng.
- **Lý do duyệt ngoại lệ:** duyệt người 90 điểm khi còn người 100 điểm trả `SKIP_REASON_REQUIRED`. Khi có lý do: được duyệt, lịch sử lưu cờ và lý do. Từ chối phải có lý do.
- **Riêng tư uy tín:** sinh viên không đọc `reputation_adjustments`, không gọi được `reputation_score`, không xem danh sách hay lịch sử. Nhận theo thứ tự thì không trả điểm uy tín.
- **Mẫu đăng ký:** thiếu câu bắt buộc thì bị chặn; mẫu đã gắn chương trình không nhận phản hồi rời.
- **Audit:** cấu hình, đăng ký và duyệt ngoại lệ đều có `request_id`.

Chưa chạy:
- Trình duyệt/Playwright và E2E HTTP cho UC7: giao diện mới chỉ qua typecheck và lint.
- Toàn bộ Vitest, build: để CI của PR chạy.
- Toàn bộ pgTAP: CI không có Postgres. Các file 001, 003, 005, 006 không chạy lại.
- Đối chứng âm (bỏ khóa để chứng minh script phát hiện vượt chỉ tiêu).
- Supabase cloud.

## UC7 — Sửa theo review PR #3 — 16/10/2026

| Kiểm thử | Kết quả |
|---|---|
| pgTAP `007` (thêm 17 assertion cho hai quy tắc sửa) | 67/67 PASS |
| Vitest `program-registrations` | 15/15 PASS |
| Luồng UI trên Chrome (dev server local, `scratchpad/e2e/uc7-browser.mjs`, không commit) | 15/15 PASS, chạy 2 lần trên 2 chương trình đã duyệt |
| Lint, typecheck toàn repo | PASS |

Học kỳ cấu hình được:
- Không còn `semester_key_for`.
- Học kỳ có ngày lẻ do người dùng nhập được nhận diện đúng.
- Khoản trừ của học kỳ trước không tính vào học kỳ này, nhưng tính đúng khi xét một thời điểm trong học kỳ trước.
- Thời điểm chưa có học kỳ cấu hình thì 100 điểm.
- Học kỳ chồng ngày bị từ chối (23P01).

Cạnh tranh cùng suất (chương trình 2 chỗ: 1 chỗ dành ngành A2, 1 chỗ chung):
- Duyệt SV 90 điểm khi SV 100 điểm cùng ngành A1 đang chờ chỗ chung: phải có lý do.
- Khi chỉ còn SV 100 điểm ngành A2 (được xếp vào nhóm A2): duyệt SV 90 điểm không cần lý do và không ghi là duyệt ngoại lệ.
- Danh sách hiện đúng suất cho từng người chờ.

Luồng UI:
- BTC cấu hình (Khoa CNKT, 1 chỗ, BTC duyệt) → lưu → mở. Form cấu hình bị khóa khi đang mở.
- Hai SV xem điều kiện và gửi → "Chờ BTC duyệt"; SV không thấy chữ "uy tín"; SV mở trang danh sách BTC nhận 404.
- BTC thấy "Chung · #1/#2" và duyệt #1 không cần lý do. Duyệt người thứ hai báo hết chỗ. Từ chối có lý do. Lịch sử hiển thị.
- SV thấy "Đã xác nhận" / "Không được duyệt" kèm lý do.
- CSV chỉ có người được nhận, không có cột uy tín.

Ảnh chụp phát hiện 2 lỗi hiển thị mà assertion DOM bỏ sót, đã sửa và chạy lại:
- Lặp chữ "Khoa Khoa".
- Checkbox bị kéo rộng 100%.

Chưa chạy: Playwright/pgTAP UC6, toàn bộ Vitest/build (để CI), Supabase cloud.

## UC8 — Điểm danh QR lượt — 13/10/2026

| Kiểm thử | Kết quả |
|---|---|
| pgTAP `008_program_attendance.sql` | 55/55 PASS (DB local, rollback) |
| Vitest `program-attendance` | 7/7 PASS |
| Luồng UI trên Chrome (dev server local, QR giải mã quang học bằng jsQR từ ảnh chụp màn hình BTC, sinh viên dùng viewport điện thoại; script ở scratchpad, không commit) | 14/14 PASS |
| Lint, typecheck toàn repo | PASS |

pgTAP:
- **QR:** còn hạn → nhận; quá 30 giây theo giờ server → `QR_EXPIRED`; mã lượt khác → `WRONG_SESSION`; chữ ký sai, hoặc sửa thời điểm phát để kéo dài hạn → `QR_INVALID`; lượt chưa mở hoặc đã đóng → `SESSION_NOT_OPEN`.
- **Đăng ký:** chờ duyệt hoặc không đăng ký → `REGISTRATION_NOT_ACCEPTED`.
- **Quét trùng:** `ALREADY_CHECKED_IN`.
- **Mở lại:** cần lý do; vẫn là lượt cũ (`open_count` 2, không tạo lượt mới). Mã lần mở trước → `QR_EXPIRED`. Bản ghi bổ sung được đánh dấu. Người đã có mặt không được ghi lần nữa.
- **Điểm tối đa:** điểm lượt/bậc vượt tối đa bị chặn. Cộng 0+2+2 với tối đa 3 → 3. Bậc, bậc kèm lượt bắt buộc, đủ lượt bắt buộc, ít nhất một lượt đều ra đúng.
- **Trạng thái tham gia:** chỉ lượt 0 điểm → Có tham gia; không lượt nào → absent; chỉ đăng ký được nhận mới vào bảng.
- **Khóa quy tắc:** thiếu lý do → `AMEND_REASON_REQUIRED`; BTV (faculty_executive) → `AMEND_FORBIDDEN`; xóa lượt đã mở → `SESSION_IN_USE`; mỗi lần điều chỉnh lưu trước/sau + lý do.
- **Quyền và riêng tư:** BTC Khoa khác/SV không cấu hình, không lấy QR; SV không đọc bí mật QR, không xem bảng điểm, không ghi trực tiếp. Không phát sinh `reputation_adjustments`. Audit có `request_id`.

Luồng UI:
1. BTC lập kế hoạch (tối đa 3, cộng từng lượt: Đầu giờ 0, Cuối giờ 3), mở lượt, hiển thị QR.
2. SV quét: lần đầu được nhận; quét lại bị chặn. SV có đăng ký bị từ chối không điểm danh được.
3. QR đổi sau 30 giây; mã cũ báo hết hiệu lực, mã mới được nhận.
4. Đóng lượt thì mã còn hạn cũng bị từ chối.
5. Bảng xem trước của BTC: "Đầu giờ, Cuối giờ · Hoàn thành · 3". Lịch sử ghi mở/đóng; quy tắc hiện đã khóa.
6. SV thấy các lượt của mình, không thấy điểm hay uy tín; SV mở trang BTC → 404.

Lần chạy đầu phát hiện trang QR và trang `/attend` trả 404: embed `event_programs` sai quan hệ khóa ngoại. Đã sửa và chạy lại. Ảnh chụp phát hiện QR lệch trái và ô điểm của lượt rơi xuống dòng; đã sửa.

Chưa chạy: E2E UC6/UC7, toàn bộ Vitest và build (để CI), pgTAP các file khác, kiểm thử đồng thời nhiều phiên cho điểm danh, Supabase cloud.

## UC9 — Nghiệm thu, uy tín, khiếu nại — 13/10/2026

Nhánh `feat/program-acceptance`, stack Supabase local (không cloud). Migration `202610160001_program_acceptance.sql` áp bằng `supabase migration up --local` (không `db reset`).

| Kiểm thử | Kết quả |
|---|---|
| pgTAP `009_program_acceptance.sql`: khóa (quyền, lượt còn mở, chặn mở lượt/đổi quy tắc/nhận đăng ký sau khóa), hồ sơ thiếu (3 thành phần, thiếu minh chứng), phiên bản tệp, báo cáo phải PDF, quyền nghiệm thu (BTC, người nộp có vai trò Văn phòng), lý do yêu cầu bổ sung, thiếu học kỳ, học kỳ chồng ngày, -5 đúng đối tượng (0 lượt bị trừ; 1 lượt 0 điểm, chờ duyệt, bị từ chối không trừ), nghiệm thu lặp, chạy lại bước trừ = 0, sổ và snapshot chỉ thêm, học kỳ đã dùng không đổi ngày, không hủy sau nghiệm thu, quyền riêng tư (SV không đọc sổ/snapshot, BTC không đọc sổ), khiếu nại (lượt chưa mở, trùng, SV tự xử lý, chờ duyệt), hoàn +5 đúng một lần qua 2 khiếu nại, khiếu nại bị từ chối không hoàn, snapshot v1 giữ nguyên, hạn khiếu nại hết học kỳ, chương trình hủy không trừ, audit có request_id | 64/64 PASS |
| pgTAP `005`, `007`, `008` (chạy lại vì migration đổi ràng buộc `event_programs` và thêm trigger vào bảng UC7/UC8) | 157/157 PASS |
| Vitest `tests/program-acceptance.test.ts` (chỉ tệp này; toàn bộ Vitest để CI chạy) | 6/6 PASS |
| Luồng UI Chrome (`2026990004` BTC, `2026990006` Văn phòng, `2026990001` Đoàn Trường, `2026990005` SV viewport điện thoại) | 20/22 PASS ở lần chạy chính; B4 chạy lại riêng PASS; B10 chỉ kiểm qua log server (xem dưới) |
| Lint, typecheck toàn repo (1 lần) | PASS |

Luồng UI: đóng lượt/đăng ký → BTC khóa → cảnh báo chưa có học kỳ → bảng: SV vắng = "Đăng ký nhưng không tham gia" → CSV + bản xem trước → tải Đơn đề nghị 2 lần, báo cáo, ảnh minh chứng → nộp → Văn phòng thấy hồ sơ trong hàng đợi → nghiệm thu bị chặn vì thiếu học kỳ → Đoàn Trường thêm HK1 2026-2027 → Văn phòng nghiệm thu, sổ ghi -5 → SV xem kết quả (không có chữ "uy tín") và khiếu nại lượt Đầu giờ → BTC chấp nhận → bảng "Đầu giờ (bổ sung qua khiếu nại)", snapshot v2 → Văn phòng thấy -5 và +5 → SV thấy "Có tham gia".

Hai bước đọc sai ở lần chạy chính: script lấy phần tử `role=alert` đầu tiên, trùng với route announcer của Next nên ra chuỗi rỗng.
- **B4 (hồ sơ thiếu):** chạy lại riêng trên chương trình `78312b4a`, UI hiện "Hồ sơ còn thiếu: Đơn đề nghị, Báo cáo kết quả, Ảnh minh chứng.", rồi mở khóa có lý do.
- **B10 (thiếu học kỳ):** log server ghi `review_rejected` với `TERM_NOT_CONFIGURED`. Không chụp được dòng thông báo trên UI, vì học kỳ đã được tạo ngay sau đó nên không lặp lại được.
