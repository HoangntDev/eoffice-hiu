-- CR-01-TaiKhoanToChuc (#37): tài khoản tổ chức và công tắc chuyển đổi an toàn.
-- Tài khoản tổ chức là một dòng accounts loại 'organization' (người dùng Auth riêng, mật khẩu Auth ngẫu
-- nhiên, không ai biết) và giữ role_grants của đơn vị. Cán bộ là thành viên đơn vị, chỉ dùng để xác thực
-- bước 2. RPC/RLS kiểm quyền giữ nguyên; write_audit ghi cán bộ và từ chối ghi khi phiên tổ chức chưa có
-- cán bộ; quy tắc tự duyệt xét theo cán bộ.

-- ── 0. Giới hạn thử PIN tổ chức (dùng chung bảng auth_attempts) ───────────────
alter table public.auth_attempts drop constraint if exists auth_attempts_action_check;
alter table public.auth_attempts add constraint auth_attempts_action_check
  check (action in ('login', 'register', 'recover', 'pin_change', 'org_login'));

-- Công tắc nằm trong database để RPC/RLS và ứng dụng cùng đọc một nguồn sự thật.
create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.accounts(user_id) on delete restrict,
  reason text
);
alter table public.feature_flags enable row level security;
insert into public.feature_flags(key, enabled, reason)
values ('ORG_ACCOUNTS_ENABLED', false, 'Mặc định tắt khi áp migration CR-01');

create or replace function public.feature_flag_enabled(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_enabled boolean;
begin
  select f.enabled into v_enabled from public.feature_flags f where f.key = p_key;
  return coalesce(v_enabled, false);
end;
$$;

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
  if new.account_type = 'student'
     and not coalesce(public.is_valid_student_code(new.student_code, current_date), false) then
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

-- Grant quản lý cá nhân vẫn được lưu để công tắc có thể quay về hành vi v1.0.0.
-- Với tài khoản tổ chức, grant phải thuộc chính đơn vị; vai trò cá nhân không cấp cho tổ chức.
create or replace function public.enforce_role_grant_holder()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_type text; v_org uuid;
begin
  if new.revoked_at is not null then return new; end if;
  select account_type, organization_id into v_type, v_org from public.accounts where user_id = new.user_id;
  if v_type = 'organization' and new.role_code in ('school_admin', 'office', 'faculty_manager', 'faculty_executive') then
    if v_org is distinct from new.organization_id then
      raise exception 'MANAGEMENT_ROLE_REQUIRES_ORGANIZATION_ACCOUNT';
    end if;
  elsif v_type = 'organization' then
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
create or replace function public.start_organization_login(p_organization_id uuid, p_pin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.accounts a
    join public.organization_units ou on ou.id = a.organization_id and ou.is_active
    join public.organization_pins p on p.account_user_id = a.user_id
    where a.user_id = p_organization_id and a.account_type = 'organization' and a.status = 'active'
      and p.pin_hash = crypt(p_pin, p.pin_hash)
  ) then
    return null;
  end if;
  insert into public.organization_login_challenges(account_user_id) values (p_organization_id) returning id into v_id;
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
  -- Chưa có PIN tổ chức: dùng trạng thái suspended cho tới khi PIN được đặt.
  insert into public.accounts(user_id, account_type, organization_id, status) values (v_user, 'organization', p_organization_id, 'suspended');
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
  update public.accounts set status = 'active' where user_id = p_account_user_id;
end;
$$;

-- ── 6. Chuyển dữ liệu: sao chép quyền sang tổ chức, không thu hồi grant cá nhân ──
create or replace function public.migrate_management_grants_to_organizations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare r record; v_account uuid; n_grants int := 0;
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
    end if;
    insert into public.organization_members(organization_id, user_id, member_role, source_role_grant_id, reason)
    values (r.organization_id, r.user_id,
      case r.role_code when 'faculty_executive' then 'executive' when 'faculty_manager' then 'manager' else 'officer' end,
      r.id, 'CR-01: chuyển từ role_grants ' || r.role_code)
    on conflict (organization_id, user_id) where revoked_at is null do nothing;
    insert into public.audit_events(actor_user_id, active_role_grant_id, organization_id, action, target_type, target_id, after_data)
    values (null, r.id, r.organization_id, 'role.copied_to_organization', 'role_grant', r.id::text,
      jsonb_build_object('from_user_id', r.user_id, 'to_user_id', v_account, 'role_code', r.role_code));
    n_grants := n_grants + 1;
  end loop;
  return n_grants;
end;
$$;

-- Bootstrap mới tạo quyền trên tài khoản Đoàn Trường và ghi người chạy là thành viên.
create or replace function public.bootstrap_school_admin(p_user_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school constant uuid := '00000000-0000-4000-8000-000000000001';
  v_account uuid;
begin
  if not exists (
    select 1 from public.accounts a
    where a.user_id = p_user_id and a.account_type = 'student' and a.status = 'active'
  ) then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;

  select a.user_id into v_account
  from public.accounts a
  where a.organization_id = v_school and a.account_type = 'organization';

  if v_account is null then
    v_account := public.create_organization_account(v_school, p_reason);
  end if;

  insert into public.organization_members(
    organization_id, user_id, member_role, added_by, reason
  ) values (v_school, p_user_id, 'manager', p_user_id, p_reason)
  on conflict (organization_id, user_id) where revoked_at is null do nothing;

  insert into public.audit_events(
    actor_user_id, organization_id, action, target_type, target_id, after_data
  ) values (
    p_user_id, v_school, 'organization_account.bootstrap', 'account', v_account::text,
    jsonb_build_object('role_code', 'school_admin')
  );
  perform public.seed_camtinh_doan_template(p_user_id);
  return v_account;
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
revoke all on function public.feature_flag_enabled(text) from public, anon;
revoke all on function public.migrate_management_grants_to_organizations() from public, anon, authenticated;
grant execute on function public.current_officer_user_id() to authenticated;
grant execute on function public.is_organization_account(uuid) to authenticated;
grant execute on function public.start_organization_login(uuid, text) to service_role;
grant execute on function public.read_organization_login(uuid, boolean) to service_role;
grant execute on function public.organization_member_for(uuid, uuid) to service_role;
grant execute on function public.start_officer_session(uuid, uuid, uuid) to service_role;
grant execute on function public.end_officer_session(uuid) to service_role;
grant execute on function public.create_organization_account(uuid, text) to service_role;
grant execute on function public.set_organization_pin(uuid, text) to service_role;
grant execute on function public.feature_flag_enabled(text) to authenticated, service_role;
grant execute on function public.migrate_management_grants_to_organizations() to service_role;

-- ── 7. Phiên tổ chức, đăng nhập và quản lý tài khoản ─────────────────────────
create index if not exists organization_members_lookup_idx
  on public.organization_members(organization_id, user_id) where revoked_at is null;
create index if not exists organization_login_challenges_expiry_idx
  on public.organization_login_challenges(expires_at) where used_at is null;
create index if not exists organization_session_officers_active_idx
  on public.organization_session_officers(account_user_id, officer_user_id) where ended_at is null;

create or replace function public.organization_session_ok()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account_type text;
  v_session_id uuid;
begin
  if auth.uid() is null then return false; end if;
  select a.account_type into v_account_type
  from public.accounts a
  where a.user_id = auth.uid() and a.status = 'active';
  if v_account_type is null then return false; end if;
  if v_account_type <> 'organization' then return true; end if;

  begin
    v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if v_session_id is null then return false; end if;

  return exists (
    select 1
    from public.organization_session_officers s
    join public.organization_members m on m.id = s.member_id
      and m.organization_id = (select a.organization_id from public.accounts a where a.user_id = s.account_user_id)
      and m.user_id = s.officer_user_id
      and m.revoked_at is null
    join public.accounts officer on officer.user_id = s.officer_user_id
      and officer.account_type = 'student' and officer.status = 'active'
    join auth.sessions auth_session on auth_session.id = s.session_id
      and auth_session.user_id = s.account_user_id
    where s.session_id = v_session_id
      and s.account_user_id = auth.uid()
      and s.ended_at is null
  );
end;
$$;

create or replace function public.management_account_allowed()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_type text;
begin
  select a.account_type into v_type from public.accounts a where a.user_id = auth.uid();
  if not public.feature_flag_enabled('ORG_ACCOUNTS_ENABLED') then
    return v_type = 'student';
  end if;
  return v_type = 'organization' and public.organization_session_ok();
end;
$$;

-- Bước 1 nhận đơn vị, luôn kiểm một bcrypt thật hoặc bcrypt giả để tránh lộ sự tồn tại tài khoản.
create or replace function public.start_organization_login(p_organization_id uuid, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_account uuid;
  v_hash text;
  v_challenge uuid;
  v_dummy constant text := '$2a$10$SEu1jPh5YpnNNt.OjRukUe1ptALn4my13.j5jnu3aeuPit098HCPW';
begin
  if not public.feature_flag_enabled('ORG_ACCOUNTS_ENABLED') then return null; end if;
  select a.user_id, p.pin_hash into v_account, v_hash
  from public.accounts a
  join public.organization_units ou on ou.id = a.organization_id and ou.is_active
  join public.organization_pins p on p.account_user_id = a.user_id
  where a.organization_id = p_organization_id
    and a.account_type = 'organization'
    and a.status = 'active';

  if crypt(coalesce(p_pin, ''), coalesce(v_hash, v_dummy))
       is distinct from coalesce(v_hash, v_dummy)
     or v_account is null then
    return null;
  end if;

  insert into public.organization_login_challenges(account_user_id)
  values (v_account) returning id into v_challenge;
  return v_challenge;
end;
$$;

create or replace function public.list_organization_login_units()
returns table(organization_id uuid, name text, unit_type text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.feature_flag_enabled('ORG_ACCOUNTS_ENABLED') then return; end if;
  return query
  select ou.id, ou.name, ou.unit_type
  from public.organization_units ou
  join public.accounts a on a.organization_id = ou.id
    and a.account_type = 'organization' and a.status = 'active'
  where ou.is_active
    and ou.unit_type in ('school_union', 'office', 'faculty_union')
  order by case ou.unit_type when 'school_union' then 1 when 'office' then 2 else 3 end,
    ou.name;
end;
$$;

-- Đổi cán bộ không yêu cầu nhập lại PIN tổ chức: server tạo một challenge mới cho đúng tài khoản
-- trước khi thu hồi phiên Auth cũ.
create or replace function public.start_organization_switch(p_account_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_challenge uuid;
begin
  if not public.feature_flag_enabled('ORG_ACCOUNTS_ENABLED') then return null; end if;
  if not exists (
    select 1 from public.accounts a
    join public.organization_units ou on ou.id = a.organization_id and ou.is_active
    where a.user_id = p_account_user_id and a.account_type = 'organization' and a.status = 'active'
  ) then return null; end if;
  insert into public.organization_login_challenges(account_user_id)
  values (p_account_user_id) returning id into v_challenge;
  return v_challenge;
end;
$$;

create or replace function public.end_officer_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.organization_session_officers
  set ended_at = now()
  where session_id = p_session_id and ended_at is null;
  delete from auth.sessions where id = p_session_id;
end;
$$;

create or replace function public.set_feature_flag(p_key text, p_enabled boolean, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_before boolean;
begin
  select a.organization_id into v_org
  from public.accounts a
  join public.organization_units ou on ou.id = a.organization_id
  where a.user_id = auth.uid() and a.account_type = 'organization'
    and ou.unit_type = 'school_union';
  if v_org is null or not public.organization_session_ok() then raise exception 'FORBIDDEN'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'REASON_REQUIRED'; end if;

  select f.enabled into v_before from public.feature_flags f where f.key = p_key for update;
  if v_before is null then raise exception 'FEATURE_FLAG_NOT_FOUND'; end if;
  update public.feature_flags
  set enabled = p_enabled, updated_at = now(), updated_by = auth.uid(), reason = p_reason
  where key = p_key;
  perform public.write_audit(
    'feature_flag.updated', 'feature_flag', p_key,
    jsonb_build_object('enabled', v_before), jsonb_build_object('enabled', p_enabled, 'reason', p_reason),
    null, v_org, null
  );
  return true;
end;
$$;

create or replace function public.manage_organization_account(
  p_organization_id uuid,
  p_action text,
  p_pin text,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school uuid;
  v_account uuid;
  v_before text;
begin
  select a.organization_id into v_school
  from public.accounts a
  join public.organization_units ou on ou.id = a.organization_id
  where a.user_id = auth.uid() and a.account_type = 'organization'
    and ou.unit_type = 'school_union';
  if v_school is null or not public.organization_session_ok() then raise exception 'FORBIDDEN'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'REASON_REQUIRED'; end if;

  select a.user_id, a.status into v_account, v_before
  from public.accounts a where a.organization_id = p_organization_id for update;

  if p_action = 'create' then
    if v_account is not null then raise exception 'ORG_ACCOUNT_EXISTS'; end if;
    v_account := public.create_organization_account(p_organization_id, p_reason);
    perform public.set_organization_pin(v_account, p_pin);
  elsif p_action = 'reset_pin' then
    if v_account is null then raise exception 'ORG_ACCOUNT_NOT_FOUND'; end if;
    perform public.set_organization_pin(v_account, p_pin);
  elsif p_action = 'lock' then
    if v_account is null then raise exception 'ORG_ACCOUNT_NOT_FOUND'; end if;
    update public.accounts set status = 'suspended', updated_at = now() where user_id = v_account;
  elsif p_action = 'unlock' then
    if v_account is null then raise exception 'ORG_ACCOUNT_NOT_FOUND'; end if;
    if not exists (select 1 from public.organization_pins p where p.account_user_id = v_account) then
      raise exception 'PIN_NOT_SET';
    end if;
    update public.accounts set status = 'active', updated_at = now() where user_id = v_account;
  else
    raise exception 'INVALID_ACTION';
  end if;

  perform public.write_audit(
    'organization_account.' || p_action, 'account', v_account::text,
    jsonb_build_object('status', v_before), jsonb_build_object('organization_id', p_organization_id, 'reason', p_reason),
    null, p_organization_id, null
  );
  return v_account;
end;
$$;

create or replace function public.change_organization_pin(p_current_pin text, p_new_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  if not public.organization_session_ok() then raise exception 'FORBIDDEN'; end if;
  select p.pin_hash into v_hash
  from public.organization_pins p where p.account_user_id = auth.uid() for update;
  if v_hash is null or crypt(coalesce(p_current_pin, ''), v_hash) <> v_hash then
    raise exception 'INVALID_CREDENTIALS';
  end if;
  perform public.set_organization_pin(auth.uid(), p_new_pin);
  perform public.write_audit(
    'organization_account.pin_changed', 'account', auth.uid()::text,
    null, jsonb_build_object('changed', true), null,
    (select a.organization_id from public.accounts a where a.user_id = auth.uid()), null
  );
  return true;
end;
$$;

-- ── 8. Khi bật công tắc, quyền quản lý chỉ có hiệu lực trên phiên tổ chức ─────
create or replace function public.has_active_role(
  p_role_code text,
  p_organization_id uuid default null
) returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return false; end if;
  if p_role_code in ('school_admin', 'office', 'faculty_manager', 'faculty_executive')
     and not public.management_account_allowed() then
    return false;
  end if;
  return exists (
    select 1 from public.role_grants rg
    where rg.user_id = auth.uid()
      and rg.role_code = p_role_code
      and rg.revoked_at is null
      and (p_organization_id is null or rg.organization_id = p_organization_id)
  );
end;
$$;

create or replace function public.event_program_manager_grant(p_org_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_grant uuid;
begin
  if not public.management_account_allowed() then return null; end if;
  select rg.id into v_grant
  from public.role_grants rg
  join public.organization_units ou on ou.id = rg.organization_id
  where rg.user_id = auth.uid() and rg.revoked_at is null
    and rg.organization_id = p_org_id
    and rg.role_code in ('faculty_manager', 'faculty_executive')
    and ou.unit_type = 'faculty_union' and ou.is_active
  order by case rg.role_code when 'faculty_manager' then 0 else 1 end, rg.granted_at
  limit 1;
  return v_grant;
end;
$$;

create or replace function public.event_program_reviewer_grant()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_grant uuid;
begin
  if not public.management_account_allowed() then return null; end if;
  select rg.id into v_grant
  from public.role_grants rg
  join public.organization_units ou on ou.id = rg.organization_id
  where rg.user_id = auth.uid() and rg.revoked_at is null
    and rg.role_code = 'office' and ou.unit_type = 'office' and ou.is_active
  order by rg.granted_at limit 1;
  return v_grant;
end;
$$;

create or replace function public.user_can_manage_forms_for_org(p_org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.has_active_role('school_admin') then return true; end if;
  if exists (
    select 1 from public.role_grants rg
    where rg.user_id = auth.uid() and rg.revoked_at is null
      and rg.organization_id = p_org_id and rg.role_code = 'committee_manager'
  ) then return true; end if;
  if not public.management_account_allowed() then return false; end if;
  return exists (
    select 1 from public.role_grants rg
    where rg.user_id = auth.uid() and rg.revoked_at is null
      and rg.organization_id = p_org_id and rg.role_code in ('faculty_manager', 'office')
  );
end;
$$;

drop policy if exists audit_events_read_authorized on public.audit_events;
create policy audit_events_read_authorized on public.audit_events for select to authenticated using (
  public.organization_session_ok()
  and (actor_user_id = auth.uid() or public.has_active_role('school_admin') or public.has_active_role('office'))
);

revoke all on function public.organization_session_ok() from public, anon;
revoke all on function public.management_account_allowed() from public, anon;
revoke all on function public.list_organization_login_units() from public, authenticated;
revoke all on function public.set_feature_flag(text, boolean, text) from public, anon;
revoke all on function public.manage_organization_account(uuid, text, text, text) from public, anon;
revoke all on function public.change_organization_pin(text, text) from public, anon;
revoke all on function public.start_organization_switch(uuid) from public, anon, authenticated;
grant execute on function public.organization_session_ok() to authenticated, service_role;
grant execute on function public.management_account_allowed() to authenticated, service_role;
grant execute on function public.list_organization_login_units() to anon, authenticated, service_role;
grant execute on function public.set_feature_flag(text, boolean, text) to authenticated, service_role;
grant execute on function public.manage_organization_account(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.change_organization_pin(text, text) to authenticated, service_role;
grant execute on function public.start_organization_switch(uuid) to service_role;


-- Quyền sửa quy tắc sau khi khóa xét theo cán bộ đang thao tác, không chỉ theo tài khoản dùng chung.
create or replace function public.save_attendance_plan(
  p_program_id   uuid,
  p_max_points   integer,
  p_rule_type    text,
  p_tiers        jsonb,
  p_tiers_require_required boolean,
  p_sessions     jsonb,
  p_reason       text default null,
  p_request_id   text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_program  public.event_programs%rowtype;
  v_grant    uuid;
  v_role     text;
  v_locked   boolean;
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_before   jsonb;
  v_after    jsonb;
  v_item     jsonb;
  v_id       uuid;
  v_keep     uuid[] := '{}'::uuid[];
  v_count    integer;
  v_required integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_program from public.event_programs where id = p_program_id for update;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if v_program.status <> 'approved' then raise exception 'PROGRAM_NOT_APPROVED'; end if;

  -- Kiểm tra cấu hình
  if p_max_points is null or p_max_points not between 0 and 100 then raise exception 'INVALID_MAX_POINTS'; end if;
  if p_rule_type not in ('all_required', 'any_session', 'sum_sessions', 'tiers') then raise exception 'INVALID_RULE'; end if;
  if p_sessions is null or jsonb_typeof(p_sessions) <> 'array' or jsonb_array_length(p_sessions) = 0 then
    raise exception 'SESSIONS_REQUIRED';
  end if;
  p_tiers := coalesce(p_tiers, '[]'::jsonb);
  if jsonb_typeof(p_tiers) <> 'array' then raise exception 'INVALID_TIERS'; end if;
  v_count := jsonb_array_length(p_sessions);
  select count(*) into v_required from jsonb_array_elements(p_sessions) e where coalesce((e->>'is_required')::boolean, false);
  if p_rule_type = 'all_required' and v_required = 0 then raise exception 'REQUIRED_SESSION_NEEDED'; end if;
  if p_rule_type = 'tiers' then
    if jsonb_array_length(p_tiers) = 0 then raise exception 'INVALID_TIERS'; end if;
    if exists (
      select 1 from jsonb_array_elements(p_tiers) t
      where coalesce(jsonb_typeof(t->'min_sessions'), '') <> 'number' or coalesce(jsonb_typeof(t->'points'), '') <> 'number'
         or (t->>'min_sessions')::numeric <> floor((t->>'min_sessions')::numeric)
         or (t->>'points')::numeric <> floor((t->>'points')::numeric)
         or (t->>'min_sessions')::int not between 1 and v_count
         or (t->>'points')::int not between 0 and p_max_points
    ) then raise exception 'INVALID_TIERS'; end if;
    if (select count(distinct (t->>'min_sessions')::int) from jsonb_array_elements(p_tiers) t) <> jsonb_array_length(p_tiers) then
      raise exception 'INVALID_TIERS';
    end if;
    if coalesce(p_tiers_require_required, false) and v_required = 0 then raise exception 'REQUIRED_SESSION_NEEDED'; end if;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_sessions) e
    where coalesce(jsonb_typeof(e->'points'), '') <> 'number' or (e->>'points')::numeric <> floor((e->>'points')::numeric)
       or (e->>'points')::int not between 0 and greatest(p_max_points, 0)
  ) then raise exception 'INVALID_SESSION_POINTS'; end if;

  -- Đã mở lượt nào → khóa quy tắc: chỉ faculty_manager, có lý do, ghi lịch sử điều chỉnh.
  v_locked := exists (select 1 from public.program_attendance_sessions where program_id = p_program_id and open_count > 0);
  if v_locked then
    if public.is_organization_account(auth.uid()) then
      if not exists (
        select 1 from public.role_grants rg
        where rg.user_id = public.current_officer_user_id()
          and rg.organization_id = v_program.owner_org_id
          and rg.role_code = 'faculty_manager'
          and rg.revoked_at is null
      ) then raise exception 'AMEND_FORBIDDEN'; end if;
    else
      select role_code into v_role from public.role_grants where id = v_grant;
      if v_role <> 'faculty_manager' then raise exception 'AMEND_FORBIDDEN'; end if;
    end if;
    if char_length(coalesce(v_reason, '')) < 10 then raise exception 'AMEND_REASON_REQUIRED'; end if;
  end if;

  select jsonb_build_object('plan', to_jsonb(p), 'sessions',
           coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label, 'points', s.points,
                       'is_required', s.is_required, 'sort_order', s.sort_order) order by s.sort_order)
                     from public.program_attendance_sessions s where s.program_id = p_program_id), '[]'::jsonb))
    into v_before
  from public.program_attendance_plans p where p.program_id = p_program_id;

  insert into public.program_attendance_plans(program_id, max_points, rule_type, tiers, tiers_require_required, updated_by)
  values (p_program_id, p_max_points, p_rule_type, p_tiers, coalesce(p_tiers_require_required, false), auth.uid())
  on conflict (program_id) do update
  set max_points = excluded.max_points, rule_type = excluded.rule_type, tiers = excluded.tiers,
      tiers_require_required = excluded.tiers_require_required, updated_at = now(), updated_by = auth.uid();

  for v_item in select value from jsonb_array_elements(p_sessions) loop
    v_id := nullif(v_item->>'id', '')::uuid;
    if v_id is not null then
      update public.program_attendance_sessions
      set label = btrim(v_item->>'label'), points = (v_item->>'points')::int,
          is_required = coalesce((v_item->>'is_required')::boolean, false),
          sort_order = coalesce((v_item->>'sort_order')::int, 0)
      where id = v_id and program_id = p_program_id;
      if not found then raise exception 'SESSION_NOT_FOUND'; end if;
    else
      insert into public.program_attendance_sessions(program_id, label, points, is_required, sort_order)
      values (p_program_id, btrim(v_item->>'label'), (v_item->>'points')::int,
              coalesce((v_item->>'is_required')::boolean, false), coalesce((v_item->>'sort_order')::int, 0))
      returning id into v_id;
      insert into public.program_attendance_secrets(session_id) values (v_id);
    end if;
    v_keep := array_append(v_keep, v_id);
  end loop;

  if exists (select 1 from public.program_attendance_sessions
             where program_id = p_program_id and not (id = any(v_keep)) and open_count > 0) then
    raise exception 'SESSION_IN_USE';
  end if;
  delete from public.program_attendance_secrets
  where session_id in (select id from public.program_attendance_sessions where program_id = p_program_id and not (id = any(v_keep)));
  delete from public.program_attendance_sessions where program_id = p_program_id and not (id = any(v_keep));

  select jsonb_build_object('plan', to_jsonb(p), 'sessions',
           (select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label, 'points', s.points,
                     'is_required', s.is_required, 'sort_order', s.sort_order) order by s.sort_order)
            from public.program_attendance_sessions s where s.program_id = p_program_id))
    into v_after
  from public.program_attendance_plans p where p.program_id = p_program_id;

  insert into public.program_attendance_history(program_id, action, reason, before_data, after_data, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, case when v_locked then 'plan_amended' else 'plan_saved' end, v_reason, v_before, v_after,
          auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_attendance.' || case when v_locked then 'plan_amended' else 'plan_saved' end,
    'event_program', p_program_id::text, v_before, v_after, v_grant, v_program.owner_org_id, p_request_id);
  return p_program_id;
end;
$$;


-- Các gateway UC-B/UC-C phải bỏ qua grant quản lý cá nhân khi công tắc bật.
create or replace function public.management_officer_has_role(
  p_role_code text,
  p_organization_id uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_actor uuid;
begin
  if not public.feature_flag_enabled('ORG_ACCOUNTS_ENABLED') then
    v_actor := auth.uid();
  elsif public.organization_session_ok() then
    v_actor := public.current_officer_user_id();
  end if;
  if v_actor is null then return false; end if;
  return exists (
    select 1 from public.role_grants rg
    where rg.user_id = v_actor and rg.role_code = p_role_code
      and rg.organization_id = p_organization_id and rg.revoked_at is null
  );
end;
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

  if p_permission in ('class.manage', 'student.read_faculty')
     and p_faculty_id is not null
     and public.management_account_allowed()
     and exists (
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

create or replace function public.can_access_application(p_application_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.union_applications ua
    where ua.id = p_application_id and (
      ua.user_id = auth.uid()
      or public.has_permission('student.read_all')
      or exists (
        select 1 from public.membership_application_assignments aa
        where aa.application_id = ua.id and aa.collaborator_user_id = auth.uid()
      )
      or (
        public.management_account_allowed() and exists (
          select 1 from public.role_grants rg
          join public.organization_units ou on ou.id = rg.organization_id
          where rg.user_id = auth.uid() and rg.revoked_at is null
            and rg.role_code in ('faculty_manager', 'faculty_executive')
            and ou.faculty_id::text = ua.organization_snapshot->>'facultyId'
        )
      )
    )
  );
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
  elsif v_actor_role = 'committee_manager' and p_role_code = 'collaborator'
        and v_actor_org = p_organization_id then
    v_can := true;
  elsif v_actor_role = 'faculty_manager' and p_role_code = 'faculty_executive'
        and v_actor_org = p_organization_id
        and public.management_officer_has_role('faculty_manager', p_organization_id) then
    v_can := true;
  end if;

  if not v_can then raise exception 'FORBIDDEN'; end if;
  if char_length(btrim(p_reason)) < 3 then raise exception 'REASON_REQUIRED'; end if;

  insert into public.role_grants(user_id, role_code, organization_id, granted_by, reason)
  values (p_user_id, p_role_code, p_organization_id, auth.uid(), p_reason)
  returning id into v_id;
  perform public.write_audit('role.granted', 'role_grant', v_id::text, null,
    jsonb_build_object('user_id', p_user_id, 'role_code', p_role_code),
    p_actor_role_grant_id, p_organization_id);
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
  if v_role.role_code in ('office', 'school_admin')
     and not public.management_account_allowed() then raise exception 'FORBIDDEN'; end if;
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

revoke all on function public.management_officer_has_role(text, uuid) from public, anon;
grant execute on function public.management_officer_has_role(text, uuid) to authenticated, service_role;
