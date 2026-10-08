create table if not exists public.student_profiles (
  user_id uuid primary key references public.accounts(user_id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 150),
  gender text not null check (gender in ('male', 'female', 'other')),
  phone text not null check (phone ~ '^\+?[0-9]{9,15}$'),
  class_id uuid not null references public.classes(id) on delete restrict,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_profile_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  changed_by uuid not null references public.accounts(user_id) on delete restrict,
  before_data jsonb,
  after_data jsonb not null,
  changed_at timestamptz not null default now()
);

create table if not exists public.union_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  cycle_key text not null check (cycle_key ~ '^[0-9]{4}-[0-9]{4}$'),
  status text not null default 'draft' check (status in (
    'draft', 'submitted', 'needs_changes', 'collaborator_recommended',
    'office_review', 'recognized', 'rejected', 'withdrawn_by_student'
  )),
  profile_snapshot jsonb,
  organization_snapshot jsonb,
  submitted_at timestamptz,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cycle_key)
);

create table if not exists public.union_identity_details (
  application_id uuid primary key references public.union_applications(id) on delete cascade,
  date_of_birth date not null,
  ethnicity text not null,
  religion text not null,
  citizen_id text not null check (citizen_id ~ '^[0-9]{9,12}$'),
  citizen_issued_on date not null,
  citizen_issued_by text not null,
  hometown_province_code text,
  hometown_province_name text not null,
  hometown_ward_code text,
  hometown_ward_name text not null,
  permanent_province_code text,
  permanent_province_name text not null,
  permanent_ward_code text,
  permanent_ward_name text not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists union_identity_details_citizen_id_unique
  on public.union_identity_details(citizen_id);

create table if not exists public.union_membership_details (
  application_id uuid primary key references public.union_applications(id) on delete cascade,
  joined_union_on date not null,
  joined_union_at text not null,
  admission_resolution_number text,
  union_card_number text,
  joined_party_on date,
  updated_at timestamptz not null default now()
);

create table if not exists public.union_qualification_details (
  application_id uuid primary key references public.union_applications(id) on delete cascade,
  education_level_id uuid not null references public.reference_options(id) on delete restrict,
  specialization_id uuid not null references public.reference_options(id) on delete restrict,
  political_theory_id uuid not null references public.reference_options(id) on delete restrict,
  it_level_id uuid not null references public.reference_options(id) on delete restrict,
  foreign_language_id uuid not null references public.reference_options(id) on delete restrict,
  occupation_id uuid not null references public.reference_options(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_review_checklist_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  is_required boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid not null references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.membership_application_assignments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.union_applications(id) on delete cascade,
  collaborator_user_id uuid not null references public.accounts(user_id) on delete restrict,
  organization_id uuid not null references public.organization_units(id) on delete restrict,
  assigned_by uuid not null references public.accounts(user_id) on delete restrict,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (application_id, collaborator_user_id, organization_id)
);

create table if not exists public.membership_application_checks (
  application_id uuid not null references public.union_applications(id) on delete cascade,
  checklist_item_id uuid not null references public.membership_review_checklist_items(id) on delete restrict,
  checked boolean not null,
  note text,
  checked_by uuid not null references public.accounts(user_id) on delete restrict,
  checked_at timestamptz not null default now(),
  primary key (application_id, checklist_item_id)
);

create table if not exists public.membership_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.union_applications(id) on delete restrict,
  reviewer_user_id uuid not null references public.accounts(user_id) on delete restrict,
  reviewer_role_grant_id uuid not null references public.role_grants(id) on delete restrict,
  review_type text not null check (review_type in ('collaborator_recommendation', 'office_decision')),
  outcome text not null check (outcome in ('recommend', 'needs_changes', 'recognize', 'reject')),
  reason text not null check (char_length(btrim(reason)) >= 3),
  created_at timestamptz not null default now()
);

create table if not exists public.paper_book_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  application_id uuid references public.union_applications(id) on delete restrict,
  event_type text not null check (event_type in ('received', 'withdrawn')),
  full_name_snapshot text not null,
  student_code_snapshot text not null,
  event_date date not null,
  recorded_by uuid not null references public.accounts(user_id) on delete restrict,
  role_grant_id uuid not null references public.role_grants(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists paper_book_events_user_date_idx
  on public.paper_book_events(user_id, event_date desc, created_at desc);

create table if not exists public.union_memberships (
  user_id uuid primary key references public.accounts(user_id) on delete restrict,
  recognized_application_id uuid not null unique references public.union_applications(id) on delete restrict,
  recognized_on date not null,
  recognized_by uuid not null references public.accounts(user_id) on delete restrict,
  role_grant_id uuid not null references public.role_grants(id) on delete restrict,
  status text not null default 'recognized' check (status in ('recognized', 'revoked')),
  status_reason text,
  updated_at timestamptz not null default now()
);

create or replace function public.save_student_profile(
  p_full_name text,
  p_gender text,
  p_phone text,
  p_class_id uuid
) returns public.student_profiles
language plpgsql
security definer
set search_path = public
as $$
declare v_before jsonb; v_after public.student_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (
    select 1 from public.current_academic_catalog c
    where c.class_id = p_class_id and c.class_is_active and c.program_is_active and c.faculty_is_active
  ) then raise exception 'INVALID_OR_INACTIVE_CLASS'; end if;
  if char_length(btrim(p_full_name)) < 2 then raise exception 'INVALID_FULL_NAME'; end if;
  if p_gender not in ('male', 'female', 'other') then raise exception 'INVALID_GENDER'; end if;
  if p_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'INVALID_PHONE'; end if;

  select to_jsonb(sp) into v_before from public.student_profiles sp where sp.user_id = auth.uid();
  insert into public.student_profiles(user_id, full_name, gender, phone, class_id)
  values (auth.uid(), btrim(p_full_name), p_gender, p_phone, p_class_id)
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    gender = excluded.gender,
    phone = excluded.phone,
    class_id = excluded.class_id,
    updated_at = now()
  returning * into v_after;

  insert into public.student_profile_changes(user_id, changed_by, before_data, after_data)
  values (auth.uid(), auth.uid(), v_before, to_jsonb(v_after));
  perform public.write_audit('student_profile.saved', 'student_profile', auth.uid()::text, v_before, to_jsonb(v_after));
  return v_after;
end;
$$;

create or replace function public.save_union_application(
  p_cycle_key text,
  p_payload jsonb,
  p_submit boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application_id uuid;
  v_status text;
  v_profile_snapshot jsonb;
  v_org_snapshot jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_cycle_key !~ '^[0-9]{4}-[0-9]{4}$' then raise exception 'INVALID_CYCLE'; end if;

  select id, status into v_application_id, v_status
  from public.union_applications
  where user_id = auth.uid() and cycle_key = p_cycle_key
  for update;

  if v_application_id is null then
    insert into public.union_applications(user_id, cycle_key)
    values (auth.uid(), p_cycle_key) returning id, status into v_application_id, v_status;
  end if;

  if v_status not in ('draft', 'needs_changes') then raise exception 'APPLICATION_NOT_EDITABLE'; end if;

  insert into public.union_identity_details(
    application_id, date_of_birth, ethnicity, religion, citizen_id,
    citizen_issued_on, citizen_issued_by,
    hometown_province_code, hometown_province_name, hometown_ward_code, hometown_ward_name,
    permanent_province_code, permanent_province_name, permanent_ward_code, permanent_ward_name
  ) values (
    v_application_id,
    (p_payload->'identity'->>'dateOfBirth')::date,
    btrim(p_payload->'identity'->>'ethnicity'),
    btrim(p_payload->'identity'->>'religion'),
    btrim(p_payload->'identity'->>'citizenId'),
    (p_payload->'identity'->>'citizenIssuedOn')::date,
    btrim(p_payload->'identity'->>'citizenIssuedBy'),
    nullif(p_payload->'identity'->>'hometownProvinceCode', ''),
    btrim(p_payload->'identity'->>'hometownProvinceName'),
    nullif(p_payload->'identity'->>'hometownWardCode', ''),
    btrim(p_payload->'identity'->>'hometownWardName'),
    nullif(p_payload->'identity'->>'permanentProvinceCode', ''),
    btrim(p_payload->'identity'->>'permanentProvinceName'),
    nullif(p_payload->'identity'->>'permanentWardCode', ''),
    btrim(p_payload->'identity'->>'permanentWardName')
  ) on conflict (application_id) do update set
    date_of_birth = excluded.date_of_birth, ethnicity = excluded.ethnicity,
    religion = excluded.religion, citizen_id = excluded.citizen_id,
    citizen_issued_on = excluded.citizen_issued_on, citizen_issued_by = excluded.citizen_issued_by,
    hometown_province_code = excluded.hometown_province_code,
    hometown_province_name = excluded.hometown_province_name,
    hometown_ward_code = excluded.hometown_ward_code,
    hometown_ward_name = excluded.hometown_ward_name,
    permanent_province_code = excluded.permanent_province_code,
    permanent_province_name = excluded.permanent_province_name,
    permanent_ward_code = excluded.permanent_ward_code,
    permanent_ward_name = excluded.permanent_ward_name,
    updated_at = now();

  insert into public.union_membership_details(
    application_id, joined_union_on, joined_union_at,
    admission_resolution_number, union_card_number, joined_party_on
  ) values (
    v_application_id,
    (p_payload->'membership'->>'joinedUnionOn')::date,
    btrim(p_payload->'membership'->>'joinedUnionAt'),
    nullif(btrim(p_payload->'membership'->>'admissionResolutionNumber'), ''),
    nullif(btrim(p_payload->'membership'->>'unionCardNumber'), ''),
    nullif(p_payload->'membership'->>'joinedPartyOn', '')::date
  ) on conflict (application_id) do update set
    joined_union_on = excluded.joined_union_on, joined_union_at = excluded.joined_union_at,
    admission_resolution_number = excluded.admission_resolution_number,
    union_card_number = excluded.union_card_number, joined_party_on = excluded.joined_party_on,
    updated_at = now();

  insert into public.union_qualification_details(
    application_id, education_level_id, specialization_id, political_theory_id,
    it_level_id, foreign_language_id, occupation_id
  ) values (
    v_application_id,
    (p_payload->'qualifications'->>'educationLevelId')::uuid,
    (p_payload->'qualifications'->>'specializationId')::uuid,
    (p_payload->'qualifications'->>'politicalTheoryId')::uuid,
    (p_payload->'qualifications'->>'itLevelId')::uuid,
    (p_payload->'qualifications'->>'foreignLanguageId')::uuid,
    (p_payload->'qualifications'->>'occupationId')::uuid
  ) on conflict (application_id) do update set
    education_level_id = excluded.education_level_id,
    specialization_id = excluded.specialization_id,
    political_theory_id = excluded.political_theory_id,
    it_level_id = excluded.it_level_id,
    foreign_language_id = excluded.foreign_language_id,
    occupation_id = excluded.occupation_id,
    updated_at = now();

  if p_submit then
    select jsonb_build_object(
      'fullName', sp.full_name, 'studentCode', a.student_code, 'gender', sp.gender,
      'phone', sp.phone, 'gmail', ae.email
    ), jsonb_build_object(
      'classId', c.class_id, 'classCode', c.class_code, 'className', c.class_name,
      'cohortCode', c.cohort_code, 'programId', c.program_id, 'programName', c.program_name,
      'facultyId', c.faculty_id, 'facultyName', c.faculty_name
    ) into v_profile_snapshot, v_org_snapshot
    from public.student_profiles sp
    join public.accounts a on a.user_id = sp.user_id
    join public.account_emails ae on ae.user_id = sp.user_id and ae.verified_at is not null
    join public.current_academic_catalog c on c.class_id = sp.class_id
    where sp.user_id = auth.uid();

    if v_profile_snapshot is null then raise exception 'BASIC_PROFILE_OR_VERIFIED_GMAIL_REQUIRED'; end if;

    update public.union_applications set
      status = 'submitted', submitted_at = now(), updated_at = now(),
      profile_snapshot = v_profile_snapshot, organization_snapshot = v_org_snapshot,
      decision_reason = null
    where id = v_application_id;
    perform public.write_audit('union_application.submitted', 'union_application', v_application_id::text,
      null, jsonb_build_object('cycle', p_cycle_key, 'status', 'submitted'));
  else
    update public.union_applications set updated_at = now() where id = v_application_id;
    perform public.write_audit('union_application.saved', 'union_application', v_application_id::text,
      null, jsonb_build_object('cycle', p_cycle_key, 'status', v_status));
  end if;

  return v_application_id;
exception
  when invalid_text_representation or not_null_violation or check_violation or foreign_key_violation then
    raise exception 'INVALID_APPLICATION_DATA';
end;
$$;

create or replace function public.record_paper_book_event(
  p_user_id uuid,
  p_application_id uuid,
  p_event_type text,
  p_event_date date,
  p_role_grant_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_name text; v_code text;
begin
  if not public.has_permission('paper_book.record') then raise exception 'FORBIDDEN'; end if;
  if p_event_type not in ('received', 'withdrawn') then raise exception 'INVALID_EVENT'; end if;
  if not exists (
    select 1 from public.role_grants where id = p_role_grant_id and user_id = auth.uid()
      and revoked_at is null and role_code in ('school_admin', 'office')
  ) then raise exception 'ACTIVE_ROLE_REQUIRED'; end if;

  select sp.full_name, a.student_code into v_name, v_code
  from public.student_profiles sp join public.accounts a on a.user_id = sp.user_id
  where sp.user_id = p_user_id;
  if v_name is null then raise exception 'PROFILE_NOT_FOUND'; end if;

  insert into public.paper_book_events(user_id, application_id, event_type, full_name_snapshot,
    student_code_snapshot, event_date, recorded_by, role_grant_id)
  values (p_user_id, p_application_id, p_event_type, v_name, v_code, p_event_date, auth.uid(), p_role_grant_id)
  returning id into v_id;
  perform public.write_audit('paper_book.' || p_event_type, 'paper_book_event', v_id::text, null,
    jsonb_build_object('user_id', p_user_id, 'event_date', p_event_date), p_role_grant_id);
  return v_id;
end;
$$;

create or replace function public.review_union_application(
  p_application_id uuid,
  p_outcome text,
  p_reason text,
  p_role_grant_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_role public.role_grants%rowtype; v_app public.union_applications%rowtype; v_new_status text; v_review_type text;
begin
  if char_length(btrim(p_reason)) < 3 then raise exception 'REASON_REQUIRED'; end if;
  select * into v_role from public.role_grants where id = p_role_grant_id and user_id = auth.uid() and revoked_at is null;
  if v_role.id is null then raise exception 'ACTIVE_ROLE_REQUIRED'; end if;
  select * into v_app from public.union_applications where id = p_application_id for update;
  if v_app.id is null then raise exception 'APPLICATION_NOT_FOUND'; end if;

  if v_role.role_code = 'collaborator' then
    if not exists (
      select 1 from public.membership_application_assignments aa
      where aa.application_id = p_application_id and aa.collaborator_user_id = auth.uid()
        and aa.organization_id = v_role.organization_id
    ) then raise exception 'NOT_ASSIGNED'; end if;
    if p_outcome not in ('recommend', 'needs_changes') then raise exception 'COLLABORATOR_CANNOT_FINALIZE'; end if;
    if p_outcome = 'recommend' and exists (
      select 1 from public.membership_review_checklist_items ci
      where ci.is_active and ci.is_required and not exists (
        select 1 from public.membership_application_checks ac
        where ac.application_id = p_application_id and ac.checklist_item_id = ci.id and ac.checked
      )
    ) then raise exception 'REQUIRED_CHECKLIST_INCOMPLETE'; end if;
    v_new_status := case when p_outcome = 'recommend' then 'collaborator_recommended' else 'needs_changes' end;
    v_review_type := 'collaborator_recommendation';
  elsif v_role.role_code in ('office', 'school_admin') then
    if p_outcome not in ('recognize', 'reject', 'needs_changes') then raise exception 'INVALID_OFFICE_OUTCOME'; end if;
    if p_outcome = 'recognize' and not exists (
      select 1 from public.paper_book_events pbe
      where pbe.user_id = v_app.user_id and pbe.event_type = 'received'
        and not exists (
          select 1 from public.paper_book_events later
          where later.user_id = pbe.user_id and later.created_at > pbe.created_at and later.event_type = 'withdrawn'
        )
    ) then raise exception 'PAPER_BOOK_NOT_RECEIVED'; end if;
    v_new_status := case p_outcome when 'recognize' then 'recognized' when 'reject' then 'rejected' else 'needs_changes' end;
    v_review_type := 'office_decision';
  else
    raise exception 'FORBIDDEN';
  end if;

  insert into public.membership_reviews(application_id, reviewer_user_id, reviewer_role_grant_id,
    review_type, outcome, reason)
  values (p_application_id, auth.uid(), p_role_grant_id, v_review_type, p_outcome, p_reason);

  update public.union_applications set status = v_new_status, updated_at = now(),
    decision_reason = case when v_review_type = 'office_decision' or v_new_status = 'needs_changes' then p_reason else decision_reason end,
    decided_at = case when v_new_status in ('recognized', 'rejected') then now() else decided_at end
  where id = p_application_id;

  if v_new_status = 'recognized' then
    insert into public.union_memberships(user_id, recognized_application_id, recognized_on, recognized_by, role_grant_id)
    values (v_app.user_id, p_application_id, current_date, auth.uid(), p_role_grant_id)
    on conflict (user_id) do update set
      recognized_application_id = excluded.recognized_application_id,
      recognized_on = excluded.recognized_on,
      recognized_by = excluded.recognized_by,
      role_grant_id = excluded.role_grant_id,
      status = 'recognized', status_reason = null, updated_at = now();
  end if;

  perform public.write_audit('union_application.reviewed', 'union_application', p_application_id::text,
    jsonb_build_object('status', v_app.status), jsonb_build_object('status', v_new_status, 'outcome', p_outcome),
    p_role_grant_id, v_role.organization_id);
  return v_new_status;
end;
$$;

comment on table public.union_identity_details is 'Sensitive identity data; excluded from default list/export endpoints.';
comment on table public.paper_book_events is 'Independent receipt/withdrawal log. Withdrawal does not change union membership status.';
comment on table public.union_memberships is 'Office-recognized status only; never inferred from student declarations or class.';
