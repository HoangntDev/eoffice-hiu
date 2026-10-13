-- pgTAP: UC10 — chờ đăng bài sau nghiệm thu, quyền xuất bản, dữ liệu bắt buộc, Facebook, lịch sử, cổng công khai.
begin;
select plan(45);

-- ── Fixtures (postgres) ───────────────────────────────────────────────────────
insert into public.faculties (id, current_code, current_name) values
  ('c1000000-0000-4000-8000-00000000000a', 'UC10_KHOA_A', 'Khoa UC10 A');

-- 01 BCH Khoa A (BTC); 03 Văn phòng; 07 Đoàn Trường; 21 Trưởng Ban Tuyên giáo; 22 CTV Ban Tuyên giáo;
-- 23 Trưởng Ban Tổ chức – Kiểm tra (ban khác); 31 sinh viên.
insert into auth.users (id, email)
select ('b1000000-0000-4000-8000-0000000000' || n)::uuid, 'uc10-' || n || '@test.local'
from unnest(array['01','03','07','21','22','23','31']) n;
insert into public.accounts (user_id, student_code, status)
select ('b1000000-0000-4000-8000-0000000000' || n)::uuid, '20910000' || n, 'active'
from unnest(array['01','03','07','21','22','23','31']) n;
insert into public.role_grants (user_id, role_code, organization_id, reason)
select v.u::uuid, v.r, coalesce(ou.id, v.o::uuid), 'UC10 test'
from (values ('b1000000-0000-4000-8000-000000000001', 'faculty_manager', null),
             ('b1000000-0000-4000-8000-000000000003', 'office', '00000000-0000-4000-8000-000000000002'),
             ('b1000000-0000-4000-8000-000000000007', 'school_admin', '00000000-0000-4000-8000-000000000001'),
             ('b1000000-0000-4000-8000-000000000021', 'committee_manager', '00000000-0000-4000-8000-000000000004'),
             ('b1000000-0000-4000-8000-000000000022', 'collaborator', '00000000-0000-4000-8000-000000000004'),
             ('b1000000-0000-4000-8000-000000000023', 'committee_manager', '00000000-0000-4000-8000-000000000003')) v(u, r, o)
left join public.organization_units ou
  on v.o is null and ou.faculty_id = 'c1000000-0000-4000-8000-00000000000a' and ou.unit_type = 'faculty_union';

insert into public.academic_terms (id, academic_year, term_code, name, starts_on, ends_on)
values ('e1000000-0000-4000-8000-000000000001', '2032-2033', 'UC10', 'HK UC10', '2032-08-01', '2033-01-15');

-- P: sẽ được nghiệm thu. Q: hồ sơ mới nộp, chưa nghiệm thu.
insert into public.event_programs (id, owner_org_id, faculty_id, title, location, starts_at, ends_at, status, created_by, decided_at)
select v.id::uuid, ou.id, 'c1000000-0000-4000-8000-00000000000a', v.t, 'Hội trường A',
       '2032-09-01 08:00+07', '2032-09-01 17:00+07', 'approved', 'b1000000-0000-4000-8000-000000000001', now()
from (values ('a1000000-0000-4000-8000-0000000000aa', 'UC10 chương trình đã nghiệm thu'),
             ('a1000000-0000-4000-8000-0000000000bb', 'UC10 chương trình chưa nghiệm thu')) v(id, t)
join public.organization_units ou on ou.faculty_id = 'c1000000-0000-4000-8000-00000000000a' and ou.unit_type = 'faculty_union';
insert into public.program_acceptances (program_id, status, attendance_locked, submission_count, submitted_at, created_by)
select id, 'submitted', true, 1, now() - interval '1 hour', 'b1000000-0000-4000-8000-000000000001'
from public.event_programs where id::text like 'a1000000-%';

select is((select count(*)::int from public.program_publications where program_id::text like 'a1000000-%'), 0,
  'Chưa nghiệm thu thì chưa có bài chờ đăng');
-- Nghiệm thu (tương đương review_program_acceptance của UC9).
update public.program_acceptances
set status = 'accepted', decided_at = now() - interval '30 minutes', decided_by = 'b1000000-0000-4000-8000-000000000003',
    term_id = 'e1000000-0000-4000-8000-000000000001', current_snapshot_version = 1
where program_id = 'a1000000-0000-4000-8000-0000000000aa';
select is((select status from public.program_publications where program_id = 'a1000000-0000-4000-8000-0000000000aa'),
  'awaiting', 'Nghiệm thu xong → Chờ đăng bài');
select is((select action || ':' || actor_user_id from public.program_publication_revisions
           where program_id = 'a1000000-0000-4000-8000-0000000000aa'),
  'awaiting:b1000000-0000-4000-8000-000000000003', 'Lịch sử ghi mốc chờ đăng bài, người nghiệm thu');

-- Ảnh đã có trong Storage (route handler tải lên trước khi gọi RPC).
insert into storage.objects (bucket_id, name)
values ('program-publication-covers', 'a1000000-0000-4000-8000-0000000000aa/d1000000-0000-4000-8000-000000000001.jpg');

create function pg_temp.act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', ('b1000000-0000-4000-8000-0000000000' || p_user)::uuid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.act_as(text) to authenticated;
create function pg_temp.body() returns text language sql as $$
  select 'Ngày 01/09/2032, Đoàn Khoa UC10 A tổ chức chương trình tại Hội trường A với sự tham gia đông đảo của sinh viên.';
$$;
grant execute on function pg_temp.body() to authenticated;

set local role authenticated;

-- ── 1. Quyền xuất bản ────────────────────────────────────────────────────────
select pg_temp.act_as('31');
select throws_ok($$ select public.save_program_publication('a1000000-0000-4000-8000-0000000000aa', 'Tiêu đề bài viết thử', pg_temp.body(), 'manual') $$,
  'P0001', 'FORBIDDEN', 'Sinh viên không biên tập bài');
select is((select count(*)::int from public.program_publications), 0, 'Sinh viên không đọc được bản nháp');
select pg_temp.act_as('01');
select throws_ok($$ select public.save_program_publication('a1000000-0000-4000-8000-0000000000aa', 'Tiêu đề bài viết thử', pg_temp.body(), 'manual') $$,
  'P0001', 'FORBIDDEN', 'BTC (Đoàn Khoa) không biên tập bài chính thức');
select throws_ok($$ select public.publish_program_eoffice('a1000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'FORBIDDEN', 'BTC không xuất bản');
select pg_temp.act_as('03');
select throws_ok($$ select public.publish_program_eoffice('a1000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'FORBIDDEN', 'Văn phòng không xuất bản');
select pg_temp.act_as('07');
select throws_ok($$ select public.publish_program_eoffice('a1000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'FORBIDDEN', 'Đoàn Trường (school_admin) không thay Ban xuất bản');
select pg_temp.act_as('23');
select throws_ok($$ select public.save_program_publication('a1000000-0000-4000-8000-0000000000aa', 'Tiêu đề bài viết thử', pg_temp.body(), 'manual') $$,
  'P0001', 'FORBIDDEN', 'Trưởng ban khác (Tổ chức – Kiểm tra) không biên tập');

-- ── 2. Chưa nghiệm thu ───────────────────────────────────────────────────────
select pg_temp.act_as('21');
select throws_ok($$ select public.save_program_publication('a1000000-0000-4000-8000-0000000000bb', 'Tiêu đề bài viết thử', pg_temp.body(), 'manual') $$,
  'P0001', 'PROGRAM_NOT_ACCEPTED', 'Chưa nghiệm thu: Ban không lập bài');
select throws_ok($$ select public.publish_program_eoffice('a1000000-0000-4000-8000-0000000000bb') $$,
  'P0001', 'PROGRAM_NOT_ACCEPTED', 'Chưa nghiệm thu: không xuất bản');
select pg_temp.act_as('01');
select throws_ok($$ select public.submit_publication_proposal('a1000000-0000-4000-8000-0000000000bb', 'Đề xuất bài viết thử', pg_temp.body()) $$,
  'P0001', 'PROGRAM_NOT_ACCEPTED', 'Chưa nghiệm thu: Khoa chưa gửi đề xuất');

-- ── 3. Khoa đề xuất, Ban biên tập ────────────────────────────────────────────
select throws_ok($$ select public.submit_publication_proposal('a1000000-0000-4000-8000-0000000000aa', 'Khen thưởng SV 2091000031',
  pg_temp.body()) $$, 'P0001', 'CONTAINS_STUDENT_CODE', 'Đề xuất có MSSV bị chặn');
select lives_ok($$ select public.submit_publication_proposal('a1000000-0000-4000-8000-0000000000aa', 'Đề xuất: Ngày hội UC10 thành công',
  pg_temp.body(), 'uc10-proposal') $$, 'BTC gửi nội dung đề xuất');
select is((select count(*)::int from public.program_publications), 1, 'BTC đọc được bài của chương trình mình');
select pg_temp.act_as('21');
select throws_ok($$ select public.publish_program_eoffice('a1000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'MISSING_PUBLICATION_DATA:title,body,cover', 'Bài trống: báo thiếu tiêu đề, nội dung, ảnh');
select is(public.save_program_publication('a1000000-0000-4000-8000-0000000000aa', 'Ngày hội UC10 thành công tốt đẹp', pg_temp.body(),
  'proposal', (select id from public.program_publication_proposals limit 1), null, 'uc10-save'), 1, 'Ban dùng bản đề xuất làm bản nháp');
select throws_ok($$ select public.save_program_publication('a1000000-0000-4000-8000-0000000000aa', 'Ngày hội UC10 thành công tốt đẹp',
  pg_temp.body() || ' Danh sách: 2091000031, 2091000022.', 'manual') $$, 'P0001', 'CONTAINS_STUDENT_CODE', 'Nội dung có MSSV bị chặn');
select throws_ok($$ select public.publish_program_eoffice('a1000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'MISSING_PUBLICATION_DATA:cover', 'Thiếu ảnh đại diện thì chưa xuất bản');
select throws_ok($$ select public.set_program_publication_cover('a1000000-0000-4000-8000-0000000000aa',
  'a1000000-0000-4000-8000-0000000000aa/d1000000-0000-4000-8000-000000000009.jpg', 'image/jpeg') $$,
  'P0001', 'DOCUMENT_NOT_UPLOADED', 'Ảnh chưa vào Storage thì không gắn');
select is(public.set_program_publication_cover('a1000000-0000-4000-8000-0000000000aa',
  'a1000000-0000-4000-8000-0000000000aa/d1000000-0000-4000-8000-000000000001.jpg', 'image/jpeg'), 2, 'Ban gắn ảnh đại diện');
select throws_ok($$ select public.complete_program_publication('a1000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'MISSING_PUBLICATION_DATA:eoffice,facebook_url,facebook_posted_at', 'Chưa đăng E-Office/Facebook thì chưa Đã đăng bài');

-- ── 4. Xuất bản E-Office (CTV của Ban) ───────────────────────────────────────
select pg_temp.act_as('22');
select lives_ok($$ select public.publish_program_eoffice('a1000000-0000-4000-8000-0000000000aa', 'uc10-publish') $$,
  'CTV Ban Tuyên giáo xuất bản bài E-Office');
select throws_ok($$ select public.publish_program_eoffice('a1000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'ALREADY_PUBLISHED', 'Không xuất bản lặp');
select is((select eoffice_path from public.program_publications where program_id = 'a1000000-0000-4000-8000-0000000000aa'), '/news/a1000000-0000-4000-8000-0000000000aa', 'Lưu URL bài E-Office');
select is((select status from public.program_publications where program_id = 'a1000000-0000-4000-8000-0000000000aa'), 'awaiting', 'Mới lên E-Office: chưa Đã đăng bài');
select throws_ok($$ select public.save_program_publication('a1000000-0000-4000-8000-0000000000aa', 'Ngày hội UC10 thành công rực rỡ',
  pg_temp.body(), 'manual') $$, 'P0001', 'REASON_REQUIRED', 'Sửa sau khi lên E-Office phải có lý do');
select is(public.save_program_publication('a1000000-0000-4000-8000-0000000000aa', 'Ngày hội UC10 thành công rực rỡ',
  pg_temp.body(), 'manual', null, 'Sửa tiêu đề theo góp ý của Ban'), 4, 'Sửa có lý do, tăng phiên bản');

-- ── 5. Facebook ──────────────────────────────────────────────────────────────
select throws_ok($$ select public.complete_program_publication('a1000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'MISSING_PUBLICATION_DATA:facebook_url,facebook_posted_at', 'Thiếu URL Facebook thì chưa Đã đăng bài');
select throws_ok($$ select public.record_program_facebook_post('a1000000-0000-4000-8000-0000000000aa', '  ', now()) $$,
  'P0001', 'FACEBOOK_URL_REQUIRED', 'URL Facebook trống bị chặn');
select throws_ok($$ select public.record_program_facebook_post('a1000000-0000-4000-8000-0000000000aa', 'https://example.com/post/1', now()) $$,
  'P0001', 'INVALID_FACEBOOK_URL', 'URL không phải Facebook bị chặn');
select throws_ok($$ select public.record_program_facebook_post('a1000000-0000-4000-8000-0000000000aa',
  'https://www.facebook.com/doantruong/posts/1', now() + interval '1 day') $$, 'P0001', 'FACEBOOK_TIME_IN_FUTURE', 'Thời gian đăng ở tương lai bị chặn');
select throws_ok($$ select public.record_program_facebook_post('a1000000-0000-4000-8000-0000000000aa',
  'https://www.facebook.com/doantruong/posts/1', now() - interval '2 days') $$, 'P0001', 'FACEBOOK_TIME_BEFORE_ACCEPTANCE',
  'Thời gian đăng trước khi nghiệm thu bị chặn');
select lives_ok($$ select public.record_program_facebook_post('a1000000-0000-4000-8000-0000000000aa',
  'https://www.facebook.com/doantruong/posts/1', now() - interval '5 minutes') $$, 'Ban nhập URL và thời gian bài Facebook');
select lives_ok($$ select public.complete_program_publication('a1000000-0000-4000-8000-0000000000aa', 'uc10-complete') $$,
  'Đủ dữ liệu → Đã đăng bài');
select is((select status from public.program_publications where program_id = 'a1000000-0000-4000-8000-0000000000aa'), 'published', 'Trạng thái Đã đăng bài');
select throws_ok($$ select public.complete_program_publication('a1000000-0000-4000-8000-0000000000aa') $$,
  'P0001', 'PUBLICATION_COMPLETED', 'Không hoàn tất lặp');
select pg_temp.act_as('01');
select throws_ok($$ select public.submit_publication_proposal('a1000000-0000-4000-8000-0000000000aa', 'Đề xuất bổ sung sau khi đăng',
  pg_temp.body()) $$, 'P0001', 'PUBLICATION_COMPLETED', 'Đã đăng bài: Khoa không gửi thêm đề xuất');

-- ── 6. Lịch sử ───────────────────────────────────────────────────────────────
select pg_temp.act_as('03');
select is(array(select action from public.program_publication_revisions
                where program_id = 'a1000000-0000-4000-8000-0000000000aa' order by id),
  array['awaiting', 'proposal_submitted', 'draft_saved', 'cover_set', 'eoffice_published', 'edited_after_publish',
        'facebook_recorded', 'completed'], 'Văn phòng xem đủ lịch sử biên tập, đúng thứ tự');
select is((select reason from public.program_publication_revisions where action = 'edited_after_publish'),
  'Sửa tiêu đề theo góp ý của Ban', 'Lịch sử giữ lý do sửa');
reset role;
select throws_ok($$ update public.program_publication_revisions set title = 'x' where program_id = 'a1000000-0000-4000-8000-0000000000aa' $$,
  'P0001', 'APPEND_ONLY', 'Lịch sử chỉ thêm, không sửa');

-- ── 7. Cổng công khai ────────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '', true);
select is((select title from public.public_program_posts('a1000000-0000-4000-8000-0000000000aa')),
  'Ngày hội UC10 thành công rực rỡ', 'Khách (chưa đăng nhập) đọc được bài đã xuất bản');
select throws_ok($$ select count(*) from public.program_publications $$, '42501', null, 'Khách không đọc bảng bản nháp');
reset role;
select is(
  (select array_agg(n order by n) from pg_proc p, unnest(p.proargnames) n
   where p.proname = 'public_program_posts' and n <> 'p_program_id'),
  array['body', 'facebook_url', 'has_cover', 'location', 'organization_name', 'program_id', 'program_starts_at',
        'published_at', 'title', 'updated_at'],
  'Cổng công khai không có cột MSSV, điểm danh, hồ sơ hay uy tín');

select * from finish();
rollback;
