-- CR-01-TaiKhoanToChuc (#37): tài khoản tổ chức, đăng nhập hai bước, cán bộ thao tác.
-- Mỗi khối ghi tiêu chí chấp nhận (AC) của issue #37: Cho trước = phần chuẩn bị, Khi = câu lệnh,
-- Thì = assertion. Mọi lời gọi tới bảng/hàm mới đều chạy qua pg_temp.val / pg_temp.as_val /
-- pg_temp.setup (SQL động, bắt lỗi), nên khi chưa hiện thực, test báo "not ok" kèm lỗi chứ không
-- dừng cả file.
begin;
select plan(66);

-- ── Trợ giúp ─────────────────────────────────────────────────────────────────
-- Giá trị text của câu SQL (chạy bằng postgres), hoặc 'ERROR: <thông báo>'.
create function pg_temp.val(p_sql text) returns text language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  return v;
exception when others then
  return 'ERROR: ' || sqlerrm;
end;
$$;

-- Như val nhưng chạy với vai trò và claims của một phiên (sub, session_id).
create function pg_temp.as_val(p_role text, p_user text, p_session text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', p_role, 'session_id', p_session)::text, true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql into v;
  exception when others then
    v := 'ERROR: ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return v;
end;
$$;

-- Bước chuẩn bị dùng chức năng mới: lỗi thì bỏ qua (assertion phía sau sẽ báo "not ok").
create function pg_temp.setup(p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
exception when others then
  null;
end;
$$;

-- Thời gian (ms) chạy n lần; null nếu lỗi.
create function pg_temp.ms(p_sql text, p_times int) returns numeric language plpgsql as $$
declare t0 timestamptz := clock_timestamp();
begin
  for i in 1..p_times loop execute p_sql; end loop;
  return extract(epoch from clock_timestamp() - t0) * 1000;
exception when others then
  return null;
end;
$$;

create temp table ctx(k text primary key, v text);
create function pg_temp.c(p_key text) returns text language sql as $$ select v from ctx where k = p_key $$;
create function pg_temp.is_uuid(p_value text) returns boolean language sql as $$
  select coalesce(p_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false) $$;
-- Câu gọi save_event_program đủ trường để nộp được.
create function pg_temp.create_program_sql(p_org text, p_title text) returns text language sql as $$
  select format($f$select public.save_event_program(null, %L::uuid, %L, 'Tóm tắt kiểm thử CR-01', 'Hội trường A',
    '2026-11-20T01:00:00Z', '2026-11-20T04:00:00Z', 50, '01-KH/T010', date '2026-10-30', null)::text$f$, p_org, p_title) $$;

-- ── Dữ liệu (chỉ dùng bảng đã có) ────────────────────────────────────────────
insert into auth.users(id, email) values
  ('a1000000-0000-4000-8000-000000000001', 'a@test.local'),  -- A: Bí thư Đoàn Khoa F + cán bộ Văn phòng
  ('a1000000-0000-4000-8000-000000000002', 'b@test.local'),  -- B: cán bộ Văn phòng
  ('a1000000-0000-4000-8000-000000000003', 'c@test.local'),  -- C: Ban chấp hành Đoàn Khoa F
  ('a1000000-0000-4000-8000-000000000004', 'd@test.local'),  -- D: sinh viên, không vai trò
  ('a1000000-0000-4000-8000-000000000005', 'e@test.local'),  -- E: người chạy bootstrap Đoàn Trường
  ('a1000000-0000-4000-8000-000000000006', 'x@test.local'),  -- X: CTV Ban TC-KT
  ('a1000000-0000-4000-8000-000000000007', 'z@test.local');  -- Z: thành viên có tài khoản bị khóa
insert into public.accounts(user_id, student_code, status) values
  ('a1000000-0000-4000-8000-000000000001', '8880100001', 'active'),
  ('a1000000-0000-4000-8000-000000000002', '8880100002', 'active'),
  ('a1000000-0000-4000-8000-000000000003', '8880100003', 'active'),
  ('a1000000-0000-4000-8000-000000000004', '8880100004', 'active'),
  ('a1000000-0000-4000-8000-000000000005', '8880100005', 'active'),
  ('a1000000-0000-4000-8000-000000000006', '8880100006', 'active'),
  ('a1000000-0000-4000-8000-000000000007', '8880100007', 'suspended');
insert into public.faculties(id, current_code, current_name) values
  ('c1000000-0000-4000-8000-00000000000f', 'T010F', 'Khoa Kiểm thử F'),
  ('c1000000-0000-4000-8000-0000000000f2', 'T010F2', 'Khoa Kiểm thử F2'),
  ('c1000000-0000-4000-8000-0000000000f3', 'T010F3', 'Khoa Kiểm thử F3'),
  ('c1000000-0000-4000-8000-0000000000f4', 'T010F4', 'Khoa Kiểm thử F4');
insert into ctx
select 'f',  id::text from public.organization_units where faculty_id = 'c1000000-0000-4000-8000-00000000000f'
union all select 'f2', id::text from public.organization_units where faculty_id = 'c1000000-0000-4000-8000-0000000000f2'
union all select 'f3', id::text from public.organization_units where faculty_id = 'c1000000-0000-4000-8000-0000000000f3'
union all select 'f4', id::text from public.organization_units where faculty_id = 'c1000000-0000-4000-8000-0000000000f4'
union all values ('office', '00000000-0000-4000-8000-000000000002'), ('school', '00000000-0000-4000-8000-000000000001'),
  ('ban', '00000000-0000-4000-8000-000000000003'),
  ('A', 'a1000000-0000-4000-8000-000000000001'), ('B', 'a1000000-0000-4000-8000-000000000002'),
  ('C', 'a1000000-0000-4000-8000-000000000003'), ('D', 'a1000000-0000-4000-8000-000000000004'),
  ('E', 'a1000000-0000-4000-8000-000000000005'), ('X', 'a1000000-0000-4000-8000-000000000006'),
  ('Z', 'a1000000-0000-4000-8000-000000000007'),
  ('S1', 'b1000000-0000-4000-8000-000000000001'), ('S2', 'b1000000-0000-4000-8000-000000000002'),
  ('S3', 'b1000000-0000-4000-8000-000000000003'), ('S4', 'b1000000-0000-4000-8000-000000000004'),
  ('S5', 'b1000000-0000-4000-8000-000000000005'), ('S6', 'b1000000-0000-4000-8000-000000000006'),
  ('S7', 'b1000000-0000-4000-8000-000000000007');

-- ── Cấu trúc ─────────────────────────────────────────────────────────────────
select has_table('public', 'organization_members', 'có bảng organization_members');
select has_table('public', 'organization_pins', 'có bảng organization_pins');
select has_table('public', 'organization_login_challenges', 'có bảng organization_login_challenges (phiên tạm bước 1)');
select has_table('public', 'organization_session_officers', 'có bảng organization_session_officers (cán bộ của phiên)');
select has_column('public', 'audit_events', 'officer_user_id', 'audit_events có cột officer_user_id');
select has_column('public', 'audit_events', 'organization_session_id', 'audit_events có cột organization_session_id');
select has_column('public', 'event_program_history', 'actor_officer_user_id', 'event_program_history có cột actor_officer_user_id');
select has_function('public', 'start_organization_login', array['uuid', 'text'], 'có hàm start_organization_login(đơn vị, PIN)');
select has_function('public', 'start_officer_session', array['uuid', 'uuid', 'uuid'], 'có hàm start_officer_session');
select has_function('public', 'end_officer_session', array['uuid'], 'có hàm end_officer_session');
select has_function('public', 'organization_session_ok', array[]::text[], 'có hàm organization_session_ok');
select has_function('public', 'list_organization_login_units', array[]::text[], 'có hàm list_organization_login_units');
select has_function('public', 'manage_organization_account', array['uuid', 'text', 'text', 'text'], 'có hàm manage_organization_account');
select has_function('public', 'change_organization_pin', array['text', 'text'], 'có hàm change_organization_pin');
select has_function('public', 'migrate_management_grants_to_organizations', array[]::text[], 'có hàm migrate_management_grants_to_organizations');

-- ── AC10 (R-12): bootstrap tạo tài khoản tổ chức Đoàn Trường ─────────────────
-- Cho trước DB chưa có tài khoản Đoàn Trường; Khi chạy bootstrap_school_admin cho E;
select lives_ok($$ select public.bootstrap_school_admin('a1000000-0000-4000-8000-000000000005', 'Bootstrap kiểm thử CR-01') $$,
  'AC10: bootstrap_school_admin chạy được');
-- Thì có tài khoản tổ chức Đoàn Trường, E là thành viên, E không giữ school_admin trên tài khoản cá nhân.
select ok(pg_temp.is_uuid(pg_temp.val($$ select user_id::text from public.accounts where account_type = 'organization' and organization_id = '00000000-0000-4000-8000-000000000001' $$)),
  'AC10: bootstrap tạo tài khoản tổ chức Đoàn Trường');
select is(pg_temp.val($$ select count(*)::text from public.organization_members where user_id = 'a1000000-0000-4000-8000-000000000005' and organization_id = '00000000-0000-4000-8000-000000000001' and revoked_at is null $$),
  '1', 'AC10: người chạy bootstrap là thành viên Đoàn Trường');
select is(pg_temp.val($$ select count(*)::text from public.role_grants where user_id = 'a1000000-0000-4000-8000-000000000005' and role_code = 'school_admin' and revoked_at is null $$),
  '0', 'AC10/AC6: bootstrap không cấp school_admin cho tài khoản cá nhân');
select pg_temp.setup($$ insert into ctx select 'acc_school', user_id::text from public.accounts where organization_id = '00000000-0000-4000-8000-000000000001' and account_type = 'organization' $$);

-- ── AC6 + kế hoạch dữ liệu: chuyển vai trò quản lý cá nhân sang tài khoản tổ chức ─
-- Cho trước hiện trạng trước CR: vai trò quản lý nằm trên tài khoản cá nhân (tắt trigger để dựng hiện trạng cũ).
select pg_temp.setup($$ alter table public.role_grants disable trigger role_grants_holder_rule $$);
select pg_temp.setup(format($$ insert into public.role_grants(user_id, role_code, organization_id, reason) values
  (%1$L, 'faculty_manager', %3$L, 'hiện trạng: Bí thư'), (%1$L, 'office', %4$L, 'hiện trạng: cán bộ VP'),
  (%2$L, 'office', %4$L, 'hiện trạng: cán bộ VP'), (%5$L, 'faculty_executive', %3$L, 'hiện trạng: BCH') $$,
  pg_temp.c('A'), pg_temp.c('B'), pg_temp.c('f'), pg_temp.c('office'), pg_temp.c('C')));
select pg_temp.setup($$ alter table public.role_grants enable trigger role_grants_holder_rule $$);
insert into public.role_grants(user_id, role_code, organization_id, reason)
values ('a1000000-0000-4000-8000-000000000006', 'collaborator', '00000000-0000-4000-8000-000000000003', 'CTV kiểm thử');
-- Khi chạy hàm chuyển dữ liệu;
select is(pg_temp.val($$ select public.migrate_management_grants_to_organizations()::text $$), '4',
  'AC6: chuyển đúng 4 vai trò quản lý của tài khoản cá nhân');
-- Thì không còn vai trò quản lý nào trên tài khoản cá nhân, cán bộ thành thành viên, CTV giữ nguyên.
select is(pg_temp.val($$ select count(*)::text from public.role_grants rg join public.accounts a on a.user_id = rg.user_id
  where a.student_code is not null and rg.revoked_at is null and rg.role_code in ('school_admin', 'office', 'faculty_manager', 'faculty_executive') $$),
  '0', 'AC6: không còn vai trò quản lý trên tài khoản cá nhân');
select is(pg_temp.val(format($$ select count(*)::text from public.organization_members where revoked_at is null and organization_id in (%L, %L) $$, pg_temp.c('f'), pg_temp.c('office'))),
  '4', 'AC6: A, C thành thành viên Đoàn Khoa; A, B thành thành viên Văn phòng');
select is(pg_temp.val(format($$ select string_agg(rg.role_code, ',') from public.role_grants rg join public.accounts a on a.user_id = rg.user_id
  where a.organization_id = %L and rg.revoked_at is null $$, pg_temp.c('f'))),
  'faculty_manager', 'AC6: tài khoản tổ chức Đoàn Khoa giữ vai trò faculty_manager');
select is(pg_temp.val($$ select count(*)::text from public.role_grants where user_id = 'a1000000-0000-4000-8000-000000000006' and role_code = 'collaborator' and revoked_at is null $$),
  '1', 'R-6: CTV giữ vai trò trên tài khoản cá nhân');
-- Khi A dùng tài khoản cá nhân gọi RPC quản lý; Thì bị từ chối.
select is(pg_temp.as_val('authenticated', pg_temp.c('A'), null, pg_temp.create_program_sql(pg_temp.c('f'), 'Tạo bằng tài khoản cá nhân')),
  'ERROR: FORBIDDEN', 'AC6: tài khoản cá nhân của cán bộ bị từ chối khi tạo kế hoạch');

-- Đặt PIN tổ chức cho các đơn vị đã có tài khoản.
select pg_temp.setup(format($$ insert into ctx select k, user_id::text from (values ('acc_f', %L::uuid), ('acc_office', %L::uuid)) u(k, org)
  join public.accounts a on a.organization_id = u.org and a.account_type = 'organization' $$, pg_temp.c('f'), pg_temp.c('office')));
select pg_temp.setup(format($$ select public.set_organization_pin(%L, '246810'), public.set_organization_pin(%L, '246810'), public.set_organization_pin(%L, '246810') $$,
  pg_temp.c('acc_f'), pg_temp.c('acc_office'), pg_temp.c('acc_school')));

-- ── AC1: đăng nhập hai bước ─────────────────────────────────────────────────
-- Khi bước 1 đúng PIN tổ chức; Thì có phiên tạm trỏ về đúng tài khoản tổ chức.
select pg_temp.setup(format($$ insert into ctx values ('ch1', public.start_organization_login(%L, '246810')::text) $$, pg_temp.c('f')));
select ok(pg_temp.is_uuid(pg_temp.c('ch1')), 'AC1: bước 1 đúng PIN tạo phiên tạm');
select is(pg_temp.val(format($$ select public.read_organization_login(%L, false)::text $$, pg_temp.c('ch1'))), pg_temp.c('acc_f'),
  'AC1: phiên tạm trỏ về tài khoản tổ chức Đoàn Khoa');
-- Khi bước 2 với cán bộ A là thành viên; Thì có phiên tổ chức với cán bộ A.
select ok(pg_temp.is_uuid(pg_temp.val(format($$ select public.organization_member_for(%L, %L)::text $$, pg_temp.c('acc_f'), pg_temp.c('A')))),
  'AC1: A là thành viên còn hiệu lực của Đoàn Khoa');
select pg_temp.setup(format($$ insert into auth.sessions(id, user_id) values (%L, %L) $$, pg_temp.c('S1'), pg_temp.c('acc_f')));
select ok(pg_temp.is_uuid(pg_temp.val(format($$ select public.start_officer_session(%L, %L, %L)::text $$, pg_temp.c('S1'), pg_temp.c('acc_f'), pg_temp.c('A')))),
  'AC1: bước 2 tạo phiên tổ chức có cán bộ');
select is(pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S1'), $$ select public.current_officer_user_id()::text $$), pg_temp.c('A'),
  'AC1: phiên tổ chức biết cán bộ đang thao tác (hiện ở thanh trên cùng)');
select is(pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S1'), $$ select public.organization_session_ok()::text $$), 'true',
  'AC1: phiên tổ chức có cán bộ là phiên hợp lệ');

-- ── AC2: dropdown chỉ có đơn vị đang hoạt động đã có tài khoản ───────────────
-- Cho trước F3 có tài khoản nhưng ngừng hoạt động, F2 chưa có tài khoản;
select pg_temp.setup(format($$ select public.create_organization_account(%L, 'kiểm thử AC2') $$, pg_temp.c('f3')));
update public.organization_units set is_active = false where id = (select v::uuid from ctx where k = 'f3');
-- Khi khách mở trang đăng nhập; Thì danh sách đúng 3 đơn vị Đoàn Khoa F, Văn phòng, Đoàn Trường.
select is(pg_temp.as_val('anon', null, null, $$ select string_agg(organization_id::text, ',' order by organization_id::text) from public.list_organization_login_units() $$),
  (select string_agg(v, ',' order by v) from ctx where k in ('f', 'office', 'school')),
  'AC2: dropdown chỉ có đơn vị đang hoạt động đã có tài khoản, không có Chi đoàn');
select is(pg_temp.as_val('anon', null, null, $$ select string_agg(distinct unit_type, ',' order by unit_type) from public.list_organization_login_units() $$),
  'faculty_union,office,school_union', 'AC2: dropdown trả về cấp đơn vị để nhóm theo cấp');

-- ── AC4: bước sai đều không tạo phiên (thông báo chung ở tầng API) ───────────
select pg_temp.setup(format($$ select public.set_organization_pin(public.create_organization_account(%L, 'kiểm thử AC4'), '246810') $$, pg_temp.c('f4')));
select pg_temp.setup(format($$ update public.accounts set status = 'suspended' where organization_id = %L $$, pg_temp.c('f4')));
select is(pg_temp.val(format($$ select coalesce(public.start_organization_login(%L, '000000')::text, 'null') $$, pg_temp.c('f'))), 'null',
  'AC4: sai PIN tổ chức không tạo phiên tạm');
select is(pg_temp.val(format($$ select coalesce(public.start_organization_login(%L, '246810')::text, 'null') $$, pg_temp.c('f4'))), 'null',
  'AC4: tài khoản tổ chức bị khóa không tạo phiên tạm');
select is(pg_temp.val(format($$ select coalesce(public.start_organization_login(gen_random_uuid(), '246810')::text, 'null') $$)), 'null',
  'AC4: đơn vị không tồn tại không tạo phiên tạm');
select is(pg_temp.val(format($$ select coalesce(public.organization_member_for(%L, %L)::text, 'null') $$, pg_temp.c('acc_f'), pg_temp.c('B'))), 'null',
  'AC4: cán bộ không thuộc đơn vị đã chọn bị từ chối');
select pg_temp.setup(format($$ insert into public.organization_members(organization_id, user_id, member_role, reason) values (%L, %L, 'officer', 'kiểm thử AC4') $$,
  pg_temp.c('f'), pg_temp.c('Z')));
select is(pg_temp.val(format($$ select coalesce(public.organization_member_for(%L, %L)::text, 'null') $$, pg_temp.c('acc_f'), pg_temp.c('Z'))), 'null',
  'AC4: cán bộ có tài khoản cá nhân không active bị từ chối');
-- R-4: thời gian bước 1 như nhau dù đơn vị có tài khoản hay không (kiểm tra PIN giả).
select ok(
  pg_temp.ms(format($$ select public.start_organization_login(%L, '246810') $$, pg_temp.c('f2')), 5)
    >= 0.5 * pg_temp.ms(format($$ select public.start_organization_login(%L, '000000') $$, pg_temp.c('f')), 5),
  'AC4/R-4: bước 1 với đơn vị chưa có tài khoản tốn thời gian tương đương đơn vị có tài khoản');

-- ── AC5: đếm lần sai PIN tổ chức ───────────────────────────────────────────
select lives_ok($$ insert into public.auth_attempts(action, identifier_hash, ip_hash, succeeded) values ('org_login', 'h-don-vi', 'h-ip', false) $$,
  'AC5: ghi được lần thử org_login để giới hạn 5 lần/15 phút theo đơn vị + IP');

-- ── AC7: phiên Đoàn Khoa chỉ làm việc của Đoàn Khoa đó; CTV giữ tài khoản cá nhân ─
select is(pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S1'), pg_temp.create_program_sql(pg_temp.c('f2'), 'Chương trình của khoa khác')),
  'ERROR: FORBIDDEN', 'AC7: phiên Đoàn Khoa F không tạo kế hoạch cho Đoàn Khoa F2');
select pg_temp.setup(format($$ insert into ctx values ('p1', pg_temp.as_val('authenticated', %L, %L, %L)::uuid::text) $$,
  pg_temp.c('acc_f'), pg_temp.c('S1'), pg_temp.create_program_sql(pg_temp.c('f'), 'Kế hoạch kiểm thử CR-01')));
select pg_temp.setup(format($$ insert into ctx values ('p_draft', pg_temp.as_val('authenticated', %L, %L, %L)::uuid::text) $$,
  pg_temp.c('acc_f'), pg_temp.c('S1'), pg_temp.create_program_sql(pg_temp.c('f'), 'Bản nháp nội bộ Đoàn Khoa')));
select ok(pg_temp.is_uuid(pg_temp.c('p1')), 'AC7: phiên Đoàn Khoa F tạo kế hoạch cho chính Đoàn Khoa F');
select is(pg_temp.as_val('authenticated', pg_temp.c('X'), null, $$ select public.has_active_role('collaborator')::text $$), 'true',
  'AC7/R-6: CTV vẫn dùng vai trò bằng tài khoản cá nhân');
insert into ctx values ('drafts_before', pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S1'),
  format($$ select count(*)::text from public.event_programs where owner_org_id = %L and status = 'draft' $$, pg_temp.c('f'))));

-- ── AC8: audit ghi đơn vị + cán bộ; tự duyệt xét theo cán bộ ─────────────────
select is(pg_temp.val(format($$ select actor_user_id || '|' || officer_user_id || '|' || organization_session_id from public.audit_events
  where action = 'event_program.created' and target_id = %L $$, pg_temp.c('p1'))),
  pg_temp.c('acc_f') || '|' || pg_temp.c('A') || '|' || pg_temp.c('S1'), 'AC8: audit ghi tài khoản tổ chức, cán bộ A và phiên');
select is(pg_temp.val(format($$ select actor_officer_user_id::text from public.event_program_history where program_id = %L and action = 'created' $$, pg_temp.c('p1'))),
  pg_temp.c('A'), 'AC8: lịch sử kế hoạch ghi cán bộ thao tác');
-- Cho trước A nộp kế hoạch bằng phiên Đoàn Khoa, A cũng là thành viên Văn phòng;
select pg_temp.setup(format($$ insert into storage.objects(bucket_id, name) values ('event-program-plans', %L) $$, pg_temp.c('p1') || '/' || 'd1000000-0000-4000-8000-000000000001.pdf'));
select pg_temp.setup(format($$ select pg_temp.as_val('authenticated', %L, %L, %L) $$, pg_temp.c('acc_f'), pg_temp.c('S1'),
  format($f$ select public.attach_event_program_document(%L, %L, 'kh.pdf', 1000, %L, null)::text $f$, pg_temp.c('p1'), pg_temp.c('p1') || '/d1000000-0000-4000-8000-000000000001.pdf', repeat('0', 64))));
select pg_temp.setup(format($$ select pg_temp.as_val('authenticated', %L, %L, %L) $$, pg_temp.c('acc_f'), pg_temp.c('S1'),
  format($f$ select public.submit_event_program(%L, null) $f$, pg_temp.c('p1'))));
select pg_temp.setup(format($$ insert into auth.sessions(id, user_id) values (%L, %L), (%L, %L) $$, pg_temp.c('S2'), pg_temp.c('acc_office'), pg_temp.c('S3'), pg_temp.c('acc_office')));
select pg_temp.setup(format($$ select public.start_officer_session(%L, %L, %L), public.start_officer_session(%L, %L, %L) $$,
  pg_temp.c('S2'), pg_temp.c('acc_office'), pg_temp.c('A'), pg_temp.c('S3'), pg_temp.c('acc_office'), pg_temp.c('B')));
-- Khi A duyệt bằng phiên Văn phòng; Thì bị từ chối. Khi B duyệt; Thì được.
select is(pg_temp.as_val('authenticated', pg_temp.c('acc_office'), pg_temp.c('S2'), format($$ select public.review_event_program(%L, 'approve', null, null) $$, pg_temp.c('p1'))),
  'ERROR: SELF_REVIEW_FORBIDDEN', 'AC8: người lập (A) không tự duyệt dù đăng nhập bằng phiên Văn phòng');
select is(pg_temp.as_val('authenticated', pg_temp.c('acc_office'), pg_temp.c('S3'), format($$ select public.review_event_program(%L, 'approve', null, null) $$, pg_temp.c('p1'))),
  'approved', 'AC8: cán bộ khác (B) của Văn phòng duyệt được');

-- ── AC10: Đoàn Trường quản lý tài khoản tổ chức; đơn vị tự đổi PIN ──────────
select pg_temp.setup(format($$ insert into auth.sessions(id, user_id) values (%L, %L) $$, pg_temp.c('S6'), pg_temp.c('acc_school')));
select pg_temp.setup(format($$ select public.start_officer_session(%L, %L, %L) $$, pg_temp.c('S6'), pg_temp.c('acc_school'), pg_temp.c('E')));
select is(pg_temp.as_val('authenticated', pg_temp.c('acc_school'), pg_temp.c('S6'),
  format($$ select (public.manage_organization_account(%L, 'create', '135790', 'Tạo tài khoản Đoàn Khoa F2') is not null)::text $$, pg_temp.c('f2'))),
  'true', 'AC10: Đoàn Trường tạo tài khoản tổ chức cho Đoàn Khoa');
select ok(pg_temp.is_uuid(pg_temp.val(format($$ select public.start_organization_login(%L, '135790')::text $$, pg_temp.c('f2')))),
  'AC10: tài khoản mới đăng nhập được bằng PIN đã đặt');
select pg_temp.setup(format($$ select pg_temp.as_val('authenticated', %L, %L, %L) $$, pg_temp.c('acc_school'), pg_temp.c('S6'),
  format($f$ select public.manage_organization_account(%L, 'reset_pin', '975310', 'Đặt lại PIN')::text $f$, pg_temp.c('f2'))));
select is(pg_temp.val(format($$ select (public.start_organization_login(%1$L, '975310') is not null)::text || '/' || (public.start_organization_login(%1$L, '135790') is null)::text $$, pg_temp.c('f2'))),
  'true/true', 'AC10: đặt lại PIN có hiệu lực ngay, PIN cũ không dùng được');
select pg_temp.setup(format($$ select pg_temp.as_val('authenticated', %L, %L, %L) $$, pg_temp.c('acc_school'), pg_temp.c('S6'),
  format($f$ select public.manage_organization_account(%L, 'lock', null, 'Khóa tạm')::text $f$, pg_temp.c('f2'))));
select is(pg_temp.val(format($$ select coalesce(public.start_organization_login(%L, '975310')::text, 'null') $$, pg_temp.c('f2'))), 'null',
  'AC10: tài khoản bị khóa không đăng nhập được');
select pg_temp.setup(format($$ select pg_temp.as_val('authenticated', %L, %L, %L) $$, pg_temp.c('acc_school'), pg_temp.c('S6'),
  format($f$ select public.manage_organization_account(%L, 'unlock', null, 'Mở khóa')::text $f$, pg_temp.c('f2'))));
select ok(pg_temp.is_uuid(pg_temp.val(format($$ select public.start_organization_login(%L, '975310')::text $$, pg_temp.c('f2')))),
  'AC10: mở khóa thì đăng nhập lại được');
select is(pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S1'),
  format($$ select public.manage_organization_account(%L, 'lock', null, 'Đoàn Khoa thử khóa')::text $$, pg_temp.c('f2'))),
  'ERROR: FORBIDDEN', 'AC10: đơn vị khác Đoàn Trường không quản lý được tài khoản tổ chức');
select pg_temp.setup($$ select pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S1'), 'select public.change_organization_pin(''246810'', ''112233'')::text') $$);
select is(pg_temp.val(format($$ select (public.start_organization_login(%1$L, '112233') is not null)::text || '/' || (public.start_organization_login(%1$L, '246810') is null)::text $$, pg_temp.c('f'))),
  'true/true', 'AC10: đơn vị tự đổi PIN, PIN cũ không dùng được');

-- ── AC12: phiên tạm 5 phút, dùng một lần ───────────────────────────────────
select is(pg_temp.val(format($$ select extract(epoch from expires_at - created_at)::int::text from public.organization_login_challenges where id = %L $$, pg_temp.c('ch1'))),
  '300', 'AC12: phiên tạm hết hạn sau 5 phút');
select is(pg_temp.val(format($$ select public.read_organization_login(%L, true)::text $$, pg_temp.c('ch1'))), pg_temp.c('acc_f'),
  'AC12: phiên tạm dùng được một lần');
select is(pg_temp.val(format($$ select coalesce(public.read_organization_login(%L, true)::text, 'null') $$, pg_temp.c('ch1'))), 'null',
  'AC12: phiên tạm đã dùng không dùng lại được');
select pg_temp.setup(format($$ insert into ctx values ('ch2', public.start_organization_login(%L, '112233')::text) $$, pg_temp.c('f')));
select pg_temp.setup(format($$ update public.organization_login_challenges set expires_at = now() - interval '1 second' where id = %L $$, pg_temp.c('ch2')));
select is(pg_temp.val(format($$ select coalesce(public.read_organization_login(%L, false)::text, 'null') || '|' || %L $$, pg_temp.c('ch2'), coalesce(pg_temp.c('ch2'), 'không có'))),
  'null|' || coalesce(pg_temp.c('ch2'), 'không có'), 'AC12: phiên tạm quá 5 phút không dùng được');

-- ── AC13 + AC14 (R-11): "Đổi cán bộ" thu hồi ngay phiên và token cũ ─────────
-- Khi đổi cán bộ ở phiên S1 (A); Thì dòng cán bộ kết thúc và phiên Auth bị xóa;
select pg_temp.setup(format($$ select public.end_officer_session(%L) $$, pg_temp.c('S1')));
select is(pg_temp.val(format($$ select (select count(*) from public.organization_session_officers where session_id = %1$L and ended_at is not null)::text
  || '/' || (select count(*) from auth.sessions where id = %1$L)::text $$, pg_temp.c('S1'))),
  '1/0', 'AC13/AC14: đổi cán bộ kết thúc dòng cán bộ và xóa phiên Auth cũ');
select is(pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S1'), $$ select public.organization_session_ok()::text $$), 'false',
  'AC14: token cũ sau khi đổi cán bộ không còn là phiên hợp lệ');
select is(pg_temp.c('drafts_before') || '/' || pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S1'),
  format($$ select count(*)::text from public.event_programs where owner_org_id = %L and status = 'draft' $$, pg_temp.c('f'))),
  '1/0', 'AC14: token cũ đọc được bản nháp trước khi đổi cán bộ, sau khi đổi thì không');
-- Cán bộ C vào bước 2 (không nhập lại PIN tổ chức); thao tác sau đó ghi theo C.
select pg_temp.setup(format($$ insert into auth.sessions(id, user_id) values (%L, %L) $$, pg_temp.c('S4'), pg_temp.c('acc_f')));
select pg_temp.setup(format($$ select public.start_officer_session(%L, %L, %L) $$, pg_temp.c('S4'), pg_temp.c('acc_f'), pg_temp.c('C')));
select pg_temp.setup(format($$ insert into ctx values ('p3', pg_temp.as_val('authenticated', %L, %L, %L)::uuid::text) $$,
  pg_temp.c('acc_f'), pg_temp.c('S4'), pg_temp.create_program_sql(pg_temp.c('f'), 'Kế hoạch do cán bộ C lập')));
select is(pg_temp.val(format($$ select officer_user_id::text from public.audit_events where action = 'event_program.created' and target_id = %L $$, pg_temp.c('p3'))),
  pg_temp.c('C'), 'AC13: sau khi đổi cán bộ, thao tác ghi audit theo cán bộ mới (C)');

-- ── AC14 (R-7): phiên tổ chức chưa có cán bộ không đọc, không ghi được ──────
select pg_temp.setup(format($$ insert into auth.sessions(id, user_id) values (%L, %L) $$, pg_temp.c('S5'), pg_temp.c('acc_f')));
select is(pg_temp.val(format($$ select count(*)::text from auth.sessions where id = %L $$, pg_temp.c('S5'))) || '|' ||
  pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S5'), format($$ select count(*)::text from public.event_programs where owner_org_id = %L and status = 'draft' $$, pg_temp.c('f'))),
  '1|0', 'AC14: phiên tổ chức chưa có cán bộ không đọc được bản nháp của đơn vị qua RLS');
select is(pg_temp.val(format($$ select count(*)::text from auth.sessions where id = %L $$, pg_temp.c('S5'))) || '|' ||
  pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S5'), $$ select count(*)::text from public.audit_events $$),
  '1|0', 'AC14: phiên tổ chức chưa có cán bộ không đọc được audit');
select is(pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S5'), pg_temp.create_program_sql(pg_temp.c('f'), 'Không có cán bộ')),
  'ERROR: FORBIDDEN', 'AC14: phiên tổ chức chưa có cán bộ không ghi được');
-- Thu hồi thành viên C thì phiên đang mở của C mất hiệu lực ngay.
select pg_temp.setup(format($$ update public.organization_members set revoked_at = now() where organization_id = %L and user_id = %L $$, pg_temp.c('f'), pg_temp.c('C')));
select is(pg_temp.as_val('authenticated', pg_temp.c('acc_f'), pg_temp.c('S4'), $$ select public.organization_session_ok()::text $$), 'false',
  'AC14: thu hồi thành viên làm phiên đang mở mất hiệu lực ngay');

select * from finish();
rollback;
