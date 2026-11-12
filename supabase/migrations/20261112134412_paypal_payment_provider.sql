-- PayPal Orders API v2: lưu khóa đối soát phía server, không lưu OAuth token.

alter table public.union_fee_orders
  add column provider text not null default 'vnpay'
    check (provider in ('vnpay', 'paypal')),
  add column provider_order_id text,
  add column provider_capture_id text,
  add column provider_currency text,
  add column provider_amount numeric(12,2),
  add column provider_approval_url text;

create unique index union_fee_orders_provider_order_id
  on public.union_fee_orders(provider, provider_order_id)
  where provider_order_id is not null;
create unique index union_fee_orders_provider_capture_id
  on public.union_fee_orders(provider, provider_capture_id)
  where provider_capture_id is not null;

create or replace function public.bind_union_fee_paypal_order(
  p_order_ref text,
  p_paypal_order_id text,
  p_amount_usd numeric,
  p_currency text,
  p_approval_url text,
  p_request_id text default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.union_fee_orders%rowtype;
  v_org uuid;
begin
  if not public.feature_flag_enabled('PAYMENT_ENABLED') then
    raise exception 'PAYMENT_DISABLED';
  end if;
  select * into v_order
  from public.union_fee_orders
  where order_ref = p_order_ref
  for update;
  if v_order.id is null then return '01'; end if;
  if v_order.status <> 'pending' then return '02'; end if;
  if nullif(btrim(p_paypal_order_id), '') is null
    or nullif(btrim(p_approval_url), '') is null then return '99'; end if;
  if p_currency <> 'USD' or p_amount_usd <= 0 then return '04'; end if;
  if v_order.provider_order_id is not null then
    if v_order.provider = 'paypal'
      and v_order.provider_order_id = p_paypal_order_id
      and v_order.provider_currency = p_currency
      and v_order.provider_amount = p_amount_usd then
      return '00';
    end if;
    return '02';
  end if;

  select c.organization_id into v_org
  from public.union_fee_campaigns c where c.id = v_order.campaign_id;
  update public.union_fee_orders
  set provider = 'paypal',
      provider_order_id = p_paypal_order_id,
      provider_currency = p_currency,
      provider_amount = p_amount_usd,
      provider_approval_url = p_approval_url,
      updated_at = now()
  where id = v_order.id;
  perform public.write_audit(
    'union_fee.paypal_order_bound', 'union_fee_order', v_order.id::text,
    jsonb_build_object('provider', v_order.provider),
    jsonb_build_object(
      'provider', 'paypal', 'provider_order_id', p_paypal_order_id,
      'currency', p_currency, 'amount', p_amount_usd
    ),
    null, v_org, p_request_id
  );
  return '00';
exception when unique_violation then
  return '02';
end;
$$;

create or replace function public.record_union_fee_paypal_capture(
  p_order_ref text,
  p_paypal_order_id text,
  p_capture_id text,
  p_custom_id text,
  p_amount_usd numeric,
  p_currency text,
  p_status text,
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
  v_result text;
begin
  select * into v_order
  from public.union_fee_orders
  where order_ref = p_order_ref
  for update;
  if v_order.id is null then return '01'; end if;
  if v_order.status <> 'pending' then return '02'; end if;
  if p_status <> 'COMPLETED' then return '99'; end if;
  if v_order.provider <> 'paypal'
    or v_order.provider_order_id <> p_paypal_order_id
    or p_custom_id <> v_order.order_ref
    or v_order.provider_currency <> p_currency
    or v_order.provider_amount <> p_amount_usd then return '04'; end if;
  if nullif(btrim(p_capture_id), '') is null then return '99'; end if;

  v_result := public.record_union_fee_ipn(
    v_order.order_ref,
    v_order.amount,
    p_capture_id,
    '00',
    '00',
    p_paid_at,
    p_request_id
  );
  if v_result <> '00' then return v_result; end if;

  update public.union_fee_orders
  set provider_capture_id = p_capture_id, updated_at = now()
  where id = v_order.id;
  select c.organization_id into v_org
  from public.union_fee_campaigns c where c.id = v_order.campaign_id;
  perform public.write_audit(
    'union_fee.paypal_capture_recorded', 'union_fee_order', v_order.id::text,
    null,
    jsonb_build_object(
      'provider_order_id', p_paypal_order_id,
      'provider_capture_id', p_capture_id,
      'currency', p_currency,
      'amount', p_amount_usd,
      'status', p_status
    ),
    null, v_org, p_request_id
  );
  return '00';
exception when unique_violation then
  return '02';
when others then
  return '99';
end;
$$;

revoke all on function public.bind_union_fee_paypal_order(text, text, numeric, text, text, text)
  from public, anon, authenticated;
revoke all on function public.record_union_fee_paypal_capture(text, text, text, text, numeric, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.bind_union_fee_paypal_order(text, text, numeric, text, text, text)
  to service_role;
grant execute on function public.record_union_fee_paypal_capture(text, text, text, text, numeric, text, text, timestamptz, text)
  to service_role;
