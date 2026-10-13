-- pgTAP: mẫu Cảm tình Đoàn được tạo khi bootstrap, idempotent, không mở cho client.
begin;
select plan(5);

insert into auth.users (id, email) values ('dddddddd-0000-4000-8000-000000000001', 'seed0000001@student.hiu.vn');
insert into public.accounts (user_id, student_code, status) values ('dddddddd-0000-4000-8000-000000000001', '2070000001', 'active');

select is(public.seed_camtinh_doan_template('dddddddd-0000-4000-8000-000000000001'),
  'f0000000-c45d-0000-0000-000000000001'::uuid, 'seed trả về id mẫu cố định');
select is(public.seed_camtinh_doan_template('dddddddd-0000-4000-8000-000000000001'),
  'f0000000-c45d-0000-0000-000000000001'::uuid, 'gọi lần hai không lỗi');
select is((select count(*)::int from public.form_templates where id = 'f0000000-c45d-0000-0000-000000000001'), 1,
  'không tạo mẫu trùng');
select is((select jsonb_array_length(questions) from public.form_template_versions
           where id = 'f0000000-c45d-0000-0000-000000000002'), 19, 'phiên bản 1 có 19 câu hỏi');

set local role authenticated;
select throws_ok($$ select public.seed_camtinh_doan_template('dddddddd-0000-4000-8000-000000000001') $$,
  '42501', null, 'authenticated không gọi được hàm seed');

select * from finish();
rollback;
