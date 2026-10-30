# Impact Analysis – CR-01-TaiKhoanToChuc

Lập ngày 30/10/2026 (issue #44, PR #45), lập từ code trên `main` tại commit `e6a66db`. Cập nhật cùng ngày (issue #46) theo yêu cầu mới:

- R2 đổi thành đăng nhập hai bước.
- Phương án ưu tiên là cấp `role_grants` cho chính tài khoản tổ chức.
- Đánh giá khóa ngoại tới `accounts(user_id)`.
- Lập kế hoạch chuyển dữ liệu.

Phương án và spike lần 1 vẫn được giữ ở mục 2.6 và mục 6 để so sánh.

## 1. Thông tin CR

- **Issue:** #37 (Milestone TH4, label `change-request`)
- **Hướng CR:** Kỹ thuật nâng cao khác
- **Tóm tắt thay đổi:**
  - Thêm tài khoản tổ chức cho Đoàn Trường, Văn phòng Đoàn – Hội và các Đoàn Khoa.
  - Đăng nhập hai bước:
    - Bước 1 ở `/admin/login`: chọn đơn vị và nhập PIN tổ chức. Hệ thống tạo phiên tạm, hết hạn sau 5 phút, chưa thao tác được.
    - Bước 2 ở `/admin/login/officer`: nhập MSSV và PIN cá nhân của cán bộ là thành viên còn hiệu lực của đơn vị. Đúng thì vào `/admin`.
  - Nút "Đổi cán bộ" quay về bước 2 mà không nhập lại PIN tổ chức. Thanh trên cùng luôn hiện đơn vị và cán bộ.
  - Quyền quản lý (`role_grants`) chuyển từ tài khoản cá nhân sang tài khoản tổ chức. Cán bộ trở thành thành viên đơn vị, chỉ dùng để xác thực.
  - RPC/RLS kiểm quyền giữ nguyên. `write_audit` ghi cán bộ thao tác. Quy tắc "người lập không tự duyệt" xét theo cán bộ.
  - Chức năng sinh viên giữ nguyên. CTV vẫn dùng tài khoản cá nhân.
- **Thay cho:** hướng CR-01 cũ "Thông báo realtime" (đề xuất 29/10). Hướng đó chưa có tài liệu trong `docs/TH3/`; nay chuyển thành chức năng phát triển sau, không làm trong môn.
- **Yêu cầu:** R1–R9 và AC1–AC13 trong issue #37.

### Hiện trạng liên quan (đọc từ code)

- Quyền quản lý nằm ở `role_grants(user_id, role_code, organization_id)`, gắn thẳng với tài khoản sinh viên. Có 6 mã vai trò: `school_admin`, `office`, `committee_manager`, `collaborator`, `faculty_manager`, `faculty_executive`.
- RPC quản lý lấy người thao tác từ `auth.uid()` và kiểm quyền qua các hàm "cổng": `has_active_role`, `has_permission`, `event_program_manager_grant`, `event_program_reviewer_grant`. Một số RPC tự đọc `role_grants` theo `p_role_grant_id … and user_id = auth.uid()`.
- Có 32 hàm dùng hàm cổng hoặc đọc `role_grants`. 23 trong số đó ghi dữ liệu, và 22/23 có gọi `write_audit` hoặc ghi `audit_events`. Hàm duy nhất không ghi audit là `save_membership_check`, của CTV.
- Khoảng 40 trên 54 policy RLS gọi các hàm cổng.
- 45 cột khóa ngoại trỏ tới `accounts(user_id)`, ví dụ `role_grants.user_id`, `granted_by`, `revoked_by`; `event_programs.created_by`, `decided_by`; `audit_events.actor_user_id`; `event_program_history.actor_user_id`.
- `accounts.student_code` bắt buộc là MSSV hợp lệ, do check `accounts_student_code_current_rule` và trigger `accounts_validate_student_code` kiểm. `account_emails` và `pending_account_registrations` bị ràng buộc `@student.hiu.vn` (migration `202610130002`).
- Proxy (`src/proxy.ts`) chỉ phân biệt có phiên hay không và trạng thái `accounts.status`. Layout hiện menu theo `navAccess(roles)`, tức `role_grants` của người đang đăng nhập.

## 2. Thành phần bị tác động (Impact Matrix)

Rủi ro: T = Thấp, TB = Trung bình, C = Cao (lý do ở mục 4). "Spike Lx/Mx" là kịch bản trong `scripts/spike-cr01.mjs` của spike lần 2 (mục 6).

### 2.1. Dữ liệu

| Thành phần | Loại | Thay đổi dự kiến | Rủi ro | Test kiểm chứng |
|---|---|---|---|---|
| `accounts` | dữ liệu | Thêm `account_type` (`student` mặc định, `organization`) và `organization_id` (duy nhất). `student_code` cho phép null **chỉ** khi là tài khoản tổ chức (viết lại check `accounts_student_code_current_rule`). Trigger mới: tài khoản tổ chức chỉ cho `school_union`, `office`, `faculty_union`; không đổi được loại | C (R-1) | pgTAP 009 (18 assertion trên spike) |
| `enforce_current_student_code_rule` (`202609290006`) | dữ liệu | Chỉ kiểm MSSV khi `account_type = 'student'` | TB | pgTAP 009 |
| `account_emails` | dữ liệu | **Giữ** ràng buộc `@student.hiu.vn`. Trigger mới chặn dòng email cho tài khoản tổ chức. Email Auth của tài khoản tổ chức (`org-<id>@org.eoffice.invalid`) chỉ nằm trong `auth.users` | T | pgTAP 009 |
| `role_grants` | dữ liệu | Trigger mới: vai trò `school_admin`, `office`, `faculty_manager`, `faculty_executive` chỉ cấp cho tài khoản tổ chức của chính đơn vị đó. `collaborator`, `committee_manager` chỉ cấp cho tài khoản sinh viên | C (R-2) | pgTAP 009; spike L11 |
| `organization_units` | dữ liệu | Trigger mới: không đổi được `unit_type` sang loại không có tài khoản khi đơn vị đã có tài khoản tổ chức | TB (R-3) | pgTAP mới |
| `organization_members` (mới) | dữ liệu | Cán bộ của đơn vị: `member_role` (`manager`, `executive`, `officer`), nguồn từ role grant cũ, thu hồi. Trigger: thành viên phải là tài khoản sinh viên | TB | pgTAP 009; spike L9 |
| `organization_pins` (mới) | dữ liệu | PIN tổ chức băm bcrypt (`pgcrypto`, cost 10), tách khỏi mật khẩu Auth | TB (R-4) | spike L3, L8 |
| `organization_login_challenges` (mới) | dữ liệu | Phiên tạm của bước 1: id ngẫu nhiên trong cookie httpOnly, hạn 5 phút, dùng một lần | TB | spike L1, L2b, L4 |
| `organization_session_officers` (mới) | dữ liệu | `session_id` của phiên Auth tài khoản tổ chức → cán bộ, thành viên, `ended_at` | TB | spike L2, L5 |
| `audit_events` | dữ liệu | Thêm `officer_user_id`, `organization_session_id`. `actor_user_id` là tài khoản tổ chức | T | spike L2, L5 |
| `event_program_history`, `program_registration_history`, `program_attendance_history` | dữ liệu | Thêm `actor_officer_user_id`. `actor_name` hiển thị "Đơn vị – Cán bộ" | T | spike L2 |
| `auth_attempts_action_check` | dữ liệu | Thêm action `org_login` | T | spike L10 |
| Migration chuyển dữ liệu (mục 2.8) | dữ liệu | Chuyển `role_grants` quản lý của tài khoản cá nhân sang tài khoản tổ chức; đưa cán bộ vào `organization_members` | C (R-5) | spike M1, M1b, M2 |
| Migration mới `2026103xxxxx_organization_accounts.sql` | dữ liệu | Version phải lớn hơn `202610170001` (cao nhất, ở `feat/program-publication`). Không sửa migration cũ | T | `supabase test db` trên stack tách biệt |

### 2.2. Nghiệp vụ: hàm và RPC/RLS

| Thành phần | Loại | Thay đổi dự kiến | Rủi ro | Test kiểm chứng |
|---|---|---|---|---|
| `has_active_role`, `has_permission`, `event_program_manager_grant`, `event_program_reviewer_grant`, `program_registration_manager_grant`, `can_access_application`, `user_can_manage_forms_for_org` | nghiệp vụ | **Không sửa.** Các hàm này đọc `role_grants` của `auth.uid()`. Trong phiên tổ chức, `auth.uid()` là tài khoản tổ chức, nên quyền đi theo đơn vị. Tài khoản cá nhân không còn vai trò quản lý nên tự bị từ chối | T | spike M2, L2c |
| 32 RPC quản lý (UC-A, UC-B, UC-C, UC-D, cơ cấu, biểu mẫu) và khoảng 40 policy RLS | nghiệp vụ | **Không sửa.** `created_by`, `decided_by`, `granted_by`… nhận tài khoản tổ chức (là một dòng `accounts`, thỏa khóa ngoại) | TB (R-6) | pgTAP 002, 004, 005, 007, 008 (sau khi sửa fixture) |
| `write_audit` (001) | nghiệp vụ | Ghi `officer_user_id` và `organization_session_id`. Nếu `auth.uid()` là tài khoản tổ chức mà phiên không có cán bộ còn hiệu lực thì báo `OFFICER_REQUIRED`. Vì 22/23 RPC ghi dữ liệu đều đi qua `write_audit`, phiên tổ chức không có cán bộ không ghi được | C (R-7) | spike L5, L7, L9 |
| `review_event_program` (`202610130001`) | nghiệp vụ | Quy tắc tự duyệt so sánh `coalesce(actor_officer_user_id, actor_user_id)` với cán bộ hiện tại. Thân hàm còn lại giữ nguyên | TB | spike L6; TC-UCB-01 |
| `fill_event_program_history_actor` (dùng cho 3 bảng lịch sử) | nghiệp vụ | Điền `actor_officer_user_id`, tên "Đơn vị – Cán bộ" | T | spike L2 |
| `bootstrap_school_admin` (001, `202610140001`) | nghiệp vụ | Đang cấp `school_admin` cho tài khoản sinh viên, nên sẽ bị trigger `role_grants` mới chặn. Viết lại: tạo tài khoản tổ chức Đoàn Trường, đặt PIN, thêm người chạy làm thành viên. **Spike chưa làm** | TB | pgTAP 006 (sửa) |
| `grant_role`, `revoke_role` | nghiệp vụ | Không sửa thân hàm. Nhánh Bí thư Đoàn Khoa cấp `faculty_executive` cho cá nhân không còn dùng (trigger chặn); thay bằng thêm thành viên `executive`. Đoàn Trường vẫn cấp CTV qua `grant_role` | TB (R-8) | pgTAP 002 (sửa) |
| Hàm mới (service role): `start_organization_login`, `read_organization_login`, `organization_member_for`, `start_officer_session`, `end_officer_session`, `create_organization_account`, `set_organization_pin` | nghiệp vụ | Mới | TB | spike L1–L10 |
| Hàm mới (phiên Đoàn Trường): tạo tài khoản tổ chức, đặt lại PIN, khóa/mở; thêm/thu hồi thành viên. Hàm mới (phiên của chính đơn vị): đổi PIN | nghiệp vụ | Mới, có audit. **Spike chưa làm** | TB | pgTAP mới |
| Nhánh chưa merge `feat/program-acceptance` (`202610160001`), `feat/program-publication` (`202610170001`) | nghiệp vụ | Không sửa (CLAUDE.md). RPC dùng hàm cổng và `write_audit` sẽ tự đúng. Khi đưa vào baseline, fixture pgTAP của nhánh phải tạo tài khoản tổ chức | TB | Ghi chú khi merge |

### 2.3. Server và giao diện

| Thành phần | Loại | Thay đổi dự kiến | Rủi ro | Test kiểm chứng |
|---|---|---|---|---|
| `src/app/api/admin/login/route.ts` (mới, bước 1) | nghiệp vụ | Giới hạn thử `org_login` → kiểm PIN tổ chức → tạo phiên tạm, đặt cookie `org_login` (httpOnly, `SameSite=Strict`, 300 giây) | TB (R-4) | spike L1, L3, L10 |
| `src/app/api/admin/login/officer/route.ts` (mới, bước 2) | nghiệp vụ | Đọc phiên tạm → kiểm MSSV và PIN cá nhân bằng client tạm (`signInWithPassword` rồi `signOut({ scope: "local" })`, không đụng phiên cá nhân khác của cán bộ) → kiểm thành viên → dùng phiên tạm → tạo phiên Auth của tài khoản tổ chức bằng `admin.generateLink` + `verifyOtp` (magic link) → `start_officer_session` | C (R-7) | spike L2, L3, L4 |
| `src/app/api/admin/switch-officer/route.ts` (mới, "Đổi cán bộ") | nghiệp vụ | Kết thúc dòng cán bộ của phiên, `signOut({ scope: "local" })`, tạo phiên tạm mới cho cùng đơn vị, về bước 2 | TB | spike L5 |
| `src/lib/auth/organization-login.ts` (mới), `rate-limit.ts` | nghiệp vụ | Cookie phiên tạm, kiểm PIN cá nhân, action `org_login` | T | spike |
| `src/app/api/auth/logout/route.ts` | nghiệp vụ | Phiên tổ chức: gọi `end_officer_session` trước `signOut` | T | Vitest mới |
| `src/lib/auth/dal.ts` | nghiệp vụ | Thêm `requireOrganizationSession()` (tài khoản tổ chức + cán bộ). API quản lý dùng hàm này; DB vẫn là lớp chặn cuối | TB | Vitest mới |
| `src/lib/auth/viewer.ts`, `roles.ts` | giao diện | Viewer thêm `accountType`, đơn vị, cán bộ. `navAccess(roles)` dùng tiếp được vì `role_grants` nay thuộc tài khoản tổ chức | T | `tests/nav-access.test.ts` |
| `src/proxy.ts` | cấu hình | Khách hoặc phiên sinh viên vào `/admin/*` → `/admin/login`. Phiên tổ chức vào trang sinh viên → `/admin`. Phân biệt bằng `accounts.account_type`, proxy đang đọc bảng này (`status`) nên không tốn thêm truy vấn | TB | Vitest mới |
| `src/app/admin/layout.tsx` + thanh trên cùng (mới) | giao diện | Luôn hiện đơn vị và cán bộ đang thao tác, nút "Đổi cán bộ", "Đăng xuất". **Spike chưa làm** | TB | AC1, AC13 |
| `src/app/login/page.tsx`, `auth-form-v2.tsx` | giao diện | Link "Đăng nhập tài khoản tổ chức" | T | `tests/auth-ui.test.tsx` |
| `src/app/admin/login/page.tsx`, `src/app/admin/login/officer/page.tsx` (mới) | giao diện | Bước 1: dropdown nhóm theo cấp (chỉ đơn vị hoạt động, đã có tài khoản) + PIN. Bước 2: MSSV + PIN, đếm ngược 5 phút | TB | AC1, AC2, AC12 |
| `/admin/programs`, `/admin/reviews`, `/admin/organization`, `/admin/settings`, `/admin/accounts` ← trang quản lý hiện có (`programs/new`, `programs/[id]` phần quản lý, `registrations`, `attendance`, `attendance/[sessionId]/qr`, `office/membership`, `organization`, `forms/templates/*`) | giao diện | Chuyển trang. `/admin/accounts` mới: tài khoản tổ chức và thành viên đơn vị | TB (R-9) | TC-UCA..UCD; test thủ công |
| Components quản lý (`event-program-actions`, `event-program-editor`, `program-registration-settings`, `registration-decision`, `attendance-*`, `membership-review-console`, `organization-console`, `form-template-editor`, `my-tasks`) | giao diện | Đổi đường dẫn; `my-tasks` bỏ phần việc quản lý khỏi trang sinh viên. Nguồn quyền (`roles`) giữ nguyên | T | Vitest liên quan |
| API quản lý (`src/app/api/event-programs/**`, `attendance/sessions/**`, `union-membership/{review,paper-book,assignment,checklist-definition}`, `organization/**`, `admin/student-code`, `forms/templates/**`, `students`, `reference-options` POST) | nghiệp vụ | `requireUser()` → `requireOrganizationSession()`. Phần gọi RPC giữ nguyên. `union-membership/checklist` của CTV giữ `requireUser()` | T | spike L1 (`POST /api/event-programs` bằng phiên tạm → 401) |

### 2.4. Script, test, tài liệu

| Thành phần | Loại | Thay đổi dự kiến | Rủi ro | Test kiểm chứng |
|---|---|---|---|---|
| `scripts/bootstrap-school-admin.mjs` (`npm run admin:bootstrap`) | cấu hình | Tạo tài khoản tổ chức Đoàn Trường đầu tiên, PIN tổ chức nhập ẩn (không qua tham số dòng lệnh), thêm người chạy làm thành viên | TB | AC10; pgTAP 006 |
| `scripts/seed-demo.mjs` | cấu hình | Cấp vai trò cho tài khoản tổ chức demo (Đoàn Trường, Văn phòng, Đoàn Khoa CNKT), thêm Bảo, Mai, Quân làm thành viên. Lịch sử demo ghi `actor_user_id` = tài khoản tổ chức, `actor_officer_user_id` = cán bộ | TB | Chạy seed trên stack tách biệt |
| pgTAP `002` (10), `004` (14), `005` (35), `007` (67), `008` (55) | test | Fixture đang cấp vai trò quản lý cho tài khoản sinh viên, nên trigger mới chặn ngay (spike: cả 5 file dừng ở fixture). Thêm helper tạo tài khoản tổ chức + thành viên + phiên có cán bộ (`act_as_org(org, officer)`, đặt `session_id` vào claims). Giữ `act_as` cho bước sinh viên; thêm assertion "tài khoản cá nhân bị từ chối" | C (R-10) | Job `pgtap` |
| pgTAP `001` (9), `003` (10), `006` (5) | test | Spike: PASS không sửa. `006` sẽ phải sửa khi viết lại `bootstrap_school_admin` | T | Job `pgtap` |
| pgTAP `009_account_types.sql` (mới) | test | Spike đã có 18 assertion: ràng buộc sinh viên cũ (MSSV, duy nhất, email `@student.hiu.vn`), tài khoản tổ chức (không MSSV, không email sinh viên, chặn Ban, không đổi loại), vai trò quản lý chỉ cho tài khoản tổ chức đúng đơn vị, CTV chỉ cho sinh viên, thành viên là sinh viên. Bổ sung: phiên tạm, đổi cán bộ, `OFFICER_REQUIRED`, tự duyệt theo cán bộ, migration dữ liệu | — | Job `pgtap` |
| Vitest `nav-access`, `auth-ui`, `login-next-path`, `validation` | test | Link đăng nhập tổ chức, `safeNextPath` cho `/admin/*`, schema hai bước, phân luồng proxy | T | Job `build-test` |
| `docs/TH2/test-cases.md` + `run-test-cases.mjs` | test | Bước quản lý (Mai, Quân) đăng nhập hai bước. Thêm ca "cán bộ dùng tài khoản cá nhân → 403". Lần chạy mới ghi vào `docs/TH4/` | TB | 15 test case TH2 |
| `docs/testing/smoke-test.md` | tài liệu | Bước 7 (sinh viên đăng ký UC-C) giữ nguyên. Thêm bước đăng nhập tổ chức hai bước, mở `/admin` | T | Smoke test v1.1.0 |
| `docs/TH2/demo-data.md`, README, hướng dẫn triển khai, CHANGELOG | tài liệu | Tài khoản tổ chức demo, bước bootstrap và đặt PIN sau migration | T | Đọc lại khi release |

### 2.5. Tổng hợp

| Nhóm | Phương án chọn (P1) |
|---|---|
| Hàm kiểm quyền "cổng" và RPC quản lý | 0 hàm sửa (32 hàm giữ nguyên) |
| Policy RLS | 0 policy sửa (khoảng 40/54 giữ nguyên) |
| Hàm hiện có phải sửa | 5: `write_audit`, `review_event_program`, `fill_event_program_history_actor`, `enforce_current_student_code_rule`, `bootstrap_school_admin` |
| Bảng/ràng buộc | `accounts` (2 cột, 1 check viết lại), 4 bảng mới, 3 bảng lịch sử + `audit_events` thêm cột, 5 trigger mới |
| Khóa ngoại tới `accounts(user_id)` | 0/45 phải đổi |
| Server/giao diện | 3 route mới, khoảng 25 route API đổi lớp kiểm phiên (không đổi phần gọi RPC), 2 trang đăng nhập + khung `/admin` |
| pgTAP | Sửa fixture 5 file (181/205 assertion), thêm 009 |

### 2.6. So sánh phương án thiết kế

**(a) Quyền quản lý nằm ở đâu, và số RPC/RLS phải sửa**

Đếm trên `main` (`e6a66db`): 32 hàm dùng hàm cổng hoặc đọc `role_grants`, khoảng 40/54 policy RLS gọi hàm cổng.

| | P1. `role_grants` của đơn vị cấp cho tài khoản tổ chức; cán bộ là thành viên, chỉ để xác thực (**chọn**, phương án ưu tiên) | P2. `role_grants` giữ ở tài khoản cá nhân; phiên tổ chức (đơn vị + cán bộ) gắn vào hàm cổng (spike lần 1) | P3. Mỗi RPC nhận tham số phiên tổ chức và tự kiểm |
|---|---|---|---|
| Hàm cổng sửa | 0 | 4 (`has_active_role`, `has_permission`, 2 hàm grant) | 4 |
| Hàm tự đọc `role_grants` sửa | 0 | 5 (`review_union_application`, `grant_role`, `revoke_role`, `can_access_application`, `user_can_manage_forms_for_org`) | 5 |
| RPC quản lý đổi chữ ký hoặc thân | 1 (`review_event_program`, quy tắc tự duyệt) | 0 (đổi hành vi theo hàm cổng) | 32 (đổi chữ ký, kéo theo `grant execute` và khoảng 25 route gọi RPC) |
| Policy RLS sửa | 0 | 0 (khoảng 40 đổi hành vi theo hàm cổng) | Khoảng 40 (policy không nhận tham số, phải đọc claim) |
| Hàm khác sửa | 4 (`write_audit`, trigger lịch sử, trigger MSSV, bootstrap) | 2 (`write_audit`, bootstrap) | 2 |
| **Tổng hàm + policy phải sửa** | **5** | **11** (+ khoảng 72 chỗ đổi hành vi gián tiếp) | **Khoảng 83** |
| `auth.uid()` trong RPC | Tài khoản tổ chức | Cán bộ | Cán bộ |
| Rủi ro bỏ sót đường kiểm quyền | Thấp: quyền nằm ở `role_grants`, trigger chặn cấp lại cho cá nhân | Trung bình: phải sửa đúng mọi chỗ đọc `role_grants` | Cao |
| Chi phí kiểm quyền | Không đổi (hàm cổng giữ nguyên). Mỗi lần ghi thêm 2 truy vấn theo khóa chính trong `write_audit` (chưa đo) | Spike lần 1: 0,017 → 0,08–0,11 ms mỗi lần `has_active_role` (bản plpgsql) | Tương tự P2 |
| Ghi cán bộ | `write_audit` + cột `actor_officer_user_id` | `auth.uid()` là cán bộ, có sẵn | Có sẵn |

**Lý do chọn P1:** số hàm/policy phải sửa ít nhất (5 so với 11 và khoảng 83). Chi phí kiểm quyền không đổi. Đây là phương án ưu tiên, và spike lần 2 không tìm thấy lý do để bỏ nó (mục 6).

**(b) Lưu tài khoản tổ chức: loại tài khoản trong `accounts` hay bảng riêng** (đánh giá khóa ngoại)

| | B1. Thêm `account_type` vào `accounts`, tài khoản tổ chức là một dòng `accounts` (**chọn**) | B2. Bảng riêng `organization_accounts`, không nằm trong `accounts` |
|---|---|---|
| 45 khóa ngoại tới `accounts(user_id)` | 0 phải đổi: `role_grants.user_id`, `event_programs.created_by`, `audit_events.actor_user_id`… đều nhận tài khoản tổ chức | `role_grants.user_id` không trỏ được tới tài khoản tổ chức; mọi cột người thao tác phải đổi sang bảng cha chung hoặc bỏ khóa ngoại |
| Ràng buộc MSSV | Viết lại check: sinh viên vẫn bắt buộc MSSV hợp lệ; tổ chức bắt buộc không có MSSV, có đơn vị. Trigger MSSV chỉ áp cho sinh viên | Không đụng |
| Ràng buộc email `@student.hiu.vn` | Giữ nguyên trên `account_emails`. Tổ chức không có dòng email (trigger chặn); email Auth nội bộ chỉ ở `auth.users` | Không đụng |
| Chứng minh ràng buộc cũ | pgTAP 009: 18/18 PASS trên spike | — |

**(c) Phiên Auth của tài khoản tổ chức**

| | C1. Mật khẩu Auth ngẫu nhiên, không ai biết; PIN tổ chức lưu riêng (`organization_pins`); server tạo phiên bằng magic link sau bước 2 (**chọn**) | C2. PIN tổ chức là mật khẩu Auth của tài khoản tổ chức |
|---|---|---|
| Bỏ qua bước 2 | Không đăng nhập thẳng được: `signInWithPassword(email tổ chức, PIN tổ chức)` → `Invalid login credentials` (spike L8) | Ai biết PIN tổ chức gọi thẳng Supabase Auth bằng publishable key là có phiên đủ quyền, không cần cán bộ |
| Lớp chặn thêm | `write_audit` từ chối ghi khi phiên không có cán bộ (spike L7) | Như C1, nhưng phiên không cán bộ dễ lấy hơn nhiều |

**(d) Phiên tạm của bước 1**

| | D1. Dòng `organization_login_challenges` (id ngẫu nhiên trong cookie httpOnly, hạn 5 phút, dùng một lần) (**chọn**) | D2. Cookie ký HMAC chứa đơn vị và hạn | D3. Tạo luôn phiên Auth ở bước 1 |
|---|---|---|---|
| Thao tác được trước bước 2 | Không: chưa có phiên Auth nào (spike L1) | Không | Có, nếu không sửa hàm cổng. Vi phạm R2 |
| Secret mới | Không | Cần secret ký | Không |
| Hủy/dùng một lần | Có (spike L2b) | Khó (cookie không thu hồi được) | — |

### 2.7. Ước lượng khối lượng

Ước lượng cho một người, từ 30/10 đến hạn TH4 09/11.

| Phần việc | Giờ |
|---|---|
| Migration: loại tài khoản, 5 trigger, 4 bảng mới, `write_audit`, `review_event_program`, trigger lịch sử, bootstrap, chuyển dữ liệu, hàm quản lý tài khoản tổ chức và thành viên | 8–10 |
| pgTAP: helper `act_as_org` cho 5 file, mở rộng 009 (khoảng 30 assertion) | 6–8 |
| Server: 3 route đăng nhập/đổi cán bộ, logout, `dal`, `viewer`, `proxy`, đổi lớp kiểm phiên ở khoảng 25 route API | 5–7 |
| Giao diện: 2 trang đăng nhập, thanh trên cùng + "Đổi cán bộ", khung `/admin` + menu, chuyển 6 nhóm trang | 11–15 |
| `/admin/accounts` (tài khoản tổ chức, thành viên), `/admin/settings` (đổi PIN) | 5–7 |
| Seed demo, bootstrap, diễn tập migration dữ liệu trên bản sao DB demo, test case TH2, smoke test | 4–5 |
| Vitest, tài liệu, review, CI | 4–5 |
| **Tổng** | **43–57** |

Chênh lệch so với phương án lần 1 (40–54 giờ): phần SQL kiểm quyền ít hơn hẳn, nhưng thêm bước 2, "Đổi cán bộ", quản lý thành viên và migration dữ liệu.

**Thứ tự cắt giảm nếu không kịp 09/11** (cắt từ trên xuống; phần giữ lại phải đủ cho UC-B, UC-C, UC-D chạy bằng phiên tổ chức):

1. `/admin/settings` đổi PIN qua giao diện. Giữ hàm, đổi PIN bằng script.
2. `/admin/accounts` giao diện. Tạo tài khoản, đặt lại PIN, khóa/mở, thêm/thu hồi thành viên bằng script service role. Migration dữ liệu đã tạo sẵn thành viên từ vai trò cũ.
3. Chuyển trang Đoàn Trường (cơ cấu, phân quyền CTV, mẫu biểu mẫu) sang `/admin`. Quyền vẫn đi theo tài khoản tổ chức Đoàn Trường.
4. Chuyển trang UC-A (hồ sơ Đoàn viên, Sổ Đoàn) sang `/admin/reviews`. Vẫn dùng được trong phiên Văn phòng ở trang cũ.

**Không cắt:**

- Loại tài khoản và trigger.
- Bảng thành viên.
- Đăng nhập hai bước và phiên tạm 5 phút.
- "Đổi cán bộ" và thanh trên cùng (cốt lõi của R2).
- `write_audit` ghi cán bộ, tự duyệt theo cán bộ.
- Migration dữ liệu.
- pgTAP 005/007/008/009.

### 2.8. Kế hoạch chuyển dữ liệu

Chạy trong cùng migration mới, sau khi đã tạo bảng và trigger (spike: khối `do $$ … $$` cuối `202610300003_cr01_spike_organization_accounts.sql`).

1. **Chọn nguồn:** `role_grants` còn hiệu lực, vai trò `school_admin`, `office`, `faculty_manager`, `faculty_executive`, trên tài khoản sinh viên, thuộc đơn vị `school_union`, `office`, `faculty_union`.
2. **Mỗi đơn vị một tài khoản tổ chức:**
   - Nếu chưa có, tạo người dùng Auth bằng SQL (`auth.users` + `auth.identities`, mật khẩu ngẫu nhiên), dòng `accounts` loại `organization` ở trạng thái `pending_pin`, và một `role_grants` theo loại đơn vị: `school_admin`, `office` hoặc `faculty_manager`.
   - Đơn vị không có vai trò quản lý nào thì không tạo (spike M1b).
3. **Mỗi role grant nguồn:**
   - Thêm cán bộ vào `organization_members`, với `member_role` lấy từ vai trò cũ (`faculty_manager` → `manager`, `faculty_executive` → `executive`, còn lại → `officer`) và `source_role_grant_id` trỏ về grant cũ.
   - Thu hồi grant cũ (`revoked_at`, lý do thêm "CR-01: chuyển sang tài khoản tổ chức").
   - Ghi `audit_events` action `role.migrated_to_organization`.
4. **Không chuyển:**
   - `collaborator` và `committee_manager`: vẫn ở tài khoản cá nhân.
   - Vai trò trên Ban, Chi đoàn.
   - Grant đã thu hồi.
5. **Sau migration (vận hành):**
   - Chạy `npm run admin:bootstrap` mới để đặt PIN cho tài khoản Đoàn Trường.
   - Đoàn Trường đặt PIN cho Văn phòng và các Đoàn Khoa.
   - Trước khi có PIN, tài khoản ở `pending_pin` và bước 1 trả lỗi chung.
6. **Quay lui:** mỗi grant cũ còn nguyên dòng (chỉ bị thu hồi), có `source_role_grant_id` và audit, nên có thể viết migration bù để mở lại grant cá nhân và khóa tài khoản tổ chức. Không xóa dữ liệu.
7. **Diễn tập:** chạy trên bản sao DB demo (stack tách biệt) trước khi release. Không chạy trên DB local đang dùng.

Kết quả spike (M1): 6 grant còn hiệu lực trước migration. 5 grant quản lý được chuyển. Tạo 3 tài khoản tổ chức (Đoàn Khoa, Văn phòng, Đoàn Trường) ở `pending_pin` và 5 thành viên (cán bộ A ở cả Đoàn Khoa và Văn phòng). Còn 0 vai trò quản lý trên tài khoản cá nhân; CTV giữ nguyên; có 5 dòng audit. Sau migration, cán bộ A đăng nhập cá nhân gọi `save_event_program` → `FORBIDDEN`, RPC không sửa (M2).

## 3. Dependency, dịch vụ và cấu hình mới

- **Không thêm package npm.** Dùng `@supabase/ssr`, `@supabase/supabase-js`, `zod` hiện có.
- **Supabase Auth Admin API:** `auth.admin.generateLink({ type: "magiclink" })` và `auth.verifyOtp({ token_hash })` để server tạo phiên cho tài khoản tổ chức. `getUserById` để lấy email nội bộ. Cần `SUPABASE_SERVICE_ROLE_KEY` (đã có).
- **Bảng `auth.users`, `auth.identities`:** migration dữ liệu ghi trực tiếp để tạo tài khoản tổ chức (R-5).
- **Extension `pgcrypto`:** đã bật; hàm mới khai báo `search_path = public, extensions`.
- **Email nội bộ:** `org-<organization_id>@org.eoffice.invalid` (tên miền `.invalid` không nhận thư), chỉ trong `auth.users`.
- **Biến môi trường:** không thêm. `AUTH_RATE_LIMIT_PEPPER` dùng chung cho băm định danh `org_login`.
- **Cấu hình nghiệp vụ:** phiên tạm 5 phút, sai PIN tổ chức 5 lần/15 phút. Ghi vào Configuration Inventory (`docs/TH2/config-dependency.md`) khi hiện thực.
- **Vận hành:** thêm bước đặt PIN tổ chức sau migration (mục 2.8). Không đụng Supabase cloud trong môn.

## 4. Rủi ro và phương án xử lý

| Mã | Rủi ro | Mức | Phương án |
|---|---|---|---|
| R-1 | Viết lại check của `accounts` làm lỏng quy tắc MSSV cho sinh viên | Cao | Check mới vẫn bắt buộc MSSV hợp lệ khi `account_type = 'student'`. pgTAP 009 kiểm MSSV null, sai quy tắc, trùng; email Gmail; sinh viên gắn đơn vị (spike 18/18 PASS) |
| R-2 | Cấp lại vai trò quản lý cho tài khoản cá nhân bằng đường khác | Cao | Trigger `role_grants_holder_rule` chặn ở DB, áp dụng cho cả SQL trực tiếp (spike L11) |
| R-3 | Đơn vị có tài khoản bị đổi `unit_type` sang loại không có tài khoản | Trung bình | Trigger trên `organization_units` |
| R-4 | Dò PIN tổ chức, hoặc lộ đơn vị nào đã có tài khoản | Trung bình | 5 lần/15 phút (spike L10), thông báo chung (L3). **Phát hiện khi spike:** bước 1 với đơn vị chưa có tài khoản trả lời trong khoảng 20 ms, so với khoảng 80 ms khi có kiểm bcrypt. Khi hiện thực, chạy `crypt()` giả ở nhánh không có tài khoản để thời gian như nhau. Dropdown vốn đã công khai danh sách đơn vị có tài khoản, nên mức lộ thấp |
| R-5 | Migration dữ liệu ghi thẳng `auth.users`/`auth.identities`, phụ thuộc cấu trúc của Supabase Auth | Trung bình | Spike chạy được trên CLI 2.117.0: magic link và `verifyOtp` dùng được với người dùng tạo bằng SQL. Diễn tập trên bản sao trước release. Phương án dự phòng: script service role tạo người dùng Auth bằng Admin API, migration chỉ chuyển grant |
| R-6 | `created_by`, `decided_by`, `granted_by` nay là tài khoản tổ chức; màn hình hiện tên người lập theo `student_profiles` sẽ trống | Trung bình | Lịch sử có `actor_name` "Đơn vị – Cán bộ" (spike L2). Trang nào hiện `created_by` thì đổi sang lấy từ lịch sử/audit |
| R-7 | Có phiên Auth của tài khoản tổ chức mà không có cán bộ. Mật khẩu ngẫu nhiên nên không đăng nhập thẳng được (L8), nhưng `signInWithOtp` tới email nội bộ vẫn gửi được thư. Ở local, Inbucket nhận mọi thư; ở môi trường thật, thư tới `.invalid` không giao được | Trung bình | `write_audit` chặn ghi (L7: `OFFICER_REQUIRED`). Đọc qua RLS vẫn được (L7: 2 dòng kế hoạch của đơn vị). Khi hiện thực: chặn đọc nội bộ bằng điều kiện có cán bộ trong vài hàm đọc nội bộ (`can_view_event_program_internals`, `list_program_registrations`) hoặc dùng Auth Hook từ chối cấp token cho tài khoản tổ chức không qua server |
| R-8 | Phân biệt Bí thư (`faculty_manager`) và Ban chấp hành (`faculty_executive`) nay nằm ở `organization_members.member_role`, không còn ở `role_grants` | Thấp | Hiện quyền của hai vai trò như nhau với kế hoạch chương trình. Ghi rõ ai được thêm thành viên (Đoàn Trường; Bí thư cho Đoàn Khoa của mình) khi làm `/admin/accounts` |
| R-9 | Chuyển trang sang `/admin` làm gãy link cũ, bookmark, link trong "Việc của tôi" | Thấp | Chuyển hướng 308 từ đường dẫn cũ trong một bản phát hành |
| R-10 | Sửa fixture pgTAP 5 file (181 assertion) làm thay đổi ý nghĩa test cũ | Cao | Một helper dùng chung, chỉ thay phần "ai thao tác". Thêm assertion "tài khoản cá nhân bị từ chối" trước (RED), rồi phiên tổ chức (GREEN). Không xóa assertion cũ |
| R-11 | Sau "Đổi cán bộ" hoặc thu hồi thành viên, token cũ còn hạn (tối đa 1 giờ) vẫn đọc được qua RLS | Thấp | Ghi bị chặn ngay (L5, L9: `OFFICER_REQUIRED`). Đọc: như R-7 |
| R-12 | `bootstrap_school_admin` hiện tại bị trigger mới chặn | Trung bình | Viết lại cùng migration, sửa pgTAP 006. Spike chưa làm |
| R-13 | Không kịp 09/11 | Trung bình | Thứ tự cắt giảm ở 2.7 |

## 5. Bộ test hồi quy (test tự động + test case từ TH2)

Số liệu hiện có trên `main` (`e6a66db`, chạy ngày 30/10/2026):

| Bộ | Quy mô | Cách chạy | Đổi gì |
|---|---|---|---|
| Vitest | 13 file, 142 test, PASS (`npx vitest run`) | Job `build-test` | Sửa `nav-access`, `auth-ui`; thêm test schema hai bước, `safeNextPath` cho `/admin/*`, phân luồng proxy |
| pgTAP | 8 file, 205 assertion theo `plan()` | Job `pgtap` | Sửa fixture 002, 004, 005, 007, 008 (và 006 khi viết lại bootstrap). Thêm `009_account_types.sql` (18 assertion trên spike, mở rộng khi hiện thực) |
| Test case TH2 | 15 ca: TC-UCA-01..03, TC-UCB-01..03, TC-UCC-01..04, TC-UCD-01..05 (`docs/TH2/test-cases.md`) | `run-test-cases.mjs` trên bản build + DB demo tách biệt | Bước của Mai, Quân đăng nhập hai bước. Thêm ca "cán bộ dùng tài khoản cá nhân → 403" cho UC-A..UC-D, ca "Đổi cán bộ". Ca sinh viên giữ nguyên (R9) |
| Smoke test | 8 bước (`docs/testing/smoke-test.md`) | Thủ công + Playwright trên artifact | Giữ 8 bước; bước 7 không đổi. Thêm bước đăng nhập tổ chức hai bước, mở `/admin` |

Ưu tiên khi hồi quy: UC-B, UC-C, UC-D trước, rồi UC-A.

## 6. Kết quả thử nghiệm kỹ thuật (spike)

**Branch:** `spike/CR-01-TaiKhoanToChuc`, không merge. Có hai lần:

- **Lần 1:** commit `688f9d5`, theo phương án P2.
- **Lần 2:** commit `d064324`, theo phương án ưu tiên P1. Commit này bỏ 2 migration của lần 1 bằng commit mới, không viết lại lịch sử.

**Môi trường (cả hai lần):**

- Worktree riêng, stack Supabase tách biệt `project_id = "eoffice-cr01-spike"` (cổng 573xx, CLI 2.117.0, PostgreSQL 17.6). Không đụng stack `hiu-youth-e-office` và `hiu-eoffice-demo`, không áp migration mới vào DB local đang dùng.
- Web chạy bằng `next dev -p 3401`.
- Dữ liệu: MSSV giả `999…`; pgTAP 009 dùng `888…`.

### 6.1. Spike lần 2: phương án ưu tiên P1 (ngày 30/10/2026)

**Nội dung:**

- Migration `202610300003_cr01_spike_organization_accounts.sql`: loại tài khoản, 5 trigger, 4 bảng mới, `write_audit`, `review_event_program`, trigger lịch sử, `create_organization_account`, `set_organization_pin` và khối chuyển dữ liệu.
- Route `/api/admin/login`, `/api/admin/login/officer`, `/api/admin/switch-officer`.
- pgTAP `009_account_types.sql`.
- Script `scripts/spike-cr01-seed.mjs` dựng hiện trạng **trước** migration (vai trò quản lý trên tài khoản cá nhân), rồi `supabase migration up`. Sau đó `scripts/spike-cr01.mjs` chạy 17 kịch bản.

**Cách chạy:** 2 chu trình sạch, mỗi chu trình gồm: dừng stack (`--no-backup`), dựng lại, seed hiện trạng, áp migration, chạy script. Log ở `spike/lan-2/spike-lan-2-chay-1.log` và `spike-lan-2-chay-2.log`.

| Kịch bản | Chứng minh | Kết quả (chạy 1) |
|---|---|---|
| M1 | Migration dữ liệu | 3 tài khoản tổ chức (`pending_pin`), mỗi tài khoản 1 `role_grants` đúng đơn vị; còn 0 vai trò quản lý trên tài khoản cá nhân; 5 thành viên; CTV còn hiệu lực; 5 dòng audit `role.migrated_to_organization` |
| M1b | Không tạo thừa | Đoàn Khoa không có vai trò quản lý → không có tài khoản tổ chức |
| M2 | Tài khoản cá nhân mất quyền, RPC không sửa | Cán bộ A đăng nhập `/login` (200), `save_event_program` → `FORBIDDEN` |
| L1 | Bước 1 → phiên tạm, chưa thao tác được | 200, cookie `org_login`, không có phiên Auth; hạn 300 giây; `POST /api/event-programs` bằng phiên tạm → 401 |
| L2 | Bước 2 → `/admin`; RPC giữ nguyên chạy với tài khoản tổ chức; ghi cán bộ | 200, `next=/admin`; `save_event_program` OK; lịch sử: `actor_user_id` = tài khoản tổ chức, `actor_officer_user_id` = A, `actor_name` = "Đoàn Khoa Khoa Spike CR-01 – 9990000001"; audit: tổ chức, A, đơn vị, phiên |
| L2b | Phiên tạm dùng một lần | Dùng lại → 401 |
| L2c | Không làm việc của đơn vị khác | Tạo chương trình cho Đoàn Khoa khác → `FORBIDDEN` |
| L3 | Mỗi bước sai trả một thông báo chung | 7 tình huống (bước 1: sai PIN, đơn vị chưa có tài khoản; bước 2: sai MSSV, sai PIN, không phải thành viên, sinh viên không vai trò, không qua bước 1) → cùng `401` và cùng một câu |
| L4 | Phiên tạm hết hạn | Bước 2 sau hạn → 401, cùng thông báo |
| L5 | "Đổi cán bộ" | 200, `next=/admin/login/officer`; token của A sau khi đổi → `OFFICER_REQUIRED`; bước 2 với cán bộ C, không nhập PIN tổ chức → 200; thao tác sau đó ghi audit theo C |
| L6 | Tự duyệt xét theo cán bộ | A nộp bằng phiên Đoàn Khoa; A duyệt bằng phiên Văn phòng → `SELF_REVIEW_FORBIDDEN`; B phiên Văn phòng → `approved` |
| L7 | Phiên tổ chức không qua bước 2 (magic link tạo thẳng bằng service role) | Ghi → `OFFICER_REQUIRED`; đọc kế hoạch của đơn vị qua RLS vẫn được (2 dòng), ghi ở R-7 |
| L8 | Không đăng nhập thẳng vào Auth | `signInWithPassword(email tổ chức, PIN tổ chức)` → `Invalid login credentials` |
| L9 | Thu hồi thành viên có hiệu lực ngay | Phiên đang mở → `OFFICER_REQUIRED`; đăng nhập lại bước 2 → 401 |
| L10 | Khóa tạm PIN tổ chức | 5 lần sai → 401; lần 6 PIN đúng → 429; IP khác → 200 |
| L11 | DB chặn Chi đoàn, Ban, cấp vai trò quản lý cho cá nhân | `ORG_ACCOUNT_UNIT_NOT_ALLOWED` (2 lần), `MANAGEMENT_ROLE_REQUIRES_ORGANIZATION_ACCOUNT` |
| L12 | Sinh viên và CTV không đổi | Sinh viên đăng nhập `/login` → 200; CTV đăng nhập cá nhân → 200, `has_active_role('collaborator')` = true |

**Số liệu:**

1. **17/17 PASS ở cả 2 chu trình sạch.**
2. **Thời gian:**
   - Bước 1 thành công (có kiểm bcrypt): 78–93 ms. Bước 1 với đơn vị chưa có tài khoản: 19–25 ms (R-4).
   - Bước 2 thành công (kiểm PIN cá nhân + magic link + tạo phiên): 368–410 ms.
3. **pgTAP trên stack spike lần 2** (`spike/lan-2/pgtap-tren-spike-lan-2.log`):
   - PASS không sửa: 001, 003, 006, cùng 009 mới (18/18), tổng 42 assertion.
   - 002, 004, 005, 007, 008 dừng ngay ở fixture với `MANAGEMENT_ROLE_REQUIRES_ORGANIZATION_ACCOUNT`, vì fixture cấp vai trò quản lý cho tài khoản sinh viên. Đúng 5 file dự đoán ở 2.4.
4. **Không sửa** hàm cổng, RPC quản lý (trừ `review_event_program`) hay policy RLS nào.
5. **Phát hiện khi spike:**
   - Lần chạy đầu bước 1 trả 500 vì migration thiếu action `org_login` trong `auth_attempts_action_check`. Đã thêm vào migration.
   - pgTAP 009 lần đầu FAIL 1 assertion do trùng email với dữ liệu seed của spike. Đã đổi dữ liệu test sang `888…`.
   - Thời gian bước 1 lộ việc đơn vị có tài khoản hay không (R-4).
   - Phiên tổ chức không có cán bộ vẫn đọc được qua RLS (R-7, R-11).
   - `bootstrap_school_admin` hiện tại xung đột với trigger mới (R-12).

**Kết luận:** phương án ưu tiên P1 chạy được, không cần chuyển sang phương án khác:

- Đăng nhập hai bước có phiên tạm 5 phút.
- "Đổi cán bộ" không cần PIN tổ chức.
- Quyền đi theo tài khoản tổ chức với RPC/RLS giữ nguyên.
- Cán bộ được ghi qua `write_audit` và lịch sử; tự duyệt xét theo cán bộ.
- Migration dữ liệu chuyển đúng vai trò và thành viên.
- Ràng buộc sinh viên cũ vẫn áp dụng.

Khi hiện thực trên `cr/CR-01-TaiKhoanToChuc` cần làm thêm:

- Chặn đọc nội bộ khi không có cán bộ (R-7).
- Cân bằng thời gian bước 1 (R-4).
- Viết lại bootstrap (R-12).
- Làm hàm quản lý tài khoản/thành viên.
- Làm giao diện `/admin`, thanh trên cùng, phân luồng proxy.

### 6.2. Spike lần 1: phương án P2 (ngày 30/10/2026, giữ để so sánh)

Phương án P2: tài khoản tổ chức là bản ghi PIN băm, phiên tổ chức gắn `session_id` → đơn vị + cán bộ, và `current_org_unit_id()` gắn vào các hàm cổng. Log ở `spike/lan-1/`.

- 14/14 kịch bản PASS ở 3 lần chạy. Các kịch bản gồm: đăng nhập tạo phiên, RPC nhận đúng đơn vị + cán bộ, tài khoản cá nhân bị chặn, audit ghi đủ, tự duyệt theo cán bộ, lỗi chung, khóa tạm PIN, chặn Chi đoàn/Ban, thu hồi tức thì, refresh token giữ `session_id`.
- Đăng nhập (một bước, 4 thông tin): 227–293 ms.
- pgTAP hiện có: 5 file FAIL với `FORBIDDEN`.
- **Chi phí kiểm quyền** (`spike/lan-1/do-chi-phi-kiem-phien.txt`, 10.000 lần gọi): thân `has_active_role` trước CR khoảng 0,017 ms/lần. Bản SQL có kiểm phiên khoảng 0,60 ms/lần, chậm khoảng 35 lần do hàm SQL `security definer` có `SET search_path` được lập kế hoạch lại mỗi lần gọi. Bản plpgsql khoảng 0,08–0,11 ms/lần.
- P1 tránh được chi phí này vì không sửa hàm cổng. Đây là thêm một lý do chọn P1.

## 7. Bộ câu kiểm tra chuẩn – golden set (CR tích hợp AI)

Không áp dụng. CR-01-TaiKhoanToChuc thuộc hướng "Kỹ thuật nâng cao khác", không dùng mô hình AI, nên không có đầu ra cần chấm bằng golden set. Tính đúng được kiểm bằng pgTAP, Vitest, test case TH2 và smoke test (mục 5).
