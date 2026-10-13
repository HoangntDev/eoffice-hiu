-- UC7 (sửa theo review PR #3, 16/10/2026)
--
-- 1. Học kỳ cấu hình được theo từng năm học, không suy ra từ tháng.
--    Bỏ semester_key_for (HK1 = tháng 8–12…). Điểm uy tín reset mỗi học kỳ (hỏi đáp 15.1), nên điểm
--    UC7 đọc phải biết học kỳ hiện tại → bảng academic_terms với ngày bắt đầu/kết thúc do người dùng nhập.
--    Chưa có học kỳ nào bao trùm thời điểm xét thì không có khoản trừ nào được tính (mọi người 100 điểm).
--    Màn hình/quyền quản lý học kỳ thuộc UC điểm danh/uy tín; hiện chỉ service_role/SQL ghi được.
-- 2. Lý do duyệt ngoại lệ chỉ bắt buộc khi người uy tín cao hơn đang chờ cạnh tranh CÙNG suất:
--    cùng nhóm chỉ tiêu (hoặc cùng chỉ tiêu chung) mà người được duyệt sẽ chiếm tại thời điểm duyệt.

-- ── Học kỳ ────────────────────────────────────────────────────────────────────
create table if not exists public.academic_terms (
  id            uuid primary key default gen_random_uuid(),
  academic_year text not null check (academic_year ~ '^[0-9]{4}-[0-9]{4}$'
                  and split_part(academic_year, '-', 2)::int = split_part(academic_year, '-', 1)::int + 1),
  term_code     text not null check (char_length(btrim(term_code)) between 1 and 20),
  name          text not null check (char_length(btrim(name)) between 2 and 100),
  starts_on     date not null,
  ends_on       date not null,
  created_by    uuid references public.accounts(user_id) on delete restrict,
  created_at    timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (academic_year, term_code),
  -- Hai học kỳ không được chồng ngày: mỗi thời điểm thuộc tối đa một học kỳ.
  exclude using gist (daterange(starts_on, ends_on, '[]') with &&)
);

alter table public.academic_terms enable row level security;
drop policy if exists academic_terms_read on public.academic_terms;
create policy academic_terms_read on public.academic_terms for select to authenticated using (true);
revoke all on public.academic_terms from anon;
revoke insert, update, delete on public.academic_terms from authenticated;
grant select on public.academic_terms to authenticated;

-- Học kỳ chứa thời điểm (theo ngày giờ Việt Nam), hoặc null nếu chưa cấu hình.
create or replace function public.academic_term_at(p_at timestamptz)
returns uuid
language sql stable security definer set search_path = public as $$
  select t.id from public.academic_terms t
  where (p_at at time zone 'Asia/Ho_Chi_Minh')::date between t.starts_on and t.ends_on
  limit 1;
$$;

-- ── Sổ uy tín gắn với học kỳ đã cấu hình ─────────────────────────────────────
-- Sổ chưa có luồng ghi ở môi trường nào (UC điểm danh/nghiệm thu sẽ ghi), nên đổi cột trực tiếp.
drop function if exists public.reputation_score(uuid, timestamptz);
drop function if exists public.semester_key_for(timestamptz);
drop index if exists public.reputation_adjustments_user_idx;
alter table public.reputation_adjustments drop column if exists semester_key;
alter table public.reputation_adjustments
  add column if not exists term_id uuid not null references public.academic_terms(id) on delete restrict;
create index if not exists reputation_adjustments_user_term_idx on public.reputation_adjustments (user_id, term_id);

-- Mỗi học kỳ bắt đầu 100 điểm, tối thiểu 0 (15.1).
create or replace function public.reputation_score(p_user_id uuid, p_at timestamptz default now())
returns integer
language sql stable security definer set search_path = public as $$
  select greatest(0, 100 + coalesce(sum(a.delta), 0))::int
  from public.reputation_adjustments a
  where a.user_id = p_user_id and a.term_id = public.academic_term_at(p_at);
$$;

revoke all on function public.academic_term_at(timestamptz) from public, anon;
grant execute on function public.academic_term_at(timestamptz) to authenticated;
revoke all on function public.reputation_score(uuid, timestamptz) from public, anon, authenticated;

-- ── Duyệt: chỉ so với người cạnh tranh cùng suất ─────────────────────────────
create or replace function public.decide_program_registration(
  p_registration_id uuid,
  p_decision        text,
  p_reason          text,
  p_request_id      text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_reg      public.program_registrations%rowtype;
  v_program  public.event_programs%rowtype;
  v_settings public.program_registration_settings%rowtype;
  v_grant    uuid;
  v_slot     record;
  v_other_slot record;
  v_quota    uuid;
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_to       text;
  v_skipped  boolean := false;
  v_score    integer;
  v_other    record;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_decision not in ('approve', 'reject') then raise exception 'INVALID_DECISION'; end if;

  select * into v_reg from public.program_registrations where id = p_registration_id;
  if v_reg.id is null then raise exception 'REGISTRATION_NOT_FOUND'; end if;
  select * into v_program from public.event_programs where id = v_reg.program_id;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if v_reg.user_id = auth.uid() then raise exception 'SELF_DECISION_FORBIDDEN'; end if;

  -- Cùng khóa với đăng ký: hai BTC duyệt suất cuối đồng thời được xếp tuần tự.
  select * into v_settings from public.program_registration_settings where program_id = v_reg.program_id for update;
  select * into v_reg from public.program_registrations where id = p_registration_id for update;
  if v_reg.status <> 'pending' then raise exception 'INVALID_TRANSITION'; end if;

  if p_decision = 'reject' then
    if char_length(coalesce(v_reason, '')) < 10 then raise exception 'REASON_REQUIRED'; end if;
    v_to := 'rejected';
  else
    select * into v_slot from public.program_registration_slot(v_reg.program_id, v_reg.user_id);
    if not v_slot.o_ok then raise exception 'QUOTA_FULL'; end if;
    v_quota := v_slot.o_quota;

    -- Uy tín chỉ áp dụng khi vừa giới hạn chỗ vừa yêu cầu duyệt (15.2, 16.3, 16.4).
    -- Người cao điểm hơn chỉ "bị bỏ qua" nếu lúc này họ cũng sẽ được xếp vào đúng suất đó
    -- (cùng nhóm chỉ tiêu, hoặc cùng chỉ tiêu chung). Người được xếp vào nhóm khác vẫn còn chỗ của họ;
    -- người không thể nhận suất này (sai nhóm, nhóm hết chỗ và chỉ tiêu chung cũng hết) không cạnh tranh.
    if v_settings.capacity is not null and v_settings.requires_approval then
      v_score := public.reputation_score(v_reg.user_id);
      for v_other in
        select r.user_id from public.program_registrations r
        where r.program_id = v_reg.program_id and r.status = 'pending' and r.id <> v_reg.id
          and public.reputation_score(r.user_id) > v_score
      loop
        select * into v_other_slot from public.program_registration_slot(v_reg.program_id, v_other.user_id);
        if v_other_slot.o_ok and v_other_slot.o_quota is not distinct from v_quota then
          v_skipped := true;
          exit;
        end if;
      end loop;
      if v_skipped and char_length(coalesce(v_reason, '')) < 10 then raise exception 'SKIP_REASON_REQUIRED'; end if;
    end if;
    v_to := 'accepted';
  end if;

  update public.program_registrations
  set status = v_to,
      quota_id = v_quota,
      decided_at = now(),
      decided_by = auth.uid(),
      decision_reason = case when v_to = 'rejected' then v_reason end
  where id = p_registration_id;

  insert into public.program_registration_history(program_id, registration_id, action, from_status, to_status, reason,
    skipped_higher_reputation, details, actor_user_id, actor_role_grant_id, request_id)
  values (v_reg.program_id, p_registration_id, case v_to when 'accepted' then 'approved' else 'rejected' end,
    'pending', v_to, v_reason, v_skipped,
    case when v_to = 'accepted' then jsonb_build_object('quota_id', v_quota) end,
    auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_registration.' || case v_to when 'accepted' then 'approved' else 'rejected' end,
    'program_registration', p_registration_id::text,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', v_to, 'reason', v_reason, 'skipped_higher_reputation', v_skipped),
    v_grant, v_program.owner_org_id, p_request_id);
  return v_to;
end;
$$;

-- ── Danh sách: gợi ý thứ tự trong từng suất đang cạnh tranh ──────────────────
-- Thêm cột pool_label (nhóm chỉ tiêu người chờ sẽ được xếp vào nếu duyệt lúc này; "Chung"; hoặc
-- "Hết chỗ phù hợp") và xếp hạng gợi ý theo từng pool thay vì toàn bộ danh sách.
drop function if exists public.list_program_registrations(uuid);
create function public.list_program_registrations(p_program_id uuid)
returns table (
  registration_id  uuid,
  user_id          uuid,
  student_code     text,
  full_name        text,
  class_code       text,
  program_name     text,
  faculty_name     text,
  status           text,
  quota_label      text,
  pool_label       text,
  registered_at    timestamptz,
  decided_at       timestamptz,
  decision_reason  text,
  reputation_score integer,
  suggested_rank   integer,
  answers          jsonb
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_settings public.program_registration_settings%rowtype;
  v_uses_reputation boolean;
begin
  if public.program_registration_manager_grant(p_program_id) is null then raise exception 'FORBIDDEN'; end if;
  select * into v_settings from public.program_registration_settings where program_id = p_program_id;
  v_uses_reputation := v_settings.capacity is not null and v_settings.requires_approval;

  return query
  with base as (
    select r.*,
      case when v_uses_reputation then public.reputation_score(r.user_id) end as score,
      coalesce(sl.o_ok, false) as slot_ok, sl.o_quota as slot_quota
    from public.program_registrations r
    left join lateral public.program_registration_slot(p_program_id, r.user_id) sl on r.status = 'pending'
    where r.program_id = p_program_id
  ), pooled as (
    select b.*,
      case when b.status <> 'pending' then null
           when not b.slot_ok then 'Hết chỗ phù hợp'
           else coalesce((select q.label from public.program_registration_quotas q where q.id = b.slot_quota), 'Chung')
      end as pool
    from base b
  )
  select b.id, b.user_id, a.student_code, sp.full_name, cat.class_code, cat.program_name, cat.faculty_name,
    b.status, q.label, b.pool, b.registered_at, b.decided_at, b.decision_reason, b.score,
    case when b.status = 'pending' and v_uses_reputation and b.slot_ok
      then (rank() over (partition by b.status = 'pending' and b.slot_ok, b.pool
                         order by b.score desc, b.registered_at))::int end,
    coalesce((select jsonb_object_agg(fa.question_id, fa.answer_value)
              from public.form_response_answers fa where fa.response_id = b.form_response_id), '{}'::jsonb)
  from pooled b
  join public.accounts a on a.user_id = b.user_id
  left join public.student_profiles sp on sp.user_id = b.user_id
  left join public.current_academic_catalog cat on cat.class_id = sp.class_id
  left join public.program_registration_quotas q on q.id = b.quota_id
  order by case b.status when 'pending' then 0 when 'accepted' then 1 else 2 end,
    b.pool nulls last, b.score desc nulls last, b.registered_at;
end;
$$;

revoke all on function public.list_program_registrations(uuid) from public, anon;
grant execute on function public.list_program_registrations(uuid) to authenticated;
