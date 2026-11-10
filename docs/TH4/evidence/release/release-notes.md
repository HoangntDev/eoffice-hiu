# HIU Youth E Office v1.1.0

Phiên bản 1.1.0 hoàn tất CR-01: mọi thao tác quản lý có thể chạy trong phiên tài
khoản tổ chức, đồng thời vẫn có đường quay lui tức thời về quyền cá nhân của v1.0.0
bằng công tắc database.

## Điểm mới

- Tài khoản tổ chức cho Đoàn Trường, Văn phòng Đoàn – Hội và Đoàn Khoa.
- Đăng nhập hai bước tại `/admin/login`: PIN tổ chức, sau đó MSSV và PIN cá nhân
  của cán bộ còn hiệu lực.
- Phiên tạm 5 phút dùng một lần, giới hạn 5 lần sai trong 15 phút, thông báo lỗi
  chung và kiểm PIN giả để giảm rò rỉ thời gian.
- Khu `/admin` có menu theo loại đơn vị, thanh đơn vị/cán bộ, "Đổi cán bộ", đổi
  PIN và quản lý tài khoản tổ chức.
- Audit và lịch sử ghi đồng thời đơn vị và cán bộ thao tác; phiên không có cán bộ
  không đọc hoặc ghi được dữ liệu.
- `ORG_ACCOUNTS_ENABLED` nằm trong database và có audit. TẮT giữ hành vi v1.0.0;
  BẬT vô hiệu grant quản lý cá nhân mà không thu hồi dữ liệu grant.

Ban (`school_committee`) chưa nằm trong giai đoạn này. Chi đoàn (`class_union`)
không bao giờ có tài khoản tổ chức. Thanh toán Đoàn phí chưa nằm trong v1.1.0.

## Nâng cấp

1. Sao lưu database và file kế hoạch.
2. Cài gói, chạy `npm ci`, rồi dựng/áp migration Supabase.
3. Giữ `ORG_ACCOUNTS_ENABLED` ở trạng thái TẮT để smoke hành vi cũ.
4. Chạy `npm run admin:bootstrap -- --user-id <UUID> --confirm` nếu chưa có tài
   khoản Đoàn Trường; script sẽ hỏi PIN tổ chức bằng đầu vào ẩn.
5. Đăng nhập Đoàn Trường tại `/admin/login`, kiểm tra tài khoản/thành viên rồi bật
   công tắc tại `/admin/accounts`.

Không chạy migration ngược. Khi cần quay lui hành vi, tắt công tắc; khi cần quay
về schema cũ phải phục hồi bản sao lưu trước nâng cấp.

## Kiểm thử

- CI trên merge commit `1bcdda1`: `build-test` và `pgtap` PASS.
- Công tắc TẮT: 205/205 assertion pgTAP cũ PASS.
- Công tắc BẬT: 306/306 assertion pgTAP PASS.
- Vitest: 203/203 PASS; test case TH2 + AC6: 19/19 PASS; smoke branch: 8/8 PASS.

## Gói phát hành

- `hiu-youth-e-office-v1.1.0.zip`
- SHA-256: `322ecb146b3e437c5781f8135e63779f99095372e019918a7b17a54ce1a66d0f`

Gói được tạo bởi `scripts/package-release.sh 1.1.0` từ tag annotated, giữ symlink,
và đã qua tự kiểm tra giải nén, `npm ci`, khởi động và `/api/health` trả đúng
`version: 1.1.0`.
