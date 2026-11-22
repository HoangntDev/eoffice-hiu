-- Không suy ra thời điểm đồng ý cho tài khoản hoặc yêu cầu đã có.
alter table public.pending_account_registrations add column data_consent_at timestamptz;
alter table public.accounts add column data_consent_at timestamptz;

drop function public.reserve_account_registration(text, citext);
create function public.reserve_account_registration(
  p_student_code text,
  p_gmail citext,
  p_data_consent boolean
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_data_consent is not true or not public.is_valid_student_code(p_student_code, current_date)
    or p_gmail::text !~* '^[^@[:space:]]+@student\.hiu\.vn$'
    or split_part(lower(p_gmail::text), '@', 1) not like
         '%' || substr(p_student_code, 1, 3) || substr(p_student_code, 7) then
    return false;
  end if;

  delete from public.pending_account_registrations
  where consumed_at is null and expires_at <= now();

  if exists (select 1 from public.accounts where student_code = p_student_code)
    or exists (select 1 from public.account_emails where email = p_gmail)
  then
    return false;
  end if;

  -- Yêu cầu trước migration chỉ được tiếp tục sau khi sinh viên chủ động đồng ý.
  update public.pending_account_registrations set data_consent_at = now()
  where student_code = p_student_code and gmail = p_gmail and consumed_at is null and data_consent_at is null;
  if found then return true; end if;

  insert into public.pending_account_registrations(student_code, gmail, data_consent_at)
  values (p_student_code, lower(p_gmail::text)::citext, now());
  return true;
exception
  when unique_violation then return false;
end;
$$;

revoke all on function public.reserve_account_registration(text, citext, boolean) from public, anon, authenticated;
grant execute on function public.reserve_account_registration(text, citext, boolean) to service_role;

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

  if v_pending.id is null or v_pending.data_consent_at is null then
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

  insert into public.accounts(user_id, student_code, status, data_consent_at)
  values (p_user_id, v_pending.student_code, 'pending_pin', v_pending.data_consent_at);
  insert into public.account_emails(user_id, email, verified_at)
  values (p_user_id, lower(p_gmail::text)::citext, now());
  update public.pending_account_registrations set consumed_at = now() where id = v_pending.id;
  return p_user_id;
end;
$$;
