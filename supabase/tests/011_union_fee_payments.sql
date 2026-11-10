-- Final Project (#81): Đoàn phí theo tháng, đóng gộp năm qua cổng thanh toán.
-- RED: mọi đối tượng mới được gọi qua SQL động để toàn bộ assertion vẫn chạy khi chưa có migration.
begin;
\ir helpers/organization_login.inc
select plan(44);

create function pg_temp.val(p_sql text) returns text language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  return v;
exception when others then
  return 'ERROR: ' || sqlerrm;
end;
$$;

create function pg_temp.setup(p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
exception when others then
  null;
end;
$$;

create temp table payment_ctx(k text primary key, v text);
grant all on payment_ctx to authenticated, service_role;
create function pg_temp.c(p_key text) returns text language sql as $$
  select v from payment_ctx where k = p_key
$$;
grant execute on function pg_temp.c(text) to authenticated, service_role;

-- Hai Khoa, ba lớp và bốn sinh viên giả để kiểm tra đúng phạm vi Khoa/lớp.
insert into public.faculties(id, current_code, current_name) values
  ('f1100000-0000-4000-8000-000000000001', 'PAYF1', 'Khoa Thanh toán Một'),
  ('f1100000-0000-4000-8000-000000000002', 'PAYF2', 'Khoa Thanh toán Hai');
insert into public.programs(id, current_code, current_name, current_faculty_id) values
  ('f1200000-0000-4000-8000-000000000001', 'PAYP1', 'Ngành Thanh toán Một', 'f1100000-0000-4000-8000-000000000001'),
  ('f1200000-0000-4000-8000-000000000002', 'PAYP2', 'Ngành Thanh toán Hai', 'f1100000-0000-4000-8000-000000000002');
insert into public.cohorts(id, code, display_name) values
  ('f1300000-0000-4000-8000-000000000001', 'PAYK26', 'Khóa Thanh toán 2026');
insert into public.classes(id, current_code, current_name, current_program_id, current_cohort_id) values
  ('f1400000-0000-4000-8000-000000000001', '99PAY01', 'Lớp Thanh toán 1', 'f1200000-0000-4000-8000-000000000001', 'f1300000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000002', '99PAY02', 'Lớp Thanh toán 2', 'f1200000-0000-4000-8000-000000000001', 'f1300000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000003', '99PAY03', 'Lớp Thanh toán 3', 'f1200000-0000-4000-8000-000000000002', 'f1300000-0000-4000-8000-000000000001');
insert into public.faculty_versions(faculty_id, code, name, valid_during, changed_reason) values
  ('f1100000-0000-4000-8000-000000000001', 'PAYF1', 'Khoa Thanh toán Một', '[2026-01-01,)', 'Kiểm thử thanh toán'),
  ('f1100000-0000-4000-8000-000000000002', 'PAYF2', 'Khoa Thanh toán Hai', '[2026-01-01,)', 'Kiểm thử thanh toán');
insert into public.program_versions(program_id, faculty_id, code, name, valid_during, changed_reason) values
  ('f1200000-0000-4000-8000-000000000001', 'f1100000-0000-4000-8000-000000000001', 'PAYP1', 'Ngành Thanh toán Một', '[2026-01-01,)', 'Kiểm thử thanh toán'),
  ('f1200000-0000-4000-8000-000000000002', 'f1100000-0000-4000-8000-000000000002', 'PAYP2', 'Ngành Thanh toán Hai', '[2026-01-01,)', 'Kiểm thử thanh toán');
insert into public.class_versions(class_id, program_id, cohort_id, code, name, valid_during, changed_reason) values
  ('f1400000-0000-4000-8000-000000000001', 'f1200000-0000-4000-8000-000000000001', 'f1300000-0000-4000-8000-000000000001', '99PAY01', 'Lớp Thanh toán 1', '[2026-01-01,)', 'Kiểm thử thanh toán'),
  ('f1400000-0000-4000-8000-000000000002', 'f1200000-0000-4000-8000-000000000001', 'f1300000-0000-4000-8000-000000000001', '99PAY02', 'Lớp Thanh toán 2', '[2026-01-01,)', 'Kiểm thử thanh toán'),
  ('f1400000-0000-4000-8000-000000000003', 'f1200000-0000-4000-8000-000000000002', 'f1300000-0000-4000-8000-000000000001', '99PAY03', 'Lớp Thanh toán 3', '[2026-01-01,)', 'Kiểm thử thanh toán');

insert into auth.users(id, email) values
  ('f1500000-0000-4000-8000-000000000001', 'manager1@test.local'),
  ('f1500000-0000-4000-8000-000000000002', 'student1@test.local'),
  ('f1500000-0000-4000-8000-000000000003', 'student2@test.local'),
  ('f1500000-0000-4000-8000-000000000004', 'student3@test.local'),
  ('f1500000-0000-4000-8000-000000000005', 'manager2@test.local');
insert into public.accounts(user_id, student_code, status) values
  ('f1500000-0000-4000-8000-000000000001', '9991100001', 'active'),
  ('f1500000-0000-4000-8000-000000000002', '9991100002', 'active'),
  ('f1500000-0000-4000-8000-000000000003', '9991100003', 'active'),
  ('f1500000-0000-4000-8000-000000000004', '9991100004', 'active'),
  ('f1500000-0000-4000-8000-000000000005', '9991100005', 'active');
insert into public.student_profiles(user_id, full_name, gender, phone, class_id) values
  ('f1500000-0000-4000-8000-000000000002', 'Sinh viên Thanh toán Một', 'female', '0900000002', 'f1400000-0000-4000-8000-000000000001'),
  ('f1500000-0000-4000-8000-000000000003', 'Sinh viên Thanh toán Hai', 'male', '0900000003', 'f1400000-0000-4000-8000-000000000002'),
  ('f1500000-0000-4000-8000-000000000004', 'Sinh viên Khoa Khác', 'female', '0900000004', 'f1400000-0000-4000-8000-000000000003');

insert into payment_ctx
select 'org1', id::text from public.organization_units where faculty_id = 'f1100000-0000-4000-8000-000000000001'
union all
select 'org2', id::text from public.organization_units where faculty_id = 'f1100000-0000-4000-8000-000000000002';
insert into public.role_grants(user_id, role_code, organization_id, reason) values
  ('f1500000-0000-4000-8000-000000000001', 'faculty_manager', pg_temp.c('org1')::uuid, 'Kiểm thử thanh toán'),
  ('f1500000-0000-4000-8000-000000000005', 'faculty_manager', pg_temp.c('org2')::uuid, 'Kiểm thử thanh toán');
select pg_temp.cr01_setup_organization_logins();

-- Cấu trúc và ràng buộc mức thu.
update public.feature_flags set enabled = false where key = 'PAYMENT_ENABLED';
select is(pg_temp.val($$ select enabled::text from public.feature_flags where key = 'PAYMENT_ENABLED' $$),
  'false', 'YC4: PAYMENT_ENABLED tồn tại và mặc định tắt');
select has_table('public', 'union_fee_campaigns', 'có bảng khoản thu Đoàn phí theo năm');
select has_table('public', 'union_fee_orders', 'có bảng đơn thanh toán');
select has_table('public', 'union_fee_month_payments', 'có bảng đối chiếu từng tháng');
select throws_ok(format($$ insert into public.union_fee_campaigns(organization_id, calendar_year, monthly_amount)
  values (%L, 2040, 3000) $$, pg_temp.c('org1')), '23514', null,
  'database từ chối mức ngoài bốn giá trị');
select lives_ok(format($$ insert into public.union_fee_campaigns(organization_id, calendar_year, monthly_amount) values
  (%1$L, 2041, 2000), (%1$L, 2042, 5000), (%1$L, 2043, 10000), (%1$L, 2044, 20000) $$,
  pg_temp.c('org1')), 'database nhận đúng bốn mức Trung ương');
select is(pg_temp.val($$ select count(distinct monthly_amount)::text from public.union_fee_campaigns where calendar_year between 2041 and 2044 $$),
  '4', 'bốn mức được lưu nguyên vẹn');
select is(pg_temp.val($$ select min(monthly_amount)::text || '/' || max(monthly_amount)::text from public.union_fee_campaigns where calendar_year between 2041 and 2044 $$),
  '2000/20000', 'biên nhỏ nhất/lớn nhất là 2.000/20.000');
select is(pg_temp.val($$ select count(*)::text from public.union_fee_campaigns where monthly_amount not in (2000,5000,10000,20000) $$),
  '0', 'không có mức ngoài danh sách');

set local role authenticated;
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000001', pg_temp.c('org1')::uuid);
select is(pg_temp.val($$ select public.create_union_fee_campaign(2026, 2000, 'flag-off')::text $$),
  'ERROR: PAYMENT_DISABLED', 'công tắc tắt chặn tạo khoản thu');
reset role;
update public.feature_flags set enabled = true where key = 'PAYMENT_ENABLED';
set local role authenticated;

select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000002', null);
select is(pg_temp.val($$ select public.create_union_fee_campaign(2026, 2000, 'student')::text $$),
  'ERROR: FORBIDDEN', 'sinh viên không tạo khoản thu');

select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000001', pg_temp.c('org1')::uuid);
select pg_temp.setup($$ insert into payment_ctx values ('campaign2026', public.create_union_fee_campaign(2026, 2000, 'campaign-create')::text) $$);
select ok(pg_temp.c('campaign2026') ~ '^[0-9a-f-]{36}$', 'Đoàn Khoa tạo khoản thu năm cho Khoa mình');
select is(pg_temp.val(format($$ select monthly_amount::text from public.union_fee_campaigns where id = %L $$, pg_temp.c('campaign2026'))),
  '2000', 'một mức áp dụng cho cả Khoa');
select is(pg_temp.val($$ select public.create_union_fee_campaign(2026, 5000, 'duplicate')::text $$),
  'ERROR: CAMPAIGN_ALREADY_EXISTS', 'mỗi Khoa chỉ có một khoản thu cho một năm');
select is(pg_temp.val(format($$ select count(*)::text from public.audit_events where action = 'union_fee.campaign_created' and target_id = %L $$, pg_temp.c('campaign2026'))),
  '1', 'tạo khoản thu có audit');

select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000002', null);
select is(pg_temp.val(format($$ select count(*)::text from public.union_fee_campaigns where id = %L $$, pg_temp.c('campaign2026'))),
  '1', 'sinh viên thấy khoản phải đóng của Khoa mình');
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000004', null);
select is(pg_temp.val(format($$ select count(*)::text from public.union_fee_campaigns where id = %L $$, pg_temp.c('campaign2026'))),
  '0', 'sinh viên Khoa khác không thấy khoản thu');

-- Đơn thanh toán: số tiền phải do database tính 2.000 × 12.
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000002', null);
select pg_temp.setup(format($$ insert into payment_ctx values ('order1', public.create_union_fee_order(%L, 'order-create')::text) $$, pg_temp.c('campaign2026')));
select ok(pg_temp.c('order1') ~ '^[0-9a-f-]{36}$', 'sinh viên tạo được đơn thanh toán cho chính mình');
select is(pg_temp.val(format($$ select amount::text from public.union_fee_orders where id = %L $$, pg_temp.c('order1'))),
  '24000', 'database tính số tiền bằng mức tháng × 12');
select pg_temp.setup(format($$ insert into payment_ctx select 'order_ref1', order_ref from public.union_fee_orders where id = %L $$, pg_temp.c('order1')));

select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000004', null);
select is(pg_temp.val(format($$ select public.create_union_fee_order(%L, 'wrong-faculty')::text $$, pg_temp.c('campaign2026'))),
  'ERROR: FORBIDDEN', 'sinh viên Khoa khác không tạo đơn');
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000003', null);
select is(pg_temp.val(format($$ select count(*)::text from public.union_fee_orders where id = %L $$, pg_temp.c('order1'))),
  '0', 'sinh viên khác không đọc được đơn qua RLS');

-- IPN chạy bằng service_role; Return URL không có RPC ghi nào khác.
reset role;
set local role service_role;
select is(pg_temp.val($$ select public.record_union_fee_ipn('UF-NOT-FOUND', 24000, '15000999', '00', '00', now(), 'unknown') $$),
  '01', 'mã đơn không tồn tại trả RspCode 01');
select is(pg_temp.val(format($$ select public.record_union_fee_ipn(%L, 60000, '15000001', '00', '00', now(), 'amount-mismatch') $$, pg_temp.c('order_ref1'))),
  '04', 'số tiền khác mức × 12 trả RspCode 04');
select is(pg_temp.val(format($$ select status from public.union_fee_orders where id = %L $$, pg_temp.c('order1'))),
  'pending', 'sai số tiền không ghi nhận đã đóng');
select is(pg_temp.val(format($$ select public.record_union_fee_ipn(%L, 24000, '15000001', '00', '00', '2026-11-11 06:00+07', 'success') $$, pg_temp.c('order_ref1'))),
  '00', 'IPN hợp lệ ghi nhận thành công');
select is(pg_temp.val(format($$ select status || '/' || transaction_ref from public.union_fee_orders where id = %L $$, pg_temp.c('order1'))),
  'paid/15000001', 'đơn lưu trạng thái và mã giao dịch');
select is(pg_temp.val(format($$ select count(*)::text from public.union_fee_month_payments where order_id = %L $$, pg_temp.c('order1'))),
  '12', 'thành công ghi đủ 12 tháng');
select is(pg_temp.val(format($$ select min(month_number)::text || '/' || max(month_number)::text from public.union_fee_month_payments where order_id = %L $$, pg_temp.c('order1'))),
  '1/12', 'đối chiếu lưu riêng tháng 1 đến tháng 12');
select is(pg_temp.val(format($$ select public.record_union_fee_ipn(%L, 24000, '15000001', '00', '00', '2026-11-11 06:00+07', 'repeat') $$, pg_temp.c('order_ref1'))),
  '02', 'IPN lặp trả RspCode 02');
select is(pg_temp.val(format($$ select count(*)::text from public.union_fee_month_payments where order_id = %L $$, pg_temp.c('order1'))),
  '12', 'IPN lặp không ghi trùng tháng');

set local role authenticated;
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000002', null);
select is(pg_temp.val(format($$ select public.create_union_fee_order(%L, 'duplicate-paid')::text $$, pg_temp.c('campaign2026'))),
  'ERROR: ALREADY_PAID', 'đã đóng cả năm thì không cho đóng trùng');

-- Giao dịch hủy cho phép tạo đơn mới.
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000001', pg_temp.c('org1')::uuid);
select pg_temp.setup($$ insert into payment_ctx values ('campaign2027', public.create_union_fee_campaign(2027, 5000, 'retry-campaign')::text) $$);
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000002', null);
select pg_temp.setup(format($$ insert into payment_ctx values ('cancelled_order', public.create_union_fee_order(%L, 'cancelled-order')::text) $$, pg_temp.c('campaign2027')));
select pg_temp.setup(format($$ insert into payment_ctx select 'cancelled_ref', order_ref from public.union_fee_orders where id = %L $$, pg_temp.c('cancelled_order')));
reset role;
set local role service_role;
select is(pg_temp.val(format($$ select public.record_union_fee_ipn(%L, 60000, '15000002', '24', '11', now(), 'cancelled') $$, pg_temp.c('cancelled_ref'))),
  '00', 'IPN giao dịch hủy được ghi nhận và kết thúc retry phía VNPay');
select is(pg_temp.val(format($$ select status from public.union_fee_orders where id = %L $$, pg_temp.c('cancelled_order'))),
  'cancelled', 'mã 24/11 lưu trạng thái hủy');
set local role authenticated;
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000002', null);
select ok(pg_temp.val(format($$ select public.create_union_fee_order(%L, 'retry-after-cancel')::text $$, pg_temp.c('campaign2027'))) ~ '^[0-9a-f-]{36}$',
  'giao dịch hủy cho thanh toán lại bằng đơn mới');

-- Báo cáo Khoa, lọc lớp, audit và tương thích hồ sơ Đoàn viên.
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000001', pg_temp.c('org1')::uuid);
select is(pg_temp.val(format($$ select count(*)::text from public.faculty_union_fee_report(%L, null) $$, pg_temp.c('campaign2026'))),
  '2', 'Đoàn Khoa thấy danh sách đủ sinh viên của Khoa');
select is(pg_temp.val(format($$ select count(*) filter (where paid_months = 12)::text || '/' || count(*) filter (where paid_months = 0)::text from public.faculty_union_fee_report(%L, null) $$, pg_temp.c('campaign2026'))),
  '1/1', 'danh sách phân biệt đã đóng/chưa đóng');
select is(pg_temp.val(format($$ select string_agg(class_code, ',') from public.faculty_union_fee_report(%L, 'f1400000-0000-4000-8000-000000000001') $$, pg_temp.c('campaign2026'))),
  '99PAY01', 'lọc danh sách theo lớp đóng vai trò Chi đoàn');
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000005', pg_temp.c('org2')::uuid);
select is(pg_temp.val(format($$ select count(*)::text from public.faculty_union_fee_report(%L, null) $$, pg_temp.c('campaign2026'))),
  'ERROR: FORBIDDEN', 'Đoàn Khoa khác không xem báo cáo');
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000003', null);
select lives_ok($$ select public.save_student_profile('Sinh viên Thanh toán Hai', 'male', '0900000003', 'f1400000-0000-4000-8000-000000000002') $$,
  'chưa đóng không chặn cập nhật hồ sơ Đoàn viên');
reset role;
select is(pg_temp.val($$ select count(*)::text from public.audit_events where action = 'union_fee.order_created' $$),
  '3', 'mọi lần tạo đơn đều có audit');
select is(pg_temp.val($$ select count(*)::text from public.audit_events where action in ('union_fee.payment_paid','union_fee.payment_cancelled') $$),
  '2', 'IPN thành công hoặc hủy đều có audit');

update public.feature_flags set enabled = false where key = 'PAYMENT_ENABLED';
set local role authenticated;
select pg_temp.cr01_login_as('f1500000-0000-4000-8000-000000000003', null);
select is(pg_temp.val(format($$ select public.create_union_fee_order(%L, 'flag-off-order')::text $$, pg_temp.c('campaign2026'))),
  'ERROR: PAYMENT_DISABLED', 'công tắc tắt chặn thanh toán và hệ thống còn lại vẫn hoạt động');
select throws_ok(format($$ insert into public.union_fee_orders(campaign_id, student_user_id, order_ref, amount)
  values (%L, 'f1500000-0000-4000-8000-000000000003', 'DIRECT', 24000) $$, pg_temp.c('campaign2026')),
  '42501', null, 'authenticated không chèn trực tiếp đơn thanh toán');
select throws_ok(format($$ update public.union_fee_orders set status = 'paid' where id = %L $$, pg_temp.c('order1')),
  '42501', null, 'authenticated không sửa trực tiếp trạng thái thanh toán');

select * from finish();
rollback;
