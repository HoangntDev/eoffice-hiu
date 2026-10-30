-- CR-01-TaiKhoanToChuc (#37): loại tài khoản student/organization.
-- AC3 (chặn Chi đoàn, Ban), AC6 (vai trò quản lý không nằm trên tài khoản cá nhân), AC11 và R-6
-- (ràng buộc cũ của tài khoản sinh viên giữ nguyên, CTV và trưởng Ban giữ trên tài khoản cá nhân).
-- Câu lệnh dùng cột/bảng mới đều nằm trong chuỗi SQL của assertion hoặc pg_temp.val, để khi chưa
-- hiện thực, test báo "not ok" thay vì dừng cả file.
begin;
select plan(26);

-- Chạy SQL động, trả về giá trị dạng text hoặc 'ERROR: <thông báo>'.
create function pg_temp.val(p_sql text) returns text language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  return v;
exception when others then
  return 'ERROR: ' || sqlerrm;
end;
$$;

insert into auth.users(id, email) values
  ('a9000000-0000-4000-8000-000000000001', 'sv1@test.local'),
  ('a9000000-0000-4000-8000-000000000002', 'sv2@test.local'),
  ('a9000000-0000-4000-8000-000000000003', 'sv3@test.local'),
  ('a9000000-0000-4000-8000-000000000004', 'org1@test.local'),
  ('a9000000-0000-4000-8000-000000000005', 'org2@test.local');
insert into public.faculties(id, current_code, current_name)
values ('c9000000-0000-4000-8000-00000000000a', 'T009', 'Khoa Kiểm thử 009');
insert into public.programs(id, current_code, current_name, current_faculty_id)
values ('c9000000-0000-4000-8000-0000000000aa', 'T009P', 'Ngành Kiểm thử 009', 'c9000000-0000-4000-8000-00000000000a');
insert into public.cohorts(id, code, display_name) values ('c9000000-0000-4000-8000-0000000000bb', 'T009K', 'Khóa Kiểm thử 009');
insert into public.classes(id, current_code, current_name, current_program_id, current_cohort_id)
values ('c9000000-0000-4000-8000-0000000000cc', 'T009L', 'Lớp Kiểm thử 009', 'c9000000-0000-4000-8000-0000000000aa', 'c9000000-0000-4000-8000-0000000000bb');
create temp table ctx(k text primary key, v uuid);
insert into ctx select 'faculty_org', id from public.organization_units where faculty_id = 'c9000000-0000-4000-8000-00000000000a';
insert into ctx select 'class_org', id from public.organization_units where class_id = 'c9000000-0000-4000-8000-0000000000cc';

-- ── Cấu trúc ──────────────────────────────────────────────────────────────────
select has_column('public', 'accounts', 'account_type', 'accounts có cột account_type');
select has_column('public', 'accounts', 'organization_id', 'accounts có cột organization_id');
select has_table('public', 'organization_members', 'có bảng thành viên đơn vị organization_members');

-- ── AC11: tài khoản sinh viên giữ ràng buộc cũ ───────────────────────────────
select lives_ok(
  $$ insert into public.accounts(user_id, student_code, status) values ('a9000000-0000-4000-8000-000000000001', '8880090001', 'active') $$,
  'AC11: tạo tài khoản sinh viên như trước (MSSV 10 số hợp lệ)');
select is(pg_temp.val($$ select account_type from public.accounts where user_id = 'a9000000-0000-4000-8000-000000000001' $$),
  'student', 'AC11: tài khoản tạo như trước mặc định là student');
select throws_ok(
  $$ insert into public.accounts(user_id, student_code) values ('a9000000-0000-4000-8000-000000000002', null) $$,
  'P0001', 'INVALID_STUDENT_CODE', 'AC11: sinh viên không có MSSV vẫn bị từ chối');
select throws_ok(
  $$ insert into public.accounts(user_id, student_code) values ('a9000000-0000-4000-8000-000000000002', '12345') $$,
  'P0001', 'INVALID_STUDENT_CODE', 'AC11: MSSV sai quy tắc vẫn bị từ chối');
select throws_ok(
  $$ insert into public.accounts(user_id, student_code) values ('a9000000-0000-4000-8000-000000000002', '8880090001') $$,
  '23505', null, 'AC11: MSSV vẫn duy nhất');
select throws_ok(
  $$ insert into public.account_emails(user_id, email, verified_at) values ('a9000000-0000-4000-8000-000000000001', 'sv1@gmail.com', now()) $$,
  '23514', null, 'AC11: email sinh viên vẫn phải @student.hiu.vn');
select lives_ok(
  $$ insert into public.account_emails(user_id, email, verified_at) values ('a9000000-0000-4000-8000-000000000001', '8880001@student.hiu.vn', now()) $$,
  'AC11: email @student.hiu.vn của sinh viên được nhận');
select throws_ok(
  $$ insert into public.accounts(user_id, student_code, organization_id) values ('a9000000-0000-4000-8000-000000000002', '8880090002', (select v from ctx where k = 'faculty_org')) $$,
  '23514', null, 'tài khoản sinh viên không được gắn đơn vị');

-- ── AC3: tài khoản tổ chức chỉ cho Đoàn Trường, Văn phòng, Đoàn Khoa ─────────
select throws_ok(
  $$ insert into public.accounts(user_id, account_type, student_code, organization_id) values ('a9000000-0000-4000-8000-000000000004', 'organization', '8880090004', (select v from ctx where k = 'faculty_org')) $$,
  '23514', null, 'tài khoản tổ chức không có MSSV');
select throws_ok(
  $$ insert into public.accounts(user_id, account_type, organization_id) values ('a9000000-0000-4000-8000-000000000004', 'organization', '00000000-0000-4000-8000-000000000003') $$,
  'P0001', 'ORG_ACCOUNT_UNIT_NOT_ALLOWED', 'AC3: Ban (school_committee) bị DB chặn tạo tài khoản tổ chức');
select throws_ok(
  $$ insert into public.accounts(user_id, account_type, organization_id) values ('a9000000-0000-4000-8000-000000000004', 'organization', (select v from ctx where k = 'class_org')) $$,
  'P0001', 'ORG_ACCOUNT_UNIT_NOT_ALLOWED', 'AC3: Chi đoàn bị DB chặn khi chèn thẳng vào accounts');
select throws_ok(
  $$ select public.create_organization_account((select v from ctx where k = 'class_org'), 'thử Chi đoàn') $$,
  'P0001', 'ORG_ACCOUNT_UNIT_NOT_ALLOWED', 'AC3: Chi đoàn bị chặn khi tạo qua create_organization_account');
select lives_ok(
  $$ insert into public.accounts(user_id, account_type, organization_id, status) values ('a9000000-0000-4000-8000-000000000004', 'organization', (select v from ctx where k = 'faculty_org'), 'active') $$,
  'AC3: Đoàn Khoa có tài khoản tổ chức');
select throws_ok(
  $$ insert into public.account_emails(user_id, email) values ('a9000000-0000-4000-8000-000000000004', '8880004@student.hiu.vn') $$,
  'P0001', 'STUDENT_EMAIL_ONLY_FOR_STUDENTS', 'tài khoản tổ chức không có email sinh viên');
select throws_ok(
  $$ update public.accounts set account_type = 'student', student_code = '8880090004', organization_id = null where user_id = 'a9000000-0000-4000-8000-000000000004' $$,
  'P0001', 'ACCOUNT_TYPE_IMMUTABLE', 'không đổi được loại tài khoản');
select throws_ok(
  $$ update public.organization_units set unit_type = 'school_committee' where id = (select v from ctx where k = 'faculty_org') $$,
  'P0001', 'ORG_ACCOUNT_UNIT_NOT_ALLOWED', 'AC3: đơn vị đã có tài khoản không đổi được sang loại không có tài khoản');

-- ── AC6: vai trò quản lý chỉ nằm trên tài khoản tổ chức của đúng đơn vị ──────
select throws_ok(
  $$ insert into public.role_grants(user_id, role_code, organization_id, reason) values ('a9000000-0000-4000-8000-000000000001', 'faculty_manager', (select v from ctx where k = 'faculty_org'), 'thử') $$,
  'P0001', 'MANAGEMENT_ROLE_REQUIRES_ORGANIZATION_ACCOUNT', 'AC6: không cấp vai trò quản lý cho tài khoản cá nhân');
select throws_ok(
  $$ insert into public.role_grants(user_id, role_code, organization_id, reason) values ('a9000000-0000-4000-8000-000000000004', 'office', '00000000-0000-4000-8000-000000000002', 'thử') $$,
  'P0001', 'MANAGEMENT_ROLE_REQUIRES_ORGANIZATION_ACCOUNT', 'AC6: tài khoản tổ chức chỉ giữ vai trò của chính đơn vị');
select throws_ok(
  $$ insert into public.role_grants(user_id, role_code, organization_id, reason) values ('a9000000-0000-4000-8000-000000000004', 'collaborator', '00000000-0000-4000-8000-000000000003', 'thử') $$,
  'P0001', 'PERSONAL_ROLE_REQUIRES_STUDENT_ACCOUNT', 'R-6: CTV không cấp cho tài khoản tổ chức');
select lives_ok(
  $$ insert into public.role_grants(user_id, role_code, organization_id, reason) values ('a9000000-0000-4000-8000-000000000001', 'collaborator', '00000000-0000-4000-8000-000000000003', 'thử') $$,
  'R-6: CTV vẫn cấp cho tài khoản cá nhân');
select lives_ok(
  $$ insert into public.role_grants(user_id, role_code, organization_id, reason) values ('a9000000-0000-4000-8000-000000000001', 'committee_manager', '00000000-0000-4000-8000-000000000003', 'thử') $$,
  'R-6: trưởng Ban vẫn cấp cho tài khoản cá nhân');

-- ── Thành viên đơn vị là tài khoản sinh viên ────────────────────────────────
select lives_ok(
  $$ insert into public.organization_members(organization_id, user_id, member_role, reason) values ((select v from ctx where k = 'faculty_org'), 'a9000000-0000-4000-8000-000000000001', 'manager', 'thử') $$,
  'sinh viên là thành viên đơn vị');
select throws_ok(
  $$ insert into public.organization_members(organization_id, user_id, member_role, reason) values ((select v from ctx where k = 'faculty_org'), 'a9000000-0000-4000-8000-000000000004', 'officer', 'thử') $$,
  'P0001', 'MEMBER_MUST_BE_STUDENT_ACCOUNT', 'tài khoản tổ chức không là thành viên đơn vị');

select * from finish();
rollback;
