create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

create table if not exists public.student_code_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null unique,
  regex_pattern text not null,
  digit_length smallint not null check (digit_length between 1 and 32),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

insert into public.student_code_rules (rule_name, regex_pattern, digit_length, effective_from)
values ('MSSV 10 chữ số hiện hành', '^[0-9]{10}$', 10, date '2026-01-01')
on conflict (rule_name) do nothing;

create or replace function public.is_valid_student_code(
  p_student_code text,
  p_on_date date default current_date
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_code_rules r
    where r.effective_from <= p_on_date
      and (r.effective_to is null or r.effective_to > p_on_date)
      and p_student_code ~ r.regex_pattern
  );
$$;

create table if not exists public.accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  student_code text not null unique,
  status text not null default 'pending_email_verification'
    check (status in ('pending_email_verification', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_student_code_current_rule
    check (public.is_valid_student_code(student_code, created_at::date))
);

create table if not exists public.account_emails (
  user_id uuid primary key references public.accounts(user_id) on delete cascade,
  email citext not null unique,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_emails_gmail check (email::text ~* '^[^@[:space:]]+@gmail\.com$')
);

create table if not exists public.email_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  requested_email citext not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint email_change_requests_gmail check (requested_email::text ~* '^[^@[:space:]]+@gmail\.com$')
);

create unique index if not exists email_change_requests_one_pending
  on public.email_change_requests(user_id) where completed_at is null;

create table if not exists public.student_code_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  old_student_code text not null,
  new_student_code text not null,
  reason text not null check (char_length(btrim(reason)) >= 5),
  changed_by uuid not null references public.accounts(user_id) on delete restrict,
  changed_at timestamptz not null default now(),
  check (old_student_code <> new_student_code)
);

create table if not exists public.auth_attempts (
  id bigint generated always as identity primary key,
  action text not null check (action in ('login', 'register', 'recover')),
  identifier_hash text not null,
  ip_hash text not null,
  succeeded boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists auth_attempts_window_idx
  on public.auth_attempts(action, identifier_hash, ip_hash, attempted_at desc);

create table if not exists public.faculties (
  id uuid primary key default gen_random_uuid(),
  current_code text not null unique,
  current_name text not null,
  is_active boolean not null default true,
  source_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.faculty_versions (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties(id) on delete restrict,
  code text not null,
  name text not null,
  source_order integer,
  valid_during daterange not null,
  changed_reason text not null,
  changed_by uuid references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  exclude using gist (faculty_id with =, valid_during with &&)
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  current_code text not null unique,
  current_name text not null,
  current_faculty_id uuid not null references public.faculties(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  faculty_id uuid not null references public.faculties(id) on delete restrict,
  code text not null,
  name text not null,
  valid_during daterange not null,
  changed_reason text not null,
  changed_by uuid references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  exclude using gist (program_id with =, valid_during with &&)
);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  current_code text not null unique,
  current_name text not null,
  current_program_id uuid not null references public.programs(id) on delete restrict,
  current_cohort_id uuid not null references public.cohorts(id) on delete restrict,
  is_active boolean not null default true,
  source_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_versions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  program_id uuid not null references public.programs(id) on delete restrict,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  code text not null,
  name text not null,
  source_number text,
  valid_during daterange not null,
  changed_reason text not null,
  changed_by uuid references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  exclude using gist (class_id with =, valid_during with &&)
);

create table if not exists public.organization_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit_type text not null check (unit_type in ('school_union', 'office', 'school_committee', 'faculty_union', 'class_union')),
  parent_id uuid references public.organization_units(id) on delete restrict,
  faculty_id uuid references public.faculties(id) on delete restrict,
  class_id uuid references public.classes(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((unit_type = 'faculty_union' and faculty_id is not null) or unit_type <> 'faculty_union'),
  check ((unit_type = 'class_union' and class_id is not null) or unit_type <> 'class_union')
);

insert into public.organization_units (id, code, name, unit_type)
values
  ('00000000-0000-4000-8000-000000000001', 'SCHOOL_UNION', 'Đoàn Trường', 'school_union'),
  ('00000000-0000-4000-8000-000000000002', 'OFFICE', 'Văn phòng Đoàn – Hội', 'office'),
  ('00000000-0000-4000-8000-000000000003', 'ORGANIZATION_INSPECTION', 'Ban Tổ chức – Kiểm tra', 'school_committee')
on conflict (code) do nothing;

update public.organization_units
set parent_id = '00000000-0000-4000-8000-000000000001'
where code in ('OFFICE', 'ORGANIZATION_INSPECTION') and parent_id is null;

create table if not exists public.organization_unit_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization_units(id) on delete restrict,
  parent_id uuid references public.organization_units(id) on delete restrict,
  code text not null,
  name text not null,
  valid_during daterange not null,
  changed_reason text not null,
  changed_by uuid references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  exclude using gist (organization_id with =, valid_during with &&)
);

create table if not exists public.role_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  role_code text not null check (role_code in ('school_admin', 'office', 'committee_manager', 'collaborator', 'faculty_manager', 'faculty_executive')),
  organization_id uuid not null references public.organization_units(id) on delete restrict,
  granted_by uuid references public.accounts(user_id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.accounts(user_id) on delete restrict,
  revoked_at timestamptz,
  reason text not null check (char_length(btrim(reason)) >= 3)
);

create unique index if not exists role_grants_one_active
  on public.role_grants(user_id, role_code, organization_id) where revoked_at is null;

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.accounts(user_id) on delete restrict,
  active_role_grant_id uuid references public.role_grants(id) on delete set null,
  organization_id uuid references public.organization_units(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_events_target_idx
  on public.audit_events(target_type, target_id, occurred_at desc);

create table if not exists public.catalog_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_sha256 text not null,
  row_count integer not null check (row_count >= 0),
  dry_run boolean not null,
  conflict_report jsonb not null default '[]'::jsonb,
  imported_by uuid references public.accounts(user_id) on delete restrict,
  imported_at timestamptz not null default now()
);

create unique index if not exists catalog_import_batches_applied_file
  on public.catalog_import_batches(file_sha256) where dry_run = false;

create table if not exists public.reference_options (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('education_level', 'specialization', 'political_theory', 'it_level', 'foreign_language', 'occupation')),
  code text not null,
  label text not null,
  is_active boolean not null default true,
  valid_from date not null default current_date,
  valid_to date,
  source_note text not null,
  created_at timestamptz not null default now(),
  unique (category, code),
  check (valid_to is null or valid_to > valid_from)
);

create or replace view public.current_academic_catalog
with (security_invoker = true)
as
select
  c.id as class_id,
  c.current_code as class_code,
  c.current_name as class_name,
  c.is_active as class_is_active,
  ch.id as cohort_id,
  ch.code as cohort_code,
  ch.display_name as cohort_name,
  p.id as program_id,
  p.current_code as program_code,
  p.current_name as program_name,
  p.is_active as program_is_active,
  f.id as faculty_id,
  f.current_code as faculty_code,
  f.current_name as faculty_name,
  f.is_active as faculty_is_active,
  f.source_order
from public.classes c
join public.cohorts ch on ch.id = c.current_cohort_id
join public.programs p on p.id = c.current_program_id
join public.faculties f on f.id = p.current_faculty_id;

create or replace function public.has_active_role(
  p_role_code text,
  p_organization_id uuid default null
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.role_grants rg
    where rg.user_id = auth.uid()
      and rg.role_code = p_role_code
      and rg.revoked_at is null
      and (p_organization_id is null or rg.organization_id = p_organization_id)
  );
$$;

create or replace function public.has_permission(
  p_permission text,
  p_faculty_id uuid default null,
  p_organization_id uuid default null
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;

  if public.has_active_role('school_admin') then return true; end if;

  if p_permission in ('student_code.edit', 'membership.final_review', 'paper_book.record')
     and public.has_active_role('office') then return true; end if;

  if p_permission = 'student.read_all' and (
    public.has_active_role('office') or exists (
      select 1 from public.role_grants rg
      join public.organization_units ou on ou.id = rg.organization_id
      where rg.user_id = auth.uid() and rg.revoked_at is null
        and ou.code = 'ORGANIZATION_INSPECTION'
    )
  ) then return true; end if;

  if p_permission in ('class.manage', 'student.read_faculty') and p_faculty_id is not null and exists (
    select 1 from public.role_grants rg
    join public.organization_units ou on ou.id = rg.organization_id
    where rg.user_id = auth.uid() and rg.revoked_at is null
      and rg.role_code in ('faculty_manager', 'faculty_executive')
      and ou.faculty_id = p_faculty_id
  ) then return true; end if;

  if p_permission in ('role.grant_collaborator', 'membership.collaborator_review')
     and p_organization_id is not null and exists (
    select 1 from public.role_grants rg
    where rg.user_id = auth.uid() and rg.revoked_at is null
      and rg.role_code = 'committee_manager'
      and rg.organization_id = p_organization_id
  ) then return true; end if;

  return false;
end;
$$;

create or replace function public.write_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_role_grant_id uuid default null,
  p_organization_id uuid default null,
  p_request_id text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  insert into public.audit_events(
    actor_user_id, active_role_grant_id, organization_id, action,
    target_type, target_id, before_data, after_data, request_id
  ) values (
    auth.uid(), p_role_grant_id, p_organization_id, p_action,
    p_target_type, p_target_id, p_before, p_after, p_request_id
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.bootstrap_school_admin(p_user_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_grant_id uuid;
begin
  if not exists (select 1 from public.accounts where user_id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;
  if exists (select 1 from public.role_grants where role_code = 'school_admin' and revoked_at is null) then
    raise exception 'BOOTSTRAP_ALREADY_COMPLETED';
  end if;
  insert into public.role_grants(user_id, role_code, organization_id, reason)
  values (p_user_id, 'school_admin', '00000000-0000-4000-8000-000000000001', p_reason)
  returning id into v_grant_id;
  insert into public.audit_events(actor_user_id, active_role_grant_id, organization_id, action, target_type, target_id, after_data)
  values (p_user_id, v_grant_id, '00000000-0000-4000-8000-000000000001', 'role.bootstrap', 'role_grant', v_grant_id::text,
          jsonb_build_object('role_code', 'school_admin'));
  return v_grant_id;
end;
$$;

revoke all on function public.bootstrap_school_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.bootstrap_school_admin(uuid, text) to service_role;

create or replace function public.change_student_code(
  p_user_id uuid,
  p_new_student_code text,
  p_reason text,
  p_role_grant_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_old text;
begin
  if not public.has_permission('student_code.edit') then raise exception 'FORBIDDEN'; end if;
  if not public.is_valid_student_code(p_new_student_code, current_date) then raise exception 'INVALID_STUDENT_CODE'; end if;
  if char_length(btrim(p_reason)) < 5 then raise exception 'REASON_REQUIRED'; end if;

  select student_code into v_old from public.accounts where user_id = p_user_id for update;
  if v_old is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if v_old = p_new_student_code then raise exception 'STUDENT_CODE_UNCHANGED'; end if;

  update public.accounts set student_code = p_new_student_code, updated_at = now() where user_id = p_user_id;
  insert into public.student_code_changes(user_id, old_student_code, new_student_code, reason, changed_by)
  values (p_user_id, v_old, p_new_student_code, p_reason, auth.uid());
  perform public.write_audit('student_code.changed', 'account', p_user_id::text,
    jsonb_build_object('student_code', v_old), jsonb_build_object('student_code', p_new_student_code), p_role_grant_id);
end;
$$;

create or replace function public.grant_role(
  p_user_id uuid,
  p_role_code text,
  p_organization_id uuid,
  p_reason text,
  p_actor_role_grant_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_can boolean := false; v_actor_org uuid; v_actor_role text;
begin
  select role_code, organization_id into v_actor_role, v_actor_org
  from public.role_grants
  where id = p_actor_role_grant_id and user_id = auth.uid() and revoked_at is null;

  if public.has_active_role('school_admin') then
    v_can := true;
  elsif v_actor_role = 'committee_manager' and p_role_code = 'collaborator' and v_actor_org = p_organization_id then
    v_can := true;
  end if;

  if not v_can then raise exception 'FORBIDDEN'; end if;
  if char_length(btrim(p_reason)) < 3 then raise exception 'REASON_REQUIRED'; end if;

  insert into public.role_grants(user_id, role_code, organization_id, granted_by, reason)
  values (p_user_id, p_role_code, p_organization_id, auth.uid(), p_reason)
  returning id into v_id;
  perform public.write_audit('role.granted', 'role_grant', v_id::text, null,
    jsonb_build_object('user_id', p_user_id, 'role_code', p_role_code), p_actor_role_grant_id, p_organization_id);
  return v_id;
end;
$$;

create or replace function public.revoke_role(
  p_grant_id uuid,
  p_reason text,
  p_actor_role_grant_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_target public.role_grants%rowtype; v_actor public.role_grants%rowtype; v_can boolean := false;
begin
  select * into v_target from public.role_grants where id = p_grant_id and revoked_at is null for update;
  if v_target.id is null then raise exception 'ACTIVE_GRANT_NOT_FOUND'; end if;
  select * into v_actor from public.role_grants where id = p_actor_role_grant_id and user_id = auth.uid() and revoked_at is null;

  if public.has_active_role('school_admin') then v_can := true;
  elsif v_actor.role_code = 'committee_manager' and v_target.role_code = 'collaborator'
    and v_actor.organization_id = v_target.organization_id then v_can := true;
  end if;
  if not v_can then raise exception 'FORBIDDEN'; end if;

  update public.role_grants set revoked_at = now(), revoked_by = auth.uid(), reason = reason || E'\nThu hồi: ' || p_reason
  where id = p_grant_id;
  perform public.write_audit('role.revoked', 'role_grant', p_grant_id::text, to_jsonb(v_target), null,
    p_actor_role_grant_id, v_target.organization_id);
end;
$$;

comment on table public.account_emails is 'Private Gmail mapping. Never expose through broad profile/list endpoints.';
comment on table public.audit_events is 'Append-only audit trail with real actor and active organization role.';
comment on table public.reference_options is 'Official option catalog; intentionally empty until an authoritative source is supplied.';
