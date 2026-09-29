alter table public.faculties alter column current_code drop not null;
alter table public.faculty_versions alter column code drop not null;
alter table public.programs alter column current_code drop not null;
alter table public.program_versions alter column code drop not null;

create or replace function public.import_academic_catalog(
  p_rows jsonb,
  p_file_name text,
  p_file_sha256 text,
  p_dry_run boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_faculty_id uuid;
  v_program_id uuid;
  v_cohort_id uuid;
  v_class_id uuid;
  v_conflicts jsonb := '[]'::jsonb;
  v_row_count integer := jsonb_array_length(p_rows);
  v_effective date := current_date;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'ROWS_MUST_BE_ARRAY'; end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if coalesce(btrim(v_row->>'Khoa'), '') = '' or coalesce(btrim(v_row->>'Ngành'), '') = ''
      or coalesce(btrim(v_row->>'Lớp'), '') = '' or coalesce(btrim(v_row->>'Khóa'), '') = '' then
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('stt', v_row->>'STT', 'reason', 'Thiếu Khoa/Ngành/Lớp/Khóa'));
      continue;
    end if;
    if exists (
      select 1 from public.classes c
      join public.class_versions cv on cv.class_id = c.id and cv.valid_during @> current_date
      join public.program_versions pv on pv.program_id = cv.program_id and pv.valid_during @> current_date
      join public.faculty_versions fv on fv.faculty_id = pv.faculty_id and fv.valid_during @> current_date
      join public.cohorts ch on ch.id = cv.cohort_id
      where cv.code = v_row->>'Lớp'
        and (pv.name <> v_row->>'Ngành' or fv.name <> v_row->>'Khoa' or ch.code <> v_row->>'Khóa')
    ) then
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
        'stt', v_row->>'STT', 'class', v_row->>'Lớp',
        'reason', 'Lớp đã tồn tại với quan hệ Khoa/Ngành/Khóa khác; cần xử lý thủ công'
      ));
    end if;
  end loop;

  insert into public.catalog_import_batches(file_name, file_sha256, row_count, dry_run, conflict_report)
  values (p_file_name, p_file_sha256, v_row_count, p_dry_run, v_conflicts);

  if p_dry_run then
    return jsonb_build_object('rowCount', v_row_count, 'conflicts', v_conflicts, 'applied', false);
  end if;
  if jsonb_array_length(v_conflicts) > 0 then raise exception 'IMPORT_HAS_CONFLICTS'; end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    select f.id into v_faculty_id from public.faculties f
      join public.faculty_versions fv on fv.faculty_id = f.id and fv.valid_during @> v_effective
      where fv.name = v_row->>'Khoa' limit 1;
    if v_faculty_id is null then
      v_faculty_id := gen_random_uuid();
      insert into public.faculties(id, current_code, current_name, source_order)
      values (v_faculty_id, null, v_row->>'Khoa', nullif(v_row->>'Thứ tự khoa','')::integer);
      insert into public.faculty_versions(faculty_id, code, name, source_order, valid_during, changed_reason)
      values (v_faculty_id, null, v_row->>'Khoa', nullif(v_row->>'Thứ tự khoa','')::integer,
        daterange(v_effective, null, '[)'), 'Import danh mục gốc');
    end if;

    insert into public.cohorts(code, display_name) values (v_row->>'Khóa', v_row->>'Khóa')
      on conflict (code) do update set display_name = excluded.display_name
      returning id into v_cohort_id;

    select p.id into v_program_id from public.programs p
      join public.program_versions pv on pv.program_id = p.id and pv.valid_during @> v_effective
      where pv.name = v_row->>'Ngành' and pv.faculty_id = v_faculty_id limit 1;
    if v_program_id is null then
      v_program_id := gen_random_uuid();
      insert into public.programs(id, current_code, current_name, current_faculty_id)
      values (v_program_id, null, v_row->>'Ngành', v_faculty_id);
      insert into public.program_versions(program_id, faculty_id, code, name, valid_during, changed_reason)
      values (v_program_id, v_faculty_id, null, v_row->>'Ngành', daterange(v_effective, null, '[)'), 'Import danh mục gốc');
    end if;

    select c.id into v_class_id from public.classes c where c.current_code = v_row->>'Lớp';
    if v_class_id is null then
      v_class_id := gen_random_uuid();
      insert into public.classes(id, current_code, current_name, current_program_id, current_cohort_id, source_number)
      values (v_class_id, v_row->>'Lớp', v_row->>'Lớp', v_program_id, v_cohort_id, nullif(v_row->>'Số hiệu',''));
      insert into public.class_versions(class_id, program_id, cohort_id, code, name, source_number, valid_during, changed_reason)
      values (v_class_id, v_program_id, v_cohort_id, v_row->>'Lớp', v_row->>'Lớp', nullif(v_row->>'Số hiệu',''),
        daterange(v_effective, null, '[)'), 'Import danh mục gốc');
    end if;
  end loop;

  return jsonb_build_object('rowCount', v_row_count, 'conflicts', v_conflicts, 'applied', true);
exception
  when unique_violation then
    if sqlerrm like '%catalog_import_batches_applied_file%' then raise exception 'FILE_ALREADY_APPLIED'; end if;
    raise;
end;
$$;

revoke all on function public.import_academic_catalog(jsonb, text, text, boolean) from public, anon, authenticated;
grant execute on function public.import_academic_catalog(jsonb, text, text, boolean) to service_role;

comment on function public.import_academic_catalog is 'Atomic, rerunnable CSV import. Never deletes rows absent from a later file.';
