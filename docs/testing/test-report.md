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
