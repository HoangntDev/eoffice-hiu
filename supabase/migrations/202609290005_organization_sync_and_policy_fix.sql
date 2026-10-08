create or replace function public.sync_faculty_organization_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_units(code, name, unit_type, parent_id, faculty_id, is_active)
  values ('FACULTY_UNION:' || new.id::text, 'Đoàn Khoa ' || new.current_name, 'faculty_union',
    '00000000-0000-4000-8000-000000000001', new.id, new.is_active)
  on conflict (code) do update set name = excluded.name, faculty_id = excluded.faculty_id,
    is_active = excluded.is_active, updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_class_organization_unit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_faculty_id uuid; v_parent_id uuid;
begin
  select current_faculty_id into v_faculty_id from public.programs where id = new.current_program_id;
  select id into v_parent_id from public.organization_units where unit_type = 'faculty_union' and faculty_id = v_faculty_id;
  insert into public.organization_units(code, name, unit_type, parent_id, class_id, is_active)
  values ('CLASS_UNION:' || new.id::text, 'Chi đoàn ' || new.current_name, 'class_union',
    v_parent_id, new.id, new.is_active)
  on conflict (code) do update set name = excluded.name, parent_id = excluded.parent_id,
    class_id = excluded.class_id, is_active = excluded.is_active, updated_at = now();
  return new;
end;
$$;

drop trigger if exists faculties_sync_organization on public.faculties;
create trigger faculties_sync_organization after insert or update of current_name, is_active
on public.faculties for each row execute function public.sync_faculty_organization_unit();

drop trigger if exists classes_sync_organization on public.classes;
create trigger classes_sync_organization after insert or update of current_name, current_program_id, is_active
on public.classes for each row execute function public.sync_class_organization_unit();

insert into public.organization_units(code, name, unit_type, parent_id, faculty_id, is_active)
select 'FACULTY_UNION:' || f.id::text, 'Đoàn Khoa ' || f.current_name, 'faculty_union',
  '00000000-0000-4000-8000-000000000001', f.id, f.is_active
from public.faculties f on conflict (code) do nothing;

insert into public.organization_units(code, name, unit_type, parent_id, class_id, is_active)
select 'CLASS_UNION:' || c.id::text, 'Chi đoàn ' || c.current_name, 'class_union', fu.id, c.id, c.is_active
from public.classes c
join public.programs p on p.id = c.current_program_id
join public.organization_units fu on fu.unit_type = 'faculty_union' and fu.faculty_id = p.current_faculty_id
on conflict (code) do nothing;

create or replace function public.can_read_role_grant(p_target_user_id uuid, p_target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_target_user_id = auth.uid()
    or public.has_active_role('school_admin')
    or exists (
      select 1 from public.role_grants actor
      where actor.user_id = auth.uid() and actor.revoked_at is null
        and actor.role_code = 'committee_manager'
        and actor.organization_id = p_target_organization_id
    );
$$;

drop policy if exists role_grants_read on public.role_grants;
create policy role_grants_read on public.role_grants for select to authenticated
  using (public.can_read_role_grant(user_id, organization_id));

grant execute on function public.can_read_role_grant(uuid, uuid) to authenticated;

comment on function public.sync_faculty_organization_unit is 'Keeps academic faculties manageable as faculty-union authorization scopes.';
