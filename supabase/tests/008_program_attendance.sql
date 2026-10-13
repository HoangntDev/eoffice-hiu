-- pgTAP: UC8 — điểm danh QR lượt, mở lại lượt, quy tắc điểm dự kiến, khóa quy tắc.
begin;
select plan(55);

-- ── Fixtures (postgres) ───────────────────────────────────────────────────────
insert into public.faculties (id, current_code, current_name) values
  ('c8000000-0000-4000-8000-00000000000a', 'UC8_KHOA_A', 'Khoa UC8 A'),
  ('c8000000-0000-4000-8000-00000000000b', 'UC8_KHOA_B', 'Khoa UC8 B');

-- 01 BTC (faculty_manager), 04 BTC (faculty_executive), 02 BTC Khoa B; 11,13,15 SV được nhận; 12 chờ duyệt; 14 không đăng ký
insert into auth.users (id, email)
select ('b8000000-0000-4000-8000-0000000000' || n)::uuid, 'uc8-' || n || '@test.local'
from unnest(array['01','02','04','11','12','13','14','15']) n;
insert into public.accounts (user_id, student_code, status)
select ('b8000000-0000-4000-8000-0000000000' || n)::uuid, '20800000' || n, 'active'
from unnest(array['01','02','04','11','12','13','14','15']) n;
insert into public.role_grants (user_id, role_code, organization_id, reason)
select v.u::uuid, v.r, ou.id, 'UC8 test'
from (values ('b8000000-0000-4000-8000-000000000001', 'faculty_manager', 'c8000000-0000-4000-8000-00000000000a'),
             ('b8000000-0000-4000-8000-000000000004', 'faculty_executive', 'c8000000-0000-4000-8000-00000000000a'),
             ('b8000000-0000-4000-8000-000000000002', 'faculty_manager', 'c8000000-0000-4000-8000-00000000000b')) v(u, r, f)
join public.organization_units ou on ou.faculty_id = v.f::uuid and ou.unit_type = 'faculty_union';

insert into public.event_programs (id, owner_org_id, faculty_id, title, starts_at, ends_at, status, created_by, decided_at)
select 'a8000000-0000-4000-8000-0000000000aa', id, 'c8000000-0000-4000-8000-00000000000a', 'UC8 chương trình điểm danh',
       now(), now() + interval '1 day', 'approved', 'b8000000-0000-4000-8000-000000000001', now()
from public.organization_units where faculty_id = 'c8000000-0000-4000-8000-00000000000a' and unit_type = 'faculty_union';
insert into public.program_registration_settings (program_id, status, requires_approval)
values ('a8000000-0000-4000-8000-0000000000aa', 'open', true);
insert into public.program_registrations (program_id, user_id, status, decided_at)
select 'a8000000-0000-4000-8000-0000000000aa', ('b8000000-0000-4000-8000-0000000000' || n)::uuid,
       case when n = '12' then 'pending' else 'accepted' end, case when n = '12' then null else now() end
from unnest(array['11','12','13','15']) n;

create temp table uc8_ctx (k text primary key, v text);
grant all on uc8_ctx to authenticated;

create function pg_temp.act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', ('b8000000-0000-4000-8000-0000000000' || p_user)::uuid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.act_as(text) to authenticated;
create function pg_temp.ctx(p_key text) returns text language sql as $$ select v from uc8_ctx where k = p_key $$;
grant execute on function pg_temp.ctx(text) to authenticated;
create function pg_temp.sid(p_label text) returns uuid language sql as $$
  select id from public.program_attendance_sessions
  where program_id = 'a8000000-0000-4000-8000-0000000000aa' and label = p_label;
$$;
grant execute on function pg_temp.sid(text) to authenticated;
-- Token tự ký (chỉ postgres gọi được hàm chữ ký) để tạo mã cũ/hết hạn.
create function pg_temp.craft(p_session uuid, p_generation int, p_age_ms bigint) returns text language sql as $$
  select p_session::text || '.' || p_generation || '.' || ms || '.' || public.attendance_token_signature(p_session, p_generation, ms)
  from (select floor(extract(epoch from clock_timestamp()) * 1000)::bigint - p_age_ms as ms) t;
$$;
-- Bộ lượt hiện có, đổi cờ bắt buộc theo danh sách nhãn.
create function pg_temp.sessions_json(p_required text[]) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'points', points,
                   'is_required', label = any(p_required), 'sort_order', sort_order) order by sort_order)
  from public.program_attendance_sessions where program_id = 'a8000000-0000-4000-8000-0000000000aa';
$$;
grant execute on function pg_temp.sessions_json(text[]) to authenticated;

set local role authenticated;

-- ── 1. Cấu hình kế hoạch: quyền, điểm nguyên, không vượt tối đa ─────────────
select pg_temp.act_as('02');
select throws_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 3, 'any_session', '[]', false,
  '[{"label":"Đầu giờ","points":0}]') $$, 'P0001', 'FORBIDDEN', 'BTC Khoa B không cấu hình điểm danh của Khoa A');
select pg_temp.act_as('01');
select throws_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 3, 'sum_sessions', '[]', false,
  '[{"label":"Đầu giờ","points":4}]') $$, 'P0001', 'INVALID_SESSION_POINTS', 'Điểm một lượt không vượt điểm tối đa');
select throws_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 3, 'tiers',
  '[{"min_sessions":1,"points":5}]', false, '[{"label":"Đầu giờ","points":0}]') $$,
  'P0001', 'INVALID_TIERS', 'Điểm theo bậc không vượt điểm tối đa');
select throws_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 3, 'all_required', '[]', false,
  '[{"label":"Đầu giờ","points":0}]') $$, 'P0001', 'REQUIRED_SESSION_NEEDED', 'Quy tắc đủ lượt bắt buộc cần ít nhất 1 lượt bắt buộc');
select lives_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 3, 'sum_sessions', '[]', false,
  '[{"label":"Đầu giờ","points":0,"sort_order":0},{"label":"Giữa giờ","points":2,"sort_order":1},
    {"label":"Cuối giờ","points":2,"sort_order":2}]', null, 'uc8-plan') $$,
  'BTC lưu: tối đa 3 điểm, cộng từng lượt (0 + 2 + 2)');
select is((select count(*)::int from public.program_attendance_sessions where program_id = 'a8000000-0000-4000-8000-0000000000aa'), 3, '3 lượt');

-- ── 2. Mở lượt, QR ────────────────────────────────────────────────────────────
select pg_temp.act_as('11');
select throws_ok($$ select public.issue_attendance_qr(pg_temp.sid('Đầu giờ')) $$, 'P0001', 'FORBIDDEN', 'Sinh viên không lấy được QR');
select throws_ok($$ select public.set_attendance_session_status(pg_temp.sid('Đầu giờ'), 'open') $$, 'P0001', 'FORBIDDEN', 'Sinh viên không mở lượt');
select pg_temp.act_as('01');
select throws_ok($$ select public.issue_attendance_qr(pg_temp.sid('Đầu giờ')) $$, 'P0001', 'SESSION_NOT_OPEN', 'Lượt chưa mở thì không phát QR');
select is(public.set_attendance_session_status(pg_temp.sid('Đầu giờ'), 'open', null, 'uc8-open'), 'open', 'BTC mở lượt Đầu giờ');
insert into uc8_ctx values ('qr1', public.issue_attendance_qr(pg_temp.sid('Đầu giờ'))->>'token');
select ok((select (q->>'expires_at')::timestamptz - (q->>'issued_at')::timestamptz = interval '30 seconds'
           from (select public.issue_attendance_qr(pg_temp.sid('Đầu giờ')) q) t), 'QR có hạn 30 giây');

select pg_temp.act_as('11');
select is(public.check_in_attendance(pg_temp.sid('Đầu giờ'), pg_temp.ctx('qr1'), 'uc8-checkin')->>'session_label', 'Đầu giờ',
  'QR còn hạn: SV được nhận điểm danh');
select throws_ok($$ select public.check_in_attendance(pg_temp.sid('Đầu giờ'), pg_temp.ctx('qr1')) $$,
  'P0001', 'ALREADY_CHECKED_IN', 'Quét trùng trong một lượt bị chặn');
select throws_ok($$ select public.check_in_attendance(pg_temp.sid('Giữa giờ'), pg_temp.ctx('qr1')) $$,
  'P0001', 'WRONG_SESSION', 'Mã của lượt khác bị từ chối');
select throws_ok($$ select public.check_in_attendance(pg_temp.sid('Đầu giờ'), left(pg_temp.ctx('qr1'), -1) || 'x') $$,
  'P0001', 'QR_INVALID', 'Chữ ký sai bị từ chối');
select throws_ok($$ select public.check_in_attendance(pg_temp.sid('Đầu giờ'),
  replace(pg_temp.ctx('qr1'), split_part(pg_temp.ctx('qr1'), '.', 3), (split_part(pg_temp.ctx('qr1'), '.', 3)::bigint + 60000)::text)) $$,
  'P0001', 'QR_INVALID', 'Sửa thời điểm phát để kéo dài hạn làm hỏng chữ ký');

reset role;
insert into uc8_ctx values
  ('qr1_expired', pg_temp.craft(pg_temp.sid('Đầu giờ'), 1, 31000)),
  ('qr1_29s',     pg_temp.craft(pg_temp.sid('Đầu giờ'), 1, 29000));
set local role authenticated;

select pg_temp.act_as('13');
select throws_ok($$ select public.check_in_attendance(pg_temp.sid('Đầu giờ'), pg_temp.ctx('qr1_expired')) $$,
  'P0001', 'QR_EXPIRED', 'QR quá 30 giây (giờ server) hết hiệu lực');
select pg_temp.act_as('12');
select throws_ok($$ select public.check_in_attendance(pg_temp.sid('Đầu giờ'), pg_temp.ctx('qr1_29s')) $$,
  'P0001', 'REGISTRATION_NOT_ACCEPTED', 'Đăng ký chưa được nhận thì không điểm danh');
select pg_temp.act_as('14');
select throws_ok($$ select public.check_in_attendance(pg_temp.sid('Đầu giờ'), pg_temp.ctx('qr1_29s')) $$,
  'P0001', 'REGISTRATION_NOT_ACCEPTED', 'Không đăng ký thì không điểm danh');

-- ── 3. Lượt đóng, quy tắc bị khóa sau khi bắt đầu ────────────────────────────
select pg_temp.act_as('01');
select is(public.set_attendance_session_status(pg_temp.sid('Đầu giờ'), 'closed'), 'closed', 'BTC đóng lượt');
reset role;
insert into uc8_ctx values ('qr1_after_close', pg_temp.craft(pg_temp.sid('Đầu giờ'), 1, 0));
set local role authenticated;
select pg_temp.act_as('13');
select throws_ok($$ select public.check_in_attendance(pg_temp.sid('Đầu giờ'), pg_temp.ctx('qr1_after_close')) $$,
  'P0001', 'SESSION_NOT_OPEN', 'Lượt đã đóng: mã còn hạn cũng bị từ chối');

select pg_temp.act_as('01');
select throws_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 5, 'sum_sessions', '[]', false,
  pg_temp.sessions_json('{}')) $$, 'P0001', 'AMEND_REASON_REQUIRED', 'Đã bắt đầu điểm danh: sửa quy tắc phải có lý do');
select pg_temp.act_as('04');
select throws_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 5, 'sum_sessions', '[]', false,
  pg_temp.sessions_json('{}'), 'BTV muốn đổi điểm tối đa') $$, 'P0001', 'AMEND_FORBIDDEN', 'BTV Đoàn Khoa không được điều chỉnh sau khi khóa');
select pg_temp.act_as('01');
select throws_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 3, 'sum_sessions', '[]', false,
  (select jsonb_agg(e) from jsonb_array_elements(pg_temp.sessions_json('{}')) e where e->>'label' <> 'Đầu giờ'),
  'Bỏ lượt đầu giờ đã điểm danh') $$, 'P0001', 'SESSION_IN_USE', 'Không xóa lượt đã mở');

-- ── 4. Mở lại đúng lượt cũ để điểm danh bổ sung ──────────────────────────────
select throws_ok($$ select public.set_attendance_session_status(pg_temp.sid('Đầu giờ'), 'open') $$,
  'P0001', 'REOPEN_REASON_REQUIRED', 'Mở lại lượt phải có lý do');
select is(public.set_attendance_session_status(pg_temp.sid('Đầu giờ'), 'open', 'Điểm danh bổ sung cho SV đến muộn'), 'open', 'Mở lại lượt cũ');
select is((select open_count from public.program_attendance_sessions where id = pg_temp.sid('Đầu giờ')), 2, 'Cùng lượt, lần mở thứ 2');
insert into uc8_ctx values ('qr1_gen2', public.issue_attendance_qr(pg_temp.sid('Đầu giờ'))->>'token');
reset role;
insert into uc8_ctx values ('qr1_gen1_fresh', pg_temp.craft(pg_temp.sid('Đầu giờ'), 1, 0));
set local role authenticated;

select pg_temp.act_as('13');
select throws_ok($$ select public.check_in_attendance(pg_temp.sid('Đầu giờ'), pg_temp.ctx('qr1_gen1_fresh')) $$,
  'P0001', 'QR_EXPIRED', 'Mã của lần mở trước không dùng lại được');
select is((public.check_in_attendance(pg_temp.sid('Đầu giờ'), pg_temp.ctx('qr1_gen2'))->>'supplementary')::boolean, true,
  'SV 13 điểm danh bổ sung');
select pg_temp.act_as('11');
select throws_ok($$ select public.check_in_attendance(pg_temp.sid('Đầu giờ'), pg_temp.ctx('qr1_gen2')) $$,
  'P0001', 'ALREADY_CHECKED_IN', 'Mở lại không cho SV đã có mặt ghi nhận lần nữa');
select is((select count(*)::int from public.program_attendance_records where session_id = pg_temp.sid('Đầu giờ')), 1,
  'RLS: SV chỉ thấy bản ghi của mình (lượt có 2 bản ghi)');

-- ── 5. Điểm dự kiến và trạng thái tham gia ───────────────────────────────────
select pg_temp.act_as('01');
select is((select count(*)::int from public.program_attendance_records where session_id = pg_temp.sid('Đầu giờ')), 2,
  'Lượt Đầu giờ có 2 bản ghi, không tạo lượt mới');
select is((select participation || '/' || expected_points from public.program_attendance_preview('a8000000-0000-4000-8000-0000000000aa')
           where user_id = 'b8000000-0000-4000-8000-000000000011'), 'participated/0',
  'Chỉ có lượt đầu giờ 0 điểm: Có tham gia, chưa Hoàn thành');
select is((select participation from public.program_attendance_preview('a8000000-0000-4000-8000-0000000000aa')
           where user_id = 'b8000000-0000-4000-8000-000000000015'), 'absent', 'Không lượt nào: đăng ký nhưng không tham gia');
select is((select count(*)::int from public.program_attendance_preview('a8000000-0000-4000-8000-0000000000aa')
           where user_id = 'b8000000-0000-4000-8000-000000000012'), 0, 'Bảng xem trước chỉ gồm đăng ký được nhận');

select lives_ok($$ select public.set_attendance_session_status(pg_temp.sid('Giữa giờ'), 'open') $$, 'Mở Giữa giờ');
select lives_ok($$ select public.set_attendance_session_status(pg_temp.sid('Cuối giờ'), 'open') $$, 'Mở Cuối giờ');
insert into uc8_ctx values ('qr2', public.issue_attendance_qr(pg_temp.sid('Giữa giờ'))->>'token'),
                           ('qr3', public.issue_attendance_qr(pg_temp.sid('Cuối giờ'))->>'token');
select pg_temp.act_as('11');
select lives_ok($$ select public.check_in_attendance(pg_temp.sid('Giữa giờ'), pg_temp.ctx('qr2')),
                          public.check_in_attendance(pg_temp.sid('Cuối giờ'), pg_temp.ctx('qr3')) $$, 'SV 11 điểm danh 2 lượt còn lại');

select pg_temp.act_as('01');
select is((select participation || '/' || expected_points from public.program_attendance_preview('a8000000-0000-4000-8000-0000000000aa')
           where user_id = 'b8000000-0000-4000-8000-000000000011'), 'completed/3',
  'Cộng từng lượt 0+2+2 = 4 nhưng không vượt tối đa 3');

-- Đổi quy tắc (đã khóa → faculty_manager + lý do), kiểm từng loại quy tắc.
select lives_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 3, 'tiers',
  '[{"min_sessions":1,"points":1},{"min_sessions":3,"points":3}]', false, pg_temp.sessions_json('{}'),
  'Chuyển sang cấp điểm theo bậc số lượt', 'uc8-amend') $$, 'Điều chỉnh có lý do: theo bậc');
select is((select string_agg(expected_points::text, ',' order by student_code) from public.program_attendance_preview('a8000000-0000-4000-8000-0000000000aa')),
  '3,1,0', 'Theo bậc: 3 lượt → 3; 1 lượt → 1; vắng → 0');
select lives_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 3, 'tiers',
  '[{"min_sessions":1,"points":1},{"min_sessions":3,"points":3}]', true, pg_temp.sessions_json('{Cuối giờ}'),
  'Theo bậc kèm lượt cuối giờ bắt buộc') $$, 'Theo bậc kèm lượt bắt buộc');
select is((select string_agg(expected_points::text, ',' order by student_code) from public.program_attendance_preview('a8000000-0000-4000-8000-0000000000aa')),
  '3,0,0', 'Thiếu lượt bắt buộc → 0 dù đạt bậc');
select is((select participation from public.program_attendance_preview('a8000000-0000-4000-8000-0000000000aa')
           where user_id = 'b8000000-0000-4000-8000-000000000013'), 'participated', 'SV 13 vẫn Có tham gia');
select lives_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 3, 'all_required', '[]', false,
  pg_temp.sessions_json('{Đầu giờ,Cuối giờ}'), 'Đủ lượt đầu giờ và cuối giờ') $$, 'Đủ các lượt bắt buộc');
select is((select string_agg(expected_points::text, ',' order by student_code) from public.program_attendance_preview('a8000000-0000-4000-8000-0000000000aa')),
  '3,0,0', 'Đủ bắt buộc → tối đa; thiếu → 0');
select lives_ok($$ select public.save_attendance_plan('a8000000-0000-4000-8000-0000000000aa', 2, 'any_session', '[]', false,
  (select jsonb_agg(e || '{"points":0}') from jsonb_array_elements(pg_temp.sessions_json('{}')) e),
  'Có mặt ít nhất một lượt, tối đa 2 điểm') $$, 'Ít nhất một lượt');
select is((select string_agg(expected_points::text, ',' order by student_code) from public.program_attendance_preview('a8000000-0000-4000-8000-0000000000aa')),
  '2,2,0', 'Ít nhất một lượt → tối đa 2');

-- ── 6. Lịch sử, riêng tư, uy tín ─────────────────────────────────────────────
select is((select count(*)::int from public.program_attendance_history
           where program_id = 'a8000000-0000-4000-8000-0000000000aa' and action = 'plan_amended' and before_data is not null and after_data is not null),
  4, 'Mỗi lần điều chỉnh lưu lý do + trước/sau');
select ok((select reason = 'Điểm danh bổ sung cho SV đến muộn' from public.program_attendance_history where action = 'session_reopened'),
  'Lịch sử mở lại lượt lưu lý do');
select pg_temp.act_as('11');
select throws_ok($$ select count(*) from public.program_attendance_secrets $$, '42501', null, 'SV không đọc bí mật ký QR');
select throws_ok($$ select * from public.program_attendance_preview('a8000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'FORBIDDEN', 'SV không xem bảng điểm dự kiến');
select throws_ok($$ insert into public.program_attendance_records (session_id, program_id, user_id, registration_id, generation)
  select pg_temp.sid('Đầu giờ'), 'a8000000-0000-4000-8000-0000000000aa', 'b8000000-0000-4000-8000-000000000015', id, 1
  from public.program_registrations limit 1 $$, '42501', null, 'Không ghi điểm danh trực tiếp');

reset role;
select is((select count(*)::int from public.reputation_adjustments where user_id::text like 'b8000000-%'), 0,
  'UC8 không trừ điểm uy tín');
select is((select count(*)::int from public.audit_events where request_id in ('uc8-plan', 'uc8-open', 'uc8-checkin', 'uc8-amend')), 4,
  'Audit có request_id cho cấu hình, mở lượt, điểm danh, điều chỉnh');

select * from finish();
rollback;
