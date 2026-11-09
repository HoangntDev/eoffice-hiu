# Bằng chứng điều chỉnh RED AC6

Ngày thực hiện: 10/11/2026. Stack: `eoffice-cr01-spike`, cổng 573xx.

## Commit

```text
3812cbd test(cr01): điều chỉnh AC6 theo công tắc tính năng (#37)
 supabase/tests/009_account_types.sql         |  8 ++++----
 supabase/tests/010_organization_accounts.sql | 25 +++++++++++++++++--------
 2 files changed, 21 insertions(+), 12 deletions(-)
```

## Lệnh kiểm thử

```bash
supabase test db supabase/tests/009_account_types.sql supabase/tests/010_organization_accounts.sql --workdir .
```

## Kết quả

```text
009_account_types.sql: 26 assertion, 17 FAIL
010_organization_accounts.sql: 69 assertion, 65 FAIL
Files=2, Tests=95
Result: FAIL
```

Các lỗi mới đúng mục tiêu RED: thiếu bảng `feature_flags`, thiếu hàm `feature_flag_enabled(text)`, và tài khoản cá nhân vẫn tạo được kế hoạch khi test đặt công tắc bật.

## Liên kết theo dõi

- Issue #37: phần “Phát hiện khi hiện thực” và bình luận ngày 10/11/2026.
- PR #50: mô tả AC6 cập nhật và bình luận kết quả RED ngày 10/11/2026.

