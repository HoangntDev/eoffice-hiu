# Impact Analysis – CR-01-TaiKhoanToChuc

Ngày lập: 30/10/2026. Issue #44 (Milestone TH3). Lập từ code trên `main` tại commit `e6a66db`.

## 1. Thông tin CR

- **Issue:** #37 (Milestone TH4, label `change-request`)
- **Hướng CR:** Kỹ thuật nâng cao khác
- **Tóm tắt thay đổi:** Thêm tài khoản tổ chức cho Đoàn Trường, Văn phòng Đoàn – Hội và các Đoàn Khoa. Đăng nhập tại `/admin/login` cần bốn thông tin: đơn vị, PIN tổ chức, MSSV cán bộ và PIN cá nhân. Từ đó, mọi thao tác quản lý chỉ chạy trong phiên tổ chức của đúng đơn vị. Tài khoản cá nhân bị từ chối ở tầng RPC/RLS, kể cả khi gọi thẳng API, trừ việc kiểm tra hồ sơ của CTV. Audit ghi cả đơn vị và cán bộ thao tác. Quy tắc "người lập không tự duyệt" xét theo cán bộ thao tác. Chức năng sinh viên giữ nguyên.
- **Thay cho:** hướng CR-01 cũ "Thông báo realtime" (đề xuất 29/10). Hướng đó chưa có tài liệu trong `docs/TH3/`; nay chuyển thành chức năng phát triển sau, không làm trong môn.
- **Yêu cầu:** R1–R9 và AC1–AC11 trong issue #37.

### Hiện trạng liên quan (đọc từ code)

- Quyền quản lý nằm ở `role_grants(user_id, role_code, organization_id)`, gắn thẳng với tài khoản sinh viên. Có 6 mã vai trò: `school_admin`, `office`, `committee_manager`, `collaborator`, `faculty_manager`, `faculty_executive`.
- Mọi RPC quản lý lấy người thao tác từ `auth.uid()` và kiểm quyền bằng một số hàm "cổng": `has_active_role`, `has_permission`, `event_program_manager_grant`, `event_program_reviewer_grant` (và `program_registration_manager_grant`, hàm gọi lại `event_program_manager_grant`). Một số RPC khác tự đọc `role_grants` theo `p_role_grant_id … and user_id = auth.uid()`.
- `auth.uid()` xuất hiện 107 lần trong 21 migration trên `main`. Các FK người thao tác (`audit_events.actor_user_id`, `event_program_history.actor_user_id`, `role_grants.granted_by`…) đều trỏ tới `accounts(user_id)`, tức tài khoản sinh viên.
- `account_emails` và `pending_account_registrations` bị ràng buộc `@student.hiu.vn` (migration `202610130002`). `accounts.student_code` bắt buộc là MSSV 10 số.
- Proxy (`src/proxy.ts`) chỉ phân biệt có phiên hay không và trạng thái `accounts.status`. Layout hiện menu theo `navAccess(roles)`.

## 2. Thành phần bị tác động (Impact Matrix)

Rủi ro: T = Thấp, TB = Trung bình, C = Cao (lý do ở mục 4). Test kiểm chứng: "pgTAP mới" là file `supabase/tests/009_organization_accounts.sql` dự kiến; "spike Sx" là kịch bản trong `scripts/spike-cr01.mjs` (mục 6).

### 2.1. Dữ liệu (bảng, ràng buộc, migration mới)

| Thành phần | Loại | Thay đổi dự kiến | Rủi ro | Test kiểm chứng |
|---|---|---|---|---|
| `organization_accounts` (mới) | dữ liệu | Mỗi đơn vị một dòng: `pin_hash` (bcrypt, `pgcrypto`), `status` `active`/`locked`. Trigger chỉ cho `school_union`, `office`, `faculty_union` | TB (R-3) | pgTAP mới, spike S8 |
| `organization_sessions` (mới) | dữ liệu | `session_id` của Supabase Auth → đơn vị, cán bộ, role grant, hạn phiên, `ended_at`. Bật RLS, chỉ đọc qua hàm `security definer` | C (R-1) | spike S1, S9 |
| `auth_attempts_action_check` | dữ liệu | Thêm action `org_login` để đếm lần sai PIN tổ chức theo đơn vị + IP | T | spike S7 |
| `audit_events` | dữ liệu | Thêm `acting_organization_id`, `organization_session_id`. `actor_user_id` giữ là cán bộ | T | spike S4 |
| `organization_units` | dữ liệu | Trigger mới: không cho đổi `unit_type` sang `class_union`/`school_committee` hay ngừng hoạt động khi còn tài khoản tổ chức đang mở (hoặc tự khóa tài khoản) | TB (R-3) | pgTAP mới |
| `202610130002_student_email_domain` | dữ liệu | **Không sửa.** Phương án chọn không tạo email cho tài khoản tổ chức (mục 2.6) | T | pgTAP 001, 003 giữ nguyên |
| Migration mới `2026103xxxxx_organization_accounts.sql` | dữ liệu | Version phải lớn hơn `202610170001` (cao nhất, ở `feat/program-publication`) | T | `supabase test db` trên stack tách biệt |

### 2.2. Nghiệp vụ: hàm kiểm quyền và RPC/RLS

| Thành phần (migration hiện tại) | Loại | Thay đổi dự kiến | Rủi ro | Test kiểm chứng |
|---|---|---|---|---|
| `current_org_unit_id()`, `current_org_session_id()` (mới) | nghiệp vụ | Đọc `auth.jwt()->>'session_id'`, so với `organization_sessions`. Phiên phải còn hạn, chưa kết thúc, còn trong `auth.sessions`; tài khoản tổ chức `active`, đơn vị hoạt động, role grant chưa thu hồi | C (R-1) | spike S2, S3, S9 |
| `verify_organization_pin`, `start_organization_session` (mới, chỉ `service_role`) | nghiệp vụ | Kiểm PIN tổ chức. Tạo phiên khi cán bộ `active` và có vai trò quản lý còn hiệu lực ở đúng đơn vị | TB (R-4) | spike S1, S6 |
| `has_active_role` (001) | nghiệp vụ | Vai trò quản lý chỉ có hiệu lực khi `rg.organization_id = current_org_unit_id()`. `collaborator` được miễn (ngoại lệ CTV). `committee_manager` tạm miễn vì Ban chưa có tài khoản (R-6) | C (R-2) | spike S3; pgTAP 002, 004, mới |
| `has_permission` (001) | nghiệp vụ | Các nhánh tự đọc `role_grants` (Đoàn Khoa: `class.manage`, `student.read_faculty`; Ban TC-KT: `student.read_all`) thêm điều kiện phiên tổ chức. Nhánh `school_admin`/`office` đi qua `has_active_role` nên tự áp dụng | C (R-2) | pgTAP 002, mới |
| `event_program_manager_grant` (`202610130001`) | nghiệp vụ | Thêm `rg.organization_id = current_org_unit_id()`. Kéo theo mọi RPC UC-B, UC-C, UC-D và RLS dùng hàm này | C (R-2) | spike S2, S2b, S3; pgTAP 005, 007, 008 |
| `event_program_reviewer_grant` (`202610130001`) | nghiệp vụ | Thêm điều kiện phiên Văn phòng | C (R-2) | spike S5; pgTAP 005 |
| `program_registration_manager_grant` (`202610150001`) | nghiệp vụ | Không sửa thân hàm, đổi theo `event_program_manager_grant` | TB | pgTAP 007, 008 |
| `can_view_event_program_internals`, `can_upload/read_event_program_object` + RLS `event_programs`, `event_program_documents`, `event_program_history` | nghiệp vụ | Không sửa thân hàm, đổi theo hai hàm grant. Phiên cá nhân của cán bộ không còn thấy bản nháp, PDF và lịch sử của đơn vị | TB (R-5) | pgTAP 005 |
| RPC UC-B: `save_event_program`, `attach_event_program_document`, `submit_event_program`, `review_event_program` | nghiệp vụ | Không sửa thân hàm. `actor_user_id = auth.uid()` vẫn là cán bộ, nên `SELF_REVIEW_FORBIDDEN` tự xét theo cán bộ (R6) | TB | spike S5; TC-UCB-01..03 |
| RPC UC-C: `save_program_registration_settings`, `set_program_registration_status`, `decide_program_registration`, `list_program_registrations`, `program_registration_summary` + RLS `program_registration_*` | nghiệp vụ | Không sửa thân hàm (qua hàm grant). `register_for_program` của sinh viên **không đổi** (R9) | TB | pgTAP 007; TC-UCC-01..04 |
| RPC UC-D: `save_attendance_plan`, `set_attendance_session_status`, `issue_attendance_qr`, `program_attendance_preview` + RLS `program_attendance_*` | nghiệp vụ | Không sửa thân hàm (qua hàm grant). `check_in_attendance` của sinh viên **không đổi** | TB | pgTAP 008; TC-UCD-01..05 |
| `review_union_application`, `record_paper_book_event` (`202609290002`) | nghiệp vụ | Đang đọc `role_grants where id = p_role_grant_id and user_id = auth.uid()`. Thêm: vai trò khác `collaborator` phải thuộc đơn vị của phiên. Sổ Đoàn đã qua `has_permission('paper_book.record')` | C (R-2) | pgTAP 002; TC-UCA-01..03 |
| `assign_membership_application`, `save_membership_check` (`202609290003`), `can_access_application` | nghiệp vụ | Giữ cho CTV (ngoại lệ R4). Nhánh Đoàn Khoa trong `can_access_application` thêm điều kiện phiên | TB (R-6) | pgTAP 002 |
| `grant_role`, `revoke_role` (001, `202609290006`) | nghiệp vụ | Actor đọc theo `p_actor_role_grant_id`. Thêm điều kiện đơn vị của grant = đơn vị của phiên (Đoàn Trường cấp mọi vai trò; Bí thư Đoàn Khoa cấp `faculty_executive`). `committee_manager` cấp CTV: tạm giữ (R-6) | C (R-2) | pgTAP 002, mới |
| `save_organization_unit`, `catalog_save_entity`, `change_student_code`, `save_reference_option`, `save_membership_checklist_definition` | nghiệp vụ | Không sửa thân hàm, đổi theo `has_active_role`/`has_permission` | TB | pgTAP 002, mới |
| Forms: RLS `form_templates`/`form_template_versions` và `save_form_template`, `publish_form_template_version`, `user_can_manage_forms_for_org` (`202610050011`) | nghiệp vụ | Mẫu biểu mẫu chỉ cho phiên Đoàn Trường (`has_active_role('school_admin')`). `user_can_manage_forms_for_org` tự đọc `role_grants`, thêm điều kiện phiên | TB | pgTAP 004 |
| RLS đọc `role_grants`, `audit_events`, `student_profiles`, `accounts` (`202609290003`, `202609290005`) | nghiệp vụ | Đổi theo `has_permission`/`has_active_role`. Phiên cá nhân của cán bộ chỉ còn đọc dữ liệu của chính mình | TB (R-5) | pgTAP 002 |
| `write_audit` (001) | nghiệp vụ | Ghi thêm `acting_organization_id`, `organization_session_id` | T | spike S4 |
| `bootstrap_school_admin` + `seed_camtinh_doan_template` (`202610140001`) | nghiệp vụ | Thêm bước tạo tài khoản tổ chức Đoàn Trường đầu tiên (PIN do người chạy script nhập). Hàm seed mẫu đọc `role_grants` để tìm admin: giữ | TB | pgTAP 006 |
| RPC quản lý tài khoản tổ chức (mới): tạo, đặt lại PIN, khóa/mở (phiên Đoàn Trường), đổi PIN (phiên của chính đơn vị) | nghiệp vụ | Mới. Có audit | TB | pgTAP mới |
| Nhánh chưa merge `feat/program-acceptance` (`202610160001`), `feat/program-publication` (`202610170001`) | nghiệp vụ | Không sửa (CLAUDE.md). RPC mới trên các nhánh này nếu dùng hàm grant sẽ tự theo; nếu tự đọc `role_grants` thì phải sửa khi đưa vào baseline | TB | Ghi chú khi merge |

### 2.3. Server và giao diện

| Thành phần | Loại | Thay đổi dự kiến | Rủi ro | Test kiểm chứng |
|---|---|---|---|---|
| `src/app/api/admin/login/route.ts` (mới) | nghiệp vụ | Kiểm giới hạn thử → PIN tổ chức → MSSV/PIN cá nhân (`signInWithPassword`) → lấy `session_id` từ access token → `start_organization_session`. Lỗi ở bước nào cũng trả một thông báo chung; lỗi sau khi đã đăng nhập thì `signOut` | C (R-4) | spike S1, S6, S7 |
| `src/app/api/auth/logout/route.ts` | nghiệp vụ | Đánh dấu `organization_sessions.ended_at` trước `signOut` (dù không đánh dấu, `auth.sessions` bị xóa cũng làm phiên mất hiệu lực) | T | spike S9 |
| `src/lib/auth/rate-limit.ts` | nghiệp vụ | Thêm action `org_login` (5 lần/15 phút, theo đơn vị + IP) | T | spike S7 |
| `src/lib/auth/dal.ts` | nghiệp vụ | Thêm `requireOrganizationSession()` (đơn vị, loại đơn vị, cán bộ). API quản lý dùng hàm này thay `requireUser()`; DB vẫn là lớp chặn cuối | TB | Vitest mới |
| `src/lib/auth/viewer.ts`, `roles.ts` (`navAccess`) | giao diện | Viewer có thêm `organization` (đơn vị, loại). Menu quản trị theo loại đơn vị, không theo `roles` của tài khoản cá nhân | TB | `tests/nav-access.test.ts` (sửa) |
| `src/proxy.ts` | cấu hình | Phân luồng: khách vào `/admin/*` → `/admin/login`. Phiên sinh viên vào `/admin/*` → `/admin/login`. Phiên tổ chức vào trang sinh viên → `/admin`. Cần đọc `organization_sessions` (qua RPC `current_org_unit_id`) mỗi request được bảo vệ | TB (R-7) | Vitest mới; spike (đọc thủ công) |
| `src/app/layout.tsx`, `src/components/account-menu.tsx` | giao diện | Thanh đầu trang hiện đơn vị + cán bộ khi ở phiên tổ chức. Bỏ link "Cơ cấu", "Xử lý hồ sơ" khỏi menu sinh viên | T | `tests/auth-ui.test.tsx` (sửa) |
| `src/app/login/page.tsx`, `src/components/auth-form-v2.tsx` | giao diện | Thêm link "Đăng nhập tài khoản tổ chức" | T | `tests/auth-ui.test.tsx` |
| `src/app/admin/login/page.tsx` (mới) | giao diện | Dropdown đơn vị nhóm theo cấp (chỉ đơn vị hoạt động, đã có tài khoản), PIN tổ chức, MSSV, PIN cá nhân | TB | AC1, AC2; test thủ công |
| `src/app/admin/layout.tsx`, `/admin` (mới) | giao diện | Khung quản trị, menu theo loại đơn vị | TB | AC9 |
| `/admin/programs` ← `src/app/programs/new`, `programs/[id]` (phần quản lý), `programs/[id]/registrations`, `programs/[id]/attendance`, `attendance/[sessionId]/qr` | giao diện | Chuyển phần quản lý của Đoàn Khoa sang `/admin/programs/...`. Trang `/programs` và `/programs/[id]` của sinh viên giữ phần xem và đăng ký | TB (R-8) | TC-UCB, TC-UCC-04, TC-UCD-01 |
| `/admin/reviews` ← `src/app/office/membership`, phần duyệt kế hoạch của Văn phòng | giao diện | Chuyển trang | TB | TC-UCA, TC-UCB-02/03 |
| `/admin/organization` ← `src/app/organization` | giao diện | Chuyển trang (cơ cấu, phân quyền) cho Đoàn Trường | TB | Test thủ công |
| `/admin/settings` (mẫu biểu mẫu, đổi PIN đơn vị) ← `src/app/forms/templates/*` | giao diện | Chuyển trang mẫu biểu mẫu; thêm form đổi PIN | TB | pgTAP 004; test thủ công |
| `/admin/accounts` (mới) | giao diện | Đoàn Trường tạo tài khoản tổ chức, đặt lại PIN, khóa/mở | TB | AC10 |
| Components quản lý: `event-program-actions`, `event-program-editor`, `program-registration-settings`, `registration-decision`, `attendance-plan-editor`, `attendance-session-controls`, `attendance-qr-display`, `membership-review-console`, `organization-console`, `form-template-editor`, `my-tasks` | giao diện | Đổi đường dẫn và nguồn quyền (viewer tổ chức thay cho `roles`). `my-tasks` bỏ phần việc quản lý khỏi trang sinh viên | TB | Vitest liên quan; test thủ công |
| API quản lý (`src/app/api/event-programs/**`, `attendance/sessions/**`, `union-membership/{review,paper-book,assignment,checklist-definition}`, `organization/**`, `admin/student-code`, `forms/templates/**`, `students`, `reference-options` POST) | nghiệp vụ | Đổi `requireUser()` → `requireOrganizationSession()`. `union-membership/checklist` của CTV giữ `requireUser()` | TB | spike S3 (`POST /api/event-programs` → 403) |
| `src/modules/event-programs/viewer.ts` | nghiệp vụ | `isReviewer`/`managerOrgIds` theo đơn vị của phiên | T | `tests/event-programs.test.ts` |

### 2.4. Script, test, tài liệu

| Thành phần | Loại | Thay đổi dự kiến | Rủi ro | Test kiểm chứng |
|---|---|---|---|---|
| `scripts/bootstrap-school-admin.mjs` (`npm run admin:bootstrap`) | cấu hình | Nhận thêm PIN tổ chức (nhập ẩn, không qua tham số dòng lệnh) và tạo tài khoản Đoàn Trường đầu tiên. Chạy lại thì báo đã khởi tạo | TB | AC10; pgTAP 006 |
| `scripts/seed-demo.mjs` | cấu hình | Tạo tài khoản tổ chức demo cho Đoàn Trường, Văn phòng, Đoàn Khoa CNKT (PIN demo ghi trong `docs/TH2/demo-data.md`). Lịch sử demo ghi trực tiếp vào bảng nên không phải đổi | T | Chạy seed trên stack tách biệt |
| pgTAP `002_authorization_workflow.sql` (10), `004_forms.sql` (14), `005_event_programs.sql` (35), `007_program_registrations.sql` (67), `008_program_attendance.sql` (55) | test | Fixture đang gọi RPC quản lý bằng `act_as(<user>)` (chỉ có `sub`). Thêm `act_as_org(<user>, <org>)`: tạo dòng `auth.sessions` + `organization_sessions` và đặt `session_id` vào claims. Thay ở các bước quản lý; giữ `act_as` ở bước sinh viên và thêm assertion "tài khoản cá nhân bị từ chối" | C (R-9) | Job `pgtap` |
| pgTAP `001` (9), `003` (10), `006` (5) | test | Không đổi (không gọi RPC quản lý bằng tài khoản cá nhân, hoặc chạy bằng service role) | T | Job `pgtap` |
| pgTAP `009_organization_accounts.sql` (mới) | test | Chặn Chi đoàn/Ban, PIN băm, phiên hết hạn/khóa/thu hồi vai trò, tài khoản cá nhân bị từ chối từng nhóm RPC, tự duyệt theo cán bộ, audit | — | Job `pgtap` |
| Vitest `tests/nav-access.test.ts`, `auth-ui.test.tsx`, `login-next-path.test.ts`, `validation.test.ts` | test | Menu theo loại đơn vị, link đăng nhập tổ chức, `safeNextPath` cho `/admin/login`, schema đăng nhập tổ chức | T | Job `build-test` |
| `docs/TH2/test-cases.md` + `docs/TH2/evidence/test-run/run-test-cases.mjs` | test | Bước quản lý (Mai, Quân) đăng nhập qua `/api/admin/login`. Thêm ca "cán bộ dùng tài khoản cá nhân → 403". Lần chạy mới ghi vào `docs/TH4/` | TB | 15 test case TH2 |
| `docs/testing/smoke-test.md` | tài liệu | Bước 7 (UC-C, sinh viên đăng ký) giữ nguyên. Thêm bước "đăng nhập tài khoản tổ chức, mở `/admin`" | T | Smoke test v1.1.0 |
| `docs/TH2/demo-data.md`, README, hướng dẫn triển khai, CHANGELOG | tài liệu | Tài khoản tổ chức demo, bước bootstrap mới | T | Đọc lại khi release |

### 2.5. Tổng hợp

| Nhóm | Số thành phần đổi | Ghi chú |
|---|---|---|
| Bảng/ràng buộc | 4 mới hoặc đổi + 1 trigger | Không sửa migration cũ |
| Hàm kiểm quyền "cổng" | 4 (`has_active_role`, `has_permission`, 2 hàm grant) + 4 hàm tự đọc `role_grants` (`review_union_application`, `grant_role`, `revoke_role`, `user_can_manage_forms_for_org`), `can_access_application` | Khoảng 30 RPC quản lý tự đổi theo, không sửa thân |
| Route/trang | 1 API mới, khoảng 25 route API đổi lớp kiểm phiên, 6 nhóm trang chuyển sang `/admin` | |
| pgTAP | 5 file sửa fixture + 1 file mới | 181/205 assertion hiện có nằm trong 5 file phải sửa |

### 2.6. So sánh phương án thiết kế

**(a) Lưu tài khoản tổ chức và email nội bộ**

| | A1. Tài khoản tổ chức là một người dùng Supabase Auth riêng, email nội bộ (ví dụ `<mã>@org.eoffice.invalid`) | A2. Tài khoản tổ chức là bản ghi `organization_accounts` (PIN băm bcrypt), không phải người dùng Auth, không có email (**chọn**) |
|---|---|---|
| Ràng buộc `@student.hiu.vn` (`202610130002`) | Phải nới hoặc tách bảng email; nếu ghi vào `account_emails` thì vi phạm ràng buộc | Không đụng |
| `accounts.student_code` bắt buộc MSSV | Không có MSSV, phải cho phép null hoặc tách bảng; ảnh hưởng mọi FK `accounts(user_id)` | Không đụng |
| Người thao tác trong audit/history | `auth.uid()` là tài khoản tổ chức, không phải người. Phải thêm cột cán bộ ở mọi bảng lịch sử và sửa khoảng 30 RPC | `auth.uid()` vẫn là cán bộ, các FK và `SELF_REVIEW_FORBIDDEN` giữ nguyên ý nghĩa |
| Bảo mật PIN | Supabase Auth quản lý mật khẩu | `pgcrypto` `crypt()` bcrypt cost 10, giới hạn thử ở server |

**Lý do chọn A2:** không phải nới quy tắc email đã chốt và không đổi nghĩa `auth.uid()` ở hơn 100 chỗ. Cán bộ vẫn là người thật đứng sau mọi thao tác.

**(b) Lưu cán bộ thao tác trong phiên**

| | B1. Bảng `organization_sessions` khóa bằng `session_id` của JWT Supabase (**chọn**) | B2. Ghi đơn vị vào `app_metadata` hoặc claim tùy biến (Custom Access Token Hook) | B3. Cookie riêng do Next.js ký, server truyền đơn vị/cán bộ vào RPC |
|---|---|---|---|
| Nhiều phiên song song | Mỗi phiên một dòng; cùng cán bộ có thể vừa có phiên cá nhân vừa có phiên tổ chức | `app_metadata` theo người dùng, không theo phiên: đăng nhập cá nhân cũng mang claim tổ chức | Được |
| Thu hồi tức thì (khóa tài khoản, thu hồi vai trò, đăng xuất) | Có, vì hàm đọc bảng mỗi lần gọi | Claim nằm trong JWT tới khi hết hạn (mặc định 1 giờ) | Phụ thuộc server |
| Gọi thẳng RPC bằng token | DB tự kiểm | DB kiểm claim | RPC phải nhận tham số đơn vị/cán bộ từ client: dễ giả mạo, hoặc phải gọi bằng service role và bỏ RLS |
| Cấu hình thêm | Không | Hook trong `config.toml` và trên cloud | Secret ký cookie |

**Lý do chọn B1:** thu hồi có hiệu lực ngay, phiên cá nhân và phiên tổ chức của cùng một người tách bạch, không cần cấu hình Auth Hook.

**(c) Cách RPC nhận biết phiên tổ chức**

| | C1. Một hàm trung tâm `current_org_unit_id()`, gắn vào các hàm kiểm quyền "cổng" (**chọn**) | C2. Thêm tham số phiên vào từng RPC và kiểm trong thân hàm |
|---|---|---|
| Số chỗ sửa | 4 hàm cổng + 5 hàm tự đọc `role_grants` | Khoảng 30 RPC, cả chữ ký hàm (đổi chữ ký kéo theo đổi `grant execute` và code gọi) |
| Bỏ sót | Thấp: RPC mới dùng hàm cổng thì tự được bảo vệ | Cao: mỗi RPC mới phải nhớ kiểm |
| Chi phí | Thêm 1 truy vấn theo khóa chính mỗi lần kiểm quyền (đo ở mục 6) | Tương tự |

**Lý do chọn C1:** ít chỗ sửa, khó bỏ sót, và các RPC hiện có không đổi chữ ký nên API/route không phải sửa phần gọi RPC.

### 2.7. Ước lượng khối lượng

Ước lượng cho một người, tính từ khi Impact Analysis được merge (30/10) đến hạn TH4 (09/11).

| Phần việc | Giờ |
|---|---|
| Migration: 2 bảng, trigger, hàm phiên, sửa 4 hàm cổng + 5 hàm tự đọc `role_grants`, RPC quản lý tài khoản tổ chức, bootstrap | 8–10 |
| pgTAP: `act_as_org` cho 5 file, file `009` (khoảng 30 assertion) | 6–8 |
| Server: `/api/admin/login`, logout, `dal`, `viewer`, `proxy`, đổi lớp kiểm phiên ở khoảng 25 route API | 5–7 |
| Giao diện: `/admin/login`, khung `/admin` + menu, chuyển 6 nhóm trang quản lý | 10–14 |
| `/admin/accounts`, `/admin/settings` (đổi PIN) | 4–6 |
| Seed demo, script bootstrap, chạy lại test case TH2, smoke test | 3–4 |
| Vitest (menu, schema, proxy), tài liệu, review, CI | 4–5 |
| **Tổng** | **40–54** |

**Thứ tự cắt giảm nếu không kịp 09/11** (cắt từ trên xuống; phần giữ lại phải đủ cho UC-B, UC-C, UC-D chạy bằng phiên tổ chức):

1. `/admin/settings` đổi PIN qua giao diện. Giữ RPC, đổi PIN bằng script.
2. `/admin/accounts` giao diện. Tạo, đặt lại, khóa/mở bằng script service role.
3. Chuyển trang Đoàn Trường (cơ cấu, phân quyền, mẫu biểu mẫu) sang `/admin`. RPC vẫn đòi phiên Đoàn Trường, trang cũ dùng được trong phiên tổ chức.
4. UC-A (hồ sơ Đoàn viên, Sổ Đoàn) trong phiên Văn phòng. Nếu cắt thì giữ `review_union_application`/`record_paper_book_event` như hiện tại và ghi rõ là chưa đạt R4 cho Văn phòng.

**Không cắt:** bảng và hàm phiên, đăng nhập `/admin/login`, chặn tài khoản cá nhân ở hai hàm grant (UC-B, UC-C, UC-D), audit, pgTAP 005/007/008/009, chặn Chi đoàn.

## 3. Dependency, dịch vụ và cấu hình mới

- **Không thêm package npm.** Dùng `@supabase/ssr`, `@supabase/supabase-js`, `zod` hiện có.
- **Extension `pgcrypto`:** đã bật từ migration `202609290001`. Supabase đặt hàm ở schema `extensions`, nên hàm mới khai báo `search_path = public, extensions`.
- **Supabase Auth:** dựa vào claim `session_id` trong access token và bảng `auth.sessions`. Không cần Auth Hook, không đổi `config.toml`.
- **Biến môi trường:** không thêm. `AUTH_RATE_LIMIT_PEPPER` dùng chung cho băm định danh `org_login`.
- **Cấu hình nghiệp vụ:** hạn phiên tổ chức (spike: 8 giờ), số lần sai PIN tổ chức (5 lần/15 phút). Ghi vào Configuration Inventory TH2 (`docs/TH2/config-dependency.md`) khi hiện thực.
- **Vận hành:** bước mới sau `admin:bootstrap` là nhập PIN tổ chức Đoàn Trường đầu tiên. Không đụng Supabase cloud trong môn.

## 4. Rủi ro và phương án xử lý

| Mã | Rủi ro | Mức | Phương án |
|---|---|---|---|
| R-1 | Phiên tổ chức dựa vào `session_id` trong JWT. Nếu Supabase đổi định dạng claim, hoặc phiên được làm mới (refresh) sinh `session_id` khác, phiên tổ chức sẽ mất | Cao | Spike S10: refresh giữ nguyên `session_id`, phiên tổ chức còn hiệu lực. Khi hiện thực, giữ test này trong pgTAP/Vitest để phát hiện nếu Supabase đổi hành vi. Hàm chỉ trả null (từ chối), không bao giờ mở quyền khi lỗi |
| R-2 | Bỏ sót một đường kiểm quyền, khiến tài khoản cá nhân vẫn làm được việc quản lý | Cao | Gom vào 4 hàm cổng. `grep` mọi chỗ đọc `role_grants` (đã liệt kê ở 2.2). pgTAP `009` thử từng nhóm RPC bằng phiên cá nhân |
| R-3 | Tạo được tài khoản cho Chi đoàn qua đường khác (sửa `unit_type` sau khi tạo) | Trung bình | Trigger trên cả `organization_accounts` và `organization_units` |
| R-4 | Đăng nhập 4 thông tin để lộ thông tin nào sai (MSSV có tồn tại, cán bộ có thuộc đơn vị), hoặc dò PIN tổ chức | Trung bình | Một thông báo chung, giới hạn 5 lần/15 phút cho PIN tổ chức. Cần thêm kiểm tra thời gian phản hồi giữa các nhánh sai |
| R-5 | Cán bộ quen dùng tài khoản cá nhân, sau thay đổi không thấy dữ liệu quản lý trên trang sinh viên | Trung bình | Link "Đăng nhập tài khoản tổ chức" ở `/login`, hướng dẫn trong tài liệu, dữ liệu demo có tài khoản tổ chức |
| R-6 | Ban (`school_committee`) chưa có tài khoản, nhưng `committee_manager` đang giao hồ sơ cho CTV và cấp vai trò CTV | Trung bình | Trong CR: `committee_manager` tạm giữ quyền bằng tài khoản cá nhân như CTV, ghi rõ ở issue. Khi làm tài khoản Ban thì đưa vào phiên tổ chức |
| R-7 | Hàm kiểm phiên chạy ở mọi lần kiểm quyền, và proxy phải gọi DB mỗi request để biết loại phiên, làm chậm trang | Trung bình | Spike đo được bản SQL chậm khoảng 35 lần, bản plpgsql 5–6 lần (khoảng 0,1 ms/lần, mục 6). Dùng plpgsql; RLS gọi `(select current_org_unit_id())`. Quyền thật vẫn do DB kiểm |
| R-8 | Chuyển trang sang `/admin` làm gãy link cũ, bookmark, link trong "Việc của tôi" | Thấp | Chuyển hướng 308 từ đường dẫn cũ trong một bản phát hành |
| R-9 | Sửa fixture pgTAP 5 file (181 assertion) làm thay đổi ý nghĩa test cũ | Cao | Sửa theo RED → GREEN: thêm assertion "phiên cá nhân bị từ chối" trước (RED), rồi thêm phiên tổ chức (GREEN). Không xóa assertion cũ |
| R-10 | Phiên tổ chức dùng được chức năng sinh viên (đăng ký, điểm danh) của chính cán bộ qua API | Thấp | Proxy chặn trang sinh viên. R9 không đổi RPC sinh viên. Chặn thêm ở DB nếu cần, ghi khi hiện thực |
| R-11 | Không kịp 09/11 | Trung bình | Thứ tự cắt giảm ở 2.7 |

## 5. Bộ test hồi quy (test tự động + test case từ TH2)

Số liệu hiện có trên `main` (`e6a66db`, chạy ngày 30/10/2026):

| Bộ | Quy mô | Cách chạy | Đổi gì |
|---|---|---|---|
| Vitest | 13 file, 142 test, PASS (`npx vitest run`) | Job `build-test` | Sửa `nav-access`, `auth-ui`; thêm test schema đăng nhập tổ chức, `safeNextPath` cho `/admin`, phân luồng proxy |
| pgTAP | 8 file, 205 assertion theo `plan()` | Job `pgtap` (`supabase test db`) | Sửa fixture 002, 004, 005, 007, 008; thêm `009_organization_accounts.sql` |
| Test case TH2 | 15 ca: TC-UCA-01..03, TC-UCB-01..03, TC-UCC-01..04, TC-UCD-01..05 (`docs/TH2/test-cases.md`) | `run-test-cases.mjs` trên bản build + DB demo tách biệt | Bước của Mai (Văn phòng), Quân (Đoàn Khoa) đăng nhập tổ chức. Thêm ca "cán bộ dùng tài khoản cá nhân → 403" cho UC-A, UC-B, UC-C, UC-D. Ca của sinh viên giữ nguyên (R9) |
| Smoke test | 8 bước (`docs/testing/smoke-test.md`) | Thủ công + Playwright trên artifact | Giữ 8 bước. Bước 7 (sinh viên đăng ký UC-C) không đổi. Thêm bước đăng nhập tổ chức, mở `/admin` |

Ưu tiên khi hồi quy: UC-B, UC-C, UC-D trước (theo thứ tự cắt giảm), rồi UC-A.

## 6. Kết quả thử nghiệm kỹ thuật (spike)

**Branch:** `spike/CR-01-TaiKhoanToChuc` (commit `688f9d5`, không merge). **Ngày chạy:** 30/10/2026.

**Môi trường:** worktree riêng, stack Supabase tách biệt `project_id = "eoffice-cr01-spike"` (cổng 573xx, CLI 2.117.0, PostgreSQL 17.6). Không đụng stack `hiu-youth-e-office` (543xx) và `hiu-eoffice-demo` (553xx), không áp migration mới vào DB local đang dùng. Web: `next dev -p 3401`. Dữ liệu: MSSV giả `999…`, email `999…@student.hiu.vn`, khoa "Khoa Spike CR-01".

**Nội dung spike** (đúng phương án chọn ở 2.6: A2 + B1 + C1):

- Migration `202610300001_cr01_spike_organization_sessions.sql`: `organization_accounts` (trigger chặn đơn vị không hợp lệ), `organization_sessions`, `current_org_unit_id()`, `verify_organization_pin`, `start_organization_session`. Gắn điều kiện phiên vào `has_active_role`, `event_program_manager_grant`, `event_program_reviewer_grant`. `write_audit` ghi đơn vị và phiên.
- Migration `202610300002_cr01_spike_session_check_plpgsql.sql`: viết lại 4 hàm trên bằng plpgsql sau khi đo chi phí (xem kết quả 5).
- Route `POST /api/admin/login`, action `org_login` trong `rate-limit.ts`, schema `organizationLoginSchema`.
- Script `scripts/spike-cr01.mjs`: 14 kịch bản S1–S11 gọi API và RPC thật, đọc DB bằng `psql`.

**Kết quả** (log: `spike/spike-lan-1.log`, `spike-lan-2.log`, `spike-lan-3.log`, chạy 3 lần liên tiếp):

| Kịch bản | Chứng minh | Kết quả (lần 1) |
|---|---|---|
| S1 | Đăng nhập tổ chức tạo phiên | `/api/admin/login` 200; `organization_sessions` có dòng `session_id` → đúng Đoàn Khoa và cán bộ A |
| S2 | RPC nhận đúng đơn vị + cán bộ | `current_org_unit_id()` = Đoàn Khoa đã chọn; `save_event_program` OK; `event_program_history.actor_user_id` = cán bộ A |
| S2b | Phiên đơn vị A không làm việc của đơn vị B | Tạo chương trình cho Đoàn Khoa khác → `FORBIDDEN` |
| S3 | Tài khoản cá nhân bị chặn | Cùng cán bộ A đăng nhập `/login` (200): RPC `save_event_program` → `FORBIDDEN`; `current_org_unit_id()` = null; `has_active_role('office')` = false; `POST /api/event-programs` → 403 |
| S4, S4b | Audit ghi đủ | `audit_events` của `event_program.created`: `actor_user_id` = cán bộ A, `organization_id` = `acting_organization_id` = Đoàn Khoa, `organization_session_id` = phiên. Có 1 dòng `organization_session.started` |
| S5 | Tự duyệt xét theo cán bộ | Kế hoạch do A nộp (phiên Đoàn Khoa). A đăng nhập phiên Văn phòng và duyệt → `SELF_REVIEW_FORBIDDEN`. B phiên cá nhân → `FORBIDDEN`. B phiên Văn phòng → `approved` |
| S6, S6b | Một thông báo lỗi chung | 5 tình huống sai (PIN tổ chức, MSSV, PIN cá nhân, cán bộ không thuộc đơn vị, không có vai trò) → cùng `401` và cùng một câu. 0 phiên tổ chức được tạo |
| S7 | Khóa tạm PIN tổ chức | 5 lần sai → 401; lần 6 với PIN đúng → 429; IP khác → vẫn thử được (401); đơn vị khác cùng IP → 200 |
| S8 | DB chặn Chi đoàn và Ban | Thêm `organization_accounts` cho `class_union` và `school_committee` → `ORG_ACCOUNT_UNIT_NOT_ALLOWED` |
| S9 | Thu hồi tức thì | Token cũ sau khi khóa tài khoản tổ chức → `FORBIDDEN`; sau đăng xuất → `FORBIDDEN` |
| S10 | Làm mới token giữ phiên (rủi ro R-1) | `session_id` trước và sau `refreshSession` giống nhau; `current_org_unit_id()` vẫn là Văn phòng |
| S11 | Chi phí kiểm phiên | Xem kết quả 5 |

**Số liệu:**

1. **14/14 kịch bản PASS ở cả 3 lần chạy.** Lần chạy thử đầu có S8 FAIL do lỗi của script: DB spike chưa có lớp nên không tạo được Chi đoàn. Đã sửa script để tự tạo ngành, khóa, lớp; không phải sửa migration.
2. **Thời gian `/api/admin/login` thành công** (3 lần mỗi lượt chạy, `next dev`): 261/250/293 ms, 228/235/268 ms, 260/227/241 ms. Gồm kiểm PIN bcrypt (cost 10), `signInWithPassword` và tạo phiên.
3. **pgTAP hiện có chạy trên stack spike** (`spike/pgtap-tren-spike.log`): 001, 003, 006 PASS (24 assertion). 002 (3/10 FAIL), 004 (2/14 FAIL), 005 (dừng ở 18/35), 007 (dừng ở 16/67), 008 (dừng ở 9/55) FAIL. Tổng chạy 91/205 assertion. Lỗi gốc là `FORBIDDEN` do fixture gọi RPC quản lý bằng phiên cá nhân. `PROGRAM_NOT_FOUND`, `SESSION_NOT_FOUND` là lỗi dây chuyền vì dữ liệu chưa được tạo. Kết quả khớp dự đoán ở 2.4: đúng 5 file phải sửa fixture, 3 file không đổi.
4. **Không phải đổi** chữ ký RPC, code gọi RPC trong route, hay bảng lịch sử. `SELF_REVIEW_FORBIDDEN` tự đúng theo cán bộ (S5).
5. **Chi phí kiểm phiên** (`spike/do-chi-phi-kiem-phien.txt`, 10.000 lần gọi): thân `has_active_role` trước CR khoảng 0,017 ms/lần. Bản SQL đầu tiên khoảng 0,60 ms/lần (chậm khoảng 35 lần), vì hàm SQL `security definer` có `SET search_path` không được inline và phép nối 5 bảng được lập kế hoạch lại mỗi lần gọi. Bản plpgsql khoảng 0,08–0,11 ms/lần (5–6 lần so với trước CR). **Phát hiện khi spike:** hàm kiểm phiên phải viết bằng plpgsql, và RLS nên gọi dạng `(select public.current_org_unit_id())` để tính một lần mỗi câu lệnh.
6. Số liệu đầu tiên của S11 và thời gian đăng nhập bị nhiễu do máy đang build poppler bằng Homebrew (load average 37). Sau khi dừng build, đã đo lại; mục này chỉ dùng số đo sau đó.

**Kết luận:** phương án A2 + B1 + C1 chạy được. Phiên tổ chức gắn đơn vị + cán bộ, tài khoản cá nhân bị chặn ở tầng RPC, audit ghi đủ, thu hồi có hiệu lực ngay, và refresh token không làm mất phiên. Khi hiện thực trên `cr/CR-01-TaiKhoanToChuc` cần làm thêm:

- Viết các hàm kiểm phiên bằng plpgsql. RLS gọi dạng `(select …)`.
- Phủ các hàm tự đọc `role_grants` mà spike chưa sửa: `has_permission`, `review_union_application`, `grant_role`, `revoke_role`, `can_access_application`, `user_can_manage_forms_for_org`.
- Thêm trigger trên `organization_units` (R-3).
- Đánh dấu `ended_at` khi đăng xuất.

Spike chưa làm giao diện `/admin`, phân luồng proxy và quản lý tài khoản tổ chức. Phần này nằm trong ước lượng ở 2.7.

## 7. Bộ câu kiểm tra chuẩn – golden set (CR tích hợp AI)

Không áp dụng. CR-01-TaiKhoanToChuc thuộc hướng "Kỹ thuật nâng cao khác", không dùng mô hình AI, nên không có đầu ra cần chấm bằng golden set. Tính đúng được kiểm bằng pgTAP, Vitest, test case TH2 và smoke test (mục 5).
