-- pgTAP: UC7 — đăng ký tham gia chương trình (quyền, đối tượng, trùng, chỉ tiêu, uy tín, lịch sử)
-- Tranh chấp suất cuối giữa nhiều phiên đồng thời: scripts/race-program-registration.sh (cần commit thật).

begin;
select plan(50);

-- ── Fixtures (postgres) ───────────────────────────────────────────────────────
insert into public.faculties (id, current_code, current_name) values
  ('c7000000-0000-4000-8000-00000000000a', 'UC7_KHOA_A', 'Khoa UC7 A'),
  ('c7000000-0000-4000-8000-00000000000b', 'UC7_KHOA_B', 'Khoa UC7 B');
insert into public.programs (id, current_code, current_name, current_faculty_id) values
  ('c7000000-0000-4000-8000-0000000000a1', 'UC7_NGANH_A1', 'Ngành UC7 A1', 'c7000000-0000-4000-8000-00000000000a'),
  ('c7000000-0000-4000-8000-0000000000a2', 'UC7_NGANH_A2', 'Ngành UC7 A2', 'c7000000-0000-4000-8000-00000000000a'),
  ('c7000000-0000-4000-8000-0000000000b1', 'UC7_NGANH_B1', 'Ngành UC7 B1', 'c7000000-0000-4000-8000-00000000000b');
insert into public.cohorts (id, code, display_name) values
  ('c7000000-0000-4000-8000-0000000000c0', 'UC7K', 'Khóa UC7');
insert into public.classes (id, current_code, current_name, current_program_id, current_cohort_id) values
  ('c7000000-0000-4000-8000-0000000001a1', 'UC7A1', 'Lớp UC7 A1', 'c7000000-0000-4000-8000-0000000000a1', 'c7000000-0000-4000-8000-0000000000c0'),
  ('c7000000-0000-4000-8000-0000000001a2', 'UC7A2', 'Lớp UC7 A2', 'c7000000-0000-4000-8000-0000000000a2', 'c7000000-0000-4000-8000-0000000000c0'),
  ('c7000000-0000-4000-8000-0000000001b1', 'UC7B1', 'Lớp UC7 B1', 'c7000000-0000-4000-8000-0000000000b1', 'c7000000-0000-4000-8000-0000000000c0');

-- 01 BTC Khoa A, 02 BTC Khoa B, 03 Văn phòng, 11–14 SV Khoa A (14 thuộc ngành A2), 15 SV Khoa B
insert into auth.users (id, email)
select ('b7000000-0000-4000-8000-0000000000' || n)::uuid, 'uc7-' || n || '@test.local'
from unnest(array['01','02','03','11','12','13','14','15']) n;
insert into public.accounts (user_id, student_code, status)
select ('b7000000-0000-4000-8000-0000000000' || n)::uuid, '20700000' || n, 'active'
from unnest(array['01','02','03','11','12','13','14','15']) n;
insert into public.student_profiles (user_id, full_name, gender, phone, class_id) values
  ('b7000000-0000-4000-8000-000000000011', 'Sinh viên Mười Một', 'female', '0900000011', 'c7000000-0000-4000-8000-0000000001a1'),
  ('b7000000-0000-4000-8000-000000000012', 'Sinh viên Mười Hai', 'male',   '0900000012', 'c7000000-0000-4000-8000-0000000001a1'),
  ('b7000000-0000-4000-8000-000000000013', 'Sinh viên Mười Ba',  'female', '0900000013', 'c7000000-0000-4000-8000-0000000001a1'),
  ('b7000000-0000-4000-8000-000000000014', 'Sinh viên Mười Bốn', 'male',   '0900000014', 'c7000000-0000-4000-8000-0000000001a2'),
  ('b7000000-0000-4000-8000-000000000015', 'Sinh viên Mười Lăm', 'female', '0900000015', 'c7000000-0000-4000-8000-0000000001b1');

insert into public.role_grants (user_id, role_code, organization_id, reason)
select 'b7000000-0000-4000-8000-000000000001'::uuid, 'faculty_manager', id, 'UC7 test'
from public.organization_units where faculty_id = 'c7000000-0000-4000-8000-00000000000a' and unit_type = 'faculty_union';
insert into public.role_grants (user_id, role_code, organization_id, reason)
select 'b7000000-0000-4000-8000-000000000002'::uuid, 'faculty_manager', id, 'UC7 test'
from public.organization_units where faculty_id = 'c7000000-0000-4000-8000-00000000000b' and unit_type = 'faculty_union';
insert into public.role_grants (user_id, role_code, organization_id, reason) values
  ('b7000000-0000-4000-8000-000000000003', 'office', '00000000-0000-4000-8000-000000000002', 'UC7 test');

create temp table uc7_ctx (k text primary key, v uuid);
grant all on uc7_ctx to authenticated;
insert into uc7_ctx
select 'org_a', id from public.organization_units where faculty_id = 'c7000000-0000-4000-8000-00000000000a' and unit_type = 'faculty_union';

-- Chương trình: pA, pB đã chấp thuận; pS còn chờ Văn phòng.
insert into public.event_programs (id, owner_org_id, faculty_id, title, starts_at, ends_at, status, created_by, decided_at, decided_by)
select v.id::uuid, (select v from uc7_ctx where k = 'org_a'), 'c7000000-0000-4000-8000-00000000000a', v.title,
       now() + interval '7 days', now() + interval '8 days', v.status,
       'b7000000-0000-4000-8000-000000000001', case when v.status = 'approved' then now() end,
       case when v.status = 'approved' then 'b7000000-0000-4000-8000-000000000003'::uuid end
from (values
  ('a7000000-0000-4000-8000-0000000000aa', 'UC7 nhận theo thứ tự', 'approved'),
  ('a7000000-0000-4000-8000-0000000000bb', 'UC7 BTC xét duyệt', 'approved'),
  ('a7000000-0000-4000-8000-0000000000cc', 'UC7 chưa được duyệt', 'submitted')) v(id, title, status);

insert into public.forms (id, owner_org_id, title, questions, status, created_by)
values ('f7000000-0000-4000-8000-000000000001', (select v from uc7_ctx where k = 'org_a'), 'Mẫu đăng ký UC7',
        '[{"id":"q_size","type":"short_text","label":"Cỡ áo","required":true,"order":0}]'::jsonb,
        'published', 'b7000000-0000-4000-8000-000000000001');

-- SV 12 bị trừ 10 điểm uy tín trong học kỳ hiện tại (do UC sau ghi; ở đây chèn trực tiếp).
insert into public.reputation_adjustments (user_id, semester_key, delta, reason)
values ('b7000000-0000-4000-8000-000000000012', public.semester_key_for(now()), -10, 'UC7 fixture');

create function pg_temp.act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', ('b7000000-0000-4000-8000-0000000000' || p_user)::uuid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.act_as(text) to authenticated;

create function pg_temp.reg_id(p_program text, p_user text) returns uuid language sql as $$
  select id from public.program_registrations
  where program_id = p_program::uuid and user_id = ('b7000000-0000-4000-8000-0000000000' || p_user)::uuid;
$$;
grant execute on function pg_temp.reg_id(text, text) to authenticated;

set local role authenticated;

-- ── 1. Quyền cấu hình theo đơn vị ────────────────────────────────────────────
-- pA: giới hạn 3 chỗ, nhận theo thứ tự, chỉ SV Khoa A; 2 chỗ dành cho ngành A2, 1 chỗ chung.
select pg_temp.act_as('02');
select throws_ok($$ select public.save_program_registration_settings('a7000000-0000-4000-8000-0000000000aa',
  '{"type":"faculty","faculty_id":"c7000000-0000-4000-8000-00000000000a"}', 3, false, null, null, null, null, '[]') $$,
  'P0001', 'FORBIDDEN', 'BTC Khoa B không cấu hình chương trình của Khoa A');
select pg_temp.act_as('03');
select throws_ok($$ select public.save_program_registration_settings('a7000000-0000-4000-8000-0000000000aa',
  '{"type":"hiu_student"}', 3, false, null, null, null, null, '[]') $$,
  'P0001', 'FORBIDDEN', 'Văn phòng không cấu hình thay BTC');
select pg_temp.act_as('11');
select throws_ok($$ select public.save_program_registration_settings('a7000000-0000-4000-8000-0000000000aa',
  '{"type":"hiu_student"}', 3, false, null, null, null, null, '[]') $$,
  'P0001', 'FORBIDDEN', 'Sinh viên không cấu hình đăng ký');

select pg_temp.act_as('01');
select throws_ok($$ select public.save_program_registration_settings('a7000000-0000-4000-8000-0000000000cc',
  '{"type":"hiu_student"}', null, false, null, null, null, null, '[]') $$,
  'P0001', 'PROGRAM_NOT_APPROVED', 'Chương trình chưa được Văn phòng duyệt thì không cấu hình/mở đăng ký');
select throws_ok($$ select public.save_program_registration_settings('a7000000-0000-4000-8000-0000000000aa',
  '{"type":"hiu_student"}', 3, false, null, null, null, null,
  '[{"label":"Ngành A2","audience_rule":{"type":"major","program_id":"c7000000-0000-4000-8000-0000000000a2"},"seats":4}]') $$,
  'P0001', 'QUOTAS_EXCEED_CAPACITY', 'Tổng chỉ tiêu nhóm không vượt sức chứa');
select lives_ok($$ select public.save_program_registration_settings('a7000000-0000-4000-8000-0000000000aa',
  '{"type":"faculty","faculty_id":"c7000000-0000-4000-8000-00000000000a"}', 3, false, null, null, null, 'Mang thẻ SV',
  '[{"label":"Ngành A2","audience_rule":{"type":"major","program_id":"c7000000-0000-4000-8000-0000000000a2"},"seats":2}]',
  'uc7-req-settings') $$,
  'BTC Khoa A lưu cấu hình chương trình đã duyệt');

-- ── 2. Chưa mở thì không đăng ký; mở/đóng chỉ BTC ────────────────────────────
select pg_temp.act_as('11');
select throws_ok($$ select public.register_for_program('a7000000-0000-4000-8000-0000000000aa', '[]', null) $$,
  'P0001', 'REGISTRATION_NOT_OPEN', 'Chưa mở đăng ký thì sinh viên không đăng ký được');
select throws_ok($$ select public.set_program_registration_status('a7000000-0000-4000-8000-0000000000aa', 'open') $$,
  'P0001', 'FORBIDDEN', 'Sinh viên không mở đăng ký');
select is((select count(*)::int from public.program_registration_settings where program_id = 'a7000000-0000-4000-8000-0000000000aa'), 0,
  'RLS: cấu hình nháp chưa hiển thị cho sinh viên');
select pg_temp.act_as('01');
select is(public.set_program_registration_status('a7000000-0000-4000-8000-0000000000aa', 'open'), 'open', 'BTC mở đăng ký');
select throws_ok($$ select public.save_program_registration_settings('a7000000-0000-4000-8000-0000000000aa',
  '{"type":"hiu_student"}', 10, false, null, null, null, null, '[]') $$,
  'P0001', 'SETTINGS_LOCKED_WHILE_OPEN', 'Đang mở thì phải đóng trước khi sửa cấu hình');

-- ── 3. Sai đối tượng, trùng, nhóm chỉ tiêu ───────────────────────────────────
select pg_temp.act_as('15');
select throws_ok($$ select public.register_for_program('a7000000-0000-4000-8000-0000000000aa', '[]', null) $$,
  'P0001', 'AUDIENCE_NOT_MET', 'SV Khoa B không thuộc đối tượng');
select pg_temp.act_as('11');
select is(public.register_for_program('a7000000-0000-4000-8000-0000000000aa', '[]', null, 'uc7-req-reg')->>'status', 'accepted',
  'Nhận theo thứ tự: SV 11 được xác nhận ngay (chỗ chung)');
select throws_ok($$ select public.register_for_program('a7000000-0000-4000-8000-0000000000aa', '[]', null) $$,
  'P0001', 'ALREADY_REGISTERED', 'Không đăng ký trùng');
select is((select quota_id from public.program_registrations where id = pg_temp.reg_id('a7000000-0000-4000-8000-0000000000aa', '11')),
  null, 'SV ngành A1 dùng chỉ tiêu chung');
select pg_temp.act_as('12');
select throws_ok($$ select public.register_for_program('a7000000-0000-4000-8000-0000000000aa', '[]', null) $$,
  'P0001', 'REGISTRATION_FULL', 'Chỉ tiêu chung hết; 2 chỗ còn lại dành riêng ngành A2');
select is((select count(*)::int from public.program_registrations where user_id = 'b7000000-0000-4000-8000-000000000012'), 0,
  'Đăng ký bị chặn không để lại bản ghi');
select pg_temp.act_as('14');
select is(public.register_for_program('a7000000-0000-4000-8000-0000000000aa', '[]', null)->>'status', 'accepted',
  'SV ngành A2 vào chỉ tiêu nhóm');
select isnt((select quota_id from public.program_registrations where id = pg_temp.reg_id('a7000000-0000-4000-8000-0000000000aa', '14')),
  null, 'Đăng ký của SV ngành A2 gắn với nhóm chỉ tiêu');
select throws_ok($$ insert into public.program_registrations (program_id, user_id, status)
  values ('a7000000-0000-4000-8000-0000000000aa', 'b7000000-0000-4000-8000-000000000013', 'pending') $$,
  '42501', null, 'Không ghi trực tiếp vào bảng đăng ký');

-- ── 4. Sau hạn BTC đặt, chỉ tiêu dư thành chỉ tiêu chung ─────────────────────
select pg_temp.act_as('01');
select is(public.set_program_registration_status('a7000000-0000-4000-8000-0000000000aa', 'closed'), 'closed', 'BTC đóng đăng ký');
select pg_temp.act_as('12');
select throws_ok($$ select public.register_for_program('a7000000-0000-4000-8000-0000000000aa', '[]', null) $$,
  'P0001', 'REGISTRATION_NOT_OPEN', 'Đã đóng thì không đăng ký');
select pg_temp.act_as('01');
select lives_ok($$ select public.save_program_registration_settings('a7000000-0000-4000-8000-0000000000aa',
  '{"type":"faculty","faculty_id":"c7000000-0000-4000-8000-00000000000a"}', 3, false, null, null, now() - interval '1 minute', null,
  jsonb_build_array(jsonb_build_object('id', (select id from public.program_registration_quotas
      where program_id = 'a7000000-0000-4000-8000-0000000000aa'),
    'label', 'Ngành A2', 'audience_rule', '{"type":"major","program_id":"c7000000-0000-4000-8000-0000000000a2"}'::jsonb, 'seats', 2))) $$,
  'Đặt hạn chuyển chỉ tiêu dư (đã qua)');
select is(public.set_program_registration_status('a7000000-0000-4000-8000-0000000000aa', 'open'), 'open', 'Mở lại');
select pg_temp.act_as('12');
select is(public.register_for_program('a7000000-0000-4000-8000-0000000000aa', '[]', null)->>'status', 'accepted',
  'Qua hạn: SV ngành A1 dùng chỗ dư của nhóm A2');
select pg_temp.act_as('13');
select throws_ok($$ select public.register_for_program('a7000000-0000-4000-8000-0000000000aa', '[]', null) $$,
  'P0001', 'REGISTRATION_FULL', 'Đủ 3 chỗ thì chặn');
select pg_temp.act_as('01');
select is((select count(*)::int from public.list_program_registrations('a7000000-0000-4000-8000-0000000000aa') where status = 'accepted'), 3,
  'Không vượt sức chứa');
select is((select count(*)::int from public.list_program_registrations('a7000000-0000-4000-8000-0000000000aa') where reputation_score is not null), 0,
  'Nhận theo thứ tự: không dùng điểm uy tín');

-- ── 5. Chương trình cần BTC duyệt, có biểu mẫu ───────────────────────────────
select lives_ok($$ select public.save_program_registration_settings('a7000000-0000-4000-8000-0000000000bb',
  '{"type":"faculty","faculty_id":"c7000000-0000-4000-8000-00000000000a"}', 1, true,
  'f7000000-0000-4000-8000-000000000001', null, null, null, '[]') $$,
  'Cấu hình 1 chỗ, BTC duyệt, kèm mẫu đăng ký');
select is(public.set_program_registration_status('a7000000-0000-4000-8000-0000000000bb', 'open'), 'open', 'Mở đăng ký pB');

select pg_temp.act_as('13');
select throws_ok($$ select public.register_for_program('a7000000-0000-4000-8000-0000000000bb', '[]', null) $$,
  'P0001', null, 'Thiếu câu bắt buộc của mẫu thì không đăng ký');
select is(public.register_for_program('a7000000-0000-4000-8000-0000000000bb',
  '[{"question_id":"q_size","answer_value":"M"}]', null)->>'status', 'pending', 'Cần duyệt: trạng thái chờ duyệt');
select throws_ok($$ select public.submit_form_response('f7000000-0000-4000-8000-000000000001', null,
  '[{"question_id":"q_size","answer_value":"L"}]', null) $$,
  'P0001', 'FORM_REQUIRES_PROGRAM_REGISTRATION', 'Mẫu gắn chương trình không nhận phản hồi rời');
select pg_temp.act_as('11');
select is(public.register_for_program('a7000000-0000-4000-8000-0000000000bb',
  '[{"question_id":"q_size","answer_value":"S"}]', null)->>'status', 'pending', 'SV 11 chờ duyệt');
select pg_temp.act_as('12');
select is(public.register_for_program('a7000000-0000-4000-8000-0000000000bb',
  '[{"question_id":"q_size","answer_value":"XL"}]', null)->>'status', 'pending', 'SV 12 (uy tín thấp hơn) chờ duyệt');
insert into uc7_ctx values ('r12', pg_temp.reg_id('a7000000-0000-4000-8000-0000000000bb', '12'));

-- ── 6. Sinh viên không thấy uy tín, danh sách, lịch sử ───────────────────────
select is((select count(*)::int from public.program_registrations where program_id = 'a7000000-0000-4000-8000-0000000000bb'), 1,
  'RLS: sinh viên chỉ thấy đăng ký của mình');
select throws_ok($$ select count(*) from public.reputation_adjustments $$, '42501', null, 'Sinh viên không đọc sổ uy tín');
select throws_ok($$ select public.reputation_score('b7000000-0000-4000-8000-000000000012') $$, '42501', null,
  'Sinh viên không gọi được hàm điểm uy tín');
select throws_ok($$ select * from public.list_program_registrations('a7000000-0000-4000-8000-0000000000bb') $$,
  'P0001', 'FORBIDDEN', 'Sinh viên không xem danh sách đăng ký');
select is((select count(*)::int from public.program_registration_history), 0, 'RLS: sinh viên không đọc lịch sử xét duyệt');

-- ── 7. Duyệt: quyền, lý do ngoại lệ uy tín, suất cuối ───────────────────────
select throws_ok($$ select public.decide_program_registration(pg_temp.reg_id('a7000000-0000-4000-8000-0000000000bb', '12'), 'approve', null) $$,
  'P0001', 'FORBIDDEN', 'Sinh viên không tự duyệt');
select pg_temp.act_as('02');
select throws_ok($$ select public.decide_program_registration((select v from uc7_ctx where k = 'r12'), 'approve', null) $$,
  'P0001', 'FORBIDDEN', 'BTC Khoa khác không duyệt');
select pg_temp.act_as('01');
select is((select suggested_rank from public.list_program_registrations('a7000000-0000-4000-8000-0000000000bb')
           where user_id = 'b7000000-0000-4000-8000-000000000012'), 3, 'Gợi ý xếp SV 12 (90 điểm) sau hai SV 100 điểm');
select throws_ok($$ select public.decide_program_registration(pg_temp.reg_id('a7000000-0000-4000-8000-0000000000bb', '12'), 'approve', null) $$,
  'P0001', 'SKIP_REASON_REQUIRED', 'Bỏ qua người uy tín cao phải nhập lý do');
select is(public.decide_program_registration(pg_temp.reg_id('a7000000-0000-4000-8000-0000000000bb', '12'), 'approve',
  'Đã tham gia tập huấn bắt buộc của chương trình', 'uc7-req-skip'), 'accepted', 'Duyệt ngoại lệ có lý do');
select ok((select skipped_higher_reputation and reason like 'Đã tham gia%' from public.program_registration_history
           where registration_id = pg_temp.reg_id('a7000000-0000-4000-8000-0000000000bb', '12') and action = 'approved'),
  'Lịch sử lưu cờ bỏ qua uy tín và lý do');
select throws_ok($$ select public.decide_program_registration(pg_temp.reg_id('a7000000-0000-4000-8000-0000000000bb', '11'), 'approve', null) $$,
  'P0001', 'QUOTA_FULL', 'Hết chỗ thì không duyệt thêm');
select throws_ok($$ select public.decide_program_registration(pg_temp.reg_id('a7000000-0000-4000-8000-0000000000bb', '11'), 'reject', 'ngắn') $$,
  'P0001', 'REASON_REQUIRED', 'Từ chối phải có lý do');
select is(public.decide_program_registration(pg_temp.reg_id('a7000000-0000-4000-8000-0000000000bb', '11'), 'reject',
  'Chương trình đã đủ người tham gia'), 'rejected', 'BTC từ chối có lý do');

reset role;
select is((select count(*)::int from public.audit_events
           where action like 'program_registration.%' and request_id in ('uc7-req-settings', 'uc7-req-reg', 'uc7-req-skip')), 3,
  'Audit ghi đủ cấu hình, đăng ký, duyệt ngoại lệ với request_id');

select * from finish();
rollback;
