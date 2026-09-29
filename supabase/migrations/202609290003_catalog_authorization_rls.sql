alter table public.faculty_versions add column if not exists is_active boolean not null default true;
alter table public.program_versions add column if not exists is_active boolean not null default true;
alter table public.class_versions add column if not exists is_active boolean not null default true;

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
  fv.source_order
from public.classes c
join public.class_versions cv on cv.class_id = c.id and cv.valid_during @> current_date
join public.cohorts ch on ch.id = cv.cohort_id
join public.programs p on p.id = cv.program_id
join public.program_versions pv on pv.program_id = p.id and pv.valid_during @> current_date
join public.faculties f on f.id = pv.faculty_id
join public.faculty_versions fv on fv.faculty_id = f.id and fv.valid_during @> current_date;

create or replace function public.catalog_save_entity(
  p_entity_type text,
  p_entity_id uuid,
  p_code text,
  p_name text,
  p_parent_id uuid,
  p_cohort_id uuid,
  p_source_number text,
  p_source_order integer,
  p_effective_date date,
  p_is_active boolean,
  p_reason text,
  p_role_grant_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce(p_entity_id, gen_random_uuid());
  v_faculty_id uuid;
  v_existing_lower date;
  v_before jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_entity_type not in ('faculty', 'program', 'class') then raise exception 'INVALID_ENTITY_TYPE'; end if;
  if char_length(btrim(p_code)) = 0 or char_length(btrim(p_name)) = 0 then raise exception 'CODE_AND_NAME_REQUIRED'; end if;
  if char_length(btrim(p_reason)) < 5 then raise exception 'REASON_REQUIRED'; end if;

  if p_entity_type = 'class' then
    select pv.faculty_id into v_faculty_id
    from public.program_versions pv
    where pv.program_id = p_parent_id and pv.valid_during @> p_effective_date;
    if v_faculty_id is null then raise exception 'PROGRAM_NOT_EFFECTIVE_ON_DATE'; end if;
    if not (public.has_active_role('school_admin') or public.has_permission('class.manage', v_faculty_id)) then
      raise exception 'FORBIDDEN';
    end if;
  elsif not public.has_active_role('school_admin') then
    raise exception 'FORBIDDEN';
  end if;

  if p_entity_type = 'faculty' then
    select to_jsonb(f) into v_before from public.faculties f where f.id = p_entity_id;
    if p_entity_id is null then
      insert into public.faculties(id, current_code, current_name, is_active, source_order)
      values (v_id, p_code, p_name, p_is_active and p_effective_date <= current_date, p_source_order);
    elsif not exists (select 1 from public.faculties where id = p_entity_id) then
      raise exception 'FACULTY_NOT_FOUND';
    end if;

    select lower(valid_during) into v_existing_lower from public.faculty_versions
    where faculty_id = v_id and valid_during @> p_effective_date for update;
    if v_existing_lower = p_effective_date then
      update public.faculty_versions set code = p_code, name = p_name, source_order = p_source_order,
        is_active = p_is_active, changed_reason = p_reason, changed_by = auth.uid()
      where faculty_id = v_id and lower(valid_during) = p_effective_date;
    else
      update public.faculty_versions set valid_during = daterange(lower(valid_during), p_effective_date, '[)')
      where faculty_id = v_id and valid_during @> p_effective_date;
      insert into public.faculty_versions(faculty_id, code, name, source_order, is_active, valid_during, changed_reason, changed_by)
      values (v_id, p_code, p_name, p_source_order, p_is_active, daterange(p_effective_date, null, '[)'), p_reason, auth.uid());
    end if;
    if p_effective_date <= current_date then
      update public.faculties set current_code = p_code, current_name = p_name, source_order = p_source_order,
        is_active = p_is_active, updated_at = now() where id = v_id;
    end if;

  elsif p_entity_type = 'program' then
    if p_parent_id is null or not exists (
      select 1 from public.faculty_versions where faculty_id = p_parent_id and valid_during @> p_effective_date
    ) then raise exception 'FACULTY_NOT_EFFECTIVE_ON_DATE'; end if;
    select to_jsonb(p) into v_before from public.programs p where p.id = p_entity_id;
    if p_entity_id is null then
      insert into public.programs(id, current_code, current_name, current_faculty_id, is_active)
      values (v_id, p_code, p_name, p_parent_id, p_is_active and p_effective_date <= current_date);
    elsif not exists (select 1 from public.programs where id = p_entity_id) then
      raise exception 'PROGRAM_NOT_FOUND';
    end if;

    select lower(valid_during) into v_existing_lower from public.program_versions
    where program_id = v_id and valid_during @> p_effective_date for update;
    if v_existing_lower = p_effective_date then
      update public.program_versions set faculty_id = p_parent_id, code = p_code, name = p_name,
        is_active = p_is_active, changed_reason = p_reason, changed_by = auth.uid()
      where program_id = v_id and lower(valid_during) = p_effective_date;
    else
      update public.program_versions set valid_during = daterange(lower(valid_during), p_effective_date, '[)')
      where program_id = v_id and valid_during @> p_effective_date;
      insert into public.program_versions(program_id, faculty_id, code, name, is_active, valid_during, changed_reason, changed_by)
      values (v_id, p_parent_id, p_code, p_name, p_is_active, daterange(p_effective_date, null, '[)'), p_reason, auth.uid());
    end if;
    if p_effective_date <= current_date then
      update public.programs set current_code = p_code, current_name = p_name, current_faculty_id = p_parent_id,
        is_active = p_is_active, updated_at = now() where id = v_id;
    end if;

  else
    if p_cohort_id is null or not exists (select 1 from public.cohorts where id = p_cohort_id) then
      raise exception 'COHORT_NOT_FOUND';
    end if;
    select to_jsonb(c) into v_before from public.classes c where c.id = p_entity_id;
    if p_entity_id is null then
      insert into public.classes(id, current_code, current_name, current_program_id, current_cohort_id, is_active, source_number)
      values (v_id, p_code, p_name, p_parent_id, p_cohort_id, p_is_active and p_effective_date <= current_date, p_source_number);
    elsif not exists (select 1 from public.classes where id = p_entity_id) then
      raise exception 'CLASS_NOT_FOUND';
    end if;

    select lower(valid_during) into v_existing_lower from public.class_versions
    where class_id = v_id and valid_during @> p_effective_date for update;
    if v_existing_lower = p_effective_date then
      update public.class_versions set program_id = p_parent_id, cohort_id = p_cohort_id,
        code = p_code, name = p_name, source_number = p_source_number, is_active = p_is_active,
        changed_reason = p_reason, changed_by = auth.uid()
      where class_id = v_id and lower(valid_during) = p_effective_date;
    else
      update public.class_versions set valid_during = daterange(lower(valid_during), p_effective_date, '[)')
      where class_id = v_id and valid_during @> p_effective_date;
      insert into public.class_versions(class_id, program_id, cohort_id, code, name, source_number,
        is_active, valid_during, changed_reason, changed_by)
      values (v_id, p_parent_id, p_cohort_id, p_code, p_name, p_source_number,
        p_is_active, daterange(p_effective_date, null, '[)'), p_reason, auth.uid());
    end if;
    if p_effective_date <= current_date then
      update public.classes set current_code = p_code, current_name = p_name, current_program_id = p_parent_id,
        current_cohort_id = p_cohort_id, source_number = p_source_number,
        is_active = p_is_active, updated_at = now() where id = v_id;
    end if;
  end if;

  perform public.write_audit('catalog.' || p_entity_type || '.saved', p_entity_type, v_id::text, v_before,
    jsonb_build_object('code', p_code, 'name', p_name, 'effectiveDate', p_effective_date,
      'isActive', p_is_active, 'parentId', p_parent_id), p_role_grant_id);
  return v_id;
exception
  when unique_violation then raise exception 'DUPLICATE_CURRENT_CODE';
end;
$$;

create or replace function public.can_access_application(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.union_applications ua
    where ua.id = p_application_id and (
      ua.user_id = auth.uid()
      or public.has_permission('student.read_all')
      or exists (
        select 1 from public.membership_application_assignments aa
        where aa.application_id = ua.id and aa.collaborator_user_id = auth.uid()
      )
      or exists (
        select 1 from public.role_grants rg
        join public.organization_units ou on ou.id = rg.organization_id
        where rg.user_id = auth.uid() and rg.revoked_at is null
          and rg.role_code in ('faculty_manager', 'faculty_executive')
          and ou.faculty_id::text = ua.organization_snapshot->>'facultyId'
      )
    )
  );
$$;

create or replace function public.assign_membership_application(
  p_application_id uuid,
  p_collaborator_user_id uuid,
  p_organization_id uuid,
  p_role_grant_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_actor public.role_grants%rowtype;
begin
  select * into v_actor from public.role_grants where id = p_role_grant_id and user_id = auth.uid() and revoked_at is null;
  if not (public.has_active_role('school_admin') or public.has_active_role('office')
    or (v_actor.role_code = 'committee_manager' and v_actor.organization_id = p_organization_id)) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.role_grants where user_id = p_collaborator_user_id and role_code = 'collaborator'
      and organization_id = p_organization_id and revoked_at is null
  ) then raise exception 'COLLABORATOR_ROLE_REQUIRED'; end if;
  insert into public.membership_application_assignments(application_id, collaborator_user_id, organization_id, assigned_by)
  values (p_application_id, p_collaborator_user_id, p_organization_id, auth.uid())
  on conflict (application_id, collaborator_user_id, organization_id) do update set completed_at = null
  returning id into v_id;
  perform public.write_audit('union_application.assigned', 'union_application', p_application_id::text,
    null, jsonb_build_object('collaborator_user_id', p_collaborator_user_id), p_role_grant_id, p_organization_id);
  return v_id;
end;
$$;

create or replace function public.save_membership_check(
  p_application_id uuid,
  p_checklist_item_id uuid,
  p_checked boolean,
  p_note text,
  p_role_grant_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_role public.role_grants%rowtype;
begin
  select * into v_role from public.role_grants where id = p_role_grant_id and user_id = auth.uid() and revoked_at is null;
  if v_role.role_code <> 'collaborator' or not exists (
    select 1 from public.membership_application_assignments aa
    where aa.application_id = p_application_id and aa.collaborator_user_id = auth.uid()
      and aa.organization_id = v_role.organization_id
  ) then raise exception 'FORBIDDEN'; end if;
  insert into public.membership_application_checks(application_id, checklist_item_id, checked, note, checked_by)
  values (p_application_id, p_checklist_item_id, p_checked, nullif(btrim(p_note), ''), auth.uid())
  on conflict (application_id, checklist_item_id) do update set
    checked = excluded.checked, note = excluded.note, checked_by = excluded.checked_by, checked_at = now();
end;
$$;

alter table public.student_code_rules enable row level security;
alter table public.accounts enable row level security;
alter table public.account_emails enable row level security;
alter table public.email_change_requests enable row level security;
alter table public.student_code_changes enable row level security;
alter table public.auth_attempts enable row level security;
alter table public.faculties enable row level security;
alter table public.faculty_versions enable row level security;
alter table public.programs enable row level security;
alter table public.program_versions enable row level security;
alter table public.cohorts enable row level security;
alter table public.classes enable row level security;
alter table public.class_versions enable row level security;
alter table public.organization_units enable row level security;
alter table public.organization_unit_versions enable row level security;
alter table public.role_grants enable row level security;
alter table public.audit_events enable row level security;
alter table public.catalog_import_batches enable row level security;
alter table public.reference_options enable row level security;
alter table public.student_profiles enable row level security;
alter table public.student_profile_changes enable row level security;
alter table public.union_applications enable row level security;
alter table public.union_identity_details enable row level security;
alter table public.union_membership_details enable row level security;
alter table public.union_qualification_details enable row level security;
alter table public.membership_review_checklist_items enable row level security;
alter table public.membership_application_assignments enable row level security;
alter table public.membership_application_checks enable row level security;
alter table public.membership_reviews enable row level security;
alter table public.paper_book_events enable row level security;
alter table public.union_memberships enable row level security;

create policy student_code_rules_read on public.student_code_rules for select to authenticated using (true);
create policy accounts_read_own_or_authorized on public.accounts for select to authenticated
  using (user_id = auth.uid() or public.has_permission('student.read_all'));
create policy account_emails_read_own_or_authorized on public.account_emails for select to authenticated
  using (user_id = auth.uid() or public.has_permission('student.read_all'));
create policy email_change_requests_own on public.email_change_requests for select to authenticated using (user_id = auth.uid());
create policy student_code_changes_read on public.student_code_changes for select to authenticated
  using (user_id = auth.uid() or public.has_permission('student_code.edit'));

create policy faculties_read on public.faculties for select to authenticated using (true);
create policy faculty_versions_read on public.faculty_versions for select to authenticated using (true);
create policy programs_read on public.programs for select to authenticated using (true);
create policy program_versions_read on public.program_versions for select to authenticated using (true);
create policy cohorts_read on public.cohorts for select to authenticated using (true);
create policy classes_read on public.classes for select to authenticated using (true);
create policy class_versions_read on public.class_versions for select to authenticated using (true);
create policy organization_units_read on public.organization_units for select to authenticated using (true);
create policy organization_unit_versions_read on public.organization_unit_versions for select to authenticated using (true);
create policy reference_options_read on public.reference_options for select to authenticated using (is_active);

create policy role_grants_read on public.role_grants for select to authenticated using (
  user_id = auth.uid() or public.has_active_role('school_admin') or exists (
    select 1 from public.role_grants actor
    where actor.user_id = auth.uid() and actor.revoked_at is null and actor.role_code = 'committee_manager'
      and actor.organization_id = role_grants.organization_id
  )
);
create policy audit_events_read_authorized on public.audit_events for select to authenticated using (
  actor_user_id = auth.uid() or public.has_active_role('school_admin') or public.has_active_role('office')
);
create policy import_batches_admin_read on public.catalog_import_batches for select to authenticated
  using (public.has_active_role('school_admin'));

create policy student_profiles_read_scoped on public.student_profiles for select to authenticated using (
  user_id = auth.uid() or public.has_permission('student.read_all') or exists (
    select 1 from public.current_academic_catalog c
    where c.class_id = student_profiles.class_id and public.has_permission('student.read_faculty', c.faculty_id)
  )
);
create policy student_profile_changes_read_scoped on public.student_profile_changes for select to authenticated using (
  user_id = auth.uid() or public.has_permission('student.read_all')
);

create policy union_applications_read_scoped on public.union_applications for select to authenticated
  using (public.can_access_application(id));
create policy union_identity_read_scoped on public.union_identity_details for select to authenticated
  using (public.can_access_application(application_id));
create policy union_membership_details_read_scoped on public.union_membership_details for select to authenticated
  using (public.can_access_application(application_id));
create policy union_qualification_read_scoped on public.union_qualification_details for select to authenticated
  using (public.can_access_application(application_id));
create policy checklist_items_read on public.membership_review_checklist_items for select to authenticated using (is_active);
create policy assignments_read_scoped on public.membership_application_assignments for select to authenticated
  using (collaborator_user_id = auth.uid() or public.can_access_application(application_id));
create policy checks_read_scoped on public.membership_application_checks for select to authenticated
  using (public.can_access_application(application_id));
create policy reviews_read_scoped on public.membership_reviews for select to authenticated
  using (public.can_access_application(application_id));
create policy paper_book_events_read_scoped on public.paper_book_events for select to authenticated
  using (user_id = auth.uid() or public.has_permission('student.read_all'));
create policy memberships_read_scoped on public.union_memberships for select to authenticated
  using (user_id = auth.uid() or public.has_permission('student.read_all'));

revoke all on public.auth_attempts from anon, authenticated;
revoke insert, update, delete on public.audit_events from anon, authenticated;
revoke insert, update, delete on public.role_grants from anon, authenticated;
revoke insert, update, delete on public.union_memberships from anon, authenticated;
revoke insert, update, delete on public.student_code_changes from anon, authenticated;
revoke all on function public.write_audit(text, text, text, jsonb, jsonb, uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.is_valid_student_code(text, date) to anon, authenticated, service_role;
grant execute on function public.has_active_role(text, uuid) to authenticated;
grant execute on function public.has_permission(text, uuid, uuid) to authenticated;
grant execute on function public.save_student_profile(text, text, text, uuid) to authenticated;
grant execute on function public.save_union_application(text, jsonb, boolean) to authenticated;
grant execute on function public.record_paper_book_event(uuid, uuid, text, date, uuid) to authenticated;
grant execute on function public.review_union_application(uuid, text, text, uuid) to authenticated;
grant execute on function public.change_student_code(uuid, text, text, uuid) to authenticated;
grant execute on function public.grant_role(uuid, text, uuid, text, uuid) to authenticated;
grant execute on function public.revoke_role(uuid, text, uuid) to authenticated;
grant execute on function public.catalog_save_entity(text, uuid, text, text, uuid, uuid, text, integer, date, boolean, text, uuid) to authenticated;
grant execute on function public.assign_membership_application(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.save_membership_check(uuid, uuid, boolean, text, uuid) to authenticated;

comment on function public.catalog_save_entity is 'Effective-dated catalog mutation. Program transfer changes faculty display for every class without duplicating classes.';
