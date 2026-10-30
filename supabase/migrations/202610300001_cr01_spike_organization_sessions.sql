-- SPIKE CR-01-TaiKhoanToChuc (#37). Branch spike/, KHÔNG merge.
-- Chứng minh phương án: tài khoản tổ chức là bản ghi PIN băm (không phải người dùng Auth),
-- phiên tổ chức gắn đơn vị + cán bộ với session_id của JWT, các hàm kiểm quyền chỉ nhận
-- vai trò quản lý khi phiên hiện tại là phiên tổ chức của đúng đơn vị.

-- ── Giới hạn thử PIN tổ chức (dùng chung bảng auth_attempts) ───────────────────
alter table public.auth_attempts drop constraint if exists auth_attempts_action_check;
alter table public.auth_attempts add constraint auth_attempts_action_check
  check (action in ('login', 'register', 'recover', 'pin_change', 'org_login'));

-- ── Tài khoản tổ chức ──────────────────────────────────────────────────────────
create table if not exists public.organization_accounts (
  organization_id uuid primary key references public.organization_units(id) on delete restrict,
  pin_hash text not null,
  status text not null default 'active' check (status in ('active', 'locked')),
  created_by uuid references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chỉ Đoàn Trường, Văn phòng, Đoàn Khoa. Chi đoàn không bao giờ có tài khoản; Ban chưa làm.
create or replace function public.enforce_organization_account_unit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_type text;
begin
  select unit_type into v_type from public.organization_units where id = new.organization_id;
  if v_type is null or v_type not in ('school_union', 'office', 'faculty_union') then
    raise exception 'ORG_ACCOUNT_UNIT_NOT_ALLOWED';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_accounts_unit on public.organization_accounts;
create trigger organization_accounts_unit before insert or update on public.organization_accounts
  for each row execute function public.enforce_organization_account_unit();

alter table public.organization_accounts enable row level security;

-- ── Phiên tổ chức: session_id của Supabase Auth → đơn vị + cán bộ ─────────────
create table if not exists public.organization_sessions (
  session_id uuid primary key,
  organization_id uuid not null references public.organization_accounts(organization_id) on delete restrict,
  staff_user_id uuid not null references public.accounts(user_id) on delete restrict,
  staff_role_grant_id uuid not null references public.role_grants(id) on delete restrict,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '8 hours',
  ended_at timestamptz
);

alter table public.organization_sessions enable row level security;

-- Đơn vị của phiên hiện tại; null nếu là phiên cá nhân, phiên đã hết hạn/đăng xuất,
-- tài khoản tổ chức bị khóa hoặc đơn vị ngừng hoạt động.
create or replace function public.current_org_unit_id()
returns uuid language sql stable security definer set search_path = public as $$
  select s.organization_id
  from public.organization_sessions s
  join public.organization_accounts a on a.organization_id = s.organization_id and a.status = 'active'
  join public.organization_units ou on ou.id = s.organization_id and ou.is_active
  join public.role_grants rg on rg.id = s.staff_role_grant_id and rg.revoked_at is null
  where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and s.staff_user_id = auth.uid()
    and s.ended_at is null
    and s.expires_at > now()
    and exists (select 1 from auth.sessions x where x.id = s.session_id and x.user_id = s.staff_user_id);
$$;

create or replace function public.current_org_session_id()
returns uuid language sql stable security definer set search_path = public as $$
  select case when public.current_org_unit_id() is not null
    then nullif(auth.jwt() ->> 'session_id', '')::uuid end;
$$;

-- ── Đăng nhập tổ chức (chỉ server gọi bằng service role) ──────────────────────
create or replace function public.verify_organization_pin(p_organization_id uuid, p_pin text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.organization_accounts a
    join public.organization_units ou on ou.id = a.organization_id and ou.is_active
    where a.organization_id = p_organization_id
      and a.status = 'active'
      and a.pin_hash = crypt(p_pin, a.pin_hash)
  );
$$;

create or replace function public.start_organization_session(
  p_session_id uuid, p_organization_id uuid, p_staff_user_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_grant uuid;
begin
  if not exists (select 1 from public.accounts where user_id = p_staff_user_id and status = 'active') then
    raise exception 'STAFF_NOT_ALLOWED';
  end if;
  if not exists (select 1 from auth.sessions where id = p_session_id and user_id = p_staff_user_id) then
    raise exception 'SESSION_NOT_FOUND';
  end if;
  -- Vai trò quản lý còn hiệu lực ở đúng đơn vị (CTV và trưởng Ban không tính).
  select rg.id into v_grant
  from public.role_grants rg
  where rg.user_id = p_staff_user_id and rg.organization_id = p_organization_id and rg.revoked_at is null
    and rg.role_code in ('school_admin', 'office', 'faculty_manager', 'faculty_executive')
  order by rg.granted_at limit 1;
  if v_grant is null then raise exception 'STAFF_NOT_ALLOWED'; end if;

  insert into public.organization_sessions(session_id, organization_id, staff_user_id, staff_role_grant_id)
  values (p_session_id, p_organization_id, p_staff_user_id, v_grant);
  insert into public.audit_events(actor_user_id, active_role_grant_id, organization_id, acting_organization_id,
    organization_session_id, action, target_type, target_id)
  values (p_staff_user_id, v_grant, p_organization_id, p_organization_id, p_session_id,
    'organization_session.started', 'organization_account', p_organization_id::text);
  return v_grant;
end;
$$;

-- ── Audit ghi đơn vị và phiên tổ chức ─────────────────────────────────────────
alter table public.audit_events add column if not exists acting_organization_id uuid
  references public.organization_units(id) on delete set null;
alter table public.audit_events add column if not exists organization_session_id uuid;

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
    target_type, target_id, before_data, after_data, request_id,
    acting_organization_id, organization_session_id
  ) values (
    auth.uid(), p_role_grant_id, p_organization_id, p_action,
    p_target_type, p_target_id, p_before, p_after, p_request_id,
    public.current_org_unit_id(), public.current_org_session_id()
  ) returning id into v_id;
  return v_id;
end;
$$;

-- ── Hàm kiểm quyền chỉ nhận vai trò quản lý trong phiên tổ chức ───────────────
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
      and (rg.role_code in ('collaborator', 'committee_manager')
           or rg.organization_id = public.current_org_unit_id())
  );
$$;

create or replace function public.event_program_manager_grant(p_org_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select rg.id
  from public.role_grants rg
  join public.organization_units ou on ou.id = rg.organization_id
  where rg.user_id = auth.uid()
    and rg.revoked_at is null
    and rg.organization_id = p_org_id
    and rg.organization_id = public.current_org_unit_id()
    and rg.role_code in ('faculty_manager', 'faculty_executive')
    and ou.unit_type = 'faculty_union'
    and ou.is_active
  order by case rg.role_code when 'faculty_manager' then 0 else 1 end, rg.granted_at
  limit 1;
$$;

create or replace function public.event_program_reviewer_grant()
returns uuid
language sql stable security definer set search_path = public as $$
  select rg.id
  from public.role_grants rg
  join public.organization_units ou on ou.id = rg.organization_id
  where rg.user_id = auth.uid()
    and rg.revoked_at is null
    and rg.role_code = 'office'
    and ou.unit_type = 'office'
    and ou.is_active
    and rg.organization_id = public.current_org_unit_id()
  order by rg.granted_at
  limit 1;
$$;

revoke all on function public.current_org_unit_id() from public, anon;
revoke all on function public.current_org_session_id() from public, anon;
revoke all on function public.verify_organization_pin(uuid, text) from public, anon, authenticated;
revoke all on function public.start_organization_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.current_org_unit_id() to authenticated;
grant execute on function public.current_org_session_id() to authenticated;
grant execute on function public.verify_organization_pin(uuid, text) to service_role;
grant execute on function public.start_organization_session(uuid, uuid, uuid) to service_role;
