-- SPIKE CR-01-TaiKhoanToChuc (#37), phương án ưu tiên ngày 30/10/2026. Branch spike/, KHÔNG merge.
-- Tài khoản tổ chức là một dòng accounts loại 'organization' (người dùng Auth riêng, mật khẩu Auth ngẫu
-- nhiên, không ai biết) và giữ role_grants của đơn vị. Cán bộ là thành viên đơn vị, chỉ dùng để xác thực
-- bước 2. RPC/RLS kiểm quyền giữ nguyên; write_audit ghi cán bộ và từ chối ghi khi phiên tổ chức chưa có
-- cán bộ; quy tắc tự duyệt xét theo cán bộ.

-- ── 0. Giới hạn thử PIN tổ chức (dùng chung bảng auth_attempts) ───────────────
alter table public.auth_attempts drop constraint if exists auth_attempts_action_check;
alter table public.auth_attempts add constraint auth_attempts_action_check
  check (action in ('login', 'register', 'recover', 'pin_change', 'org_login'));

-- ── 1. Loại tài khoản ─────────────────────────────────────────────────────────
alter table public.accounts add column if not exists account_type text not null default 'student'
  check (account_type in ('student', 'organization'));
alter table public.accounts add column if not exists organization_id uuid unique
  references public.organization_units(id) on delete restrict;
alter table public.accounts alter column student_code drop not null;
alter table public.accounts drop constraint if exists accounts_student_code_current_rule;
alter table public.accounts add constraint accounts_student_code_current_rule check (
  (account_type = 'student' and student_code is not null and organization_id is null
     and public.is_valid_student_code(student_code, created_at::date))
  or (account_type = 'organization' and student_code is null and organization_id is not null)
);

-- Quy tắc MSSV hiện hành chỉ áp dụng cho tài khoản sinh viên.
create or replace function public.enforce_current_student_code_rule()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.account_type = 'student' and not public.is_valid_student_code(new.student_code, current_date) then
    raise exception 'INVALID_STUDENT_CODE';
  end if;
  return new;
end;
$$;

-- Chỉ Đoàn Trường, Văn phòng, Đoàn Khoa. Chi đoàn không bao giờ có tài khoản; Ban chưa làm.
create or replace function public.enforce_organization_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_type text;
begin
  if new.account_type = 'organization' then
    select unit_type into v_type from public.organization_units where id = new.organization_id;
    if v_type is null or v_type not in ('school_union', 'office', 'faculty_union') then
      raise exception 'ORG_ACCOUNT_UNIT_NOT_ALLOWED';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.account_type <> old.account_type then raise exception 'ACCOUNT_TYPE_IMMUTABLE'; end if;
  return new;
end;
$$;
drop trigger if exists accounts_organization_rule on public.accounts;
create trigger accounts_organization_rule before insert or update on public.accounts
  for each row execute function public.enforce_organization_account();

-- Không cho đổi đơn vị đang có tài khoản tổ chức sang loại không được phép.
create or replace function public.enforce_organization_unit_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.unit_type <> old.unit_type and new.unit_type not in ('school_union', 'office', 'faculty_union')
     and exists (select 1 from public.accounts where organization_id = new.id) then
    raise exception 'ORG_ACCOUNT_UNIT_NOT_ALLOWED';
  end if;
  return new;
end;
$$;
drop trigger if exists organization_units_account_type on public.organization_units;
create trigger organization_units_account_type before update of unit_type on public.organization_units
  for each row execute function public.enforce_organization_unit_type();

-- Email @student.hiu.vn chỉ dành cho sinh viên: tài khoản tổ chức không có dòng account_emails.
create or replace function public.enforce_student_email_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.accounts where user_id = new.user_id and account_type <> 'student') then
    raise exception 'STUDENT_EMAIL_ONLY_FOR_STUDENTS';
  end if;
  return new;
end;
$$;
drop trigger if exists account_emails_student_only on public.account_emails;
create trigger account_emails_student_only before insert or update on public.account_emails
  for each row execute function public.enforce_student_email_owner();

-- Vai trò quản lý chỉ cấp cho tài khoản tổ chức của chính đơn vị đó. CTV, trưởng Ban giữ ở tài khoản cá nhân.
create or replace function public.enforce_role_grant_holder()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_type text; v_org uuid;
begin
  if new.revoked_at is not null then return new; end if;
  select account_type, organization_id into v_type, v_org from public.accounts where user_id = new.user_id;
  if new.role_code in ('school_admin', 'office', 'faculty_manager', 'faculty_executive') then
    if v_type is distinct from 'organization' or v_org is distinct from new.organization_id then
      raise exception 'MANAGEMENT_ROLE_REQUIRES_ORGANIZATION_ACCOUNT';
    end if;
  elsif v_type is distinct from 'student' then
    raise exception 'PERSONAL_ROLE_REQUIRES_STUDENT_ACCOUNT';
  end if;
  return new;
end;
$$;
drop trigger if exists role_grants_holder_rule on public.role_grants;
create trigger role_grants_holder_rule before insert or update on public.role_grants
  for each row execute function public.enforce_role_grant_holder();

-- ── 2. PIN tổ chức, thành viên đơn vị, đăng nhập hai bước ─────────────────────
create table if not exists public.organization_pins (
  account_user_id uuid primary key references public.accounts(user_id) on delete restrict,
  pin_hash text not null,
  updated_by uuid references public.accounts(user_id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization_units(id) on delete restrict,
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  member_role text not null check (member_role in ('manager', 'executive', 'officer')),
  source_role_grant_id uuid references public.role_grants(id) on delete set null,
  added_by uuid references public.accounts(user_id) on delete restrict,
  added_at timestamptz not null default now(),
  revoked_by uuid references public.accounts(user_id) on delete restrict,
  revoked_at timestamptz,
  reason text not null check (char_length(btrim(reason)) >= 3)
);
create unique index if not exists organization_members_one_active
  on public.organization_members(organization_id, user_id) where revoked_at is null;

create or replace function public.enforce_member_is_student()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.accounts where user_id = new.user_id and account_type = 'student') then
    raise exception 'MEMBER_MUST_BE_STUDENT_ACCOUNT';
  end if;
  return new;
end;
$$;
drop trigger if exists organization_members_student on public.organization_members;
create trigger organization_members_student before insert or update on public.organization_members
  for each row execute function public.enforce_member_is_student();

-- Bước 1 tạo "phiên tạm": chỉ là một dòng ở DB (cookie giữ id ngẫu nhiên), không có phiên Auth nên
-- không gọi được RPC nào. Hết hạn sau 5 phút, dùng một lần.
create table if not exists public.organization_login_challenges (
  id uuid primary key default gen_random_uuid(),
  account_user_id uuid not null references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes',
  used_at timestamptz
);

-- Phiên Auth của tài khoản tổ chức → cán bộ đang thao tác.
create table if not exists public.organization_session_officers (
  session_id uuid primary key,
  account_user_id uuid not null references public.accounts(user_id) on delete restrict,
  officer_user_id uuid not null references public.accounts(user_id) on delete restrict,
  member_id uuid not null references public.organization_members(id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.organization_pins enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_login_challenges enable row level security;
alter table public.organization_session_officers enable row level security;

-- Cán bộ của phiên hiện tại; null nếu không phải phiên tổ chức hoặc cán bộ không còn hiệu lực.
create or replace function public.current_officer_user_id()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_officer uuid;
begin
  select s.officer_user_id into v_officer
  from public.organization_session_officers s
  join public.organization_members m on m.id = s.member_id and m.revoked_at is null
  join public.accounts o on o.user_id = s.officer_user_id and o.status = 'active'
  join public.accounts a on a.user_id = s.account_user_id and a.status = 'active'
  where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and s.account_user_id = auth.uid()
    and s.ended_at is null;
  return v_officer;
end;
$$;

create or replace function public.is_organization_account(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.accounts where user_id = p_user_id and account_type = 'organization');
$$;

-- Chỉ server (service role): kiểm PIN tổ chức, tạo phiên tạm.
create or replace function public.start_organization_login(p_account_user_id uuid, p_pin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.accounts a
    join public.organization_units ou on ou.id = a.organization_id and ou.is_active
    join public.organization_pins p on p.account_user_id = a.user_id
    where a.user_id = p_account_user_id and a.account_type = 'organization' and a.status = 'active'
      and p.pin_hash = crypt(p_pin, p.pin_hash)
  ) then
    return null;
  end if;
  insert into public.organization_login_challenges(account_user_id) values (p_account_user_id) returning id into v_id;
  return v_id;
end;
$$;

-- Phiên tạm còn hạn → tài khoản tổ chức (đánh dấu đã dùng khi p_consume).
create or replace function public.read_organization_login(p_challenge_id uuid, p_consume boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  select account_user_id into v_account from public.organization_login_challenges
  where id = p_challenge_id and used_at is null and expires_at > now()
  for update;
  if v_account is not null and p_consume then
    update public.organization_login_challenges set used_at = now() where id = p_challenge_id;
  end if;
  return v_account;
end;
$$;

-- Cán bộ phải là thành viên còn hiệu lực, tài khoản sinh viên active.
create or replace function public.organization_member_for(p_account_user_id uuid, p_officer_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.id from public.organization_members m
  join public.accounts a on a.user_id = p_account_user_id and a.organization_id = m.organization_id
  join public.accounts o on o.user_id = m.user_id and o.status = 'active' and o.account_type = 'student'
  where m.user_id = p_officer_user_id and m.revoked_at is null
  limit 1;
$$;

create or replace function public.start_officer_session(p_session_id uuid, p_account_user_id uuid, p_officer_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_member uuid; v_org uuid;
begin
  v_member := public.organization_member_for(p_account_user_id, p_officer_user_id);
  if v_member is null then raise exception 'OFFICER_NOT_ALLOWED'; end if;
  if not exists (select 1 from auth.sessions where id = p_session_id and user_id = p_account_user_id) then
    raise exception 'SESSION_NOT_FOUND';
  end if;
  select organization_id into v_org from public.accounts where user_id = p_account_user_id;
  insert into public.organization_session_officers(session_id, account_user_id, officer_user_id, member_id)
  values (p_session_id, p_account_user_id, p_officer_user_id, v_member);
  insert into public.audit_events(actor_user_id, officer_user_id, organization_session_id, organization_id, action, target_type, target_id)
  values (p_account_user_id, p_officer_user_id, p_session_id, v_org, 'organization_session.officer_started', 'organization_member', v_member::text);
  return v_member;
end;
$$;

create or replace function public.end_officer_session(p_session_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.organization_session_officers set ended_at = now() where session_id = p_session_id and ended_at is null;
$$;

-- ── 3. Audit và lịch sử ghi cán bộ ───────────────────────────────────────────
alter table public.audit_events add column if not exists officer_user_id uuid references public.accounts(user_id) on delete restrict;
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
declare v_id bigint; v_officer uuid;
begin
  if public.is_organization_account(auth.uid()) then
    v_officer := public.current_officer_user_id();
    -- Phiên tổ chức không có cán bộ (vd. lấy được phiên Auth bằng đường khác) thì không được ghi.
    if v_officer is null then raise exception 'OFFICER_REQUIRED'; end if;
  end if;
  insert into public.audit_events(
    actor_user_id, active_role_grant_id, organization_id, action,
    target_type, target_id, before_data, after_data, request_id,
    officer_user_id, organization_session_id
  ) values (
    auth.uid(), p_role_grant_id, p_organization_id, p_action,
    p_target_type, p_target_id, p_before, p_after, p_request_id,
    v_officer, case when v_officer is not null then nullif(auth.jwt() ->> 'session_id', '')::uuid end
  ) returning id into v_id;
  return v_id;
end;
$$;

alter table public.event_program_history add column if not exists actor_officer_user_id uuid references public.accounts(user_id) on delete restrict;
alter table public.program_registration_history add column if not exists actor_officer_user_id uuid references public.accounts(user_id) on delete restrict;
alter table public.program_attendance_history add column if not exists actor_officer_user_id uuid references public.accounts(user_id) on delete restrict;

-- Dùng chung cho 3 bảng lịch sử: ghi cán bộ, tên hiển thị "Đơn vị – Cán bộ".
create or replace function public.fill_event_program_history_actor()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_unit text;
begin
  select rg.role_code into new.actor_role_code from public.role_grants rg where rg.id = new.actor_role_grant_id;
  if public.is_organization_account(new.actor_user_id) then
    new.actor_officer_user_id := coalesce(new.actor_officer_user_id, public.current_officer_user_id());
    select ou.name into v_unit from public.accounts a join public.organization_units ou on ou.id = a.organization_id
    where a.user_id = new.actor_user_id;
    select v_unit || ' – ' || coalesce(sp.full_name, a.student_code) into new.actor_name
    from public.accounts a left join public.student_profiles sp on sp.user_id = a.user_id
    where a.user_id = new.actor_officer_user_id;
    new.actor_name := coalesce(new.actor_name, v_unit);
  else
    select coalesce(sp.full_name, a.student_code) into new.actor_name
    from public.accounts a
    left join public.student_profiles sp on sp.user_id = a.user_id
    where a.user_id = new.actor_user_id;
  end if;
  return new;
end;
$$;

-- ── 4. Người lập không tự duyệt: xét theo cán bộ ─────────────────────────────
create or replace function public.review_event_program(
  p_program_id uuid,
  p_decision   text,
  p_reason     text,
  p_request_id text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_program public.event_programs%rowtype;
  v_grant   uuid;
  v_to      text;
  v_action  text;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
  v_person  uuid := coalesce(public.current_officer_user_id(), auth.uid());
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  v_grant := public.event_program_reviewer_grant();
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if p_decision not in ('approve', 'request_changes', 'reject') then raise exception 'INVALID_DECISION'; end if;
  if p_decision in ('request_changes', 'reject') and char_length(coalesce(v_reason, '')) < 10 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_program from public.event_programs where id = p_program_id for update;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  if v_program.status <> 'submitted' then raise exception 'INVALID_TRANSITION'; end if;
  if exists (
    select 1 from public.event_program_history h
    where h.program_id = p_program_id and h.action = 'submitted'
      and coalesce(h.actor_officer_user_id, h.actor_user_id) = v_person
  ) then
    raise exception 'SELF_REVIEW_FORBIDDEN';
  end if;

  v_to := case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'needs_changes' end;
  v_action := case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'changes_requested' end;

  update public.event_programs
  set status = v_to,
      decided_at = case when v_to in ('approved', 'rejected') then now() end,
      decided_by = case when v_to in ('approved', 'rejected') then auth.uid() end,
      updated_at = now()
  where id = p_program_id;

  insert into public.event_program_history(program_id, action, from_status, to_status, reason, document_id, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, v_action, 'submitted', v_to, v_reason, v_program.current_document_id, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('event_program.' || v_action, 'event_program', p_program_id::text,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', v_to, 'reason', v_reason),
    v_grant, v_program.owner_org_id, p_request_id);
  return v_to;
end;
$$;

-- ── 5. Tạo tài khoản tổ chức (người dùng Auth + accounts + role_grants) ──────
-- Tạo người dùng Auth bằng SQL để dùng được trong migration dữ liệu. Mật khẩu Auth ngẫu nhiên, không lưu ở
-- đâu: không ai đăng nhập thẳng vào Auth bằng tài khoản này; server tạo phiên bằng magic link sau bước 2.
create or replace function public.create_organization_account(p_organization_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_user uuid := gen_random_uuid(); v_code text; v_type text; v_email text; v_role text;
begin
  select code, unit_type into v_code, v_type from public.organization_units where id = p_organization_id;
  if v_type is null or v_type not in ('school_union', 'office', 'faculty_union') then
    raise exception 'ORG_ACCOUNT_UNIT_NOT_ALLOWED';
  end if;
  if exists (select 1 from public.accounts where organization_id = p_organization_id) then
    raise exception 'ORG_ACCOUNT_EXISTS';
  end if;
  v_email := 'org-' || p_organization_id::text || '@org.eoffice.invalid';
  insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', v_email,
    crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'account_type', 'organization'),
    jsonb_build_object('organization_code', v_code), now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities(provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_user::text, v_user, jsonb_build_object('sub', v_user::text, 'email', v_email, 'email_verified', true),
    'email', null, now(), now());
  -- Chưa có PIN tổ chức: chờ Đoàn Trường đặt PIN thì mới active.
  insert into public.accounts(user_id, account_type, organization_id, status) values (v_user, 'organization', p_organization_id, 'pending_pin');
  v_role := case v_type when 'school_union' then 'school_admin' when 'office' then 'office' else 'faculty_manager' end;
  insert into public.role_grants(user_id, role_code, organization_id, reason) values (v_user, v_role, p_organization_id, p_reason);
  return v_user;
end;
$$;

create or replace function public.set_organization_pin(p_account_user_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_pin !~ '^[0-9]{6}$' then raise exception 'INVALID_PIN'; end if;
  insert into public.organization_pins(account_user_id, pin_hash) values (p_account_user_id, crypt(p_pin, gen_salt('bf', 10)))
  on conflict (account_user_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  update public.accounts set status = 'active' where user_id = p_account_user_id and status = 'pending_pin';
end;
$$;

-- ── 6. Chuyển dữ liệu: role_grants quản lý của tài khoản cá nhân → tài khoản tổ chức + thành viên ──
do $$
declare r record; v_account uuid; n_grants int := 0; n_units int := 0;
begin
  for r in
    select rg.id, rg.user_id, rg.role_code, rg.organization_id
    from public.role_grants rg
    join public.accounts a on a.user_id = rg.user_id and a.account_type = 'student'
    join public.organization_units ou on ou.id = rg.organization_id
    where rg.revoked_at is null
      and rg.role_code in ('school_admin', 'office', 'faculty_manager', 'faculty_executive')
      and ou.unit_type in ('school_union', 'office', 'faculty_union')
    order by rg.organization_id, rg.granted_at
  loop
    select user_id into v_account from public.accounts where organization_id = r.organization_id;
    if v_account is null then
      v_account := public.create_organization_account(r.organization_id, 'CR-01: chuyển vai trò quản lý sang tài khoản tổ chức');
      n_units := n_units + 1;
    end if;
    insert into public.organization_members(organization_id, user_id, member_role, source_role_grant_id, reason)
    values (r.organization_id, r.user_id,
      case r.role_code when 'faculty_executive' then 'executive' when 'faculty_manager' then 'manager' else 'officer' end,
      r.id, 'CR-01: chuyển từ role_grants ' || r.role_code)
    on conflict (organization_id, user_id) where revoked_at is null do nothing;
    update public.role_grants set revoked_at = now(), reason = reason || ' | CR-01: chuyển sang tài khoản tổ chức'
    where id = r.id;
    insert into public.audit_events(actor_user_id, active_role_grant_id, organization_id, action, target_type, target_id, after_data)
    values (null, r.id, r.organization_id, 'role.migrated_to_organization', 'role_grant', r.id::text,
      jsonb_build_object('from_user_id', r.user_id, 'to_user_id', v_account, 'role_code', r.role_code));
    n_grants := n_grants + 1;
  end loop;
  raise notice 'CR-01 data migration: % role_grants chuyển, % tài khoản tổ chức mới', n_grants, n_units;
end;
$$;

revoke all on function public.current_officer_user_id() from public, anon;
revoke all on function public.is_organization_account(uuid) from public, anon;
revoke all on function public.start_organization_login(uuid, text) from public, anon, authenticated;
revoke all on function public.read_organization_login(uuid, boolean) from public, anon, authenticated;
revoke all on function public.organization_member_for(uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_officer_session(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.end_officer_session(uuid) from public, anon, authenticated;
revoke all on function public.create_organization_account(uuid, text) from public, anon, authenticated;
revoke all on function public.set_organization_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.current_officer_user_id() to authenticated;
grant execute on function public.is_organization_account(uuid) to authenticated;
grant execute on function public.start_organization_login(uuid, text) to service_role;
grant execute on function public.read_organization_login(uuid, boolean) to service_role;
grant execute on function public.organization_member_for(uuid, uuid) to service_role;
grant execute on function public.start_officer_session(uuid, uuid, uuid) to service_role;
grant execute on function public.end_officer_session(uuid) to service_role;
grant execute on function public.create_organization_account(uuid, text) to service_role;
grant execute on function public.set_organization_pin(uuid, text) to service_role;
