alter table public.classes
  add column if not exists education_level text,
  add column if not exists training_type text;

alter table public.class_versions
  add column if not exists education_level text,
  add column if not exists training_type text;

create or replace view public.current_academic_catalog
with (security_invoker = true)
as
select
  c.id as class_id,
  cv.code as class_code,
  cv.name as class_name,
  cv.is_active as class_is_active,
  ch.id as cohort_id,
  ch.code as cohort_code,
  ch.display_name as cohort_name,
  p.id as program_id,
  pv.code as program_code,
  pv.name as program_name,
  pv.is_active as program_is_active,
  f.id as faculty_id,
  fv.code as faculty_code,
  fv.name as faculty_name,
  fv.is_active as faculty_is_active,
  fv.source_order,
  cv.education_level,
  cv.training_type
from public.classes c
join public.class_versions cv on cv.class_id = c.id and cv.valid_during @> current_date
join public.cohorts ch on ch.id = cv.cohort_id
join public.programs p on p.id = cv.program_id
join public.program_versions pv on pv.program_id = p.id and pv.valid_during @> current_date
join public.faculties f on f.id = pv.faculty_id
join public.faculty_versions fv on fv.faculty_id = f.id and fv.valid_during @> current_date;

create or replace function public.import_academic_catalog_v2(
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
  v_row_count integer;
  v_line_number integer;
  v_faculty_name text;
  v_program_name text;
  v_cohort_code text;
  v_class_code text;
  v_education_level text;
  v_training_type text;
  v_faculty_id uuid;
  v_program_id uuid;
  v_cohort_id uuid;
  v_class_id uuid;
  v_current_faculty_name text;
  v_current_program_name text;
  v_current_cohort_code text;
  v_current_class_version public.class_versions%rowtype;
  v_match_count integer;
  v_seen_class_codes text[] := array[]::text[];
  v_conflicts jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_effective date := current_date;
  v_faculty_inserted integer := 0;
  v_program_inserted integer := 0;
  v_cohort_inserted integer := 0;
  v_class_inserted integer := 0;
  v_class_updated integer := 0;
  v_was_inserted boolean;
  v_result jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'ROWS_MUST_BE_ARRAY';
  end if;
  v_row_count := jsonb_array_length(p_rows);

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_line_number := case
      when coalesce(v_row->>'lineNumber', '') ~ '^[0-9]+$' then (v_row->>'lineNumber')::integer
      else null
    end;
    v_faculty_name := v_row->>'facultyName';
    v_program_name := v_row->>'programName';
    v_cohort_code := v_row->>'cohortCode';
    v_class_code := v_row->>'classCode';
    v_education_level := v_row->>'educationLevel';
    v_training_type := v_row->>'trainingType';

    if v_line_number is null
      or coalesce(btrim(v_faculty_name), '') = ''
      or coalesce(btrim(v_program_name), '') = ''
      or coalesce(btrim(v_cohort_code), '') = ''
      or coalesce(btrim(v_class_code), '') = ''
      or coalesce(btrim(v_education_level), '') = ''
      or coalesce(btrim(v_training_type), '') = '' then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'lineNumber', v_line_number,
        'classCode', v_class_code,
        'code', 'MISSING_REQUIRED_VALUE',
        'message', 'Thiếu số dòng hoặc một giá trị bắt buộc trong 6 cột nguồn.'
      ));
      continue;
    end if;

    if v_class_code = any(v_seen_class_codes) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'lineNumber', v_line_number,
        'classCode', v_class_code,
        'code', 'DUPLICATE_CLASS_CODE',
        'message', 'Mã lớp bị trùng trong dữ liệu gửi lên.'
      ));
      continue;
    end if;
    v_seen_class_codes := array_append(v_seen_class_codes, v_class_code);

    select count(*) into v_match_count
    from public.faculties f
    where f.current_name = v_faculty_name;
    if v_match_count > 1 then
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
        'lineNumber', v_line_number,
        'classCode', v_class_code,
        'code', 'AMBIGUOUS_FACULTY',
        'message', 'Có nhiều Khoa hiện hành cùng tên; cần xử lý thủ công.'
      ));
      continue;
    end if;

    select count(*) into v_match_count
    from public.programs p
    join public.faculties f on f.id = p.current_faculty_id
    where p.current_name = v_program_name and f.current_name = v_faculty_name;
    if v_match_count > 1 then
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
        'lineNumber', v_line_number,
        'classCode', v_class_code,
        'code', 'AMBIGUOUS_PROGRAM',
        'message', 'Có nhiều Ngành hiện hành cùng tên trong cùng Khoa; cần xử lý thủ công.'
      ));
      continue;
    end if;

    v_current_faculty_name := null;
    v_current_program_name := null;
    v_current_cohort_code := null;
    select f.current_name, p.current_name, ch.code
      into v_current_faculty_name, v_current_program_name, v_current_cohort_code
    from public.classes c
    join public.programs p on p.id = c.current_program_id
    join public.faculties f on f.id = p.current_faculty_id
    join public.cohorts ch on ch.id = c.current_cohort_id
    where c.current_code = v_class_code;

    if found and (
      v_current_faculty_name <> v_faculty_name
      or v_current_program_name <> v_program_name
      or v_current_cohort_code <> v_cohort_code
    ) then
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
        'lineNumber', v_line_number,
        'classCode', v_class_code,
        'code', 'CLASS_RELATIONSHIP_CONFLICT',
        'message', 'Lớp đã tồn tại với quan hệ Khoa/Ngành/Khóa khác; cần xử lý thủ công.',
        'expected', jsonb_build_object(
          'facultyName', v_faculty_name,
          'programName', v_program_name,
          'cohortCode', v_cohort_code
        ),
        'actual', jsonb_build_object(
          'facultyName', v_current_faculty_name,
          'programName', v_current_program_name,
          'cohortCode', v_current_cohort_code
        )
      ));
    end if;
  end loop;

  if p_dry_run then
    return jsonb_build_object(
      'rowCount', v_row_count,
      'conflicts', v_conflicts,
      'errors', v_errors,
      'applied', false,
      'alreadyApplied', false
    );
  end if;
  if jsonb_array_length(v_conflicts) > 0 or jsonb_array_length(v_errors) > 0 then
    raise exception 'IMPORT_HAS_ERRORS';
  end if;

  if exists (
    select 1 from public.catalog_import_batches b
    where b.file_sha256 = p_file_sha256 and not b.dry_run
  ) then
    return jsonb_build_object(
      'rowCount', v_row_count,
      'inserted', jsonb_build_object('faculties', 0, 'programs', 0, 'cohorts', 0, 'classes', 0),
      'updated', jsonb_build_object('faculties', 0, 'programs', 0, 'cohorts', 0, 'classes', 0),
      'conflicts', '[]'::jsonb,
      'errors', '[]'::jsonb,
      'applied', false,
      'alreadyApplied', true
    );
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_faculty_name := v_row->>'facultyName';
    v_program_name := v_row->>'programName';
    v_cohort_code := v_row->>'cohortCode';
    v_class_code := v_row->>'classCode';
    v_education_level := v_row->>'educationLevel';
    v_training_type := v_row->>'trainingType';

    v_faculty_id := null;
    select f.id into v_faculty_id
    from public.faculties f
    where f.current_name = v_faculty_name
    limit 1;
    if v_faculty_id is null then
      v_faculty_id := gen_random_uuid();
      insert into public.faculties(id, current_code, current_name)
      values (v_faculty_id, null, v_faculty_name);
      insert into public.faculty_versions(
        faculty_id, code, name, valid_during, changed_reason
      ) values (
        v_faculty_id, null, v_faculty_name,
        daterange(v_effective, null, '[)'), 'Import danh mục học vụ từ CSV'
      );
      v_faculty_inserted := v_faculty_inserted + 1;
    end if;

    v_was_inserted := false;
    insert into public.cohorts(code, display_name)
    values (v_cohort_code, v_cohort_code)
    on conflict (code) do nothing
    returning true into v_was_inserted;
    if coalesce(v_was_inserted, false) then
      v_cohort_inserted := v_cohort_inserted + 1;
    end if;
    select ch.id into v_cohort_id from public.cohorts ch where ch.code = v_cohort_code;

    v_program_id := null;
    select p.id into v_program_id
    from public.programs p
    where p.current_name = v_program_name and p.current_faculty_id = v_faculty_id
    limit 1;
    if v_program_id is null then
      v_program_id := gen_random_uuid();
      insert into public.programs(id, current_code, current_name, current_faculty_id)
      values (v_program_id, null, v_program_name, v_faculty_id);
      insert into public.program_versions(
        program_id, faculty_id, code, name, valid_during, changed_reason
      ) values (
        v_program_id, v_faculty_id, null, v_program_name,
        daterange(v_effective, null, '[)'), 'Import danh mục học vụ từ CSV'
      );
      v_program_inserted := v_program_inserted + 1;
    end if;

    v_class_id := null;
    select c.id into v_class_id
    from public.classes c
    where c.current_code = v_class_code;
    if v_class_id is null then
      v_class_id := gen_random_uuid();
      insert into public.classes(
        id, current_code, current_name, current_program_id, current_cohort_id,
        education_level, training_type
      ) values (
        v_class_id, v_class_code, v_class_code, v_program_id, v_cohort_id,
        v_education_level, v_training_type
      );
      insert into public.class_versions(
        class_id, program_id, cohort_id, code, name, education_level, training_type,
        valid_during, changed_reason
      ) values (
        v_class_id, v_program_id, v_cohort_id, v_class_code, v_class_code,
        v_education_level, v_training_type,
        daterange(v_effective, null, '[)'), 'Import danh mục học vụ từ CSV'
      );
      v_class_inserted := v_class_inserted + 1;
    else
      select cv.* into v_current_class_version
      from public.class_versions cv
      where cv.class_id = v_class_id and cv.valid_during @> v_effective;

      if v_current_class_version.education_level is distinct from v_education_level
        or v_current_class_version.training_type is distinct from v_training_type then
        update public.classes
        set education_level = v_education_level,
            training_type = v_training_type,
            updated_at = now()
        where id = v_class_id;

        if lower(v_current_class_version.valid_during) = v_effective then
          update public.class_versions
          set education_level = v_education_level,
              training_type = v_training_type,
              changed_reason = 'Hiệu chỉnh import danh mục học vụ trong ngày'
          where id = v_current_class_version.id;
        else
          update public.class_versions
          set valid_during = daterange(lower(valid_during), v_effective, '[)')
          where id = v_current_class_version.id;
          insert into public.class_versions(
            class_id, program_id, cohort_id, code, name, source_number,
            education_level, training_type, valid_during, changed_reason, is_active
          ) values (
            v_class_id, v_current_class_version.program_id, v_current_class_version.cohort_id,
            v_current_class_version.code, v_current_class_version.name,
            v_current_class_version.source_number, v_education_level, v_training_type,
            daterange(v_effective, null, '[)'), 'Cập nhật thuộc tính từ import danh mục học vụ',
            v_current_class_version.is_active
          );
        end if;
        v_class_updated := v_class_updated + 1;
      end if;
    end if;
  end loop;

  v_result := jsonb_build_object(
    'rowCount', v_row_count,
    'inserted', jsonb_build_object(
      'faculties', v_faculty_inserted,
      'programs', v_program_inserted,
      'cohorts', v_cohort_inserted,
      'classes', v_class_inserted
    ),
    'updated', jsonb_build_object(
      'faculties', 0,
      'programs', 0,
      'cohorts', 0,
      'classes', v_class_updated
    ),
    'conflicts', '[]'::jsonb,
    'errors', '[]'::jsonb,
    'applied', true,
    'alreadyApplied', false
  );

  insert into public.catalog_import_batches(
    file_name, file_sha256, row_count, dry_run, conflict_report
  ) values (
    p_file_name, p_file_sha256, v_row_count, false, v_result
  );
  return v_result;
end;
$$;

revoke all on function public.import_academic_catalog_v2(jsonb, text, text, boolean)
from public, anon, authenticated;
grant execute on function public.import_academic_catalog_v2(jsonb, text, text, boolean)
to service_role;

comment on function public.import_academic_catalog_v2 is
  'Validates and atomically imports Khoa → Ngành → Khóa → Lớp from the six-column academic CSV; never deletes missing rows.';
