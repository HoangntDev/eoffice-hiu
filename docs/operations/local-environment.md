# Môi trường local: dựng sạch, bootstrap và sự cố Storage

Áp dụng cho Supabase CLI local (đã kiểm với CLI v2.117.0). Không áp dụng cho Supabase cloud.

## Dựng môi trường sạch

```bash
supabase start                       # dựng stack, chạy toàn bộ supabase/migrations theo thứ tự
npm run catalog:import -- ...        # nhập danh mục Khoa/Ngành/Lớp từ CSV chính thức (dry-run trước)
# Người quản lý Đoàn Trường đăng ký tài khoản qua /register bằng email @student.hiu.vn, tạo PIN, rồi:
npm run admin:bootstrap -- --user-id <UUID> --confirm
```

- `bootstrap_school_admin` cấp vai trò Đoàn Trường đầu tiên **và** tạo mẫu "Đăng ký Lớp bồi dưỡng nhận thức Đoàn" (`seed_camtinh_doan_template`, migration `202610140001`) với người tạo là chính tài khoản Đoàn Trường đó. Không cần và không tạo tài khoản giả.
- Migration cũ `202610100003` chỉ seed khi đã có tài khoản; trên DB dựng mới nó tự bỏ qua, mẫu sẽ được tạo ở bước bootstrap.
- Danh mục dân tộc/tôn giáo/tỉnh/phường (`reference_options`) được seed ngay trong migration.

Đã kiểm ngày 14/10/2026 trên stack tách biệt (`project_id` và cổng riêng, xóa sau khi kiểm): 18/18 migration chạy từ đầu; trước bootstrap có 0 mẫu, sau bootstrap có 1 mẫu `published` với 19 câu hỏi, người tạo là tài khoản bootstrap; upload PDF qua Storage API trả 200; pgTAP 002, 003, 005, 006 PASS.

## Lịch sử migration local

Nếu từng áp migration bằng `psql` thay vì CLI, `schema_migrations` sẽ thiếu bản ghi. Sau khi đã đối chiếu schema thật:

```bash
supabase migration repair --status applied <version...> --local   # chỉ ghi metadata, không chạy SQL
supabase migration list --local                                     # local và remote phải trùng
supabase migration up --local                                       # chạy các migration mới còn lại
```

Không dùng `migration repair` cho migration chưa thực sự có hiệu lực trong DB.

## Sự cố Storage `42P10` (13/10/2026)

**Triệu chứng:** mọi upload lỗi `there is no unique or exclusion constraint matching the ON CONFLICT specification`.

**Nguyên nhân đã xác minh:**
- Container Storage của stack chính được tạo ngày 09/10 từ `storage-api v1.79.36`, trong khi CLI v2.117.0 dựng stack mới bằng `v1.72.1`. Docker chỉ khởi động lại container cũ, không tạo lại từ image mặc định.
- Volume DB được tạo ngày 05/10 với `v1.72.1`. Migration nội bộ 0066 của bản này tạo `idx_objects_current_version` trên `(bucket_id, name)`.
- `v1.79.36` đổi nội dung migration 0066 thành `(bucket_id, name COLLATE "C")` nhưng không chạy lại vì 0066 đã ghi là chạy. Code của `v1.79.36` dùng `ON CONFLICT (bucket_id, name COLLATE "C")`, nên không tìm được index khớp.
- Chưa xác định công cụ nào đã tạo container `v1.79.36` ngày 09/10 (có thể do một lần chạy CLI bản mới hơn).

**Stack sạch không bị lỗi:** image và schema Storage cùng phiên bản (đã kiểm: `v1.72.1`, upload 200).

**DB local hiện tại:** đã thay index bằng đúng định nghĩa của `v1.79.36` (chỉ local, không có trong migration của repo):

```sql
-- chạy bằng supabase_admin, chỉ khi container Storage là v1.79.x
drop index storage.idx_objects_current_version;
create unique index idx_objects_current_version on storage.objects (bucket_id, name collate "C") where archived_at is null;
```

Không chạy lệnh trên nếu container Storage là `v1.72.x`: bản đó dùng `ON CONFLICT (bucket_id, name)` và sẽ lệch theo chiều ngược lại.

**Phòng ngừa:** dùng một phiên bản Supabase CLI cố định cho cả nhóm. Sau khi nâng hoặc hạ CLI, chạy `supabase stop` rồi `supabase start` để container được tạo lại từ image đúng phiên bản. Nếu schema Storage đã chạy migration của bản mới hơn image, dựng lại volume (`supabase stop --no-backup`, mất dữ liệu local, cần backup trước).
