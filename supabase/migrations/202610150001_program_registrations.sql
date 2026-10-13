-- UC7: Đăng ký tham gia chương trình sự kiện.
--
-- Quy tắc đã chốt (hỏi đáp 13.1, 13.2, 14.2, 14.3, 15.2, 15.3, 16.3, 16.4 và yêu cầu UC7 ngày 13/10/2026):
-- - Chỉ chương trình đã được Văn phòng chấp thuận (UC6, status = 'approved') mới được BTC mở đăng ký.
--   BTC là Đoàn Khoa sở hữu chương trình (event_program_manager_grant).
-- - Không giới hạn hoặc giới hạn chỗ; nhận theo thứ tự đăng ký hoặc BTC duyệt. Chỉ tiêu theo
--   Khoa/ngành/đối tượng; sau quota_release_at chỉ tiêu dư thành chỉ tiêu chung.
-- - Chặn trùng, vượt chỉ tiêu, sai đối tượng trong DB; mọi thao tác chiếm chỗ khóa hàng cấu hình
--   (for update) nên hai người đăng ký/duyệt đồng thời được xếp hàng tuần tự.
-- - Không có chức năng sinh viên tự hủy.
-- - Điểm uy tín chỉ dùng khi chương trình vừa giới hạn chỗ vừa yêu cầu duyệt; duyệt người thấp hơn
--   khi còn người cao hơn có thể xếp chỗ phải có lý do. Sinh viên không đọc được điểm/lịch sử uy tín.
-- - Đăng ký chưa phải điểm danh: không có trạng thái "có tham gia"/"hoàn thành", không trừ điểm.
--
-- Tái sử dụng: event_programs (UC6), forms/form_responses + evaluate_audience_rule (Prompt 02), write_audit.

-- ── Đối tượng: thêm điều kiện theo ngành, Đoàn viên phải còn hiệu lực ────────
create or replace function public.evaluate_audience_rule(
  p_rule    jsonb,
  p_user_id uuid
) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_type text := p_rule->>'type';
  v_cond jsonb;
begin
  if v_type = 'any' then
    return true;
  end if;

  if v_type = 'hiu_student' then
    return p_user_id is not null
      and exists (select 1 from public.accounts where user_id = p_user_id and status = 'active');
  end if;

  if v_type = 'faculty' then
    return p_user_id is not null
      and exists (
        select 1
        from public.student_profiles sp
        join public.classes c on c.id = sp.class_id
        join public.programs pr on pr.id = c.current_program_id
        where sp.user_id = p_user_id
          and pr.current_faculty_id = (p_rule->>'faculty_id')::uuid
      );
  end if;

  -- Ngành (bảng academic programs): {"type":"major","program_id":"<uuid>"}
  if v_type = 'major' then
    return p_user_id is not null
      and exists (
        select 1
        from public.student_profiles sp
        join public.classes c on c.id = sp.class_id
        where sp.user_id = p_user_id
          and c.current_program_id = (p_rule->>'program_id')::uuid
      );
  end if;

  if v_type = 'union_member' then
    return p_user_id is not null
      and exists (
        select 1 from public.union_memberships
        where user_id = p_user_id and status = 'recognized'
      );
  end if;

  if v_type = 'and' then
    for v_cond in select value from jsonb_array_elements(p_rule->'conditions') loop
      if not public.evaluate_audience_rule(v_cond, p_user_id) then
        return false;
      end if;
    end loop;
    return true;
  end if;

  if v_type = 'or' then
    for v_cond in select value from jsonb_array_elements(p_rule->'conditions') loop
      if public.evaluate_audience_rule(v_cond, p_user_id) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  return false;
end;
$$;

-- ── Bảng ──────────────────────────────────────────────────────────────────────
create table if not exists public.program_registration_settings (
  program_id         uuid primary key references public.event_programs(id) on delete restrict,
  status             text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  audience_rule      jsonb not null default '{"type":"hiu_student"}'::jsonb
                       check (jsonb_typeof(audience_rule) = 'object'),
  capacity           integer check (capacity is null or capacity between 1 and 100000),
  requires_approval  boolean not null default false,
  form_id            uuid references public.forms(id) on delete restrict,
  closes_at          timestamptz,
  quota_release_at   timestamptz,
  instructions       text check (instructions is null or char_length(instructions) <= 2000),
  opened_at          timestamptz,
  closed_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.accounts(user_id) on delete restrict
);

create table if not exists public.program_registration_quotas (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.program_registration_settings(program_id) on delete restrict,
  label         text not null check (char_length(btrim(label)) between 2 and 120),
  audience_rule jsonb not null check (jsonb_typeof(audience_rule) = 'object'),
  seats         integer not null check (seats between 1 and 100000),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (program_id, label)
);

create table if not exists public.program_registrations (
  id               uuid primary key default gen_random_uuid(),
  program_id       uuid not null references public.program_registration_settings(program_id) on delete restrict,
  user_id          uuid not null references public.accounts(user_id) on delete restrict,
  status           text not null check (status in ('pending', 'accepted', 'rejected')),
  quota_id         uuid references public.program_registration_quotas(id) on delete restrict,
  form_response_id uuid unique references public.form_responses(id) on delete restrict,
  registered_at    timestamptz not null default now(),
  decided_at       timestamptz,
  decided_by       uuid references public.accounts(user_id) on delete restrict,
  decision_reason  text,
  unique (program_id, user_id),
  check ((status = 'pending') = (decided_at is null)),
  check (status = 'accepted' or quota_id is null),
  check (status <> 'rejected' or char_length(btrim(coalesce(decision_reason, ''))) >= 10)
);

create table if not exists public.program_registration_history (
  id                        bigint generated always as identity primary key,
  program_id                uuid not null references public.event_programs(id) on delete restrict,
  registration_id           uuid references public.program_registrations(id) on delete restrict,
  action                    text not null check (action in (
                              'settings_saved', 'opened', 'closed',
                              'registered', 'auto_accepted', 'approved', 'rejected')),
  from_status               text,
  to_status                 text,
  reason                    text,
  skipped_higher_reputation boolean not null default false,
  details                   jsonb,
  actor_user_id             uuid not null references public.accounts(user_id) on delete restrict,
  actor_role_grant_id       uuid references public.role_grants(id) on delete set null,
  actor_role_code           text,
  actor_name                text,
  request_id                text,
  occurred_at               timestamptz not null default now(),
  check (not skipped_higher_reputation or char_length(btrim(coalesce(reason, ''))) >= 10)
);

drop trigger if exists program_registration_history_fill_actor on public.program_registration_history;
create trigger program_registration_history_fill_actor before insert on public.program_registration_history
  for each row execute function public.fill_event_program_history_actor();

-- Sổ điểm uy tín: chỉ UC điểm danh/công nhận sau này ghi (trừ 5 điểm, hoàn điểm). UC7 chỉ đọc.
create table if not exists public.reputation_adjustments (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.accounts(user_id) on delete restrict,
  semester_key  text not null check (semester_key ~ '^[0-9]{4}-[0-9]{4}/HK[123]$'),
  delta         integer not null check (delta <> 0 and delta between -100 and 100),
  reason        text not null,
  program_id    uuid references public.event_programs(id) on delete restrict,
  created_by    uuid references public.accounts(user_id) on delete restrict,
  created_at    timestamptz not null default now()
);

create index if not exists program_registrations_program_status_idx
  on public.program_registrations (program_id, status, registered_at);
create index if not exists program_registrations_user_idx on public.program_registrations (user_id);
create index if not exists program_registrations_quota_idx
  on public.program_registrations (quota_id) where quota_id is not null;
create index if not exists program_registration_quotas_program_idx
  on public.program_registration_quotas (program_id, sort_order);
create index if not exists program_registration_history_program_idx
  on public.program_registration_history (program_id, occurred_at);
create index if not exists reputation_adjustments_user_idx
  on public.reputation_adjustments (user_id, semester_key);
create unique index if not exists program_registration_settings_form_idx
  on public.program_registration_settings (form_id) where form_id is not null;

-- ── Uy tín (nội bộ) ───────────────────────────────────────────────────────────
-- Giả định học kỳ (chưa có bảng học kỳ): HK1 tháng 8–12, HK2 tháng 1–5, HK3 (hè) tháng 6–7, giờ Việt Nam.
create or replace function public.semester_key_for(p_at timestamptz)
returns text
language sql immutable set search_path = public as $$
  with d as (select (p_at at time zone 'Asia/Ho_Chi_Minh')::date as day)
  select case
    when extract(month from day) >= 8
      then extract(year from day)::int || '-' || (extract(year from day)::int + 1) || '/HK1'
    when extract(month from day) <= 5
      then (extract(year from day)::int - 1) || '-' || extract(year from day)::int || '/HK2'
    else (extract(year from day)::int - 1) || '-' || extract(year from day)::int || '/HK3'
  end
  from d;
$$;

-- Mỗi học kỳ bắt đầu 100 điểm, tối thiểu 0 (hỏi đáp 15.1).
create or replace function public.reputation_score(p_user_id uuid, p_at timestamptz default now())
returns integer
language sql stable security definer set search_path = public as $$
  select greatest(0, 100 + coalesce(sum(delta), 0))::int
  from public.reputation_adjustments
  where user_id = p_user_id and semester_key = public.semester_key_for(p_at);
$$;

-- ── Quyền ─────────────────────────────────────────────────────────────────────
-- BTC = Đoàn Khoa sở hữu chương trình. Trả về role grant hoặc null.
create or replace function public.program_registration_manager_grant(p_program_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select public.event_program_manager_grant(p.owner_org_id)
  from public.event_programs p where p.id = p_program_id;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.program_registration_settings enable row level security;
alter table public.program_registration_quotas   enable row level security;
alter table public.program_registrations         enable row level security;
alter table public.program_registration_history  enable row level security;
alter table public.reputation_adjustments        enable row level security;

drop policy if exists program_registration_settings_read on public.program_registration_settings;
create policy program_registration_settings_read on public.program_registration_settings for select to authenticated
  using (status <> 'draft' or public.program_registration_manager_grant(program_id) is not null);

drop policy if exists program_registration_quotas_read on public.program_registration_quotas;
create policy program_registration_quotas_read on public.program_registration_quotas for select to authenticated
  using (exists (select 1 from public.program_registration_settings s where s.program_id = program_registration_quotas.program_id));

drop policy if exists program_registrations_read on public.program_registrations;
create policy program_registrations_read on public.program_registrations for select to authenticated
  using (user_id = auth.uid() or public.program_registration_manager_grant(program_id) is not null);

-- Lịch sử có thể chứa lý do liên quan uy tín, nên chỉ BTC đọc.
drop policy if exists program_registration_history_read on public.program_registration_history;
create policy program_registration_history_read on public.program_registration_history for select to authenticated
  using (public.program_registration_manager_grant(program_id) is not null);

-- reputation_adjustments: không có policy nào → không ai đọc trực tiếp qua PostgREST.

revoke all on public.program_registration_settings, public.program_registration_quotas,
  public.program_registrations, public.program_registration_history, public.reputation_adjustments from anon;
revoke insert, update, delete on public.program_registration_settings, public.program_registration_quotas,
  public.program_registrations, public.program_registration_history from authenticated;
revoke all on public.reputation_adjustments from authenticated;
grant select on public.program_registration_settings, public.program_registration_quotas,
  public.program_registrations, public.program_registration_history to authenticated;

-- ── Phản hồi biểu mẫu: mẫu gắn với chương trình chỉ nhận qua đăng ký ──────────
-- Thân hàm cũ chuyển nguyên vào submit_form_response_internal (không cấp cho client).
create or replace function public.submit_form_response_internal(
  p_form_id          uuid,
  p_respondent_email text,
  p_answers          jsonb,
  p_identity_snapshot jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_form            record;
  v_response_id     uuid;
  v_user_id         uuid := auth.uid();
  v_ans             jsonb;
  v_question        jsonb;
  v_question_id     text;
  v_required_met    boolean;
begin
  select * into v_form from public.forms where id = p_form_id;
  if not found then raise exception 'FORM_NOT_FOUND'; end if;
  if v_form.status <> 'published' then raise exception 'FORM_NOT_PUBLISHED'; end if;
  if v_form.opens_at is not null and now() < v_form.opens_at then raise exception 'FORM_NOT_YET_OPEN'; end if;
  if v_form.closes_at is not null and now() > v_form.closes_at then raise exception 'FORM_CLOSED'; end if;

  if not public.evaluate_audience_rule(v_form.audience_rule, v_user_id) then
    raise exception 'AUDIENCE_NOT_MET';
  end if;

  if not v_form.allow_multiple_submissions and v_user_id is not null then
    if exists (
      select 1 from public.form_responses
      where form_id = p_form_id and respondent_user_id = v_user_id
    ) then
      raise exception 'ALREADY_SUBMITTED';
    end if;
  end if;

  for v_question in select value from jsonb_array_elements(v_form.questions) loop
    if (v_question->>'required')::boolean is true then
      v_question_id := v_question->>'id';
      v_required_met := false;
      for v_ans in select value from jsonb_array_elements(p_answers) loop
        if v_ans->>'question_id' = v_question_id
           and v_ans->'answer_value' is not null
           and v_ans->>'answer_value' <> 'null'
           and v_ans->>'answer_value' <> '' then
          v_required_met := true;
          exit;
        end if;
      end loop;
      if not v_required_met then
        raise exception 'REQUIRED_QUESTION_MISSING: %', v_question_id;
      end if;
    end if;
  end loop;

  insert into public.form_responses(
    form_id, form_version, questions_snapshot,
    respondent_user_id, respondent_email,
    identity_snapshot)
  values (
    p_form_id, v_form.form_version, v_form.questions,
    v_user_id, p_respondent_email,
    p_identity_snapshot)
  returning id into v_response_id;

  for v_ans in select value from jsonb_array_elements(p_answers) loop
    insert into public.form_response_answers(response_id, question_id, answer_value)
    values (v_response_id, v_ans->>'question_id', v_ans->'answer_value');
  end loop;

  return v_response_id;
end;
$$;

create or replace function public.submit_form_response(
  p_form_id          uuid,
  p_respondent_email text,
  p_answers          jsonb,
  p_identity_snapshot jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.program_registration_settings where form_id = p_form_id) then
    raise exception 'FORM_REQUIRES_PROGRAM_REGISTRATION';
  end if;
  return public.submit_form_response_internal(p_form_id, p_respondent_email, p_answers, p_identity_snapshot);
end;
$$;

-- ── Xếp chỗ ───────────────────────────────────────────────────────────────────
-- Gọi khi đã khóa hàng cấu hình. o_ok = còn chỗ cho người này; o_quota = nhóm chỉ tiêu được dùng
-- (null = chỉ tiêu chung hoặc không giới hạn).
create or replace function public.program_registration_slot(
  p_program_id uuid,
  p_user_id    uuid,
  out o_ok     boolean,
  out o_quota  uuid
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_settings public.program_registration_settings%rowtype;
  v_quota    record;
  v_total    integer;
  v_quota_seats integer;
  v_general_used integer;
begin
  o_ok := false; o_quota := null;
  select * into v_settings from public.program_registration_settings where program_id = p_program_id;
  if v_settings.program_id is null then return; end if;
  if v_settings.capacity is null then o_ok := true; return; end if;

  select count(*) into v_total from public.program_registrations
  where program_id = p_program_id and status = 'accepted';
  if v_total >= v_settings.capacity then return; end if;

  select coalesce(sum(seats), 0) into v_quota_seats
  from public.program_registration_quotas where program_id = p_program_id;

  -- Không chia chỉ tiêu, hoặc đã qua hạn: chỉ tiêu dư thành chỉ tiêu chung.
  if v_quota_seats = 0 or (v_settings.quota_release_at is not null and now() >= v_settings.quota_release_at) then
    o_ok := true; return;
  end if;

  for v_quota in
    select q.id, q.seats, q.audience_rule,
      (select count(*) from public.program_registrations r
       where r.quota_id = q.id and r.status = 'accepted') as used
    from public.program_registration_quotas q
    where q.program_id = p_program_id
    order by q.sort_order, q.label
  loop
    if v_quota.used < v_quota.seats and public.evaluate_audience_rule(v_quota.audience_rule, p_user_id) then
      o_ok := true; o_quota := v_quota.id; return;
    end if;
  end loop;

  select count(*) into v_general_used from public.program_registrations
  where program_id = p_program_id and status = 'accepted' and quota_id is null;
  if v_general_used < v_settings.capacity - v_quota_seats then
    o_ok := true;
  end if;
end;
$$;

-- ── RPC: BTC lưu cấu hình ─────────────────────────────────────────────────────
-- p_quotas: [{"id":"<uuid>|null","label":"...","audience_rule":{...},"seats":10,"sort_order":0}]
create or replace function public.save_program_registration_settings(
  p_program_id        uuid,
  p_audience_rule     jsonb,
  p_capacity          integer,
  p_requires_approval boolean,
  p_form_id           uuid,
  p_closes_at         timestamptz,
  p_quota_release_at  timestamptz,
  p_instructions      text,
  p_quotas            jsonb,
  p_request_id        text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_program  public.event_programs%rowtype;
  v_grant    uuid;
  v_before   public.program_registration_settings%rowtype;
  v_quota    jsonb;
  v_quota_id uuid;
  v_keep     uuid[] := '{}'::uuid[];
  v_sum      integer;
  v_accepted integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_program from public.event_programs where id = p_program_id for update;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if v_program.status <> 'approved' then raise exception 'PROGRAM_NOT_APPROVED'; end if;
  if p_audience_rule is null or jsonb_typeof(p_audience_rule) <> 'object' then raise exception 'INVALID_AUDIENCE'; end if;
  if p_quotas is null then p_quotas := '[]'::jsonb; end if;
  if jsonb_typeof(p_quotas) <> 'array' then raise exception 'INVALID_QUOTAS'; end if;
  if jsonb_array_length(p_quotas) > 0 and p_capacity is null then raise exception 'QUOTAS_REQUIRE_CAPACITY'; end if;
  if p_quota_release_at is not null and jsonb_array_length(p_quotas) = 0 then raise exception 'RELEASE_REQUIRES_QUOTAS'; end if;

  select * into v_before from public.program_registration_settings where program_id = p_program_id for update;
  if v_before.status = 'open' then raise exception 'SETTINGS_LOCKED_WHILE_OPEN'; end if;

  if p_form_id is not null and not exists (
    select 1 from public.forms f
    where f.id = p_form_id and f.owner_org_id = v_program.owner_org_id and f.status = 'published'
  ) then
    raise exception 'FORM_NOT_USABLE';
  end if;
  if v_before.program_id is not null
     and v_before.form_id is distinct from p_form_id
     and exists (select 1 from public.program_registrations where program_id = p_program_id) then
    raise exception 'FORM_LOCKED_AFTER_REGISTRATION';
  end if;
  if v_before.requires_approval and not coalesce(p_requires_approval, false)
     and exists (select 1 from public.program_registrations where program_id = p_program_id and status = 'pending') then
    raise exception 'PENDING_REGISTRATIONS_EXIST';
  end if;

  if v_before.program_id is null then
    insert into public.program_registration_settings(program_id, updated_by) values (p_program_id, auth.uid());
  end if;
  update public.program_registration_settings
  set audience_rule = p_audience_rule,
      capacity = p_capacity,
      requires_approval = coalesce(p_requires_approval, false),
      form_id = p_form_id,
      closes_at = p_closes_at,
      quota_release_at = p_quota_release_at,
      instructions = nullif(btrim(coalesce(p_instructions, '')), ''),
      updated_at = now(),
      updated_by = auth.uid()
  where program_id = p_program_id;

  for v_quota in select value from jsonb_array_elements(p_quotas) loop
    if jsonb_typeof(v_quota->'audience_rule') is distinct from 'object' then raise exception 'INVALID_QUOTAS'; end if;
    v_quota_id := nullif(v_quota->>'id', '')::uuid;
    if v_quota_id is not null then
      update public.program_registration_quotas
      set label = btrim(v_quota->>'label'), audience_rule = v_quota->'audience_rule',
          seats = (v_quota->>'seats')::int, sort_order = coalesce((v_quota->>'sort_order')::int, 0)
      where id = v_quota_id and program_id = p_program_id;
      if not found then raise exception 'QUOTA_NOT_FOUND'; end if;
    else
      insert into public.program_registration_quotas(program_id, label, audience_rule, seats, sort_order)
      values (p_program_id, btrim(v_quota->>'label'), v_quota->'audience_rule',
              (v_quota->>'seats')::int, coalesce((v_quota->>'sort_order')::int, 0))
      returning id into v_quota_id;
    end if;
    v_keep := array_append(v_keep, v_quota_id);
  end loop;

  if exists (
    select 1 from public.program_registration_quotas q
    where q.program_id = p_program_id and not (q.id = any(v_keep))
      and exists (select 1 from public.program_registrations r where r.quota_id = q.id)
  ) then
    raise exception 'QUOTA_IN_USE';
  end if;
  delete from public.program_registration_quotas where program_id = p_program_id and not (id = any(v_keep));

  select coalesce(sum(seats), 0) into v_sum from public.program_registration_quotas where program_id = p_program_id;
  if p_capacity is not null and v_sum > p_capacity then raise exception 'QUOTAS_EXCEED_CAPACITY'; end if;
  select count(*) into v_accepted from public.program_registrations where program_id = p_program_id and status = 'accepted';
  if p_capacity is not null and v_accepted > p_capacity then raise exception 'CAPACITY_BELOW_ACCEPTED'; end if;
  if exists (
    select 1 from public.program_registration_quotas q
    where q.program_id = p_program_id
      and q.seats < (select count(*) from public.program_registrations r where r.quota_id = q.id and r.status = 'accepted')
  ) then
    raise exception 'CAPACITY_BELOW_ACCEPTED';
  end if;

  insert into public.program_registration_history(program_id, action, from_status, to_status, details, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, 'settings_saved', v_before.status, coalesce(v_before.status, 'draft'),
          jsonb_build_object('capacity', p_capacity, 'requires_approval', coalesce(p_requires_approval, false),
                             'quota_count', jsonb_array_length(p_quotas), 'form_id', p_form_id),
          auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_registration.settings_saved', 'event_program', p_program_id::text,
    case when v_before.program_id is null then null else to_jsonb(v_before) end,
    (select to_jsonb(s) from public.program_registration_settings s where s.program_id = p_program_id),
    v_grant, v_program.owner_org_id, p_request_id);
  return p_program_id;
end;
$$;

-- ── RPC: BTC mở/đóng đăng ký ──────────────────────────────────────────────────
create or replace function public.set_program_registration_status(
  p_program_id uuid,
  p_status     text,
  p_request_id text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_program  public.event_programs%rowtype;
  v_settings public.program_registration_settings%rowtype;
  v_grant    uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_status not in ('open', 'closed') then raise exception 'INVALID_STATUS'; end if;
  select * into v_program from public.event_programs where id = p_program_id;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if v_program.status <> 'approved' then raise exception 'PROGRAM_NOT_APPROVED'; end if;

  select * into v_settings from public.program_registration_settings where program_id = p_program_id for update;
  if v_settings.program_id is null then raise exception 'SETTINGS_REQUIRED'; end if;
  if v_settings.status = p_status then raise exception 'INVALID_TRANSITION'; end if;
  if p_status = 'closed' and v_settings.status <> 'open' then raise exception 'INVALID_TRANSITION'; end if;
  if p_status = 'open' then
    if v_program.ends_at is not null and v_program.ends_at <= now() then raise exception 'PROGRAM_ENDED'; end if;
    if v_settings.closes_at is not null and v_settings.closes_at <= now() then raise exception 'DEADLINE_PASSED'; end if;
  end if;

  update public.program_registration_settings
  set status = p_status,
      opened_at = case when p_status = 'open' then now() else opened_at end,
      closed_at = case when p_status = 'closed' then now() else closed_at end,
      updated_at = now(), updated_by = auth.uid()
  where program_id = p_program_id;

  insert into public.program_registration_history(program_id, action, from_status, to_status, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, case p_status when 'open' then 'opened' else 'closed' end,
          v_settings.status, p_status, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_registration.' || case p_status when 'open' then 'opened' else 'closed' end,
    'event_program', p_program_id::text,
    jsonb_build_object('status', v_settings.status), jsonb_build_object('status', p_status),
    v_grant, v_program.owner_org_id, p_request_id);
  return p_status;
end;
$$;

-- ── RPC: sinh viên đăng ký ────────────────────────────────────────────────────
create or replace function public.register_for_program(
  p_program_id        uuid,
  p_answers           jsonb,
  p_identity_snapshot jsonb,
  p_request_id        text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_program  public.event_programs%rowtype;
  v_settings public.program_registration_settings%rowtype;
  v_slot     record;
  v_quota    uuid;
  v_response uuid;
  v_id       uuid;
  v_status   text;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.accounts where user_id = v_user and status = 'active') then
    raise exception 'ACCOUNT_NOT_ACTIVE';
  end if;

  -- Khóa cấu hình: mọi đăng ký/duyệt của cùng chương trình chạy tuần tự (chống tranh suất cuối).
  select * into v_settings from public.program_registration_settings where program_id = p_program_id for update;
  if v_settings.program_id is null or v_settings.status <> 'open' then raise exception 'REGISTRATION_NOT_OPEN'; end if;
  select * into v_program from public.event_programs where id = p_program_id;
  if v_program.status <> 'approved' then raise exception 'REGISTRATION_NOT_OPEN'; end if;
  if (v_settings.closes_at is not null and v_settings.closes_at <= now())
     or (v_program.ends_at is not null and v_program.ends_at <= now()) then
    raise exception 'REGISTRATION_CLOSED';
  end if;

  if exists (select 1 from public.program_registrations where program_id = p_program_id and user_id = v_user) then
    raise exception 'ALREADY_REGISTERED';
  end if;
  if not public.evaluate_audience_rule(v_settings.audience_rule, v_user) then
    raise exception 'AUDIENCE_NOT_MET';
  end if;

  if v_settings.requires_approval then
    v_status := 'pending';
  else
    select * into v_slot from public.program_registration_slot(p_program_id, v_user);
    if not v_slot.o_ok then raise exception 'REGISTRATION_FULL'; end if;
    v_quota := v_slot.o_quota;
    v_status := 'accepted';
  end if;

  if v_settings.form_id is not null then
    v_response := public.submit_form_response_internal(
      v_settings.form_id, null, coalesce(p_answers, '[]'::jsonb), p_identity_snapshot);
  end if;

  insert into public.program_registrations(program_id, user_id, status, quota_id, form_response_id, decided_at)
  values (p_program_id, v_user, v_status,
          v_quota,
          v_response,
          case when v_status = 'accepted' then now() end)
  returning id into v_id;

  insert into public.program_registration_history(program_id, registration_id, action, from_status, to_status, actor_user_id, request_id)
  values (p_program_id, v_id, 'registered', null, 'pending', v_user, p_request_id);
  if v_status = 'accepted' then
    insert into public.program_registration_history(program_id, registration_id, action, from_status, to_status, details, actor_user_id, request_id)
    values (p_program_id, v_id, 'auto_accepted', 'pending', 'accepted',
            jsonb_build_object('quota_id', v_quota), v_user, p_request_id);
  end if;
  perform public.write_audit('program_registration.registered', 'program_registration', v_id::text, null,
    jsonb_build_object('program_id', p_program_id, 'status', v_status, 'quota_id', v_quota),
    null, v_program.owner_org_id, p_request_id);
  return jsonb_build_object('registration_id', v_id, 'status', v_status);
exception
  when unique_violation then raise exception 'ALREADY_REGISTERED';
end;
$$;

-- ── RPC: BTC duyệt/từ chối ────────────────────────────────────────────────────
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
    if v_settings.capacity is not null and v_settings.requires_approval then
      v_score := public.reputation_score(v_reg.user_id);
      for v_other in
        select r.user_id from public.program_registrations r
        where r.program_id = v_reg.program_id and r.status = 'pending' and r.id <> v_reg.id
          and public.reputation_score(r.user_id) > v_score
      loop
        if (select s.o_ok from public.program_registration_slot(v_reg.program_id, v_other.user_id) s) then
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

-- ── RPC: tóm tắt công khai (số chỗ) ───────────────────────────────────────────
create or replace function public.program_registration_summary(p_program_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'capacity', s.capacity,
    'accepted', (select count(*) from public.program_registrations r where r.program_id = s.program_id and r.status = 'accepted'),
    'pending',  (select count(*) from public.program_registrations r where r.program_id = s.program_id and r.status = 'pending'),
    'quotas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'label', q.label, 'seats', q.seats,
        'accepted', (select count(*) from public.program_registrations r where r.quota_id = q.id and r.status = 'accepted'))
        order by q.sort_order, q.label)
      from public.program_registration_quotas q where q.program_id = s.program_id), '[]'::jsonb),
    'quotas_released', s.quota_release_at is not null and now() >= s.quota_release_at
  )
  from public.program_registration_settings s
  join public.event_programs p on p.id = s.program_id
  where s.program_id = p_program_id
    and (s.status <> 'draft' or public.event_program_manager_grant(p.owner_org_id) is not null);
$$;

-- ── RPC: BTC xem danh sách (kèm gợi ý thứ tự uy tín khi áp dụng) ──────────────
create or replace function public.list_program_registrations(p_program_id uuid)
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
    select r.*, case when v_uses_reputation then public.reputation_score(r.user_id) end as score
    from public.program_registrations r where r.program_id = p_program_id
  )
  select b.id, b.user_id, a.student_code, sp.full_name, cat.class_code, cat.program_name, cat.faculty_name,
    b.status, q.label, b.registered_at, b.decided_at, b.decision_reason, b.score,
    case when b.status = 'pending' and v_uses_reputation
      then (rank() over (partition by b.status = 'pending' order by b.score desc, b.registered_at))::int end,
    coalesce((select jsonb_object_agg(fa.question_id, fa.answer_value)
              from public.form_response_answers fa where fa.response_id = b.form_response_id), '{}'::jsonb)
  from base b
  join public.accounts a on a.user_id = b.user_id
  left join public.student_profiles sp on sp.user_id = b.user_id
  left join public.current_academic_catalog cat on cat.class_id = sp.class_id
  left join public.program_registration_quotas q on q.id = b.quota_id
  order by case b.status when 'pending' then 0 when 'accepted' then 1 else 2 end,
    b.score desc nulls last, b.registered_at;
end;
$$;

-- ── Quyền thực thi ────────────────────────────────────────────────────────────
revoke all on function public.submit_form_response_internal(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.semester_key_for(timestamptz) from public, anon;
revoke all on function public.reputation_score(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.program_registration_slot(uuid, uuid) from public, anon, authenticated;
revoke all on function public.program_registration_manager_grant(uuid) from public, anon;
revoke all on function public.save_program_registration_settings(uuid, jsonb, integer, boolean, uuid, timestamptz, timestamptz, text, jsonb, text) from public, anon;
revoke all on function public.set_program_registration_status(uuid, text, text) from public, anon;
revoke all on function public.register_for_program(uuid, jsonb, jsonb, text) from public, anon;
revoke all on function public.decide_program_registration(uuid, text, text, text) from public, anon;
revoke all on function public.program_registration_summary(uuid) from public, anon;
revoke all on function public.list_program_registrations(uuid) from public, anon;

grant execute on function public.semester_key_for(timestamptz) to authenticated;
grant execute on function public.program_registration_manager_grant(uuid) to authenticated;
grant execute on function public.save_program_registration_settings(uuid, jsonb, integer, boolean, uuid, timestamptz, timestamptz, text, jsonb, text) to authenticated;
grant execute on function public.set_program_registration_status(uuid, text, text) to authenticated;
grant execute on function public.register_for_program(uuid, jsonb, jsonb, text) to authenticated;
grant execute on function public.decide_program_registration(uuid, text, text, text) to authenticated;
grant execute on function public.program_registration_summary(uuid) to authenticated;
grant execute on function public.list_program_registrations(uuid) to authenticated;
grant execute on function public.submit_form_response(uuid, text, jsonb, jsonb) to authenticated, anon;
