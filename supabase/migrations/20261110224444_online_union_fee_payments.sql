-- Final Project (#81): Đoàn phí theo tháng, đóng gộp 12 tháng qua VNPay.

insert into public.feature_flags(key, enabled, reason)
values ('PAYMENT_ENABLED', false, 'Mặc định tắt khi áp migration thanh toán')
on conflict (key) do nothing;

create table public.union_fee_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organization_units(id) on delete restrict,
  calendar_year integer not null check (calendar_year between 2000 and 2100),
  monthly_amount integer not null check (monthly_amount in (2000, 5000, 10000, 20000)),
  created_by uuid references public.accounts(user_id) on delete restrict,
  created_by_officer uuid references public.accounts(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, calendar_year)
);

create table public.union_fee_orders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.union_fee_campaigns(id) on delete restrict,
  student_user_id uuid not null references public.accounts(user_id) on delete restrict,
  order_ref text not null unique check (order_ref ~ '^[A-Z0-9]{8,100}$'),
  amount integer not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled')),
  transaction_ref text,
  response_code text,
  transaction_status text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index union_fee_orders_one_pending
  on public.union_fee_orders(campaign_id, student_user_id) where status = 'pending';
create unique index union_fee_orders_one_paid
  on public.union_fee_orders(campaign_id, student_user_id) where status = 'paid';
create unique index union_fee_orders_transaction_ref
  on public.union_fee_orders(transaction_ref) where transaction_ref is not null;
create index union_fee_orders_student_idx
  on public.union_fee_orders(student_user_id, created_at desc);

create table public.union_fee_month_payments (
  campaign_id uuid not null references public.union_fee_campaigns(id) on delete restrict,
  student_user_id uuid not null references public.accounts(user_id) on delete restrict,
  month_number smallint not null check (month_number between 1 and 12),
  order_id uuid not null references public.union_fee_orders(id) on delete restrict,
  paid_at timestamptz not null,
  primary key (campaign_id, student_user_id, month_number)
);
create index union_fee_month_payments_order_idx on public.union_fee_month_payments(order_id);

alter table public.union_fee_campaigns enable row level security;
alter table public.union_fee_orders enable row level security;
alter table public.union_fee_month_payments enable row level security;

create or replace function public.current_student_faculty_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_faculty uuid;
begin
  select p.current_faculty_id into v_faculty
  from public.accounts a
  join public.student_profiles sp on sp.user_id = a.user_id
  join public.classes c on c.id = sp.class_id
  join public.programs p on p.id = c.current_program_id
  where a.user_id = auth.uid() and a.account_type = 'student' and a.status = 'active';
  return v_faculty;
end;
$$;

create or replace function public.union_fee_manager_grant(p_organization_id uuid default null)
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
  where rg.user_id = auth.uid()
    and rg.revoked_at is null
    and rg.role_code in ('faculty_manager', 'faculty_executive')
    and ou.unit_type = 'faculty_union' and ou.is_active
    and (p_organization_id is null or rg.organization_id = p_organization_id)
  order by case rg.role_code when 'faculty_manager' then 0 else 1 end, rg.granted_at
  limit 1;
  return v_grant;
end;
$$;

create or replace function public.union_fee_student_in_organization(p_organization_id uuid, p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_student_faculty uuid; v_org_faculty uuid;
begin
  select p.current_faculty_id into v_student_faculty
  from public.accounts a
  join public.student_profiles sp on sp.user_id = a.user_id
  join public.classes c on c.id = sp.class_id
  join public.programs p on p.id = c.current_program_id
  where a.user_id = p_user_id and a.account_type = 'student' and a.status = 'active';
  select ou.faculty_id into v_org_faculty
  from public.organization_units ou
  where ou.id = p_organization_id and ou.unit_type = 'faculty_union' and ou.is_active;
  return v_student_faculty is not null and v_student_faculty = v_org_faculty;
end;
$$;

create policy union_fee_campaigns_read on public.union_fee_campaigns
for select to authenticated using (
  public.feature_flag_enabled('PAYMENT_ENABLED')
  and (
    public.union_fee_student_in_organization(organization_id)
    or public.union_fee_manager_grant(organization_id) is not null
  )
);

create policy union_fee_orders_read on public.union_fee_orders
for select to authenticated using (
  public.feature_flag_enabled('PAYMENT_ENABLED')
  and (
    student_user_id = (select auth.uid())
    or public.union_fee_manager_grant((select c.organization_id from public.union_fee_campaigns c where c.id = campaign_id)) is not null
  )
);

create policy union_fee_month_payments_read on public.union_fee_month_payments
for select to authenticated using (
  public.feature_flag_enabled('PAYMENT_ENABLED')
  and (
    student_user_id = (select auth.uid())
    or public.union_fee_manager_grant((select c.organization_id from public.union_fee_campaigns c where c.id = campaign_id)) is not null
  )
);

create or replace function public.create_union_fee_campaign(
  p_calendar_year integer,
  p_monthly_amount integer,
  p_request_id text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_grant uuid; v_org uuid; v_campaign uuid;
begin
  if not public.feature_flag_enabled('PAYMENT_ENABLED') then raise exception 'PAYMENT_DISABLED'; end if;
  if p_calendar_year not between 2000 and 2100 then raise exception 'INVALID_CALENDAR_YEAR'; end if;
  if p_monthly_amount not in (2000, 5000, 10000, 20000) then raise exception 'INVALID_MONTHLY_AMOUNT'; end if;
  v_grant := public.union_fee_manager_grant(null);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  select rg.organization_id into v_org from public.role_grants rg where rg.id = v_grant;
  if exists (select 1 from public.union_fee_campaigns c where c.organization_id = v_org and c.calendar_year = p_calendar_year) then
    raise exception 'CAMPAIGN_ALREADY_EXISTS';
  end if;
  insert into public.union_fee_campaigns(
    organization_id, calendar_year, monthly_amount, created_by, created_by_officer
  ) values (
    v_org, p_calendar_year, p_monthly_amount, auth.uid(), public.current_officer_user_id()
  ) returning id into v_campaign;
  perform public.write_audit(
    'union_fee.campaign_created', 'union_fee_campaign', v_campaign::text,
    null, jsonb_build_object('calendar_year', p_calendar_year, 'monthly_amount', p_monthly_amount),
    v_grant, v_org, p_request_id
  );
  return v_campaign;
exception when unique_violation then
  raise exception 'CAMPAIGN_ALREADY_EXISTS';
end;
$$;

create or replace function public.create_union_fee_order(
  p_campaign_id uuid,
  p_request_id text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.union_fee_campaigns%rowtype;
  v_order uuid;
  v_ref text;
begin
  if not public.feature_flag_enabled('PAYMENT_ENABLED') then raise exception 'PAYMENT_DISABLED'; end if;
  if auth.uid() is null or not exists (
    select 1 from public.accounts a where a.user_id = auth.uid() and a.account_type = 'student' and a.status = 'active'
  ) then raise exception 'FORBIDDEN'; end if;
  select * into v_campaign from public.union_fee_campaigns where id = p_campaign_id for share;
  if v_campaign.id is null or not public.union_fee_student_in_organization(v_campaign.organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if exists (
    select 1 from public.union_fee_orders o
    where o.campaign_id = p_campaign_id and o.student_user_id = auth.uid() and o.status = 'paid'
  ) or exists (
    select 1 from public.union_fee_month_payments m
    where m.campaign_id = p_campaign_id and m.student_user_id = auth.uid()
  ) then raise exception 'ALREADY_PAID'; end if;
  select o.id into v_order from public.union_fee_orders o
  where o.campaign_id = p_campaign_id and o.student_user_id = auth.uid() and o.status = 'pending'
  order by o.created_at desc limit 1;
  if v_order is not null then return v_order; end if;
  v_ref := 'UF' || v_campaign.calendar_year::text || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
  insert into public.union_fee_orders(campaign_id, student_user_id, order_ref, amount)
  values (p_campaign_id, auth.uid(), v_ref, v_campaign.monthly_amount * 12)
  returning id into v_order;
  perform public.write_audit(
    'union_fee.order_created', 'union_fee_order', v_order::text,
    null, jsonb_build_object('campaign_id', p_campaign_id, 'amount', v_campaign.monthly_amount * 12),
    null, v_campaign.organization_id, p_request_id
  );
  return v_order;
end;
$$;

create or replace function public.record_union_fee_ipn(
  p_order_ref text,
  p_amount integer,
  p_transaction_ref text,
  p_response_code text,
  p_transaction_status text,
  p_paid_at timestamptz,
  p_request_id text default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.union_fee_orders%rowtype;
  v_org uuid;
  v_new_status text;
begin
  select * into v_order from public.union_fee_orders where order_ref = p_order_ref for update;
  if v_order.id is null then return '01'; end if;
  if v_order.status <> 'pending' then return '02'; end if;
  if v_order.amount <> p_amount then return '04'; end if;
  select c.organization_id into v_org from public.union_fee_campaigns c where c.id = v_order.campaign_id;

  if p_response_code = '00' and p_transaction_status = '00' then
    if nullif(btrim(p_transaction_ref), '') is null then return '99'; end if;
    update public.union_fee_orders
    set status = 'paid', transaction_ref = p_transaction_ref,
        response_code = p_response_code, transaction_status = p_transaction_status,
        paid_at = coalesce(p_paid_at, now()), updated_at = now()
    where id = v_order.id;
    insert into public.union_fee_month_payments(campaign_id, student_user_id, month_number, order_id, paid_at)
    select v_order.campaign_id, v_order.student_user_id, month_number, v_order.id, coalesce(p_paid_at, now())
    from generate_series(1, 12) month_number
    on conflict (campaign_id, student_user_id, month_number) do nothing;
    perform public.write_audit(
      'union_fee.payment_paid', 'union_fee_order', v_order.id::text,
      jsonb_build_object('status', v_order.status),
      jsonb_build_object('status', 'paid', 'amount', p_amount, 'transaction_ref', p_transaction_ref),
      null, v_org, p_request_id
    );
  else
    v_new_status := case when p_response_code = '24' or p_transaction_status = '11' then 'cancelled' else 'failed' end;
    update public.union_fee_orders
    set status = v_new_status, transaction_ref = p_transaction_ref,
        response_code = p_response_code, transaction_status = p_transaction_status,
        updated_at = now()
    where id = v_order.id;
    perform public.write_audit(
      'union_fee.payment_' || v_new_status, 'union_fee_order', v_order.id::text,
      jsonb_build_object('status', v_order.status),
      jsonb_build_object('status', v_new_status, 'amount', p_amount, 'transaction_ref', p_transaction_ref),
      null, v_org, p_request_id
    );
  end if;
  return '00';
exception when unique_violation then
  return '02';
when others then
  return '99';
end;
$$;

create or replace function public.faculty_union_fee_report(
  p_campaign_id uuid,
  p_class_id uuid default null
) returns table (
  student_user_id uuid,
  student_code text,
  full_name text,
  class_id uuid,
  class_code text,
  monthly_amount integer,
  paid_months bigint,
  paid_at timestamptz,
  transaction_ref text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_org uuid; v_faculty uuid;
begin
  if not public.feature_flag_enabled('PAYMENT_ENABLED') then raise exception 'PAYMENT_DISABLED'; end if;
  select c.organization_id, ou.faculty_id into v_org, v_faculty
  from public.union_fee_campaigns c
  join public.organization_units ou on ou.id = c.organization_id
  where c.id = p_campaign_id;
  if v_org is null or public.union_fee_manager_grant(v_org) is null then raise exception 'FORBIDDEN'; end if;
  return query
  select
    a.user_id,
    a.student_code,
    sp.full_name,
    cl.id,
    cl.current_code,
    campaign.monthly_amount,
    count(distinct month_payment.month_number),
    max(paid_order.paid_at),
    max(paid_order.transaction_ref)
  from public.accounts a
  join public.student_profiles sp on sp.user_id = a.user_id
  join public.classes cl on cl.id = sp.class_id
  join public.programs program on program.id = cl.current_program_id and program.current_faculty_id = v_faculty
  join public.union_fee_campaigns campaign on campaign.id = p_campaign_id
  left join public.union_fee_month_payments month_payment
    on month_payment.campaign_id = campaign.id and month_payment.student_user_id = a.user_id
  left join public.union_fee_orders paid_order
    on paid_order.campaign_id = campaign.id and paid_order.student_user_id = a.user_id and paid_order.status = 'paid'
  where a.account_type = 'student' and a.status = 'active'
    and (p_class_id is null or cl.id = p_class_id)
  group by a.user_id, a.student_code, sp.full_name, cl.id, cl.current_code, campaign.monthly_amount
  order by cl.current_code, a.student_code;
end;
$$;

revoke all on table public.union_fee_campaigns from public, anon, authenticated;
revoke all on table public.union_fee_orders from public, anon, authenticated;
revoke all on table public.union_fee_month_payments from public, anon, authenticated;
grant select on table public.union_fee_campaigns to authenticated, service_role;
grant select on table public.union_fee_orders to authenticated, service_role;
grant select on table public.union_fee_month_payments to authenticated, service_role;
grant all on table public.union_fee_campaigns to service_role;
grant all on table public.union_fee_orders to service_role;
grant all on table public.union_fee_month_payments to service_role;

revoke all on function public.current_student_faculty_id() from public, anon;
revoke all on function public.union_fee_manager_grant(uuid) from public, anon;
revoke all on function public.union_fee_student_in_organization(uuid, uuid) from public, anon;
revoke all on function public.create_union_fee_campaign(integer, integer, text) from public, anon;
revoke all on function public.create_union_fee_order(uuid, text) from public, anon;
revoke all on function public.record_union_fee_ipn(text, integer, text, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.faculty_union_fee_report(uuid, uuid) from public, anon;

grant execute on function public.current_student_faculty_id() to authenticated, service_role;
grant execute on function public.union_fee_manager_grant(uuid) to authenticated, service_role;
grant execute on function public.union_fee_student_in_organization(uuid, uuid) to authenticated, service_role;
grant execute on function public.create_union_fee_campaign(integer, integer, text) to authenticated;
grant execute on function public.create_union_fee_order(uuid, text) to authenticated;
grant execute on function public.record_union_fee_ipn(text, integer, text, text, text, timestamptz, text) to service_role;
grant execute on function public.faculty_union_fee_report(uuid, uuid) to authenticated;
