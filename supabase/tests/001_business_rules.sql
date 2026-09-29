begin;
select plan(9);

select ok(public.is_valid_student_code('0123456789', date '2026-09-29'), 'MSSV 10 digits keeps leading zero');
select isnt(public.is_valid_student_code('01234567890', date '2026-09-29'), true, '11-digit MSSV is rejected today');
select isnt(public.is_valid_student_code('A123456789', date '2026-09-29'), true, 'non-digit MSSV is rejected');

select lives_ok(
  $$select public.import_academic_catalog(
    '[{"STT":"1","Khoa":"Khoa Kiểm thử","Ngành":"Ngành Kiểm thử","Lớp":"00TEST0001","Khóa":"2026","Số hiệu":"001","Thứ tự khoa":"1"}]'::jsonb,
    'catalog-test.csv', 'test-sha-1', false
  )$$,
  'first catalog import applies'
);
select is((select count(*) from public.classes where current_code = '00TEST0001'), 1::bigint, 'import creates one immutable class');
select throws_ok(
  $$select public.import_academic_catalog(
    '[{"STT":"1","Khoa":"Khoa Kiểm thử","Ngành":"Ngành Kiểm thử","Lớp":"00TEST0001","Khóa":"2026","Số hiệu":"001","Thứ tự khoa":"1"}]'::jsonb,
    'catalog-test.csv', 'test-sha-1', false
  )$$,
  'P0001', 'FILE_ALREADY_APPLIED', 'same applied file cannot be applied twice'
);
select is((select count(*) from public.classes where current_code = '00TEST0001'), 1::bigint, 'rerun does not duplicate class');
select is((select count(*) from public.organization_units where class_id = (select id from public.classes where current_code='00TEST0001')), 1::bigint, 'class import creates one Chi đoàn scope');
select is((select count(*) from public.organization_units where faculty_id is not null and name='Đoàn Khoa Khoa Kiểm thử'), 1::bigint, 'faculty import creates one Đoàn Khoa scope');

select * from finish();
rollback;
