-- pgTAP: UC9 — khóa điểm danh, hồ sơ nghiệm thu, quyền nghiệm thu, trừ/hoàn uy tín, khiếu nại, học kỳ, hủy.
begin;
select plan(64);

-- ── Fixtures (postgres) ───────────────────────────────────────────────────────
insert into public.faculties (id, current_code, current_name) values
  ('c9000000-0000-4000-8000-00000000000a', 'UC9_KHOA_A', 'Khoa UC9 A');

-- 01 BCH Khoa A; 03 Văn phòng; 05 vừa BCH Khoa A vừa Văn phòng; 07 Đoàn Trường;
-- 11 nhận + có lượt 0 điểm; 12, 15 nhận + vắng; 13 chờ duyệt; 14 bị từ chối; 16 nhận ở chương trình bị hủy.
insert into auth.users (id, email)
select ('b9000000-0000-4000-8000-0000000000' || n)::uuid, 'uc9-' || n || '@test.local'
from unnest(array['01','03','05','07','11','12','13','14','15','16']) n;
insert into public.accounts (user_id, student_code, status)
select ('b9000000-0000-4000-8000-0000000000' || n)::uuid, '20900000' || n, 'active'
from unnest(array['01','03','05','07','11','12','13','14','15','16']) n;
insert into public.role_grants (user_id, role_code, organization_id, reason)
select v.u::uuid, v.r, coalesce(ou.id, v.o::uuid), 'UC9 test'
from (values ('b9000000-0000-4000-8000-000000000001', 'faculty_manager', null),
             ('b9000000-0000-4000-8000-000000000005', 'faculty_manager', null),
             ('b9000000-0000-4000-8000-000000000003', 'office', '00000000-0000-4000-8000-000000000002'),
             ('b9000000-0000-4000-8000-000000000005', 'office', '00000000-0000-4000-8000-000000000002'),
             ('b9000000-0000-4000-8000-000000000007', 'school_admin', '00000000-0000-4000-8000-000000000001')) v(u, r, o)
left join public.organization_units ou
  on v.o is null and ou.faculty_id = 'c9000000-0000-4000-8000-00000000000a' and ou.unit_type = 'faculty_union';

-- P: chương trình chính (ngày 2031-03-01, chưa có học kỳ). C: sẽ bị hủy. D: đã nghiệm thu ở học kỳ đã qua.
insert into public.event_programs (id, owner_org_id, faculty_id, title, starts_at, ends_at, status, created_by, decided_at)
select v.id::uuid, ou.id, 'c9000000-0000-4000-8000-00000000000a', v.t, v.s::timestamptz, v.s::timestamptz + interval '1 day',
       'approved', 'b9000000-0000-4000-8000-000000000001', now()
from (values ('a9000000-0000-4000-8000-0000000000aa', 'UC9 chương trình nghiệm thu', '2031-03-01 08:00+07'),
             ('a9000000-0000-4000-8000-0000000000cc', 'UC9 chương trình bị hủy', '2031-03-05 08:00+07'),
             ('a9000000-0000-4000-8000-0000000000dd', 'UC9 chương trình học kỳ cũ', '2020-03-01 08:00+07')) v(id, t, s)
join public.organization_units ou on ou.faculty_id = 'c9000000-0000-4000-8000-00000000000a' and ou.unit_type = 'faculty_union';
insert into public.program_registration_settings (program_id, status, requires_approval)
select id, 'closed', true from public.event_programs where id::text like 'a9000000-%';
insert into public.program_registrations (program_id, user_id, status, decided_at, decision_reason)
select v.p::uuid, ('b9000000-0000-4000-8000-0000000000' || v.n)::uuid, v.s,
       case when v.s = 'pending' then null else now() end,
       case when v.s = 'rejected' then 'Không đủ điều kiện tham gia' end
from (values ('a9000000-0000-4000-8000-0000000000aa', '11', 'accepted'), ('a9000000-0000-4000-8000-0000000000aa', '12', 'accepted'),
             ('a9000000-0000-4000-8000-0000000000aa', '13', 'pending'), ('a9000000-0000-4000-8000-0000000000aa', '14', 'rejected'),
             ('a9000000-0000-4000-8000-0000000000aa', '15', 'accepted'), ('a9000000-0000-4000-8000-0000000000cc', '16', 'accepted'),
             ('a9000000-0000-4000-8000-0000000000dd', '12', 'accepted')) v(p, n, s);

-- Tệp đã có trong Storage (route handler tải lên trước khi gọi RPC).
insert into storage.objects (bucket_id, name)
select 'program-acceptance-files', 'a9000000-0000-4000-8000-0000000000aa/' || x || '.' || e
from (values ('d9000000-0000-4000-8000-000000000001', 'pdf'), ('d9000000-0000-4000-8000-000000000002', 'pdf'),
             ('d9000000-0000-4000-8000-000000000003', 'pdf'), ('d9000000-0000-4000-8000-000000000004', 'jpg')) v(x, e);

create temp table uc9_ctx (k text primary key, v text);
grant all on uc9_ctx to authenticated;
create function pg_temp.act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', ('b9000000-0000-4000-8000-0000000000' || p_user)::uuid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.act_as(text) to authenticated;
create function pg_temp.ctx(p_key text) returns text language sql as $$ select v from uc9_ctx where k = p_key $$;
grant execute on function pg_temp.ctx(text) to authenticated;
create function pg_temp.sid(p_label text) returns uuid language sql as $$
  select id from public.program_attendance_sessions
  where program_id = 'a9000000-0000-4000-8000-0000000000aa' and label = p_label;
$$;
grant execute on function pg_temp.sid(text) to authenticated;
create function pg_temp.attach(p_kind text, p_n text, p_ext text) returns uuid language sql as $$
  select public.attach_program_acceptance_document('a9000000-0000-4000-8000-0000000000aa', p_kind,
    'a9000000-0000-4000-8000-0000000000aa/d9000000-0000-4000-8000-00000000000' || p_n || '.' || p_ext,
    p_kind || '.' || p_ext, case p_ext when 'pdf' then 'application/pdf' else 'image/jpeg' end, 1000, repeat('a', 64));
$$;
grant execute on function pg_temp.attach(text, text, text) to authenticated;
create function pg_temp.penalties(p_user text) returns int language sql security definer as $$
  select coalesce(sum(delta), 0)::int from public.reputation_adjustments
  where program_id = 'a9000000-0000-4000-8000-0000000000aa' and user_id = ('b9000000-0000-4000-8000-0000000000' || p_user)::uuid;
$$;

set local role authenticated;

-- ── 1. Điểm danh rồi khóa ────────────────────────────────────────────────────
select pg_temp.act_as('01');
select lives_ok($$ select public.save_attendance_plan('a9000000-0000-4000-8000-0000000000aa', 3, 'sum_sessions', '[]', false,
  '[{"label":"Lượt A","points":0,"sort_order":0},{"label":"Lượt B","points":3,"sort_order":1},
    {"label":"Lượt C","points":0,"sort_order":2}]') $$, 'BTC lập kế hoạch 3 lượt (A 0 điểm, B 3 điểm, C chưa mở)');
select public.set_attendance_session_status(pg_temp.sid('Lượt A'), 'open');
select public.set_attendance_session_status(pg_temp.sid('Lượt B'), 'open');
select public.set_attendance_session_status(pg_temp.sid('Lượt B'), 'closed');
reset role;
-- SV 11 có mặt Lượt A (0 điểm) — tương đương quét QR hợp lệ.
insert into public.program_attendance_records (session_id, program_id, user_id, registration_id, generation)
select pg_temp.sid('Lượt A'), r.program_id, r.user_id, r.id, 1 from public.program_registrations r
where r.program_id = 'a9000000-0000-4000-8000-0000000000aa' and r.user_id = 'b9000000-0000-4000-8000-000000000011';
set local role authenticated;

select pg_temp.act_as('11');
select throws_ok($$ select public.lock_program_attendance('a9000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'FORBIDDEN', 'Sinh viên không khóa điểm danh');
select pg_temp.act_as('01');
select throws_ok($$ select public.lock_program_attendance('a9000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'SESSION_STILL_OPEN', 'Còn lượt đang mở thì chưa khóa được');
select public.set_attendance_session_status(pg_temp.sid('Lượt A'), 'closed');
select is(public.lock_program_attendance('a9000000-0000-4000-8000-0000000000aa', 'uc9-lock'), 'locked', 'BTC khóa điểm danh');
select throws_ok($$ select public.set_attendance_session_status(pg_temp.sid('Lượt A'), 'open', 'Mở lại để bổ sung sau khóa') $$,
  'P0001', 'ATTENDANCE_LOCKED', 'Đã khóa: không mở lại lượt');
select throws_ok($$ select public.save_attendance_plan('a9000000-0000-4000-8000-0000000000aa', 3, 'any_session', '[]', false,
  '[{"label":"Lượt A","points":0}]', 'Đổi quy tắc sau khi đã khóa') $$, 'P0001', 'ATTENDANCE_LOCKED', 'Đã khóa: không đổi quy tắc');
select throws_ok($$ select public.decide_program_registration(
  (select id from public.program_registrations where user_id = 'b9000000-0000-4000-8000-000000000013'), 'approve', null) $$,
  'P0001', 'ATTENDANCE_LOCKED', 'Đã khóa: không nhận thêm đăng ký (tránh bị tính vắng oan)');

-- ── 2. Hồ sơ thiếu, phiên bản tệp ────────────────────────────────────────────
select throws_ok($$ select public.submit_program_acceptance('a9000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'MISSING_DOCUMENTS:proposal,report,evidence', 'Hồ sơ trống: báo thiếu cả ba thành phần');
select lives_ok($$ select pg_temp.attach('proposal', '1', 'pdf') $$, 'Tải Đơn đề nghị (PDF)');
select lives_ok($$ select pg_temp.attach('proposal', '2', 'pdf') $$, 'Tải lại Đơn đề nghị (phiên bản mới)');
select is((select count(*)::int from public.program_acceptance_documents where kind = 'proposal'
           and program_id = 'a9000000-0000-4000-8000-0000000000aa'), 2, 'Giữ cả hai phiên bản Đơn đề nghị');
select is((select count(*)::int from public.program_acceptance_documents where kind = 'proposal' and superseded_at is null
           and program_id = 'a9000000-0000-4000-8000-0000000000aa'), 1, 'Chỉ một bản hiện hành, bản cũ ghi bị thay thế');
select throws_ok($$ select pg_temp.attach('report', '4', 'jpg') $$, '23514', null, 'Báo cáo phải là PDF, không nhận ảnh');
select lives_ok($$ select pg_temp.attach('report', '3', 'pdf') $$, 'Tải báo cáo kết quả');
select throws_ok($$ select public.submit_program_acceptance('a9000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'MISSING_DOCUMENTS:evidence', 'Thiếu ảnh minh chứng thì chưa nộp được');
select lives_ok($$ select pg_temp.attach('evidence', '4', 'jpg') $$, 'Tải ảnh minh chứng');
select pg_temp.act_as('05');
select is(public.submit_program_acceptance('a9000000-0000-4000-8000-0000000000aa', 'uc9-submit'), 'submitted',
  'BCH Khoa (người 05) nộp hồ sơ');
select pg_temp.act_as('01');
select throws_ok($$ select pg_temp.attach('evidence', '4', 'jpg') $$, 'P0001', 'ACCEPTANCE_NOT_EDITABLE', 'Đã nộp: không sửa hồ sơ');

-- ── 3. Quyền nghiệm thu ──────────────────────────────────────────────────────
select throws_ok($$ select public.review_program_acceptance('a9000000-0000-4000-8000-0000000000aa', 'accept', null) $$,
  'P0001', 'FORBIDDEN', 'BTC không nghiệm thu');
select pg_temp.act_as('05');
select throws_ok($$ select public.review_program_acceptance('a9000000-0000-4000-8000-0000000000aa', 'accept', null) $$,
  'P0001', 'SELF_REVIEW_FORBIDDEN', 'Người nộp (dù có vai trò Văn phòng) không tự nghiệm thu');
select pg_temp.act_as('03');
select throws_ok($$ select public.review_program_acceptance('a9000000-0000-4000-8000-0000000000aa', 'request_changes', 'ngắn') $$,
  'P0001', 'REASON_REQUIRED', 'Yêu cầu bổ sung phải có lý do');
select is(public.review_program_acceptance('a9000000-0000-4000-8000-0000000000aa', 'request_changes',
  'Bổ sung ảnh minh chứng toàn cảnh')->>'status', 'needs_changes', 'Văn phòng yêu cầu bổ sung');
select pg_temp.act_as('01');
select is(public.submit_program_acceptance('a9000000-0000-4000-8000-0000000000aa'), 'submitted', 'BTC nộp lại');
select pg_temp.act_as('03');
select throws_ok($$ select public.review_program_acceptance('a9000000-0000-4000-8000-0000000000aa', 'accept', null) $$,
  'P0001', 'TERM_NOT_CONFIGURED', 'Ngày chương trình chưa thuộc học kỳ nào: không nghiệm thu, không trừ âm thầm');
select is(pg_temp.penalties('12'), 0, 'Chưa nghiệm thu: chưa trừ');

-- ── 4. Cấu hình học kỳ ───────────────────────────────────────────────────────
select pg_temp.act_as('11');
select throws_ok($$ select public.save_academic_term(null, '2030-2031', 'HK2', 'Học kỳ 2', '2031-01-15', '2031-06-30') $$,
  'P0001', 'FORBIDDEN', 'Sinh viên không cấu hình học kỳ');
select pg_temp.act_as('07');
select lives_ok($$ insert into uc9_ctx values ('term', public.save_academic_term(null, '2030-2031', 'HK2', 'Học kỳ 2',
  '2031-01-15', '2031-06-30')::text) $$, 'Đoàn Trường tạo học kỳ theo khoảng ngày');
select throws_ok($$ select public.save_academic_term(null, '2030-2031', 'HK3', 'Học kỳ hè', '2031-06-01', '2031-08-01') $$,
  'P0001', 'TERM_OVERLAP', 'Hai học kỳ không chồng ngày');

-- ── 5. Nghiệm thu, -5 đúng đối tượng, nghiệm thu lặp ─────────────────────────
select pg_temp.act_as('03');
select is(public.review_program_acceptance('a9000000-0000-4000-8000-0000000000aa', 'accept', null, 'uc9-accept')->>'penalties', '2',
  'Văn phòng nghiệm thu: trừ 2 người được nhận mà vắng mọi lượt');
select is(pg_temp.penalties('12'), -5, 'SV 12 (0 lượt) bị trừ đúng 5 điểm');
select is(pg_temp.penalties('11'), 0, 'SV 11 có 1 lượt dù 0 điểm: không bị trừ');
select is(pg_temp.penalties('13') + pg_temp.penalties('14'), 0, 'Đăng ký chờ duyệt / bị từ chối: không bị trừ');
select throws_ok($$ select public.review_program_acceptance('a9000000-0000-4000-8000-0000000000aa', 'accept', null) $$,
  'P0001', 'INVALID_TRANSITION', 'Nghiệm thu lặp bị chặn');
reset role;
select is((select term_id::text from public.reputation_adjustments where user_id = 'b9000000-0000-4000-8000-000000000012'
           and kind = 'absence_penalty'), pg_temp.ctx('term'), 'Khoản trừ gắn học kỳ chứa ngày chương trình');
select is(public.apply_absence_penalties('a9000000-0000-4000-8000-0000000000aa', pg_temp.ctx('term')::uuid, null), 0,
  'Chạy lại bước trừ: 0 dòng mới (một lần mỗi chương trình)');
select is((select participation from public.program_acceptance_results
           where program_id = 'a9000000-0000-4000-8000-0000000000aa' and version = 1
             and user_id = 'b9000000-0000-4000-8000-000000000011'), 'participated', 'Snapshot v1: SV 11 Có tham gia');
select throws_ok($$ update public.reputation_adjustments set delta = -1 where user_id = 'b9000000-0000-4000-8000-000000000012' $$,
  'P0001', 'APPEND_ONLY', 'Sổ uy tín không sửa được');
select throws_ok($$ delete from public.program_acceptance_results where program_id = 'a9000000-0000-4000-8000-0000000000aa' $$,
  'P0001', 'APPEND_ONLY', 'Snapshot không xóa được');
set local role authenticated;
select pg_temp.act_as('07');
select throws_ok($$ select public.save_academic_term(pg_temp.ctx('term')::uuid, '2030-2031', 'HK2', 'Học kỳ 2',
  '2031-02-01', '2031-06-30') $$, 'P0001', 'TERM_IN_USE', 'Học kỳ đã có giao dịch: không đổi ngày');
select pg_temp.act_as('01');
select throws_ok($$ select public.cancel_event_program('a9000000-0000-4000-8000-0000000000aa', 'Hủy sau khi đã nghiệm thu') $$,
  'P0001', 'PROGRAM_ALREADY_ACCEPTED', 'Đã nghiệm thu thì không hủy');

-- ── 6. Quyền riêng tư ────────────────────────────────────────────────────────
select pg_temp.act_as('12');
select throws_ok($$ select count(*) from public.reputation_adjustments $$, '42501', null, 'SV không đọc sổ uy tín');
select is((select count(*)::int from public.program_acceptance_results), 0, 'SV không đọc bảng snapshot (có điểm dự kiến)');
select is((select participation from public.my_program_results() where program_id = 'a9000000-0000-4000-8000-0000000000aa'),
  'absent', 'SV xem kết quả của mình: Đăng ký nhưng không tham gia');
select throws_ok($$ select * from public.program_reputation_ledger('a9000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'FORBIDDEN', 'SV không xem lịch sử trừ/hoàn');
select pg_temp.act_as('01');
select throws_ok($$ select * from public.program_reputation_ledger('a9000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'FORBIDDEN', 'BTC không xem sổ uy tín của chương trình');

-- ── 7. Khiếu nại và hoàn đúng một lần ─────────────────────────────────────────
select pg_temp.act_as('12');
select throws_ok($$ select public.file_attendance_complaint('a9000000-0000-4000-8000-0000000000aa', pg_temp.sid('Lượt C'),
  'Tôi có mặt ở lượt C') $$, 'P0001', 'SESSION_NEVER_OPENED', 'Không khiếu nại lượt chưa từng mở');
insert into uc9_ctx values ('c1', public.file_attendance_complaint('a9000000-0000-4000-8000-0000000000aa', pg_temp.sid('Lượt B'),
  'Tôi có mặt lượt B nhưng điện thoại hết pin', 'uc9-complaint'));
select throws_ok($$ select public.file_attendance_complaint('a9000000-0000-4000-8000-0000000000aa', pg_temp.sid('Lượt B'),
  'Gửi lại khiếu nại lượt B') $$, 'P0001', 'COMPLAINT_EXISTS', 'Không gửi trùng khiếu nại đang chờ');
select throws_ok($$ select public.resolve_attendance_complaint(pg_temp.ctx('c1')::uuid, 'accept', 'Tự duyệt khiếu nại') $$,
  'P0001', 'FORBIDDEN', 'SV không tự xử lý khiếu nại');
select pg_temp.act_as('13');
select throws_ok($$ select public.file_attendance_complaint('a9000000-0000-4000-8000-0000000000aa', pg_temp.sid('Lượt A'),
  'Tôi có mặt lượt A') $$, 'P0001', 'REGISTRATION_NOT_ACCEPTED', 'Đăng ký chờ duyệt không khiếu nại');

select pg_temp.act_as('01');
select is(public.resolve_attendance_complaint(pg_temp.ctx('c1')::uuid, 'accept', 'Đối chiếu ảnh minh chứng có mặt',
  'uc9-resolve')->>'snapshot_version', '2', 'BTC chấp nhận: bổ sung lượt B, tính lại (snapshot v2)');
select pg_temp.act_as('12');
insert into uc9_ctx values ('c2', public.file_attendance_complaint('a9000000-0000-4000-8000-0000000000aa', pg_temp.sid('Lượt A'),
  'Tôi cũng có mặt lượt A đầu giờ'));
select pg_temp.act_as('01');
select lives_ok($$ select public.resolve_attendance_complaint(pg_temp.ctx('c2')::uuid, 'accept', 'Có tên trong sổ ký giấy lượt A') $$,
  'Khiếu nại thứ hai được chấp nhận');
select pg_temp.act_as('15');
insert into uc9_ctx values ('c3', public.file_attendance_complaint('a9000000-0000-4000-8000-0000000000aa', pg_temp.sid('Lượt A'),
  'Tôi có mặt nhưng quên quét'));
select pg_temp.act_as('01');
select lives_ok($$ select public.resolve_attendance_complaint(pg_temp.ctx('c3')::uuid, 'reject', 'Không có tên trong sổ ký giấy') $$,
  'BTC từ chối khiếu nại có lý do');

reset role;
select is((select array_agg(delta order by id) from public.reputation_adjustments
           where program_id = 'a9000000-0000-4000-8000-0000000000aa' and user_id = 'b9000000-0000-4000-8000-000000000012'),
  array[-5, 5], 'SV 12: giữ cả -5 và +5; hoàn đúng một lần dù 2 khiếu nại được chấp nhận');
select ok((select bool_and(created_by is not null and char_length(reason) > 10) from public.reputation_adjustments
           where program_id = 'a9000000-0000-4000-8000-0000000000aa'), 'Mỗi giao dịch có lý do và người xử lý');
select is(pg_temp.penalties('15'), -5, 'Khiếu nại bị từ chối: không hoàn');
select is((select participation || ':' || expected_points from public.program_acceptance_results
           where program_id = 'a9000000-0000-4000-8000-0000000000aa' and version = 3
             and user_id = 'b9000000-0000-4000-8000-000000000012'), 'completed:3', 'Snapshot v3: SV 12 Hoàn thành 3 điểm');
select is((select participation from public.program_acceptance_results
           where program_id = 'a9000000-0000-4000-8000-0000000000aa' and version = 1
             and user_id = 'b9000000-0000-4000-8000-000000000012'), 'absent', 'Snapshot v1 giữ nguyên (có lịch sử)');
set local role authenticated;
select pg_temp.act_as('03');
select is((select count(*)::int from public.program_reputation_ledger('a9000000-0000-4000-8000-0000000000aa')), 3,
  'Văn phòng xem sổ của chương trình: -5, -5, +5');

-- ── 8. Hạn khiếu nại theo học kỳ ─────────────────────────────────────────────
reset role;
insert into public.academic_terms (id, academic_year, term_code, name, starts_on, ends_on)
values ('e9000000-0000-4000-8000-000000000001', '2019-2020', 'HK2', 'Học kỳ 2', '2020-01-15', '2020-06-30');
insert into public.program_attendance_plans (program_id, max_points, rule_type) values ('a9000000-0000-4000-8000-0000000000dd', 1, 'any_session');
insert into public.program_attendance_sessions (id, program_id, label, status, open_count)
values ('f9000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-0000000000dd', 'Lượt cũ', 'closed', 1);
insert into public.program_acceptances (program_id, status, attendance_locked, decided_at, term_id, current_snapshot_version, created_by)
values ('a9000000-0000-4000-8000-0000000000dd', 'accepted', true, now(), 'e9000000-0000-4000-8000-000000000001', 1,
        'b9000000-0000-4000-8000-000000000001');
set local role authenticated;
select pg_temp.act_as('12');
select throws_ok($$ select public.file_attendance_complaint('a9000000-0000-4000-8000-0000000000dd',
  'f9000000-0000-4000-8000-000000000001', 'Khiếu nại sau khi học kỳ kết thúc') $$,
  'P0001', 'COMPLAINT_DEADLINE_PASSED', 'Quá hết học kỳ: không nhận khiếu nại');

-- ── 9. Chương trình hủy: không trừ ───────────────────────────────────────────
select pg_temp.act_as('01');
select throws_ok($$ select public.cancel_event_program('a9000000-0000-4000-8000-0000000000cc', 'ngắn') $$,
  'P0001', 'REASON_REQUIRED', 'Hủy phải có lý do');
select is(public.cancel_event_program('a9000000-0000-4000-8000-0000000000cc', 'Thời tiết xấu, hủy chương trình'), 'cancelled',
  'BCH Khoa hủy chương trình');
select throws_ok($$ select public.lock_program_attendance('a9000000-0000-4000-8000-0000000000cc') $$,
  'P0001', 'PROGRAM_CANCELLED', 'Chương trình hủy không vào nghiệm thu');
reset role;
select is((select count(*)::int from public.reputation_adjustments where program_id = 'a9000000-0000-4000-8000-0000000000cc'), 0,
  'Chương trình hủy: SV được nhận nhưng vắng không bị trừ');
select is((select count(*)::int from public.audit_events where request_id in ('uc9-lock', 'uc9-submit', 'uc9-accept',
  'uc9-complaint', 'uc9-resolve')), 5, 'Audit có request_id cho khóa, nộp, nghiệm thu, khiếu nại, xử lý');

select * from finish();
rollback;
