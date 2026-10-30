# Bằng chứng test RED – CR-01-TaiKhoanToChuc

Ngày chạy: 30/10/2026. Issue #51. Theo Lab03 mục 4.4.

- **Branch:** `cr/CR-01-TaiKhoanToChuc`, tạo từ `main` tại `15823fe` (đã có Impact Analysis, #45/#47/#49).
- **Commit RED:** `fa1d4c9` `test(cr01): add failing tests for CR-01 acceptance criteria (#37)`.
- **PR:** #50, dạng Draft, tiêu đề bắt đầu bằng `[WIP]`, `Closes #37`, Milestone TH4. CI đỏ ở bước test là đúng mong đợi; không merge.

## Môi trường

| Mục | Local | CI (PR #50, run `41037701934`) |
|---|---|---|
| Máy | macOS, worktree `~/Developer/eoffice-spike-cr01` | GitHub Actions `ubuntu-latest` |
| DB | Stack Supabase tách biệt `project_id = "eoffice-cr01-spike"`, cổng 573xx (đổi tại chỗ trong `supabase/config.toml`, không commit). Không áp migration vào DB local đang dùng | `supabase db start` + `supabase test db` |
| Lệnh | `supabase test db --workdir .`, `npx vitest run`, `npm run lint`, `npm run typecheck`, `npm run build` | Job `build-test` (lint → typecheck → test → build), job `pgtap` |

## Kết quả tổng

| Bộ | Local | CI | Đúng mong đợi? |
|---|---|---|---|
| pgTAP 001–008 (cũ, không sửa) | 8 file PASS, 205 assertion | 8 file PASS | Có: chưa đổi hành vi nào |
| pgTAP `009_account_types.sql` (mới) | 26 assertion, 18 FAIL, 8 PASS | 18/26 FAIL, cùng số thứ tự | Có (xem bảng dưới) |
| pgTAP `010_organization_accounts.sql` (mới) | 66 assertion, 63 FAIL, 3 PASS | 63/66 FAIL, cùng số thứ tự | Có |
| Vitest cũ | 13 file, 142 test PASS | 142 PASS | Có |
| Vitest `tests/organization-auth.test.ts` (mới) | 24/24 FAIL ở assertion (nhận `NOT_IMPLEMENTED`) | 24 FAIL | Có |
| lint, typecheck | Đạt (exit 0) | Đạt | Có |
| build | Đạt (exit 0) | Không chạy: CI dừng ở bước test thất bại trước đó | Có |

Không file pgTAP nào dừng giữa chừng: tổng `Tests=297` = 205 + 26 + 66, `plan()` khớp. Không có lỗi cú pháp hay lỗi cấu hình.

**Lý do thất bại** (`local-pgtap.log`, `local-vitest.log`) đều là chức năng chưa có:

- Bảng, cột, hàm chưa tồn tại, ví dụ `relation "public.organization_members" does not exist`, `column "account_type" ... does not exist`, `function public.start_organization_login(...) does not exist`.
- Tài khoản tổ chức chưa tạo được, nên RPC gọi trong phiên tổ chức trả `UNAUTHENTICATED`.
- Hành vi mới chưa có:
  - Trigger chưa chặn (`caught: no exception`).
  - Tài khoản cá nhân vẫn tạo được kế hoạch (trả id thay vì `FORBIDDEN`).
  - Vẫn còn 5 vai trò quản lý trên tài khoản cá nhân (mong đợi 0).
  - `auth_attempts` chưa nhận action `org_login`.
- Vitest: 17 lần `NOT_IMPLEMENTED: <tên hàm>` hiện trong log.

## Tiêu chí chấp nhận → test → kết quả

Số trong ngoặc: số assertion/test. "Thất bại đúng lý do" = thất bại vì chức năng CR-01 chưa có. Một số assertion của R-6 và AC11 (hành vi cũ phải giữ) đạt ngay từ bây giờ; đó cũng là kết quả đúng.

| AC | Test tự động | Kết quả RED |
|---|---|---|
| AC1 Đăng nhập hai bước, thanh trên cùng | pgTAP 010 khối AC1 (6); Vitest AC1 (6) | 6/6 và 6/6 FAIL: chưa có `start_organization_login`, `read_organization_login`, `organization_member_for`, `start_officer_session`, `current_officer_user_id`, `organization_session_ok`; schema hai bước và `organizationHeader` trả `NOT_IMPLEMENTED` |
| AC2 Dropdown nhóm theo cấp | pgTAP 010 (2); Vitest AC2 (1) | 2/2, 1/1 FAIL: chưa có `list_organization_login_units`, `groupLoginUnits` |
| AC3 Chặn Chi đoàn, Ban | pgTAP 009 (5) | 5/5 FAIL: chưa có cột `account_type`, `create_organization_account`, trigger đổi `unit_type` |
| AC4 Lỗi chung; thời gian bước 1 như nhau (R-4) | pgTAP 010 (5 + 1 thời gian); Vitest AC4 (2) | 6/6, 2/2 FAIL: chưa có hàm đăng nhập tổ chức, `organizationLoginFailure` |
| AC5 Giới hạn 5 lần/15 phút | pgTAP 010 (1); Vitest AC5 (1) | 1/1 FAIL: `auth_attempts_action_check` chưa nhận `org_login`; 1/1 FAIL `NOT_IMPLEMENTED` |
| AC6 Tài khoản cá nhân bị từ chối; chuyển dữ liệu | pgTAP 009 (2); pgTAP 010 (6, 1 dùng chung với AC10) | 8/8 FAIL: vai trò quản lý vẫn cấp được cho tài khoản cá nhân; chưa có `migrate_management_grants_to_organizations`; cán bộ A vẫn tạo được kế hoạch bằng tài khoản cá nhân |
| AC7 Đơn vị chỉ làm việc của mình; CTV giữ tài khoản cá nhân | pgTAP 010 (3) | 2 FAIL (chưa có phiên tổ chức); 1 PASS: CTV vẫn dùng vai trò bằng tài khoản cá nhân (R-6, hành vi giữ nguyên) |
| AC8 Audit cán bộ; tự duyệt theo cán bộ | pgTAP 010 (4) | 4/4 FAIL: chưa có `audit_events.officer_user_id`, `event_program_history.actor_officer_user_id`, phiên Văn phòng |
| AC9 Phân luồng trang, menu theo loại đơn vị | Vitest AC9 (10) | 10/10 FAIL: `adminRouteDecision`, `adminMenuFor` trả `NOT_IMPLEMENTED` |
| AC10 Quản lý tài khoản tổ chức; bootstrap (R-12) | pgTAP 010 (11) | 10 FAIL: chưa có `manage_organization_account`, `change_organization_pin`; bootstrap hiện tại vẫn cấp `school_admin` cho tài khoản cá nhân. 1 PASS: `bootstrap_school_admin` chạy được (giữ chữ ký) |
| AC11 Chức năng sinh viên không đổi | pgTAP 009 (7) + pgTAP 001–008 + Vitest cũ | 6/7 PASS (ràng buộc MSSV, email cũ giữ nguyên), 1 FAIL (chưa có `account_type` mặc định `student`); 205 assertion cũ và 142 test cũ PASS |
| AC12 Phiên tạm 5 phút, dùng một lần | pgTAP 010 (4); Vitest AC12 (1) | 4/4, 1/1 FAIL: chưa có `organization_login_challenges`, `pendingLoginCookieOptions` |
| AC13 Đổi cán bộ | pgTAP 010 (2); Vitest (1) | 2/2, 1/1 FAIL: chưa có `end_officer_session`, audit theo cán bộ mới |
| AC14 Phiên chưa có cán bộ không đọc/ghi; thu hồi token cũ (R-7, R-11) | pgTAP 010 (7, 1 dùng chung với AC13); Vitest (2) | 7/7, 2/2 FAIL: chưa có `organization_session_ok`, phiên tổ chức |

Ngoài ra, 15 assertion "cấu trúc" của 010 (`has_table`, `has_column`, `has_function`) và 9 assertion cấu trúc/ràng buộc chung của 009 đều FAIL vì bảng, cột, hàm chưa có.

## Tệp trong thư mục này

| Tệp | Nội dung |
|---|---|
| `local-pgtap.log` | `supabase test db` trên stack tách biệt, đủ 10 file |
| `local-vitest.log` | `npx vitest run`, đủ 14 file |
| `local-lint-typecheck-build.log` | Mã thoát và output của lint, typecheck, build |
| `ci-build-test.log`, `ci-pgtap.log` | Log hai job trong tab Checks của PR #50 (`gh run view 41037701934 --log`) |
| `ci-artifacts/pgtap.txt`, `ci-artifacts/vitest-junit.xml` | Artifact kết quả test của run đó |

Log đã bỏ mã màu ANSI và đường dẫn máy; không chứa khóa hay token. Dữ liệu test là MSSV giả `888…`.

## Ảnh cần tự chụp

Lưu cùng thư mục, tên gợi ý trong ngoặc:

1. **Terminal local, pgTAP** (`local-pgtap.png`): chạy `supabase test db --workdir ~/Developer/eoffice-spike-cr01`, chụp phần cuối có `Test Summary Report` (009: Failed 18, 010: Failed 63), dòng `001`–`008 ... ok` và `Result: FAIL`.
2. **Terminal local, Vitest** (`local-vitest.png`): chạy `npx vitest run tests/organization-auth.test.ts` trong worktree, chụp một lỗi có `NOT_IMPLEMENTED` và dòng `Tests 24 failed`.
3. **PR #50, đầu trang** (`pr50-draft.png`): nhãn Draft, tiêu đề `[WIP] …`, `Closes #37`, Milestone TH4.
4. **PR #50, tab Checks** (`pr50-checks.png`): `build-test` và `pgtap` màu đỏ.
5. **PR #50, chi tiết job `build-test`** (`pr50-build-test.png`): bước `Test (JUnit + coverage)` thất bại (`24 failed | 142 passed`), bước lint và typecheck xanh.
6. **PR #50, chi tiết job `pgtap`** (`pr50-pgtap.png`): phần `Test Summary Report`.
7. **PR #50, tab Commits** (`pr50-commits.png`): commit `test(cr01): add failing tests for CR-01 acceptance criteria (#37)`.

Stack `eoffice-cr01-spike` vẫn đang chạy để chụp ảnh 1, 2. Chụp xong thì dừng bằng `supabase stop --workdir ~/Developer/eoffice-spike-cr01 --no-backup`.
