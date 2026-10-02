alter table public.accounts drop constraint if exists accounts_status_check;
alter table public.accounts add constraint accounts_status_check
  check (status in ('pending_email_verification', 'pending_pin', 'active', 'suspended'));

alter table public.auth_attempts drop constraint if exists auth_attempts_action_check;
alter table public.auth_attempts add constraint auth_attempts_action_check
  check (action in ('login', 'register', 'recover', 'pin_change'));

create table if not exists public.pending_account_registrations (
  id uuid primary key default gen_random_uuid(),
  student_code text not null,
  gmail citext not null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  consumed_at timestamptz,
  constraint pending_registration_student_code
    check (public.is_valid_student_code(student_code, requested_at::date)),
  constraint pending_registration_gmail
    check (gmail::text ~* '^[^@[:space:]]+@gmail\.com$'),
  check (expires_at > requested_at)
);

create unique index if not exists pending_registration_student_active
  on public.pending_account_registrations(student_code)
  where consumed_at is null;
create unique index if not exists pending_registration_gmail_active
  on public.pending_account_registrations(gmail)
  where consumed_at is null;

create table if not exists public.pin_recovery_authorizations (
  token_hash text primary key,
  user_id uuid not null references public.accounts(user_id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists pin_recovery_user_expiry_idx
  on public.pin_recovery_authorizations(user_id, expires_at desc);

alter table public.pending_account_registrations enable row level security;
alter table public.pin_recovery_authorizations enable row level security;
revoke all on public.pending_account_registrations from anon, authenticated;
revoke all on public.pin_recovery_authorizations from anon, authenticated;

create or replace function public.reserve_account_registration(
  p_student_code text,
  p_gmail citext
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_valid_student_code(p_student_code, current_date)
    or p_gmail::text !~* '^[^@[:space:]]+@gmail\.com$' then
    return false;
  end if;

  delete from public.pending_account_registrations
  where consumed_at is null and expires_at <= now();

  if exists (select 1 from public.accounts where student_code = p_student_code)
    or exists (select 1 from public.account_emails where email = p_gmail)
    or exists (
      select 1 from public.pending_account_registrations
      where consumed_at is null and (student_code = p_student_code or gmail = p_gmail)
    ) then
    return false;
  end if;

  insert into public.pending_account_registrations(student_code, gmail)
  values (p_student_code, lower(p_gmail::text)::citext);
  return true;
exception
  when unique_violation then return false;
end;
$$;

create or replace function public.complete_account_registration(
  p_user_id uuid,
  p_gmail citext
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending public.pending_account_registrations%rowtype;
  v_existing_code text;
  v_existing_email citext;
begin
  select * into v_pending
  from public.pending_account_registrations
  where gmail = p_gmail and consumed_at is null and expires_at > now()
  for update;

  if v_pending.id is null then
    raise exception 'REGISTRATION_NOT_PENDING';
  end if;

  select student_code into v_existing_code from public.accounts where user_id = p_user_id;
  select email into v_existing_email from public.account_emails where user_id = p_user_id;
  if v_existing_code is not null or v_existing_email is not null then
    if v_existing_code = v_pending.student_code and v_existing_email = p_gmail then
      update public.pending_account_registrations set consumed_at = coalesce(consumed_at, now())
      where id = v_pending.id;
      return p_user_id;
    end if;
    raise exception 'REGISTRATION_IDENTITY_CONFLICT';
  end if;

  if exists (select 1 from public.accounts where student_code = v_pending.student_code)
    or exists (select 1 from public.account_emails where email = p_gmail) then
    raise exception 'REGISTRATION_IDENTITY_CONFLICT';
  end if;

  insert into public.accounts(user_id, student_code, status)
  values (p_user_id, v_pending.student_code, 'pending_pin');
  insert into public.account_emails(user_id, email, verified_at)
  values (p_user_id, lower(p_gmail::text)::citext, now());
  update public.pending_account_registrations set consumed_at = now() where id = v_pending.id;
  return p_user_id;
end;
$$;

create or replace function public.claim_pin_recovery(
  p_user_id uuid,
  p_token_hash text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_claimed boolean;
begin
  update public.pin_recovery_authorizations
  set used_at = now()
  where user_id = p_user_id
    and token_hash = p_token_hash
    and used_at is null
    and expires_at > now()
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.reserve_account_registration(text, citext) from public, anon, authenticated;
revoke all on function public.complete_account_registration(uuid, citext) from public, anon, authenticated;
revoke all on function public.claim_pin_recovery(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_account_registration(text, citext) to service_role;
grant execute on function public.complete_account_registration(uuid, citext) to service_role;
grant execute on function public.claim_pin_recovery(uuid, text) to service_role;

comment on table public.pending_account_registrations is
  'Short-lived MSSV/Gmail reservation before email ownership is verified; contains no PIN.';
comment on table public.pin_recovery_authorizations is
  'One-time hashed proof created after a recovery email link is verified; contains no PIN.';
