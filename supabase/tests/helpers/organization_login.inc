-- Helper CR-01 cho fixture cũ: chuyển grant quản lý sang tài khoản tổ chức, tạo phiên Auth
-- có cán bộ, bật công tắc và đặt claims giống phiên đăng nhập hai bước thật.
create temp table cr01_organization_test_sessions (
  officer_user_id uuid not null,
  organization_id uuid not null,
  account_user_id uuid not null,
  session_id uuid not null,
  primary key (officer_user_id, organization_id)
);
grant select on cr01_organization_test_sessions to authenticated;

create function pg_temp.cr01_setup_organization_logins()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r record; v_session uuid;
begin
  perform public.migrate_management_grants_to_organizations();
  update public.accounts set status = 'active'
  where account_type = 'organization' and status <> 'active';
  if public.feature_flag_enabled('ORG_ACCOUNTS_ENABLED') then
    for r in
      select m.user_id as officer_user_id, m.organization_id, a.user_id as account_user_id
      from public.organization_members m
      join public.accounts a on a.organization_id = m.organization_id and a.account_type = 'organization'
      where m.revoked_at is null
    loop
      v_session := gen_random_uuid();
      insert into auth.sessions(id, user_id) values (v_session, r.account_user_id);
      perform public.start_officer_session(v_session, r.account_user_id, r.officer_user_id);
      insert into pg_temp.cr01_organization_test_sessions
        (officer_user_id, organization_id, account_user_id, session_id)
      values (r.officer_user_id, r.organization_id, r.account_user_id, v_session)
      on conflict (officer_user_id, organization_id) do nothing;
    end loop;
  end if;
end;
$$;

create function pg_temp.cr01_login_as(p_user uuid, p_organization_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_account uuid; v_session uuid;
begin
  if public.feature_flag_enabled('ORG_ACCOUNTS_ENABLED') then
    select s.account_user_id, s.session_id into v_account, v_session
    from pg_temp.cr01_organization_test_sessions s
    where s.officer_user_id = p_user
      and (p_organization_id is null or s.organization_id = p_organization_id)
    order by s.organization_id
    limit 1;
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', coalesce(v_account, p_user),
      'role', 'authenticated',
      'session_id', v_session
    )::text,
    true
  );
end;
$$;

create function pg_temp.cr01_management_grant(p_organization_id uuid, p_role_code text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_grant uuid;
begin
  select rg.id into v_grant
  from public.role_grants rg
  join public.accounts a on a.user_id = rg.user_id
  where rg.organization_id = p_organization_id and rg.revoked_at is null
    and rg.role_code = p_role_code
    and (
      (public.feature_flag_enabled('ORG_ACCOUNTS_ENABLED') and a.account_type = 'organization')
      or (not public.feature_flag_enabled('ORG_ACCOUNTS_ENABLED') and rg.user_id = auth.uid())
    )
  order by rg.granted_at
  limit 1;
  return v_grant;
end;
$$;

grant execute on function pg_temp.cr01_setup_organization_logins() to authenticated;
grant execute on function pg_temp.cr01_login_as(uuid, uuid) to authenticated;
grant execute on function pg_temp.cr01_management_grant(uuid, text) to authenticated;
