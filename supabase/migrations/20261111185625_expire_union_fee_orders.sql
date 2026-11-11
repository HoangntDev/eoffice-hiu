-- VNPay yêu cầu vnp_TxnRef không trùng trong ngày. Hết hạn link sau 15 phút
-- thì đóng đơn pending cũ và cấp mã mới; migration thanh toán gốc giữ nguyên.

alter table public.union_fee_orders
  drop constraint union_fee_orders_status_check;

alter table public.union_fee_orders
  add constraint union_fee_orders_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled', 'expired'));

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
  v_created_at timestamptz;
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

  select o.id, o.created_at into v_order, v_created_at
  from public.union_fee_orders o
  where o.campaign_id = p_campaign_id and o.student_user_id = auth.uid() and o.status = 'pending'
  order by o.created_at desc limit 1
  for update;
  if v_order is not null and v_created_at > now() - interval '15 minutes' then return v_order; end if;
  if v_order is not null then
    update public.union_fee_orders
    set status = 'expired', updated_at = now()
    where id = v_order;
    perform public.write_audit(
      'union_fee.order_expired', 'union_fee_order', v_order::text,
      jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'expired'),
      null, v_campaign.organization_id, p_request_id
    );
  end if;

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
