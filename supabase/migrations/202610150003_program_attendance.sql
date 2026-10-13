-- UC8: Điểm danh bằng QR lượt và điểm rèn luyện DỰ KIẾN ĐỀ NGHỊ.
--
-- Quy tắc đã chốt (hỏi đáp 11.1, 11.2, 12.1–12.3, 14.1, 15.1, 16.1 và yêu cầu UC8):
-- - BTC (Đoàn Khoa sở hữu chương trình đã duyệt) cấu hình nhiều lượt, mở/đóng từng lượt; QR chung của
--   lượt đổi mỗi 30 giây. Sinh viên đăng nhập, có đăng ký 'accepted', tự quét.
-- - Token ký HMAC-SHA256 bằng bí mật riêng của lượt (không client nào đọc được), gồm lượt, lần mở
--   (generation) và thời điểm phát theo đồng hồ server. Hết 30 giây hoặc thuộc lần mở trước → hết hiệu lực.
-- - Một bản ghi/sinh viên/lượt (unique). Mở lại đúng lượt cũ để điểm danh bổ sung, không tạo lượt mới.
-- - Có tham gia = ≥1 lượt (kể cả lượt 0 điểm); Hoàn thành = có tham gia và điểm ≥ 1; không lượt nào =
--   đăng ký nhưng không tham gia.
-- - Điểm tối đa là số nguyên do BTC nhập; quy tắc: đủ lượt bắt buộc / ít nhất một lượt / cộng từng lượt /
--   theo bậc số lượt (có thể kèm lượt bắt buộc). Kết quả luôn ≤ điểm tối đa.
-- - Sau lần mở lượt đầu tiên, quy tắc bị khóa: chỉ faculty_manager được điều chỉnh, phải có lý do, có lịch sử.
-- - Đây là điểm DỰ KIẾN ĐỀ NGHỊ; không ghi reputation_adjustments (trừ 5 điểm sau khi Văn phòng nghiệm thu, UC sau).

-- ── Bảng ──────────────────────────────────────────────────────────────────────
create table if not exists public.program_attendance_plans (
  program_id             uuid primary key references public.event_programs(id) on delete restrict,
  max_points             integer not null check (max_points between 0 and 100),
  rule_type              text not null check (rule_type in ('all_required', 'any_session', 'sum_sessions', 'tiers')),
  -- tiers: [{"min_sessions":2,"points":2},{"min_sessions":3,"points":3}]
  tiers                  jsonb not null default '[]'::jsonb check (jsonb_typeof(tiers) = 'array'),
  tiers_require_required boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.accounts(user_id) on delete restrict
);

create table if not exists public.program_attendance_sessions (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.program_attendance_plans(program_id) on delete restrict,
  label        text not null check (char_length(btrim(label)) between 2 and 120),
  points       integer not null default 0 check (points between 0 and 100),
  is_required  boolean not null default false,
  sort_order   integer not null default 0,
  status       text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  -- Số lần đã mở; token mang generation này nên mã của lần mở trước không dùng lại được.
  open_count   integer not null default 0 check (open_count >= 0),
  opened_at    timestamptz,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  unique (program_id, label),
  check ((status = 'draft') = (open_count = 0))
);

-- Bí mật ký QR tách bảng riêng, không cấp quyền đọc cho client.
create table if not exists public.program_attendance_secrets (
  session_id uuid primary key references public.program_attendance_sessions(id) on delete restrict,
  secret     bytea not null default extensions.gen_random_bytes(32)
);

create table if not exists public.program_attendance_records (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.program_attendance_sessions(id) on delete restrict,
  program_id      uuid not null references public.program_attendance_plans(program_id) on delete restrict,
  user_id         uuid not null references public.accounts(user_id) on delete restrict,
  registration_id uuid not null references public.program_registrations(id) on delete restrict,
  generation      integer not null check (generation >= 1),
  is_supplementary boolean not null default false,
  recorded_at     timestamptz not null default now(),
  request_id      text,
  unique (session_id, user_id)
);

create table if not exists public.program_attendance_history (
  id                  bigint generated always as identity primary key,
  program_id          uuid not null references public.event_programs(id) on delete restrict,
  session_id          uuid references public.program_attendance_sessions(id) on delete restrict,
  action              text not null check (action in (
                        'plan_saved', 'plan_amended', 'session_opened', 'session_reopened', 'session_closed')),
  from_status         text,
  to_status           text,
  reason              text,
  before_data         jsonb,
  after_data          jsonb,
  actor_user_id       uuid not null references public.accounts(user_id) on delete restrict,
  actor_role_grant_id uuid references public.role_grants(id) on delete set null,
  actor_role_code     text,
  actor_name          text,
  request_id          text,
  occurred_at         timestamptz not null default now(),
  check (action not in ('plan_amended', 'session_reopened') or char_length(btrim(coalesce(reason, ''))) >= 10)
);

drop trigger if exists program_attendance_history_fill_actor on public.program_attendance_history;
create trigger program_attendance_history_fill_actor before insert on public.program_attendance_history
  for each row execute function public.fill_event_program_history_actor();

create index if not exists program_attendance_sessions_program_idx on public.program_attendance_sessions (program_id, sort_order);
create index if not exists program_attendance_records_program_user_idx on public.program_attendance_records (program_id, user_id);
create index if not exists program_attendance_history_program_idx on public.program_attendance_history (program_id, occurred_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.program_attendance_plans    enable row level security;
alter table public.program_attendance_sessions enable row level security;
alter table public.program_attendance_secrets  enable row level security;
alter table public.program_attendance_records  enable row level security;
alter table public.program_attendance_history  enable row level security;

-- Lượt và quy tắc của chương trình đã duyệt là thông tin công khai trong trường.
drop policy if exists program_attendance_plans_read on public.program_attendance_plans;
create policy program_attendance_plans_read on public.program_attendance_plans for select to authenticated
  using (exists (select 1 from public.event_programs p where p.id = program_id and p.status = 'approved'));
drop policy if exists program_attendance_sessions_read on public.program_attendance_sessions;
create policy program_attendance_sessions_read on public.program_attendance_sessions for select to authenticated
  using (exists (select 1 from public.event_programs p where p.id = program_id and p.status = 'approved'));
drop policy if exists program_attendance_records_read on public.program_attendance_records;
create policy program_attendance_records_read on public.program_attendance_records for select to authenticated
  using (user_id = auth.uid() or public.program_registration_manager_grant(program_id) is not null);
drop policy if exists program_attendance_history_read on public.program_attendance_history;
create policy program_attendance_history_read on public.program_attendance_history for select to authenticated
  using (public.program_registration_manager_grant(program_id) is not null);
-- program_attendance_secrets: không có policy.

revoke all on public.program_attendance_plans, public.program_attendance_sessions, public.program_attendance_secrets,
  public.program_attendance_records, public.program_attendance_history from anon;
revoke all on public.program_attendance_secrets from authenticated;
revoke insert, update, delete on public.program_attendance_plans, public.program_attendance_sessions,
  public.program_attendance_records, public.program_attendance_history from authenticated;
grant select on public.program_attendance_plans, public.program_attendance_sessions,
  public.program_attendance_records, public.program_attendance_history to authenticated;

-- ── Token QR ──────────────────────────────────────────────────────────────────
-- Định dạng: <session_id>.<generation>.<issued_ms>.<chữ ký 32 hex>
create or replace function public.attendance_token_signature(p_session_id uuid, p_generation integer, p_issued_ms bigint)
returns text
language sql stable security definer set search_path = public as $$
  select left(encode(extensions.hmac(
    convert_to(p_session_id::text || ':' || p_generation || ':' || p_issued_ms, 'UTF8'),
    s.secret, 'sha256'), 'hex'), 32)
  from public.program_attendance_secrets s where s.session_id = p_session_id;
$$;

create or replace function public.issue_attendance_qr(p_session_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_session public.program_attendance_sessions%rowtype;
  v_ms      bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_session from public.program_attendance_sessions where id = p_session_id;
  if v_session.id is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if public.program_registration_manager_grant(v_session.program_id) is null then raise exception 'FORBIDDEN'; end if;
  if v_session.status <> 'open' then raise exception 'SESSION_NOT_OPEN'; end if;
  return jsonb_build_object(
    'token', p_session_id::text || '.' || v_session.open_count || '.' || v_ms || '.'
             || public.attendance_token_signature(p_session_id, v_session.open_count, v_ms),
    'issued_at', to_jsonb(to_timestamp(v_ms / 1000.0)),
    'expires_at', to_jsonb(to_timestamp((v_ms + 30000) / 1000.0)),
    'ttl_seconds', 30);
end;
$$;

-- ── Sinh viên quét QR ─────────────────────────────────────────────────────────
create or replace function public.check_in_attendance(
  p_session_id uuid,
  p_token      text,
  p_request_id text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_parts   text[];
  v_token_session uuid;
  v_generation integer;
  v_issued_ms  bigint;
  v_now_ms     bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_session public.program_attendance_sessions%rowtype;
  v_reg     public.program_registrations%rowtype;
  v_id      uuid;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  v_parts := string_to_array(coalesce(p_token, ''), '.');
  if array_length(v_parts, 1) is distinct from 4
     or v_parts[1] !~ '^[0-9a-f-]{36}$' or v_parts[2] !~ '^[0-9]{1,6}$'
     or v_parts[3] !~ '^[0-9]{10,16}$' or v_parts[4] !~ '^[0-9a-f]{32}$' then
    raise exception 'QR_INVALID';
  end if;
  v_token_session := v_parts[1]::uuid;
  v_generation := v_parts[2]::integer;
  v_issued_ms := v_parts[3]::bigint;
  if v_token_session <> p_session_id then raise exception 'WRONG_SESSION'; end if;

  -- for share: không cho đóng lượt chen giữa lúc đang ghi nhận.
  select * into v_session from public.program_attendance_sessions where id = p_session_id for share;
  if v_session.id is null then raise exception 'QR_INVALID'; end if;
  if public.attendance_token_signature(p_session_id, v_generation, v_issued_ms) is distinct from v_parts[4] then
    raise exception 'QR_INVALID';
  end if;
  if v_session.status <> 'open' then raise exception 'SESSION_NOT_OPEN'; end if;
  -- Hạn 30 giây theo đồng hồ server; cho lệch tối đa 5 giây về tương lai; mã của lần mở trước hết hiệu lực.
  if v_generation <> v_session.open_count or v_now_ms - v_issued_ms > 30000 or v_issued_ms - v_now_ms > 5000 then
    raise exception 'QR_EXPIRED';
  end if;

  select * into v_reg from public.program_registrations
  where program_id = v_session.program_id and user_id = v_user;
  if v_reg.id is null or v_reg.status <> 'accepted' then raise exception 'REGISTRATION_NOT_ACCEPTED'; end if;
  if exists (select 1 from public.program_attendance_records where session_id = p_session_id and user_id = v_user) then
    raise exception 'ALREADY_CHECKED_IN';
  end if;

  insert into public.program_attendance_records(session_id, program_id, user_id, registration_id, generation, is_supplementary, request_id)
  values (p_session_id, v_session.program_id, v_user, v_reg.id, v_generation, v_session.open_count > 1, p_request_id)
  returning id into v_id;
  perform public.write_audit('program_attendance.checked_in', 'program_attendance_record', v_id::text, null,
    jsonb_build_object('session_id', p_session_id, 'generation', v_generation, 'supplementary', v_session.open_count > 1),
    null, (select owner_org_id from public.event_programs where id = v_session.program_id), p_request_id);
  return jsonb_build_object('record_id', v_id, 'session_label', v_session.label, 'supplementary', v_session.open_count > 1);
exception
  when unique_violation then raise exception 'ALREADY_CHECKED_IN';
end;
$$;

-- ── BTC lưu/điều chỉnh kế hoạch điểm danh ────────────────────────────────────
-- p_sessions: [{"id":null|"<uuid>","label":"Đầu giờ","points":0,"is_required":true,"sort_order":0}]
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
    select role_code into v_role from public.role_grants where id = v_grant;
    if v_role <> 'faculty_manager' then raise exception 'AMEND_FORBIDDEN'; end if;
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

-- ── BTC mở/đóng/mở lại lượt ───────────────────────────────────────────────────
create or replace function public.set_attendance_session_status(
  p_session_id uuid,
  p_status     text,
  p_reason     text default null,
  p_request_id text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_session public.program_attendance_sessions%rowtype;
  v_program public.event_programs%rowtype;
  v_grant   uuid;
  v_action  text;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_status not in ('open', 'closed') then raise exception 'INVALID_STATUS'; end if;
  select * into v_session from public.program_attendance_sessions where id = p_session_id for update;
  if v_session.id is null then raise exception 'SESSION_NOT_FOUND'; end if;
  select * into v_program from public.event_programs where id = v_session.program_id;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if v_program.status <> 'approved' then raise exception 'PROGRAM_NOT_APPROVED'; end if;

  if p_status = 'open' then
    if v_session.status = 'open' then raise exception 'INVALID_TRANSITION'; end if;
    if v_session.status = 'closed' then
      if char_length(coalesce(v_reason, '')) < 10 then raise exception 'REOPEN_REASON_REQUIRED'; end if;
      v_action := 'session_reopened';
    else
      v_action := 'session_opened';
    end if;
    update public.program_attendance_sessions
    set status = 'open', open_count = open_count + 1, opened_at = now()
    where id = p_session_id;
  else
    if v_session.status <> 'open' then raise exception 'INVALID_TRANSITION'; end if;
    v_action := 'session_closed';
    update public.program_attendance_sessions set status = 'closed', closed_at = now() where id = p_session_id;
  end if;

  insert into public.program_attendance_history(program_id, session_id, action, from_status, to_status, reason,
    after_data, actor_user_id, actor_role_grant_id, request_id)
  values (v_session.program_id, p_session_id, v_action, v_session.status, p_status, v_reason,
    jsonb_build_object('open_count', v_session.open_count + case when p_status = 'open' then 1 else 0 end),
    auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_attendance.' || v_action, 'program_attendance_session', p_session_id::text,
    jsonb_build_object('status', v_session.status), jsonb_build_object('status', p_status, 'reason', v_reason),
    v_grant, v_program.owner_org_id, p_request_id);
  return p_status;
end;
$$;

-- ── Điểm dự kiến đề nghị ──────────────────────────────────────────────────────
create or replace function public.attendance_expected_points(p_program_id uuid, p_user_id uuid)
returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  v_plan     public.program_attendance_plans%rowtype;
  v_count    integer;
  v_missing_required boolean;
  v_points   integer;
begin
  select * into v_plan from public.program_attendance_plans where program_id = p_program_id;
  if v_plan.program_id is null then return 0; end if;
  select count(*) into v_count from public.program_attendance_records
  where program_id = p_program_id and user_id = p_user_id;
  if v_count = 0 then return 0; end if;
  v_missing_required := exists (
    select 1 from public.program_attendance_sessions s
    where s.program_id = p_program_id and s.is_required
      and not exists (select 1 from public.program_attendance_records r where r.session_id = s.id and r.user_id = p_user_id));

  v_points := case v_plan.rule_type
    when 'all_required' then case when v_missing_required then 0 else v_plan.max_points end
    when 'any_session' then v_plan.max_points
    when 'sum_sessions' then (
      select coalesce(sum(s.points), 0) from public.program_attendance_records r
      join public.program_attendance_sessions s on s.id = r.session_id
      where r.program_id = p_program_id and r.user_id = p_user_id)
    when 'tiers' then case when v_plan.tiers_require_required and v_missing_required then 0 else coalesce((
      select max((t->>'points')::int) from jsonb_array_elements(v_plan.tiers) t
      where (t->>'min_sessions')::int <= v_count), 0) end
  end;
  -- Không vượt điểm tối đa BTC đã nhập (11.1).
  return least(greatest(coalesce(v_points, 0), 0), v_plan.max_points);
end;
$$;

create or replace function public.program_attendance_preview(p_program_id uuid)
returns table (
  registration_id   uuid,
  user_id           uuid,
  student_code      text,
  full_name         text,
  class_code        text,
  faculty_name      text,
  attended_count    integer,
  attended_sessions jsonb,
  participation     text,
  expected_points   integer
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if public.program_registration_manager_grant(p_program_id) is null then raise exception 'FORBIDDEN'; end if;
  return query
  select r.id, r.user_id, a.student_code, sp.full_name, cat.class_code, cat.faculty_name,
    coalesce(att.cnt, 0)::int,
    coalesce(att.sessions, '[]'::jsonb),
    case when coalesce(att.cnt, 0) = 0 then 'absent'
         when public.attendance_expected_points(p_program_id, r.user_id) >= 1 then 'completed'
         else 'participated' end,
    public.attendance_expected_points(p_program_id, r.user_id)
  from public.program_registrations r
  join public.accounts a on a.user_id = r.user_id
  left join public.student_profiles sp on sp.user_id = r.user_id
  left join public.current_academic_catalog cat on cat.class_id = sp.class_id
  left join lateral (
    select count(*) as cnt,
      jsonb_agg(jsonb_build_object('session_id', ar.session_id, 'supplementary', ar.is_supplementary,
                                   'recorded_at', ar.recorded_at) order by ar.recorded_at) as sessions
    from public.program_attendance_records ar where ar.program_id = p_program_id and ar.user_id = r.user_id
  ) att on true
  where r.program_id = p_program_id and r.status = 'accepted'
  order by a.student_code;
end;
$$;

-- ── Quyền thực thi ────────────────────────────────────────────────────────────
revoke all on function public.attendance_token_signature(uuid, integer, bigint) from public, anon, authenticated;
revoke all on function public.attendance_expected_points(uuid, uuid) from public, anon, authenticated;
revoke all on function public.issue_attendance_qr(uuid) from public, anon;
revoke all on function public.check_in_attendance(uuid, text, text) from public, anon;
revoke all on function public.save_attendance_plan(uuid, integer, text, jsonb, boolean, jsonb, text, text) from public, anon;
revoke all on function public.set_attendance_session_status(uuid, text, text, text) from public, anon;
revoke all on function public.program_attendance_preview(uuid) from public, anon;
grant execute on function public.issue_attendance_qr(uuid) to authenticated;
grant execute on function public.check_in_attendance(uuid, text, text) to authenticated;
grant execute on function public.save_attendance_plan(uuid, integer, text, jsonb, boolean, jsonb, text, text) to authenticated;
grant execute on function public.set_attendance_session_status(uuid, text, text, text) to authenticated;
grant execute on function public.program_attendance_preview(uuid) to authenticated;
