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

## Backup local đã chạy — 05/10/2026

```bash
supabase db dump --local -f schema_20261005T223312.sql     # 255K
supabase db dump --local --data-only -f data_20261005T223312.sql  # 369K, 1780 dòng
```

Kiểm tra integrity: 11 bảng public schema, row count trong dump khớp live DB (10/51/347/6 danh mục, 1 template, 2 forms, 1 response, 3 answers). Xem chi tiết tại `docs/testing/test-report.md` → "Bổ sung backup drill".

## Restore drill đã chạy — 06/10/2026

Dùng `docker exec -i supabase_db_hiu-youth-e-office psql -U postgres` (PostgreSQL 17.6 trong container). Không cần cài `libpq` hệ thống và không hard-code đường dẫn `/opt/homebrew`.

```bash
# Tạo DB tách biệt trong cùng instance
sh -c 'docker exec supabase_db_hiu-youth-e-office psql -U postgres -c "CREATE DATABASE restore_test"'

# Restore schema rồi data qua stdin
sh -c 'docker exec -i supabase_db_hiu-youth-e-office psql -U postgres restore_test < schema_20261005T223312.sql'
sh -c 'docker exec -i supabase_db_hiu-youth-e-office psql -U postgres restore_test < data_20261005T223312.sql'

# Verify từng bảng
sh -c 'docker exec supabase_db_hiu-youth-e-office psql -U postgres restore_test -tc "select count(*) from public.faculties"'
# → 10

# Dọn dẹp sau drill
sh -c 'docker exec supabase_db_hiu-youth-e-office psql -U postgres -c "DROP DATABASE restore_test"'
```

**Lỗi không nghiêm trọng:** `supabase_functions.hooks_id_seq` không tồn tại — internal Supabase sequence, không ảnh hưởng public schema.

Kết quả: 11/11 bảng khớp đúng (xem chi tiết tại `docs/testing/test-report.md` → "G5 — Restore drill").

## Runbook cho instance mới (nếu cần)

Nếu muốn restore sang Supabase local instance thứ hai (`brew install libpq` hoặc `brew --prefix libpq` để lấy đúng prefix):

```bash
# Lấy đường dẫn psql đúng với máy hiện tại
LIBPQ_PREFIX=$(brew --prefix libpq 2>/dev/null || echo "/usr/local")
export PATH="$LIBPQ_PREFIX/bin:$PATH"

psql postgres://postgres:postgres@127.0.0.1:54322/postgres \
  -v ON_ERROR_STOP=1 -f schema_20261005T223312.sql
psql postgres://postgres:postgres@127.0.0.1:54322/postgres \
  -v ON_ERROR_STOP=1 -f data_20261005T223312.sql
```
