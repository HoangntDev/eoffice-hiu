# Backup, restore và sửa dữ liệu sai

Không chạy `--linked` nếu chưa xác nhận đúng project/cửa sổ bảo trì. Không ghi database URL hoặc mật khẩu vào history, tài liệu hay commit.

## Backup cloud được ủy quyền

```bash
supabase db dump --linked --file /secure/path/schema-before-change.sql
supabase db dump --linked --data-only --use-copy --file /secure/path/data-before-change.sql
```

Lưu dump ngoài repo công khai; ghi project ref, thời điểm, commit SHA, checksum và người thực hiện.

## Restore drill tách biệt

```bash
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f /secure/path/schema-before-change.sql
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f /secure/path/data-before-change.sql
```

Kiểm số lượng, FK, mẫu ẩn danh và chạy `supabase test db`. Chỉ lập kế hoạch production restore sau drill PASS/phê duyệt.

## Sửa sai

- Danh mục: phiên bản hiệu lực mới có lý do; lỗi hệ thống dùng migration hiệu chỉnh đã test và backup.
- MSSV: dùng API/màn hình đổi MSSV để giữ UUID và `student_code_changes`.
- Quyền: thu hồi grant, không xóa lịch sử. Hồ sơ Đoàn: trả `needs_changes`, sửa cùng hồ sơ.

Chưa có backup/restore drill cloud thật; đây là runbook, không phải bằng chứng vận hành.
