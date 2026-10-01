begin;
select plan(10);

insert into auth.users(id, email) values
  ('10000000-0000-4000-8000-000000000001', 'admin-test@gmail.com'),
  ('10000000-0000-4000-8000-000000000002', 'office-test@gmail.com'),
  ('10000000-0000-4000-8000-000000000003', 'ctv-test@gmail.com'),
  ('10000000-0000-4000-8000-000000000004', 'student-test@gmail.com');

insert into public.accounts(user_id, student_code, status) values
  ('10000000-0000-4000-8000-000000000001', '0000000001', 'active'),
  ('10000000-0000-4000-8000-000000000002', '0000000002', 'active'),
  ('10000000-0000-4000-8000-000000000003', '0000000003', 'active'),
  ('10000000-0000-4000-8000-000000000004', '0000000004', 'active');
insert into public.account_emails(user_id, email, verified_at)
select id, email, now() from auth.users where id::text like '10000000-%';

select public.import_academic_catalog_v2(
  '[{"lineNumber":2,"facultyName":"Khoa A","programName":"Ngành A","classCode":"00AUTH0001","cohortCode":"DHCQK2026","educationLevel":"Đại học","trainingType":"Chính quy"}]'::jsonb,
  'auth-test.csv', 'auth-test-sha', false
);

insert into public.student_profiles(user_id, full_name, gender, phone, class_id)
values ('10000000-0000-4000-8000-000000000004', 'Sinh viên Kiểm thử', 'female', '0900000000',
  (select id from public.classes where current_code = '00AUTH0001'));

insert into public.role_grants(id, user_id, role_code, organization_id, reason) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'office', '00000000-0000-4000-8000-000000000002', 'Kiểm thử Văn phòng'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'collaborator', '00000000-0000-4000-8000-000000000003', 'Kiểm thử CTV');

insert into public.union_applications(id, user_id, cycle_key, status, profile_snapshot, organization_snapshot, submitted_at)
values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', '2026-2027', 'submitted',
  '{"fullName":"Sinh viên Kiểm thử","studentCode":"0000000004"}',
  jsonb_build_object('facultyId', (select current_faculty_id from public.programs limit 1)), now());
insert into public.membership_application_assignments(application_id, collaborator_user_id, organization_id, assigned_by)
values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$select public.review_union_application('30000000-0000-4000-8000-000000000001','recognize','CTV không được duyệt','20000000-0000-4000-8000-000000000002')$$,
  'P0001', 'COLLABORATOR_CANNOT_FINALIZE', 'CTV cannot make final recognition'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.review_union_application('30000000-0000-4000-8000-000000000001','recognize','Duyệt khi chưa nhận sổ','20000000-0000-4000-8000-000000000001')$$,
  'P0001', 'PAPER_BOOK_NOT_RECEIVED', 'office cannot recognize before paper book receipt'
);
select lives_ok(
  $$select public.record_paper_book_event('10000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001','received',current_date,'20000000-0000-4000-8000-000000000001')$$,
  'office records paper book receipt'
);
select lives_ok(
  $$select public.review_union_application('30000000-0000-4000-8000-000000000001','recognize','Hồ sơ hợp lệ','20000000-0000-4000-8000-000000000001')$$,
  'office recognizes after receipt'
);
select is((select status from public.union_memberships where user_id='10000000-0000-4000-8000-000000000004'), 'recognized', 'recognition creates membership');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select lives_ok(
  $$select public.save_student_profile('Sinh viên Kiểm thử', 'female', '0900000000',
    (select id from public.classes where current_code = '00AUTH0001'))$$,
  'server accepts a class with a valid Khoa-Ngành-Khóa relationship'
);
select throws_ok(
  $$select public.save_student_profile('Sinh viên Kiểm thử', 'female', '0900000000',
    'ffffffff-ffff-4fff-8fff-ffffffffffff')$$,
  'P0001', 'INVALID_OR_INACTIVE_CLASS', 'server rejects a class outside the active catalog'
);
select is((select count(*) from public.union_applications), 1::bigint, 'student can read own application through RLS');
select throws_ok(
  $$select public.change_student_code('10000000-0000-4000-8000-000000000004','0000000099','Tự đổi trái phép',null)$$,
  'P0001', 'FORBIDDEN', 'student cannot change own MSSV'
);
select throws_ok(
  $$insert into public.union_memberships(user_id, recognized_application_id, recognized_on, recognized_by, role_grant_id)
    values ('10000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001',current_date,
    '10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'student/authenticated role cannot directly write membership status'
);

select * from finish();
rollback;
