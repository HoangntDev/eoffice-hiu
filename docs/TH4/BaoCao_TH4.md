# Báo cáo Thực hành 4 – Quản lý thay đổi và phát hành

Lập ngày 10/11/2026 theo lệnh `date`. Hạn nộp: 23:59 ngày 11/11/2026.

## 1. Thông tin theo dõi

- Change Request: issue #37, Milestone TH4, label `change-request`.
- Pull Request: #50, nhánh `cr/CR-01-TaiKhoanToChuc`, trạng thái Draft trong giai đoạn RED/GREEN.
- Nền triển khai: đã merge `main` tại `089519f` vào nhánh CR bằng merge commit `ac1e244`; không rebase hoặc rewrite lịch sử.
- Môi trường kiểm thử SQL: stack tách biệt `eoffice-cr01-spike`, cổng 573xx. Không áp migration CR lên stack dev chính.

## 2. Phát hiện khi hiện thực

Ngày 10/11/2026, trước commit GREEN, phát hiện kế hoạch cũ thu hồi `role_grants` quản lý cá nhân khiến hệ thống không thể quay về hành vi v1.0.0 chỉ bằng công tắc. Quyết định điều chỉnh:

1. Thêm công tắc `ORG_ACCOUNTS_ENABLED` được lưu và đọc trong database, không chỉ là biến môi trường Next.js.
2. Migration giữ nguyên `role_grants` cá nhân; đồng thời tạo tài khoản tổ chức, grant tổ chức và thành viên tương ứng.
3. Khi công tắc tắt, grant cá nhân hoạt động như v1.0.0. Khi bật, hàm kiểm quyền/RPC/RLS bỏ qua grant quản lý cá nhân; dữ liệu grant không bị thu hồi.
4. Ban (`school_committee`) chỉ chưa làm trong giai đoạn này. Chi đoàn (`class_union`) không bao giờ có tài khoản tổ chức.

Lý do và ảnh hưởng đã được ghi vào issue #37, PR #50 và mục 2.10 của Impact Analysis.

## 3. Điều chỉnh test RED trước GREEN

Commit riêng bắt buộc:

`3812cbd test(cr01): điều chỉnh AC6 theo công tắc tính năng (#37)`

Commit chỉ sửa `supabase/tests/009_account_types.sql` và `supabase/tests/010_organization_accounts.sql`, không kèm code GREEN hoặc cấu hình stack. AC6 mới kiểm tra:

- migration không thu hồi grant quản lý cá nhân;
- công tắc tắt giữ quyền quản lý cá nhân như v1.0.0;
- công tắc bật làm thao tác quản lý bằng tài khoản cá nhân trả `FORBIDDEN`;
- database có bảng công tắc và hàm `feature_flag_enabled(text)`.

Kết quả chạy ngày 10/11/2026 trên stack 573xx:

| File | Assertion | FAIL | Ý nghĩa |
|---|---:|---:|---|
| `009_account_types.sql` | 26 | 17 | Các bảng, cột và hàm CR-01 chưa được hiện thực |
| `010_organization_accounts.sql` | 69 | 65 | Feature flag, đăng nhập tổ chức và phân quyền mới chưa được hiện thực |
| **Tổng** | **95** | **82** | Trạng thái RED đúng trước GREEN |

Các assertion AC6 mới thất bại đúng lý do: chưa có `feature_flags`, chưa có `feature_flag_enabled(text)` và quyền quản lý cá nhân chưa bị vô hiệu khi bật công tắc.

## 4. Trạng thái hiện tại

- Issue #37 và PR #50 vẫn mở; PR vẫn Draft.
- Commit RED điều chỉnh AC6 đã được push trước mọi commit GREEN.
- `CLAUDE.md` đã được sửa số migration cao nhất từ `202610170001` thành `202610300003`, khớp `AGENTS.md`.
- Phần GREEN, kiểm thử hồi quy, phát hành v1.1.0 và smoke test sẽ được bổ sung vào các mục tiếp theo sau khi có kết quả thực tế.

