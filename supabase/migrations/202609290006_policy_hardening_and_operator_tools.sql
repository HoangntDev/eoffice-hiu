alter table public.accounts drop constraint if exists accounts_student_code_current_rule;

create or replace function public.enforce_current_student_code_rule()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_valid_student_code(new.student_code, current_date) then
    raise exception 'INVALID_STUDENT_CODE';
  end if;
  return new;
end;
$$;

drop trigger if exists accounts_validate_student_code on public.accounts;
create trigger accounts_validate_student_code before insert or update of student_code
on public.accounts for each row execute function public.enforce_current_student_code_rule();

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
  elsif v_actor_role = 'faculty_manager' and p_role_code = 'faculty_executive' and v_actor_org = p_organization_id then
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

create or replace function public.save_organization_unit(
  p_organization_id uuid,
  p_code text,
  p_name text,
  p_unit_type text,
  p_parent_id uuid,
  p_effective_date date,
  p_is_active boolean,
  p_reason text,
  p_role_grant_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid := coalesce(p_organization_id, gen_random_uuid()); v_lower date; v_before jsonb;
begin
  if not public.has_active_role('school_admin') then raise exception 'FORBIDDEN'; end if;
  if p_unit_type not in ('school_committee', 'office') then raise exception 'INVALID_MANAGED_UNIT_TYPE'; end if;
  if p_parent_id = v_id then raise exception 'ORGANIZATION_CYCLE'; end if;
  if char_length(btrim(p_reason)) < 5 then raise exception 'REASON_REQUIRED'; end if;
  select to_jsonb(ou) into v_before from public.organization_units ou where ou.id = p_organization_id;

  if p_organization_id is null then
    insert into public.organization_units(id, code, name, unit_type, parent_id, is_active)
    values (v_id, p_code, p_name, p_unit_type, p_parent_id, p_is_active and p_effective_date <= current_date);
  elsif not exists (select 1 from public.organization_units where id = p_organization_id) then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  select lower(valid_during) into v_lower from public.organization_unit_versions
  where organization_id = v_id and valid_during @> p_effective_date for update;
  if v_lower = p_effective_date then
    update public.organization_unit_versions set parent_id=p_parent_id, code=p_code, name=p_name,
      changed_reason=p_reason, changed_by=auth.uid()
    where organization_id=v_id and lower(valid_during)=p_effective_date;
  else
    update public.organization_unit_versions set valid_during=daterange(lower(valid_during),p_effective_date,'[)')
    where organization_id=v_id and valid_during @> p_effective_date;
    insert into public.organization_unit_versions(organization_id,parent_id,code,name,valid_during,changed_reason,changed_by)
    values(v_id,p_parent_id,p_code,p_name,daterange(p_effective_date,null,'[)'),p_reason,auth.uid());
  end if;
  if p_effective_date <= current_date then
    update public.organization_units set code=p_code,name=p_name,parent_id=p_parent_id,is_active=p_is_active,updated_at=now() where id=v_id;
  end if;
  perform public.write_audit('organization.saved','organization_unit',v_id::text,v_before,
    jsonb_build_object('code',p_code,'name',p_name,'effectiveDate',p_effective_date,'isActive',p_is_active),p_role_grant_id,v_id);
  return v_id;
end;
$$;

create or replace function public.save_membership_checklist_definition(
  p_code text,
  p_label text,
  p_is_required boolean,
  p_display_order integer,
  p_role_grant_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not (public.has_active_role('school_admin') or public.has_active_role('office')) then raise exception 'FORBIDDEN'; end if;
  if char_length(btrim(p_code)) < 2 or char_length(btrim(p_label)) < 3 then raise exception 'INVALID_CHECKLIST_ITEM'; end if;
  insert into public.membership_review_checklist_items(code,label,is_required,display_order,created_by)
  values(upper(btrim(p_code)),btrim(p_label),p_is_required,p_display_order,auth.uid())
  on conflict(code) do update set label=excluded.label,is_required=excluded.is_required,
    display_order=excluded.display_order,is_active=true
  returning id into v_id;
  perform public.write_audit('membership_checklist.saved','membership_checklist_item',v_id::text,null,
    jsonb_build_object('code',p_code,'label',p_label,'required',p_is_required),p_role_grant_id);
  return v_id;
end;
$$;

grant execute on function public.save_organization_unit(uuid,text,text,text,uuid,date,boolean,text,uuid) to authenticated;
grant execute on function public.save_membership_checklist_definition(text,text,boolean,integer,uuid) to authenticated;

comment on trigger accounts_validate_student_code on public.accounts is 'Validates the currently effective rule without coupling FK relationships to MSSV format.';
