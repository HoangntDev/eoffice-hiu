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

## Restore drill local (chưa chạy end-to-end)

`pg_restore`/`psql` không có trong system PATH. Khi cần chạy drill hoàn chỉnh:

```bash
# Bước 1 — cài client (cách an toàn, không ảnh hưởng server)
brew install libpq
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"

# Bước 2 — spin up second instance hoặc dùng máy sạch
supabase start  # hoặc target instance khác

# Bước 3 — apply schema rồi data
psql postgres://postgres:postgres@127.0.0.1:54322/postgres \
  -v ON_ERROR_STOP=1 -f schema_20261005T223312.sql
psql postgres://postgres:postgres@127.0.0.1:54322/postgres \
  -v ON_ERROR_STOP=1 -f data_20261005T223312.sql

# Bước 4 — verify
for tbl in faculties programs classes cohorts; do
  echo -n "$tbl: "
  psql postgres://postgres:postgres@127.0.0.1:54322/postgres \
    -tc "select count(*) from public.$tbl"
done
# expect: faculties=10, programs=51, classes=347, cohorts=6

# Bước 5 — pgTAP (chạy trên instance restore)
supabase test db
```

Drill phải hoàn tất PASS trước khi gắn nhãn v1.0.
