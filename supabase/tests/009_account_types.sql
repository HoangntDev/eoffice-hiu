-- SPIKE CR-01 (#37): loại tài khoản student/organization. Ràng buộc cũ vẫn đúng cho tài khoản sinh viên.
begin;
select plan(18);

insert into auth.users(id, email) values
  ('a9000000-0000-4000-8000-000000000001', 'sv1@test.local'),
  ('a9000000-0000-4000-8000-000000000002', 'sv2@test.local'),
  ('a9000000-0000-4000-8000-000000000003', 'sv3@test.local'),
  ('a9000000-0000-4000-8000-000000000004', 'org1@test.local');
insert into public.faculties(id, current_code, current_name)
values ('c9000000-0000-4000-8000-00000000000a', 'T009', 'Khoa Kiểm thử 009');
create temp table ctx(k text primary key, v uuid);
insert into ctx select 'faculty_org', id from public.organization_units where faculty_id = 'c9000000-0000-4000-8000-00000000000a';

-- ── Tài khoản sinh viên: ràng buộc cũ ─────────────────────────────────────────
select lives_ok(
  $$ insert into public.accounts(user_id, student_code, status) values ('a9000000-0000-4000-8000-000000000001', '8880090001', 'active') $$,
  'sinh viên mặc định account_type = student, MSSV 10 số hợp lệ');
select is((select account_type from public.accounts where user_id = 'a9000000-0000-4000-8000-000000000001'), 'student', 'mặc định là student');
select throws_ok(
  $$ insert into public.accounts(user_id, student_code) values ('a9000000-0000-4000-8000-000000000002', null) $$,
  'P0001', 'INVALID_STUDENT_CODE', 'sinh viên không có MSSV bị từ chối');
select throws_ok(
  $$ insert into public.accounts(user_id, student_code) values ('a9000000-0000-4000-8000-000000000002', '12345') $$,
  'P0001', 'INVALID_STUDENT_CODE', 'MSSV sai quy tắc bị từ chối');
select throws_ok(
  $$ insert into public.accounts(user_id, student_code) values ('a9000000-0000-4000-8000-000000000002', '8880090001') $$,
  '23505', null, 'MSSV vẫn duy nhất');
select throws_ok(
  $$ insert into public.account_emails(user_id, email, verified_at) values ('a9000000-0000-4000-8000-000000000001', 'sv1@gmail.com', now()) $$,
  '23514', null, 'email sinh viên vẫn phải @student.hiu.vn');
select lives_ok(
  $$ insert into public.account_emails(user_id, email, verified_at) values ('a9000000-0000-4000-8000-000000000001', '8880001@student.hiu.vn', now()) $$,
  'email @student.hiu.vn của sinh viên được nhận');
select throws_ok(
  $$ insert into public.accounts(user_id, student_code, organization_id) values ('a9000000-0000-4000-8000-000000000002', '8880090002', (select v from ctx where k = 'faculty_org')) $$,
  '23514', null, 'tài khoản sinh viên không được gắn đơn vị');

-- ── Tài khoản tổ chức ─────────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.accounts(user_id, account_type, student_code, organization_id) values ('a9000000-0000-4000-8000-000000000004', 'organization', '8880090004', (select v from ctx where k = 'faculty_org')) $$,
  '23514', null, 'tài khoản tổ chức không có MSSV');
select throws_ok(
  $$ insert into public.accounts(user_id, account_type, organization_id) values ('a9000000-0000-4000-8000-000000000004', 'organization', '00000000-0000-4000-8000-000000000003') $$,
  'P0001', 'ORG_ACCOUNT_UNIT_NOT_ALLOWED', 'Ban (school_committee) chưa có tài khoản tổ chức');
select lives_ok(
  $$ insert into public.accounts(user_id, account_type, organization_id, status) values ('a9000000-0000-4000-8000-000000000004', 'organization', (select v from ctx where k = 'faculty_org'), 'active') $$,
  'Đoàn Khoa có tài khoản tổ chức');
select throws_ok(
  $$ insert into public.account_emails(user_id, email) values ('a9000000-0000-4000-8000-000000000004', '8880004@student.hiu.vn') $$,
  'P0001', 'STUDENT_EMAIL_ONLY_FOR_STUDENTS', 'tài khoản tổ chức không có email sinh viên');
select throws_ok(
  $$ update public.accounts set account_type = 'student', student_code = '8880090004', organization_id = null where user_id = 'a9000000-0000-4000-8000-000000000004' $$,
  'P0001', 'ACCOUNT_TYPE_IMMUTABLE', 'không đổi được loại tài khoản');

-- ── Vai trò và thành viên ────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.role_grants(user_id, role_code, organization_id, reason) values ('a9000000-0000-4000-8000-000000000001', 'faculty_manager', (select v from ctx where k = 'faculty_org'), 'test') $$,
  'P0001', 'MANAGEMENT_ROLE_REQUIRES_ORGANIZATION_ACCOUNT', 'không cấp vai trò quản lý cho tài khoản sinh viên');
select throws_ok(
  $$ insert into public.role_grants(user_id, role_code, organization_id, reason) values ('a9000000-0000-4000-8000-000000000004', 'office', '00000000-0000-4000-8000-000000000002', 'test') $$,
  'P0001', 'MANAGEMENT_ROLE_REQUIRES_ORGANIZATION_ACCOUNT', 'tài khoản tổ chức chỉ giữ vai trò của chính đơn vị');
select throws_ok(
  $$ insert into public.role_grants(user_id, role_code, organization_id, reason) values ('a9000000-0000-4000-8000-000000000004', 'collaborator', '00000000-0000-4000-8000-000000000003', 'test') $$,
  'P0001', 'PERSONAL_ROLE_REQUIRES_STUDENT_ACCOUNT', 'CTV chỉ cấp cho tài khoản sinh viên');
select lives_ok(
  $$ insert into public.organization_members(organization_id, user_id, member_role, reason) values ((select v from ctx where k = 'faculty_org'), 'a9000000-0000-4000-8000-000000000001', 'manager', 'test') $$,
  'sinh viên là thành viên đơn vị');
select throws_ok(
  $$ insert into public.organization_members(organization_id, user_id, member_role, reason) values ((select v from ctx where k = 'faculty_org'), 'a9000000-0000-4000-8000-000000000004', 'officer', 'test') $$,
  'P0001', 'MEMBER_MUST_BE_STUDENT_ACCOUNT', 'tài khoản tổ chức không là thành viên');

select * from finish();
rollback;
