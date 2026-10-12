-- pgTAP: UC6 — kế hoạch chương trình sự kiện (quyền, RLS, chuyển trạng thái, lịch sử)
-- Run with: supabase test db

begin;
select plan(33);

-- ── Fixtures (postgres) ───────────────────────────────────────────────────────
insert into public.faculties (id, current_code, current_name) values
  ('cccccccc-0000-4000-8000-00000000000a', 'UC6_KHOA_A', 'Khoa Thử nghiệm A'),
  ('cccccccc-0000-4000-8000-00000000000b', 'UC6_KHOA_B', 'Khoa Thử nghiệm B');
-- trigger sync_faculty_organization_unit tạo đơn vị faculty_union tương ứng

insert into auth.users (id, email) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'uc6-khoa-a@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'uc6-khoa-b@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'uc6-student@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'uc6-office@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000006', 'uc6-dual@test.local');

insert into public.accounts (user_id, student_code, status) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '2060000001', 'active'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '2060000002', 'active'),
  ('bbbbbbbb-0000-4000-8000-000000000003', '2060000003', 'active'),
  ('bbbbbbbb-0000-4000-8000-000000000004', '2060000004', 'active'),
  ('bbbbbbbb-0000-4000-8000-000000000006', '2060000006', 'active');

insert into public.role_grants (user_id, role_code, organization_id, reason)
select 'bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'faculty_manager', id, 'UC6 test'
from public.organization_units where faculty_id = 'cccccccc-0000-4000-8000-00000000000a';
insert into public.role_grants (user_id, role_code, organization_id, reason)
select 'bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'faculty_manager', id, 'UC6 test'
from public.organization_units where faculty_id = 'cccccccc-0000-4000-8000-00000000000b';
insert into public.role_grants (user_id, role_code, organization_id, reason) values
  ('bbbbbbbb-0000-4000-8000-000000000004', 'office', '00000000-0000-4000-8000-000000000002', 'UC6 test'),
  ('bbbbbbbb-0000-4000-8000-000000000006', 'office', '00000000-0000-4000-8000-000000000002', 'UC6 test');
insert into public.role_grants (user_id, role_code, organization_id, reason)
select 'bbbbbbbb-0000-4000-8000-000000000006'::uuid, 'faculty_executive', id, 'UC6 test'
from public.organization_units where faculty_id = 'cccccccc-0000-4000-8000-00000000000a';

create temp table uc6_ctx (k text primary key, v uuid);
grant all on uc6_ctx to authenticated;
insert into uc6_ctx
select 'org_a', id from public.organization_units where faculty_id = 'cccccccc-0000-4000-8000-00000000000a'
union all
select 'org_b', id from public.organization_units where faculty_id = 'cccccccc-0000-4000-8000-00000000000b';

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.act_as(uuid) to authenticated;

set local role authenticated;

-- ── 1. Tạo bản nháp trong phạm vi Khoa ───────────────────────────────────────
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000001');
select lives_ok(
  $$ insert into uc6_ctx values ('p1', public.save_event_program(null, (select v from uc6_ctx where k = 'org_a'),
       'Ngày hội tình nguyện Khoa A', null, null, null, null, null, null, null, 'test-req')) $$,
  'Đoàn Khoa A tạo bản nháp cho Khoa mình');

select throws_ok(
  $$ select public.save_event_program(null, (select v from uc6_ctx where k = 'org_b'),
       'Chương trình lấn phạm vi', null, null, null, null, null, null, null) $$,
  'P0001', 'FORBIDDEN', 'Đoàn Khoa A không tạo kế hoạch cho Khoa B');

select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.save_event_program((select v from uc6_ctx where k = 'p1'), null,
       'Khoa B sửa trái phép', null, null, null, null, null, null, null) $$,
  'P0001', 'FORBIDDEN', 'Đoàn Khoa B không sửa hồ sơ của Khoa A');
select is((select count(*)::int from public.event_programs where id = (select v from uc6_ctx where k = 'p1')), 0,
  'RLS: Khoa B không đọc được bản nháp của Khoa A');

select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000003');
select throws_ok(
  $$ select public.save_event_program(null, (select v from uc6_ctx where k = 'org_a'),
       'Sinh viên tự tạo kế hoạch', null, null, null, null, null, null, null) $$,
  'P0001', 'FORBIDDEN', 'Sinh viên không có vai trò không tạo kế hoạch');
select is((select count(*)::int from public.event_programs where status <> 'approved'), 0,
  'RLS: sinh viên không thấy hồ sơ chưa được chấp thuận (kể cả bản nháp vừa tạo)');

select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000004');
select is((select count(*)::int from public.event_programs where id = (select v from uc6_ctx where k = 'p1')), 0,
  'RLS: Văn phòng không thấy bản nháp chưa gửi');

-- ── 2. Kiểm tra trường bắt buộc và PDF ở server ──────────────────────────────
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000001');
select throws_like(
  $$ select public.submit_event_program((select v from uc6_ctx where k = 'p1')) $$,
  'MISSING_REQUIRED_FIELDS:%', 'Gửi khi thiếu trường bắt buộc bị chặn');
select throws_ok(
  $$ select public.save_event_program((select v from uc6_ctx where k = 'p1'), null, 'Ngày hội tình nguyện Khoa A',
       'Nội dung', 'Hội trường A', '2026-11-20 08:00+07', '2026-11-20 07:00+07', 100, '12/KH-ĐKA', '2026-10-12') $$,
  'P0001', 'ENDS_BEFORE_STARTS', 'Thời gian kết thúc trước bắt đầu bị chặn');
select lives_ok(
  $$ select public.save_event_program((select v from uc6_ctx where k = 'p1'), null, 'Ngày hội tình nguyện Khoa A',
       'Nội dung và mục tiêu chương trình', 'Hội trường A', '2026-11-20 08:00+07', '2026-11-20 11:00+07', 120,
       '12/KH-ĐKA', '2026-10-12') $$,
  'Đoàn Khoa A khai báo đủ thông tin');
select throws_ok(
  $$ select public.submit_event_program((select v from uc6_ctx where k = 'p1')) $$,
  'P0001', 'PLAN_DOCUMENT_REQUIRED', 'Gửi khi chưa có PDF kế hoạch đã ký bị chặn');

-- ── 3. Storage policy và ghi nhận PDF ────────────────────────────────────────
insert into uc6_ctx values ('obj1', gen_random_uuid());
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('event-program-plans', (select v from uc6_ctx where k = 'p1')::text || '/' || (select v from uc6_ctx where k = 'obj1')::text || '.pdf') $$,
  '42501', null, 'Storage RLS: Khoa B không tải PDF vào hồ sơ Khoa A');
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000001');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('event-program-plans', (select v from uc6_ctx where k = 'p1')::text || '/' || (select v from uc6_ctx where k = 'obj1')::text || '.pdf') $$,
  'Storage RLS: Đoàn Khoa A tải PDF vào hồ sơ của mình');
select throws_ok(
  $$ select public.attach_event_program_document((select v from uc6_ctx where k = 'p1'),
       (select v from uc6_ctx where k = 'p1')::text || '/' || gen_random_uuid()::text || '.pdf',
       'ke-hoach.pdf', 2048, repeat('a', 64)) $$,
  'P0001', 'DOCUMENT_NOT_UPLOADED', 'Không ghi nhận tệp chưa tồn tại trong Storage');
select lives_ok(
  $$ select public.attach_event_program_document((select v from uc6_ctx where k = 'p1'),
       (select v from uc6_ctx where k = 'p1')::text || '/' || (select v from uc6_ctx where k = 'obj1')::text || '.pdf',
       'ke-hoach-da-ky.pdf', 2048, repeat('a', 64)) $$,
  'Ghi nhận PDF kế hoạch đã ký');

-- ── 4. Không ghi trực tiếp vào bảng ──────────────────────────────────────────
select throws_ok(
  $$ update public.event_programs set status = 'approved' where id = (select v from uc6_ctx where k = 'p1') $$,
  '42501', null, 'Không cập nhật trạng thái trực tiếp, kể cả Đoàn Khoa sở hữu');
select throws_ok(
  $$ insert into public.event_program_history (program_id, action, to_status, actor_user_id)
     values ((select v from uc6_ctx where k = 'p1'), 'approved', 'approved', 'bbbbbbbb-0000-4000-8000-000000000001') $$,
  '42501', null, 'Không chèn lịch sử giả trực tiếp');

-- ── 5. Gửi Văn phòng và xét duyệt ────────────────────────────────────────────
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000004');
select throws_ok(
  $$ select public.review_event_program((select v from uc6_ctx where k = 'p1'), 'approve', null) $$,
  'P0001', 'INVALID_TRANSITION', 'Văn phòng không duyệt bản nháp chưa gửi');

select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000001');
select is(public.submit_event_program((select v from uc6_ctx where k = 'p1')), 'submitted', 'Đoàn Khoa A gửi kế hoạch');
select throws_ok(
  $$ select public.save_event_program((select v from uc6_ctx where k = 'p1'), null, 'Sửa khi đang chờ duyệt',
       null, null, null, null, null, null, null) $$,
  'P0001', 'PROGRAM_NOT_EDITABLE', 'Không sửa khi hồ sơ đang chờ Văn phòng');

select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000003');
select throws_ok(
  $$ select public.review_event_program((select v from uc6_ctx where k = 'p1'), 'approve', null) $$,
  'P0001', 'FORBIDDEN', 'Sinh viên không tự duyệt kế hoạch');

select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000004');
select throws_ok(
  $$ select public.review_event_program((select v from uc6_ctx where k = 'p1'), 'request_changes', 'ngắn') $$,
  'P0001', 'REASON_REQUIRED', 'Yêu cầu chỉnh sửa phải có lý do');
select is(public.review_event_program((select v from uc6_ctx where k = 'p1'), 'request_changes',
  'Bổ sung danh sách ban tổ chức và kinh phí dự kiến'), 'needs_changes', 'Văn phòng yêu cầu chỉnh sửa');

-- ── 6. Sửa tiếp đúng hồ sơ hiện có và nộp lại ────────────────────────────────
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.save_event_program((select v from uc6_ctx where k = 'p1'), null, 'Ngày hội tình nguyện Khoa A',
       'Nội dung đã bổ sung ban tổ chức và kinh phí', 'Hội trường A', '2026-11-20 08:00+07', '2026-11-20 11:00+07', 120,
       '12/KH-ĐKA', '2026-10-12') $$,
  'Đoàn Khoa A sửa tiếp hồ sơ đang cần chỉnh sửa');
select public.submit_event_program((select v from uc6_ctx where k = 'p1'));
select is((select submission_count from public.event_programs where id = (select v from uc6_ctx where k = 'p1')), 2,
  'Nộp lại trên cùng hồ sơ: submission_count = 2, không tạo hồ sơ mới');

select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000004');
select throws_ok(
  $$ select public.review_event_program((select v from uc6_ctx where k = 'p1'), 'reject', null) $$,
  'P0001', 'REASON_REQUIRED', 'Từ chối phải có lý do');
select is(public.review_event_program((select v from uc6_ctx where k = 'p1'), 'approve', null), 'approved',
  'Văn phòng chấp thuận');
select throws_ok(
  $$ select public.review_event_program((select v from uc6_ctx where k = 'p1'), 'reject', 'Đổi ý sau khi đã duyệt') $$,
  'P0001', 'INVALID_TRANSITION', 'Không xét lại hồ sơ đã chấp thuận');
select is(
  (select array_agg(to_status order by id)::text from public.event_program_history
   where program_id = (select v from uc6_ctx where k = 'p1') and from_status is distinct from to_status),
  '{draft,submitted,needs_changes,submitted,approved}',
  'Lịch sử lưu đủ chuỗi chuyển trạng thái');
select is(
  (select h.actor_role_code from public.event_program_history h
   where h.program_id = (select v from uc6_ctx where k = 'p1') and h.action = 'approved'
     and h.actor_user_id = 'bbbbbbbb-0000-4000-8000-000000000004' and h.actor_role_grant_id is not null),
  'office', 'Lịch sử ghi vai trò Văn phòng của người chấp thuận');

-- ── 7. Hiển thị sau khi duyệt ────────────────────────────────────────────────
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000003');
select is((select count(*)::int from public.event_programs where status = 'approved'
           and id = (select v from uc6_ctx where k = 'p1')), 1, 'Sinh viên thấy chương trình đã được chấp thuận');
select is((select count(*)::int from public.event_program_documents where program_id = (select v from uc6_ctx where k = 'p1')), 0,
  'Sinh viên không đọc PDF/hồ sơ nội bộ của chương trình đã duyệt');

-- ── 8. Người đã nộp không tự xét duyệt ───────────────────────────────────────
select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000006');
insert into uc6_ctx values ('p2', public.save_event_program(null, (select v from uc6_ctx where k = 'org_a'),
  'Hội thảo kỹ năng Khoa A', 'Nội dung hội thảo', 'Phòng B1', '2026-12-01 13:00+07', '2026-12-01 16:00+07', 80,
  '15/KH-ĐKA', '2026-10-12'));
insert into uc6_ctx values ('obj2', gen_random_uuid());
insert into storage.objects (bucket_id, name)
values ('event-program-plans', (select v from uc6_ctx where k = 'p2')::text || '/' || (select v from uc6_ctx where k = 'obj2')::text || '.pdf');
select public.attach_event_program_document((select v from uc6_ctx where k = 'p2'),
  (select v from uc6_ctx where k = 'p2')::text || '/' || (select v from uc6_ctx where k = 'obj2')::text || '.pdf',
  'hoi-thao.pdf', 4096, repeat('b', 64));
select public.submit_event_program((select v from uc6_ctx where k = 'p2'));
select throws_ok(
  $$ select public.review_event_program((select v from uc6_ctx where k = 'p2'), 'approve', null) $$,
  'P0001', 'SELF_REVIEW_FORBIDDEN', 'Người vừa là Đoàn Khoa vừa là Văn phòng không tự duyệt hồ sơ mình nộp');

select * from finish();
rollback;
