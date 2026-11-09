# Runbook – Sao lưu và phục hồi dữ liệu

Áp dụng cho stack Supabase local (Docker) của HIU Youth E-Office. Supabase cloud chưa được phê duyệt dùng, nên chưa có quy trình cloud (xem cuối tài liệu).

Hai lệnh chính:

```bash
scripts/backup.sh  <stack>                      # sao lưu
scripts/restore.sh <stack> <bản sao lưu|latest> # phục hồi (ghi đè toàn bộ dữ liệu của stack đích)
```

`<stack>` là `project_id` trong `supabase/config.toml` của stack đó, ví dụ `hiu-youth-e-office` (stack dev chính), `eoffice-v100` (stack thử của gói v1.0.0).

## 1. Phạm vi

| Dữ liệu | Nơi lưu | Cách sao lưu |
|---|---|---|
| Nghiệp vụ: tài khoản, hồ sơ sinh viên, hồ sơ Đoàn viên, kế hoạch chương trình, đăng ký, điểm danh, biểu mẫu, audit… | Postgres, schema `public` | `pg_dump -Fc`, cả lược đồ và dữ liệu |
| Tài khoản đăng nhập (email, mật khẩu băm của PIN, phiên) | Postgres, schema `auth` | Cùng file `.dump` |
| Metadata của file (đường dẫn, phiên bản, kích thước) | Postgres, schema `storage` (`storage.objects`, `storage.buckets`) | Cùng file `.dump` |
| File PDF kế hoạch chương trình (bucket `event-program-plans`) | Thư mục file của container Storage (`/mnt`, backend `file`) | Chép nguyên thư mục ra `.storage/` |

Không sao lưu: lược đồ (bảng, hàm, RLS) vì đã có trong `supabase/migrations/` trên git; `.env.local` và khóa (mỗi máy tự cấu hình, không được chép vào bản sao lưu); log ứng dụng `logs/`.

Mỗi lần sao lưu tạo trong `backups/` (đã nằm trong `.gitignore`, không commit vì chứa dữ liệu cá nhân):

```
backups/<stack>_<YYYYMMDDTHHMMSS>.dump        # pg_dump -Fc: public, auth, storage
backups/<stack>_<YYYYMMDDTHHMMSS>.storage/    # thư mục file của Storage
backups/<stack>_<YYYYMMDDTHHMMSS>.counts.tsv  # số bản ghi từng bảng lúc sao lưu
backups/<stack>_<YYYYMMDDTHHMMSS>.manifest    # stack, thời điểm UTC, phiên bản migration, thời gian từng bước
backups/<stack>_<YYYYMMDDTHHMMSS>.sha256      # checksum của .dump, .counts.tsv và từng file trong .storage/
```

## 2. Mục tiêu

| Mục tiêu | Giá trị đề xuất | Lý do (số liệu từ diễn tập 06/11/2026, mục 7) |
|---|---|---|
| **RPO** | **1 giờ** trong giờ hoạt động (06:00–22:00), cộng 1 bản mỗi đêm | Một lần sao lưu mất 1,17 giây, tạo 784 KB, không cần dừng web, nên chạy hằng giờ gần như không tốn gì. Dữ liệu điểm danh QR và đăng ký phát sinh dồn trong ngày diễn ra chương trình và **không thu thập lại được** sau khi chương trình kết thúc, nên mất 24 giờ (RPO của ví dụ trong đề) là quá nhiều. Sau mỗi đợt điểm danh lớn, chạy thêm một lần sao lưu thủ công |
| **RTO** | **30 phút** | Phần kỹ thuật đo được 14,1 giây (dừng web → phục hồi → khởi động → so số liệu → smoke test tự động). Phần lớn thời gian thật nằm ở việc của con người: xác định sự cố từ log và `/api/health`, chọn bản sao lưu, báo người dùng là dữ liệu sau thời điểm sao lưu sẽ mất, smoke test bằng tay, thông báo hoạt động lại. 30 phút để dư cho các việc đó và cho dữ liệu thật lớn hơn dữ liệu demo nhiều lần |

Giữ bản sao lưu: 48 bản hằng giờ gần nhất và 30 bản hằng đêm. Ước tính dung lượng với dữ liệu demo (≈ 0,8 MB mỗi bản): dưới 100 MB.

**Hiện trạng:** chưa có lịch chạy tự động (cron/launchd), mới chạy bằng tay. Đến khi có lịch, RPO thực tế bằng khoảng cách giữa hai lần chạy tay. Đặt lịch thuộc bước triển khai, cần phê duyệt riêng.

## 3. Điều kiện trước

- Docker đang chạy; stack cần sao lưu/phục hồi đang chạy (`supabase status --workdir <thư mục stack>`). Script kiểm tra container `supabase_db_<stack>` và `supabase_storage_<stack>`.
- Chạy từ thư mục repo (hoặc thư mục cài gói phát hành có `scripts/`). Cần `bash`, `docker`, `tar`, `shasum` (macOS) hoặc `sha256sum` (Linux), `perl` để đo thời gian.
- **Không có mật khẩu trong script.** Script chạy `pg_dump`/`pg_restore`/`psql` bên trong container DB của stack qua `docker exec`, bằng user quản trị nội bộ `supabase_admin`. Khi cần đổi, đặt biến môi trường:

  | Biến | Mặc định |
  |---|---|
  | `DB_CONTAINER` | `supabase_db_<stack>` |
  | `STORAGE_CONTAINER` | `supabase_storage_<stack>` |
  | `BACKUP_DB_USER` | `supabase_admin` |
  | `BACKUP_DB_NAME` | `postgres` |
  | `BACKUP_DIR` | `<repo>/backups` |

- Phục hồi: stack đích phải ở **cùng phiên bản migration** với bản sao lưu (script tự kiểm tra), vì chỉ nạp lại dữ liệu.
- Phục hồi vào stack dev chính (`project_id` trong `supabase/config.toml` của repo) bị từ chối, trừ khi có cờ `--confirm-dev-stack`.
- Thư mục `backups/` chứa dữ liệu cá nhân: không commit, không gửi qua kênh chat, không chép lên dịch vụ chưa được phê duyệt.

## 4. Các bước sao lưu

```bash
scripts/backup.sh eoffice-v100
```

Script làm lần lượt (thời gian đo được ở mục 7):

1. Đếm số bản ghi mọi bảng `public`, `auth.users`, `storage.objects` → `.counts.tsv`; ghi phiên bản migration.
2. `pg_dump -Fc -n public -n auth -n storage` trong container DB → `.dump`.
3. `tar` thư mục file của Storage trong container → `.storage/`.
4. Tính SHA-256 → `.sha256`; ghi `.manifest`.

Tên file theo quy ước `<stack>_<YYYYMMDDTHHMMSS>` (giờ máy chạy). Không cần dừng web: `pg_dump` đọc một snapshot nhất quán. File Storage được chép sau `pg_dump` vài trăm mili giây; PDF tải lên đúng khoảng đó có thể có metadata mà chưa có file (hoặc ngược lại), nên ưu tiên chạy lúc ít người dùng.

Lưu ý: bản sao lưu nằm trên cùng máy với DB. Sau mỗi lần sao lưu hằng đêm, chép `backups/<tên>.*` sang ổ khác được phép (ổ ngoài mã hóa), kiểm lại bằng `shasum -a 256 -c <tên>.sha256`.

## 5. Các bước phục hồi

1. **Quyết định thời điểm phục hồi.** Mọi thay đổi sau thời điểm sao lưu sẽ mất. Nếu chỉ sai vài bản ghi, dùng cách sửa sai ở phụ lục thay vì phục hồi toàn bộ.
2. **Dừng web** để không có ghi mới: dừng tiến trình `npm start` của stack đó (ví dụ `kill -TERM $(lsof -t -iTCP:<cổng> -sTCP:LISTEN)`).
3. **Phục hồi:**

   ```bash
   scripts/restore.sh eoffice-v100 eoffice-v100_20261106T092608   # hoặc: latest
   ```

   Script: kiểm checksum → kiểm phiên bản migration → trong **một transaction** `TRUNCATE` mọi bảng của `public`, `auth`, `storage` (trừ bảng migration) rồi nạp dữ liệu bằng `pg_restore --data-only`, với `session_replication_role = replica` để trigger không chạy lại → thay thư mục file Storage → so sánh số bản ghi với `.counts.tsv`. Lỗi ở bước Postgres thì transaction bị hủy, dữ liệu giữ nguyên.
4. **Khởi động lại web** (`npm start`) và chờ `GET /api/health` trả `200 {"app":"ok","db":"ok",…}`.
5. Kiểm chứng theo mục 6. Ghi thời điểm dừng web, thời điểm phục hồi xong, thời điểm smoke test đạt.

**Mất cả stack** (máy mới, volume bị xóa): dựng stack từ đúng commit có migration bằng phiên bản trong `.manifest` (`supabase start`), rồi chạy `scripts/restore.sh` như trên.

## 6. Kiểm chứng sau phục hồi

- `restore.sh` in "Số bản ghi khớp lúc sao lưu: N bảng" và thoát mã 0. Mã khác 0 nghĩa là có bảng lệch: xem phần `diff` script in ra.
- Kiểm vài bản ghi mẫu đã biết (tên và trạng thái kế hoạch, trạng thái hồ sơ) và mở được một file PDF kế hoạch.
- Chạy checklist [`docs/testing/smoke-test.md`](../testing/smoke-test.md) (8 bước) và lưu log vào thư mục bằng chứng.
- Kiểm log ứng dụng `logs/app-*.log` không có `db.call_failed` sau thời điểm khởi động lại.

## 7. Lần diễn tập gần nhất

### 06/11/2026 – diễn tập đầy đủ bằng script (issue #57)

Stack tách biệt `eoffice-v100` (dữ liệu demo giả, migration `202610150003`); web là bản build có logging (PR #56) chạy ở cổng 3400. Không đụng stack dev chính. Bằng chứng: [`docs/TH3/evidence/backup/`](../TH3/evidence/backup/README.md).

| Bước | Thời gian |
|---|---|
| 1. Ghi số liệu trước (12 bảng chính, bản ghi mẫu, sha256 3 file PDF) | 610 ms |
| 2. Sao lưu `scripts/backup.sh` (dump 784 KB, 54 bảng, 3 file PDF 36 KB) | 1 406 ms (script tự đo 1 170 ms) |
| 3. Gây hỏng: từ chối nhầm 4 đăng ký, đổi sai tên/địa điểm 2 kế hoạch, xóa 1 hồ sơ Đoàn viên, xóa 1 PDF, ghi đè 1 PDF | 355 ms |
| 4. Dừng web | 404 ms |
| 5. Phục hồi `scripts/restore.sh` (checksum 58 ms, Postgres 883 ms, Storage 310 ms) | 1 951 ms |
| 6. Khởi động web đến khi `/api/health` = 200 | 1 731 ms |
| 7. So sánh số liệu trước/sau: **khớp hoàn toàn** (số bản ghi, bản ghi mẫu, sha256 PDF) | 657 ms |
| 8. Smoke test: bước 2–4 bằng `curl`, bước 5–8 bằng Playwright trên giao diện: **8/8 PASS** | 9 179 ms |
| **RTO kỹ thuật** (dừng web → smoke xong) | **14 063 ms** |

Kiểm tra an toàn: `restore.sh hiu-youth-e-office …` bị từ chối (mã 77); bản sao lưu có file bị sửa bị dừng ở bước checksum (mã 65), chưa đụng tới dữ liệu.

Vấn đề gặp phải (lần chính thức là lần thứ 5, bản sao lưu `eoffice-v100_20261106T092608`):

- Lần 1 và 2: kịch bản gây hỏng định xóa đăng ký nhưng bị khóa ngoại của bảng điểm danh và lịch sử đăng ký chặn; transaction tự hủy, dữ liệu không đổi. Đổi thành "từ chối nhầm hàng loạt" (`UPDATE`), giống lỗi thao tác thật hơn.
- Lần 3: chạy hết và khớp, nhưng ảnh chụp số liệu chưa có thống kê trạng thái đăng ký nên không thấy được lỗi "từ chối nhầm". Thêm thống kê rồi chạy lại.
- Lần 4: phục hồi khớp, nhưng smoke bước 7 không bấm được "Gửi đăng ký" vì tài khoản dùng để smoke đã đăng ký chương trình đó trong dữ liệu demo. Mọi sinh viên demo đều đã đăng ký chương trình duy nhất đang mở, nên lần 5 dùng tài khoản demo `2201110203`.
- Bản sao lưu của bốn lần trên đã xóa khỏi `backups/`.
- Thời gian đo trên dữ liệu demo nhỏ. Dữ liệu thật lớn hơn thì `pg_dump`/`pg_restore` lâu hơn; cần đo lại khi có dữ liệu thật.

### 06/10/2026 – restore drill thủ công (v1.0-local)

Dùng `docker exec -i supabase_db_hiu-youth-e-office psql -U postgres` (PostgreSQL 17.6 trong container), restore vào database tách biệt `restore_test` trong cùng instance:

```bash
sh -c 'docker exec supabase_db_hiu-youth-e-office psql -U postgres -c "CREATE DATABASE restore_test"'
sh -c 'docker exec -i supabase_db_hiu-youth-e-office psql -U postgres restore_test < schema_20261005T223312.sql'
sh -c 'docker exec -i supabase_db_hiu-youth-e-office psql -U postgres restore_test < data_20261005T223312.sql'
sh -c 'docker exec supabase_db_hiu-youth-e-office psql -U postgres restore_test -tc "select count(*) from public.faculties"'   # → 10
sh -c 'docker exec supabase_db_hiu-youth-e-office psql -U postgres -c "DROP DATABASE restore_test"'
```

Kết quả: 11/11 bảng khớp (chi tiết: `docs/testing/test-report.md` → "G5 — Restore drill"). Lỗi không nghiêm trọng: `supabase_functions.hooks_id_seq` không tồn tại (sequence nội bộ của Supabase, không ảnh hưởng `public`).

### 05/10/2026 – backup local thủ công

```bash
supabase db dump --local -f schema_20261005T223312.sql            # 255K
supabase db dump --local --data-only -f data_20261005T223312.sql  # 369K, 1780 dòng
```

Kiểm tra: 11 bảng `public`, số dòng trong dump khớp DB đang chạy (10/51/347/6 danh mục, 1 template, 2 forms, 1 response, 3 answers). Chi tiết: `docs/testing/test-report.md` → "Bổ sung backup drill". Lần này chưa sao lưu `auth` và file Storage.

## Phụ lục – Sửa dữ liệu sai không cần phục hồi toàn bộ

- Danh mục: tạo phiên bản hiệu lực mới có lý do; lỗi hệ thống thì dùng migration hiệu chỉnh đã test, sao lưu trước khi áp.
- MSSV: dùng API/màn hình đổi MSSV để giữ UUID và `student_code_changes`.
- Quyền: thu hồi grant, không xóa lịch sử. Hồ sơ Đoàn viên: trả `needs_changes`, sửa trên cùng hồ sơ.

## Phụ lục – Supabase cloud (chưa dùng)

Chỉ làm khi đã được phê duyệt project và cửa sổ bảo trì. Không ghi database URL hoặc mật khẩu vào history, tài liệu hay commit.

```bash
supabase db dump --linked --file /secure/path/schema-before-change.sql
supabase db dump --linked --data-only --use-copy --file /secure/path/data-before-change.sql
```

Lưu dump ngoài repo; ghi project ref, thời điểm, commit SHA, checksum, người thực hiện. File Storage trên cloud không nằm trong dump; cần công cụ riêng (chưa làm). Restore cloud chỉ lập kế hoạch sau khi diễn tập trên stack tách biệt đạt và được phê duyệt.
