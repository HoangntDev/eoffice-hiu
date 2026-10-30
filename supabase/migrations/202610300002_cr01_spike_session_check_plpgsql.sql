-- SPIKE CR-01 (#37), không merge. Phát hiện khi đo: bản SQL của current_org_unit_id/has_active_role
-- (202610300001) tốn khoảng 0,60 ms mỗi lần gọi has_active_role so với khoảng 0,017 ms trước CR
-- (10.000 lần gọi, 30/10/2026): hàm SQL security definer có SET search_path không được inline và
-- phép nối 5 bảng được lập kế hoạch lại mỗi lần gọi. Viết lại bằng plpgsql để dùng plan đã cache
-- và chỉ tính đơn vị của phiên một lần mỗi lần gọi (đo được khoảng 0,08–0,11 ms).

create or replace function public.current_org_unit_id()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_org uuid;
begin
  select s.organization_id into v_org
  from public.organization_sessions s
  join public.organization_accounts a on a.organization_id = s.organization_id and a.status = 'active'
  join public.organization_units ou on ou.id = s.organization_id and ou.is_active
  join public.role_grants rg on rg.id = s.staff_role_grant_id and rg.revoked_at is null
  where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and s.staff_user_id = auth.uid()
    and s.ended_at is null
    and s.expires_at > now()
    and exists (select 1 from auth.sessions x where x.id = s.session_id and x.user_id = s.staff_user_id);
  return v_org;
end;
$$;

create or replace function public.has_active_role(
  p_role_code text,
  p_organization_id uuid default null
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_org uuid := public.current_org_unit_id();
begin
  return exists (
    select 1 from public.role_grants rg
    where rg.user_id = auth.uid()
      and rg.role_code = p_role_code
      and rg.revoked_at is null
      and (p_organization_id is null or rg.organization_id = p_organization_id)
      and (rg.role_code in ('collaborator', 'committee_manager') or rg.organization_id = v_org)
  );
end;
$$;

create or replace function public.event_program_manager_grant(p_org_id uuid)
returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_grant uuid;
begin
  if p_org_id is distinct from public.current_org_unit_id() then return null; end if;
  select rg.id into v_grant
  from public.role_grants rg
  join public.organization_units ou on ou.id = rg.organization_id
  where rg.user_id = auth.uid()
    and rg.revoked_at is null
    and rg.organization_id = p_org_id
    and rg.role_code in ('faculty_manager', 'faculty_executive')
    and ou.unit_type = 'faculty_union'
    and ou.is_active
  order by case rg.role_code when 'faculty_manager' then 0 else 1 end, rg.granted_at
  limit 1;
  return v_grant;
end;
$$;

create or replace function public.event_program_reviewer_grant()
returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_grant uuid; v_org uuid := public.current_org_unit_id();
begin
  if v_org is null then return null; end if;
  select rg.id into v_grant
  from public.role_grants rg
  join public.organization_units ou on ou.id = rg.organization_id
  where rg.user_id = auth.uid()
    and rg.revoked_at is null
    and rg.role_code = 'office'
    and ou.unit_type = 'office'
    and ou.is_active
    and rg.organization_id = v_org
  order by rg.granted_at
  limit 1;
  return v_grant;
end;
$$;
