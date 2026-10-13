-- UC9: Khóa điểm danh, hồ sơ nghiệm thu, Văn phòng nghiệm thu, trừ/hoàn uy tín, khiếu nại, cấu hình học kỳ.
--
-- Quy tắc đã chốt (hỏi đáp 12.2, 14.1, 15.1, 16.1 và yêu cầu UC9):
-- - BTC (Đoàn Khoa sở hữu) khóa điểm danh rồi lập hồ sơ: Đơn đề nghị có chữ ký Trưởng BTC (PDF scan), báo cáo
--   kết quả (PDF) và ảnh minh chứng. Mỗi lần tải là một phiên bản mới; bản cũ được giữ (thay thế/rút có lịch sử).
-- - Chỉ Văn phòng Đoàn – Hội nghiệm thu; người đã nộp và BTC của chính chương trình không tự nghiệm thu.
-- - Nghiệm thu chốt snapshot kết quả (phiên bản 1). Mỗi khiếu nại được chấp nhận tạo phiên bản mới; không sửa bản cũ.
-- - Sau nghiệm thu: mỗi sinh viên có đăng ký 'accepted' mà không có lượt điểm danh nào bị trừ đúng 5 điểm uy tín
--   trong học kỳ chứa ngày bắt đầu chương trình; tối đa một lần mỗi chương trình (unique index).
--   Không trừ: có ≥1 lượt (kể cả 0 điểm), đăng ký pending/rejected, chương trình hủy hoặc chưa nghiệm thu.
-- - Ngày bắt đầu chương trình chưa thuộc học kỳ nào → không nghiệm thu được (TERM_NOT_CONFIGURED), không chốt âm thầm.
-- - Khiếu nại đến hết ngày cuối học kỳ (giờ Việt Nam). BTC chấp nhận → bổ sung điểm danh đúng lượt, hoàn +5 (một lần),
--   tính lại kết quả. Giao dịch -5 và +5 đều giữ lý do, người xử lý, thời điểm; sổ uy tín chỉ thêm, không sửa/xóa.
-- - Sinh viên không đọc sổ uy tín; BTC không đọc sổ; Văn phòng đọc sổ của chương trình qua RPC riêng.

-- ── 1. Hủy chương trình (BCH Đoàn Khoa hoặc Văn phòng; trước khi nghiệm thu) ──
alter table public.event_programs drop constraint if exists event_programs_status_check;
alter table public.event_programs add constraint event_programs_status_check
  check (status in ('draft', 'submitted', 'needs_changes', 'approved', 'rejected', 'cancelled'));
alter table public.event_programs add column if not exists cancelled_at timestamptz;
alter table public.event_programs add column if not exists cancel_reason text;
alter table public.event_programs drop constraint if exists event_programs_check1;
alter table public.event_programs drop constraint if exists event_programs_decided_check;
-- Chương trình hủy giữ decided_at của lần chấp thuận.
alter table public.event_programs add constraint event_programs_decided_check
  check ((status in ('approved', 'rejected', 'cancelled')) = (decided_at is not null));
alter table public.event_programs drop constraint if exists event_programs_cancel_check;
alter table public.event_programs add constraint event_programs_cancel_check
  check ((status = 'cancelled') = (cancelled_at is not null)
         and (status <> 'cancelled' or char_length(btrim(coalesce(cancel_reason, ''))) >= 10));

alter table public.event_program_history drop constraint if exists event_program_history_action_check;
alter table public.event_program_history add constraint event_program_history_action_check
  check (action in ('created', 'updated', 'document_attached', 'submitted',
                    'changes_requested', 'rejected', 'approved', 'cancelled'));
alter table public.event_program_history drop constraint if exists event_program_history_check;
alter table public.event_program_history add constraint event_program_history_check
  check (action not in ('changes_requested', 'rejected', 'cancelled') or char_length(btrim(coalesce(reason, ''))) >= 10);

-- Sinh viên đã đăng ký vẫn thấy chương trình đã hủy.
drop policy if exists event_programs_read on public.event_programs;
create policy event_programs_read on public.event_programs for select to authenticated using (
  status in ('approved', 'cancelled')
  or public.event_program_manager_grant(owner_org_id) is not null
  or (status <> 'draft' and public.event_program_reviewer_grant() is not null)
);

-- ── 2. Bảng nghiệm thu ────────────────────────────────────────────────────────
create table if not exists public.program_acceptances (
  program_id        uuid primary key references public.event_programs(id) on delete restrict,
  status            text not null default 'draft'
                      check (status in ('draft', 'submitted', 'needs_changes', 'accepted', 'rejected')),
  attendance_locked boolean not null default true,
  locked_at         timestamptz,
  submission_count  integer not null default 0 check (submission_count >= 0),
  submitted_at      timestamptz,
  decided_at        timestamptz,
  decided_by        uuid references public.accounts(user_id) on delete restrict,
  term_id           uuid references public.academic_terms(id) on delete restrict,
  current_snapshot_version integer,
  created_by        uuid not null references public.accounts(user_id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((status in ('accepted', 'rejected')) = (decided_at is not null)),
  check (status <> 'accepted' or (term_id is not null and current_snapshot_version is not null)),
  check (status not in ('submitted', 'accepted') or attendance_locked)
);

create table if not exists public.program_acceptance_documents (
  id                 uuid primary key default gen_random_uuid(),
  program_id         uuid not null references public.program_acceptances(program_id) on delete restrict,
  kind               text not null check (kind in ('proposal', 'report', 'evidence')),
  storage_path       text not null unique,
  original_file_name text not null check (char_length(original_file_name) between 1 and 255),
  content_type       text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes         integer not null check (size_bytes between 1 and 5242880),
  sha256             text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by        uuid not null references public.accounts(user_id) on delete restrict,
  uploaded_at        timestamptz not null default now(),
  superseded_by      uuid references public.program_acceptance_documents(id) on delete restrict deferrable initially deferred,
  superseded_at      timestamptz,
  withdrawn_at       timestamptz,
  withdrawn_by       uuid references public.accounts(user_id) on delete restrict,
  withdraw_reason    text,
  -- Đơn đề nghị và báo cáo là PDF; minh chứng là ảnh hoặc PDF.
  check (kind = 'evidence' or content_type = 'application/pdf'),
  check ((superseded_by is null) = (superseded_at is null)),
  check ((withdrawn_at is null) = (withdrawn_by is null)),
  check (withdrawn_at is null or char_length(btrim(coalesce(withdraw_reason, ''))) >= 10)
);
-- Mỗi chương trình có tối đa một Đơn đề nghị và một báo cáo hiện hành.
create unique index if not exists program_acceptance_documents_current_idx
  on public.program_acceptance_documents (program_id, kind)
  where kind in ('proposal', 'report') and superseded_at is null and withdrawn_at is null;
create index if not exists program_acceptance_documents_program_idx
  on public.program_acceptance_documents (program_id, uploaded_at desc);

create table if not exists public.program_acceptance_snapshots (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.program_acceptances(program_id) on delete restrict,
  version      integer not null check (version >= 1),
  reason       text not null check (reason in ('accepted', 'complaint_accepted')),
  complaint_id uuid,
  term_id      uuid not null references public.academic_terms(id) on delete restrict,
  plan         jsonb not null,
  created_by   uuid not null references public.accounts(user_id) on delete restrict,
  created_at   timestamptz not null default now(),
  unique (program_id, version)
);

create table if not exists public.program_acceptance_results (
  snapshot_id       uuid not null references public.program_acceptance_snapshots(id) on delete restrict,
  program_id        uuid not null references public.program_acceptances(program_id) on delete restrict,
  version           integer not null,
  user_id           uuid not null references public.accounts(user_id) on delete restrict,
  registration_id   uuid not null references public.program_registrations(id) on delete restrict,
  student_code      text not null,
  full_name         text,
  class_code        text,
  attended_count    integer not null check (attended_count >= 0),
  attended_sessions jsonb not null,
  participation     text not null check (participation in ('completed', 'participated', 'absent')),
  expected_points   integer not null check (expected_points >= 0),
  primary key (snapshot_id, user_id)
);
create index if not exists program_acceptance_results_user_idx on public.program_acceptance_results (user_id, program_id, version desc);

create table if not exists public.program_attendance_complaints (
  id                     uuid primary key default gen_random_uuid(),
  program_id             uuid not null references public.program_acceptances(program_id) on delete restrict,
  user_id                uuid not null references public.accounts(user_id) on delete restrict,
  registration_id        uuid not null references public.program_registrations(id) on delete restrict,
  session_id             uuid not null references public.program_attendance_sessions(id) on delete restrict,
  message                text not null check (char_length(btrim(message)) between 10 and 2000),
  status                 text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  filed_at               timestamptz not null default now(),
  resolved_at            timestamptz,
  resolved_by            uuid references public.accounts(user_id) on delete restrict,
  resolver_role_grant_id uuid references public.role_grants(id) on delete set null,
  resolution_reason      text,
  record_id              uuid references public.program_attendance_records(id) on delete restrict,
  request_id             text,
  check ((status = 'pending') = (resolved_at is null)),
  check (status = 'pending' or char_length(btrim(coalesce(resolution_reason, ''))) >= 10),
  check ((status = 'accepted') = (record_id is not null))
);
-- Một khiếu nại đang mở/đã nhận cho mỗi sinh viên × lượt; bị từ chối thì được gửi lại.
create unique index if not exists program_attendance_complaints_open_idx
  on public.program_attendance_complaints (session_id, user_id) where status <> 'rejected';
create index if not exists program_attendance_complaints_program_idx on public.program_attendance_complaints (program_id, status, filed_at);

alter table public.program_acceptance_snapshots drop constraint if exists program_acceptance_snapshots_complaint_fk;
alter table public.program_acceptance_snapshots add constraint program_acceptance_snapshots_complaint_fk
  foreign key (complaint_id) references public.program_attendance_complaints(id) on delete restrict;

create table if not exists public.program_acceptance_history (
  id                  bigint generated always as identity primary key,
  program_id          uuid not null references public.event_programs(id) on delete restrict,
  action              text not null check (action in (
                        'attendance_locked', 'attendance_unlocked', 'document_uploaded', 'document_replaced',
                        'document_withdrawn', 'submitted', 'changes_requested', 'rejected', 'accepted',
                        'complaint_filed', 'complaint_accepted', 'complaint_rejected')),
  from_status         text,
  to_status           text,
  reason              text,
  document_id         uuid references public.program_acceptance_documents(id) on delete restrict,
  complaint_id        uuid references public.program_attendance_complaints(id) on delete restrict,
  details             jsonb,
  actor_user_id       uuid not null references public.accounts(user_id) on delete restrict,
  actor_role_grant_id uuid references public.role_grants(id) on delete set null,
  actor_role_code     text,
  actor_name          text,
  request_id          text,
  occurred_at         timestamptz not null default now(),
  check (action not in ('attendance_unlocked', 'document_withdrawn', 'changes_requested', 'rejected',
                        'complaint_accepted', 'complaint_rejected')
         or char_length(btrim(coalesce(reason, ''))) >= 10)
);
drop trigger if exists program_acceptance_history_fill_actor on public.program_acceptance_history;
create trigger program_acceptance_history_fill_actor before insert on public.program_acceptance_history
  for each row execute function public.fill_event_program_history_actor();
create index if not exists program_acceptance_history_program_idx on public.program_acceptance_history (program_id, occurred_at);

-- ── 3. Bổ sung cột cho bảng UC7/UC8 ──────────────────────────────────────────
-- Bản ghi điểm danh bổ sung qua khiếu nại (không qua QR).
alter table public.program_attendance_records add column if not exists source text not null default 'qr';
alter table public.program_attendance_records drop constraint if exists program_attendance_records_source_check;
alter table public.program_attendance_records add constraint program_attendance_records_source_check
  check (source in ('qr', 'complaint'));
alter table public.program_attendance_records add column if not exists complaint_id uuid
  references public.program_attendance_complaints(id) on delete restrict;
alter table public.program_attendance_records drop constraint if exists program_attendance_records_complaint_check;
alter table public.program_attendance_records add constraint program_attendance_records_complaint_check
  check ((source = 'complaint') = (complaint_id is not null));

-- Sổ uy tín: loại giao dịch, khiếu nại liên quan, vai trò người ghi.
alter table public.reputation_adjustments add column if not exists kind text not null default 'manual';
alter table public.reputation_adjustments drop constraint if exists reputation_adjustments_kind_check;
alter table public.reputation_adjustments add constraint reputation_adjustments_kind_check
  check (kind in ('manual', 'absence_penalty', 'absence_refund'));
alter table public.reputation_adjustments add column if not exists complaint_id uuid
  references public.program_attendance_complaints(id) on delete restrict;
alter table public.reputation_adjustments add column if not exists actor_role_grant_id uuid
  references public.role_grants(id) on delete set null;
alter table public.reputation_adjustments drop constraint if exists reputation_adjustments_absence_check;
alter table public.reputation_adjustments add constraint reputation_adjustments_absence_check
  check ((kind <> 'absence_penalty' or (delta = -5 and program_id is not null))
     and (kind <> 'absence_refund' or (delta = 5 and program_id is not null and complaint_id is not null)));
create unique index if not exists reputation_adjustments_penalty_once_idx
  on public.reputation_adjustments (program_id, user_id) where kind = 'absence_penalty';
create unique index if not exists reputation_adjustments_refund_once_idx
  on public.reputation_adjustments (program_id, user_id) where kind = 'absence_refund';

-- Chỉ thêm, không sửa/xóa (kể cả qua hàm security definer).
create or replace function public.prevent_append_only_change()
returns trigger
language plpgsql as $$
begin
  raise exception 'APPEND_ONLY';
end;
$$;
drop trigger if exists reputation_adjustments_append_only on public.reputation_adjustments;
create trigger reputation_adjustments_append_only before update or delete on public.reputation_adjustments
  for each row execute function public.prevent_append_only_change();
drop trigger if exists program_acceptance_snapshots_append_only on public.program_acceptance_snapshots;
create trigger program_acceptance_snapshots_append_only before update or delete on public.program_acceptance_snapshots
  for each row execute function public.prevent_append_only_change();
drop trigger if exists program_acceptance_results_append_only on public.program_acceptance_results;
create trigger program_acceptance_results_append_only before update or delete on public.program_acceptance_results
  for each row execute function public.prevent_append_only_change();
drop trigger if exists program_acceptance_history_append_only on public.program_acceptance_history;
create trigger program_acceptance_history_append_only before update or delete on public.program_acceptance_history
  for each row execute function public.prevent_append_only_change();

-- ── 4. Khóa điểm danh ─────────────────────────────────────────────────────────
create or replace function public.attendance_is_locked(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select attendance_locked from public.program_acceptances where program_id = p_program_id), false);
$$;

-- Khi đã khóa: không đổi kế hoạch, lượt, không điểm danh QR; chỉ bổ sung qua khiếu nại được chấp nhận.
create or replace function public.enforce_attendance_lock()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_program uuid;
begin
  if tg_op = 'DELETE' then v_program := old.program_id; else v_program := new.program_id; end if;
  if public.attendance_is_locked(v_program) then
    -- Lồng if: plpgsql không rút gọn AND, còn bảng lượt/kế hoạch không có cột source.
    if tg_table_name = 'program_attendance_records' and tg_op = 'INSERT' then
      if new.source = 'complaint' then return new; end if;
    end if;
    raise exception 'ATTENDANCE_LOCKED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists program_attendance_plans_lock on public.program_attendance_plans;
create trigger program_attendance_plans_lock before insert or update or delete on public.program_attendance_plans
  for each row execute function public.enforce_attendance_lock();
drop trigger if exists program_attendance_sessions_lock on public.program_attendance_sessions;
create trigger program_attendance_sessions_lock before insert or update or delete on public.program_attendance_sessions
  for each row execute function public.enforce_attendance_lock();
drop trigger if exists program_attendance_records_lock on public.program_attendance_records;
create trigger program_attendance_records_lock before insert or update or delete on public.program_attendance_records
  for each row execute function public.enforce_attendance_lock();

-- Sau khi khóa không nhận thêm đăng ký 'accepted' (người được nhận muộn sẽ bị tính vắng oan).
create or replace function public.enforce_registration_attendance_lock()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status <> 'accepted')
     and public.attendance_is_locked(new.program_id) then
    raise exception 'ATTENDANCE_LOCKED';
  end if;
  return new;
end;
$$;
drop trigger if exists program_registrations_attendance_lock on public.program_registrations;
create trigger program_registrations_attendance_lock before insert or update on public.program_registrations
  for each row execute function public.enforce_registration_attendance_lock();

-- ── 5. Quyền ──────────────────────────────────────────────────────────────────
-- BTC hoặc Văn phòng (khi hồ sơ đã từng được nộp) xem hồ sơ nghiệm thu.
create or replace function public.can_view_program_acceptance(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.program_registration_manager_grant(p_program_id) is not null
      or (public.event_program_reviewer_grant() is not null and exists (
            select 1 from public.program_acceptances a where a.program_id = p_program_id and a.submission_count > 0));
$$;

-- Học kỳ: vai trò cấp Trường — Đoàn Trường (school_admin) hoặc Văn phòng Đoàn – Hội (office).
create or replace function public.academic_term_manager_grant()
returns uuid
language sql stable security definer set search_path = public as $$
  select rg.id
  from public.role_grants rg
  join public.organization_units ou on ou.id = rg.organization_id
  where rg.user_id = auth.uid() and rg.revoked_at is null and ou.is_active
    and ((rg.role_code = 'school_admin' and ou.unit_type = 'school_union')
      or (rg.role_code = 'office' and ou.unit_type = 'office'))
  order by case rg.role_code when 'school_admin' then 0 else 1 end, rg.granted_at
  limit 1;
$$;

-- ── 6. RLS ────────────────────────────────────────────────────────────────────
alter table public.program_acceptances           enable row level security;
alter table public.program_acceptance_documents  enable row level security;
alter table public.program_acceptance_snapshots  enable row level security;
alter table public.program_acceptance_results    enable row level security;
alter table public.program_attendance_complaints enable row level security;
alter table public.program_acceptance_history    enable row level security;

drop policy if exists program_acceptances_read on public.program_acceptances;
create policy program_acceptances_read on public.program_acceptances for select to authenticated
  using (public.can_view_program_acceptance(program_id));
drop policy if exists program_acceptance_documents_read on public.program_acceptance_documents;
create policy program_acceptance_documents_read on public.program_acceptance_documents for select to authenticated
  using (public.can_view_program_acceptance(program_id));
drop policy if exists program_acceptance_snapshots_read on public.program_acceptance_snapshots;
create policy program_acceptance_snapshots_read on public.program_acceptance_snapshots for select to authenticated
  using (public.can_view_program_acceptance(program_id));
-- Sinh viên không đọc bảng này trực tiếp (có điểm dự kiến); kết quả của mình đọc qua my_program_results().
drop policy if exists program_acceptance_results_read on public.program_acceptance_results;
create policy program_acceptance_results_read on public.program_acceptance_results for select to authenticated
  using (public.can_view_program_acceptance(program_id));
drop policy if exists program_attendance_complaints_read on public.program_attendance_complaints;
create policy program_attendance_complaints_read on public.program_attendance_complaints for select to authenticated
  using (user_id = auth.uid() or public.can_view_program_acceptance(program_id));
drop policy if exists program_acceptance_history_read on public.program_acceptance_history;
create policy program_acceptance_history_read on public.program_acceptance_history for select to authenticated
  using (public.can_view_program_acceptance(program_id));

revoke all on public.program_acceptances, public.program_acceptance_documents, public.program_acceptance_snapshots,
  public.program_acceptance_results, public.program_attendance_complaints, public.program_acceptance_history from anon;
revoke insert, update, delete on public.program_acceptances, public.program_acceptance_documents,
  public.program_acceptance_snapshots, public.program_acceptance_results, public.program_attendance_complaints,
  public.program_acceptance_history from authenticated;
grant select on public.program_acceptances, public.program_acceptance_documents, public.program_acceptance_snapshots,
  public.program_acceptance_results, public.program_attendance_complaints, public.program_acceptance_history to authenticated;

-- ── 7. Bảng kết quả hiện tại (không kiểm quyền; chỉ dùng nội bộ) ──────────────
create or replace function public.program_attendance_rows(p_program_id uuid)
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
language sql stable security definer set search_path = public as $$
  select r.id, r.user_id, a.student_code, sp.full_name, cat.class_code, cat.faculty_name,
    coalesce(att.cnt, 0)::int,
    coalesce(att.sessions, '[]'::jsonb),
    case when coalesce(att.cnt, 0) = 0 then 'absent'
         when pts.points >= 1 then 'completed'
         else 'participated' end,
    pts.points
  from public.program_registrations r
  join public.accounts a on a.user_id = r.user_id
  left join public.student_profiles sp on sp.user_id = r.user_id
  left join public.current_academic_catalog cat on cat.class_id = sp.class_id
  left join lateral (
    select count(*) as cnt,
      jsonb_agg(jsonb_build_object('session_id', ar.session_id, 'label', s.label, 'supplementary', ar.is_supplementary,
                                   'source', ar.source, 'recorded_at', ar.recorded_at) order by s.sort_order) as sessions
    from public.program_attendance_records ar
    join public.program_attendance_sessions s on s.id = ar.session_id
    where ar.program_id = p_program_id and ar.user_id = r.user_id
  ) att on true
  cross join lateral (select public.attendance_expected_points(p_program_id, r.user_id) as points) pts
  where r.program_id = p_program_id and r.status = 'accepted'
  order by a.student_code;
$$;

-- BTC hoặc Văn phòng (khi đã nộp) xem bảng điểm danh dùng cho nghiệm thu.
create or replace function public.program_acceptance_attendance(p_program_id uuid)
returns table (
  registration_id uuid, user_id uuid, student_code text, full_name text, class_code text, faculty_name text,
  attended_count integer, attended_sessions jsonb, participation text, expected_points integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_view_program_acceptance(p_program_id) then raise exception 'FORBIDDEN'; end if;
  return query select * from public.program_attendance_rows(p_program_id);
end;
$$;

-- Chốt một phiên bản kết quả (gọi trong transaction đã khóa hàng program_acceptances).
create or replace function public.write_acceptance_snapshot(
  p_program_id uuid, p_reason text, p_complaint_id uuid, p_term_id uuid
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_version  integer;
  v_snapshot uuid;
  v_plan     jsonb;
begin
  select coalesce(max(version), 0) + 1 into v_version from public.program_acceptance_snapshots where program_id = p_program_id;
  select jsonb_build_object('max_points', p.max_points, 'rule_type', p.rule_type, 'tiers', p.tiers,
           'tiers_require_required', p.tiers_require_required,
           'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label, 'points', s.points,
                         'is_required', s.is_required) order by s.sort_order)
                       from public.program_attendance_sessions s where s.program_id = p_program_id), '[]'::jsonb))
    into v_plan
  from public.program_attendance_plans p where p.program_id = p_program_id;

  insert into public.program_acceptance_snapshots(program_id, version, reason, complaint_id, term_id, plan, created_by)
  values (p_program_id, v_version, p_reason, p_complaint_id, p_term_id, coalesce(v_plan, '{}'::jsonb), auth.uid())
  returning id into v_snapshot;

  insert into public.program_acceptance_results(snapshot_id, program_id, version, user_id, registration_id, student_code,
    full_name, class_code, attended_count, attended_sessions, participation, expected_points)
  select v_snapshot, p_program_id, v_version, r.user_id, r.registration_id, r.student_code, r.full_name, r.class_code,
         r.attended_count, r.attended_sessions, r.participation, r.expected_points
  from public.program_attendance_rows(p_program_id) r;

  return v_version;
end;
$$;

-- Thống kê của một phiên bản kết quả.
create or replace function public.program_acceptance_totals(p_program_id uuid, p_version integer)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'accepted', count(*),
    'completed', count(*) filter (where participation = 'completed'),
    'participated', count(*) filter (where participation = 'participated'),
    'absent', count(*) filter (where participation = 'absent'),
    'points', coalesce(sum(expected_points), 0))
  from public.program_acceptance_results
  where program_id = p_program_id and version = p_version and public.can_view_program_acceptance(p_program_id);
$$;

-- Trừ 5 điểm cho người được nhận mà không có lượt nào. Idempotent: unique index chặn trừ lần hai.
create or replace function public.apply_absence_penalties(p_program_id uuid, p_term_id uuid, p_grant uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_title text;
begin
  select title into v_title from public.event_programs where id = p_program_id;
  insert into public.reputation_adjustments(user_id, term_id, delta, reason, program_id, kind, created_by, actor_role_grant_id)
  select r.user_id, p_term_id, -5,
         'Đăng ký được nhận nhưng không điểm danh lượt nào: ' || v_title, p_program_id, 'absence_penalty',
         auth.uid(), p_grant
  from public.program_registrations r
  where r.program_id = p_program_id and r.status = 'accepted'
    and not exists (select 1 from public.program_attendance_records ar
                    where ar.program_id = p_program_id and ar.user_id = r.user_id)
  on conflict (program_id, user_id) where kind = 'absence_penalty' do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── 8. RPC: BTC khóa / mở khóa điểm danh ─────────────────────────────────────
create or replace function public.lock_program_attendance(p_program_id uuid, p_request_id text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_program public.event_programs%rowtype;
  v_grant   uuid;
  v_acc     public.program_acceptances%rowtype;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_program from public.event_programs where id = p_program_id for update;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if v_program.status = 'cancelled' then raise exception 'PROGRAM_CANCELLED'; end if;
  if v_program.status <> 'approved' then raise exception 'PROGRAM_NOT_APPROVED'; end if;
  if not exists (select 1 from public.program_attendance_plans where program_id = p_program_id) then
    raise exception 'ATTENDANCE_PLAN_REQUIRED';
  end if;
  if exists (select 1 from public.program_attendance_sessions where program_id = p_program_id and status = 'open') then
    raise exception 'SESSION_STILL_OPEN';
  end if;
  if exists (select 1 from public.program_registration_settings where program_id = p_program_id and status = 'open') then
    raise exception 'REGISTRATION_STILL_OPEN';
  end if;

  select * into v_acc from public.program_acceptances where program_id = p_program_id for update;
  if v_acc.program_id is null then
    insert into public.program_acceptances(program_id, attendance_locked, locked_at, created_by)
    values (p_program_id, true, now(), auth.uid());
  else
    if v_acc.attendance_locked then raise exception 'ATTENDANCE_LOCKED'; end if;
    update public.program_acceptances set attendance_locked = true, locked_at = now(), updated_at = now()
    where program_id = p_program_id;
  end if;

  insert into public.program_acceptance_history(program_id, action, to_status, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, 'attendance_locked', coalesce(v_acc.status, 'draft'), auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_acceptance.attendance_locked', 'event_program', p_program_id::text, null,
    jsonb_build_object('locked', true), v_grant, v_program.owner_org_id, p_request_id);
  return 'locked';
end;
$$;

create or replace function public.unlock_program_attendance(p_program_id uuid, p_reason text, p_request_id text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_program public.event_programs%rowtype;
  v_grant   uuid;
  v_acc     public.program_acceptances%rowtype;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_program from public.event_programs where id = p_program_id;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  select * into v_acc from public.program_acceptances where program_id = p_program_id for update;
  if v_acc.program_id is null or not v_acc.attendance_locked then raise exception 'INVALID_TRANSITION'; end if;
  if v_acc.status not in ('draft', 'needs_changes') then raise exception 'ACCEPTANCE_NOT_EDITABLE'; end if;
  if char_length(coalesce(v_reason, '')) < 10 then raise exception 'REASON_REQUIRED'; end if;
  update public.program_acceptances set attendance_locked = false, updated_at = now() where program_id = p_program_id;
  insert into public.program_acceptance_history(program_id, action, to_status, reason, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, 'attendance_unlocked', v_acc.status, v_reason, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_acceptance.attendance_unlocked', 'event_program', p_program_id::text,
    jsonb_build_object('locked', true), jsonb_build_object('locked', false, 'reason', v_reason),
    v_grant, v_program.owner_org_id, p_request_id);
  return 'unlocked';
end;
$$;

-- ── 9. RPC: hồ sơ (tệp đã vào Storage trước) ─────────────────────────────────
create or replace function public.attach_program_acceptance_document(
  p_program_id   uuid,
  p_kind         text,
  p_storage_path text,
  p_file_name    text,
  p_content_type text,
  p_size_bytes   integer,
  p_sha256       text,
  p_request_id   text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_program public.event_programs%rowtype;
  v_grant   uuid;
  v_acc     public.program_acceptances%rowtype;
  v_id      uuid := gen_random_uuid();
  v_old     uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_program from public.event_programs where id = p_program_id;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  select * into v_acc from public.program_acceptances where program_id = p_program_id for update;
  if v_acc.program_id is null or not v_acc.attendance_locked then raise exception 'ATTENDANCE_NOT_LOCKED'; end if;
  if v_acc.status not in ('draft', 'needs_changes') then raise exception 'ACCEPTANCE_NOT_EDITABLE'; end if;
  if p_kind not in ('proposal', 'report', 'evidence') then raise exception 'INVALID_DOCUMENT_KIND'; end if;
  if p_storage_path !~ ('^' || p_program_id::text || '/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$') then
    raise exception 'INVALID_STORAGE_PATH';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'program-acceptance-files' and o.name = p_storage_path) then
    raise exception 'DOCUMENT_NOT_UPLOADED';
  end if;

  if p_kind in ('proposal', 'report') then
    select id into v_old from public.program_acceptance_documents
    where program_id = p_program_id and kind = p_kind and superseded_at is null and withdrawn_at is null;
    if v_old is not null then
      update public.program_acceptance_documents set superseded_by = v_id, superseded_at = now() where id = v_old;
    end if;
  end if;

  insert into public.program_acceptance_documents(id, program_id, kind, storage_path, original_file_name, content_type,
    size_bytes, sha256, uploaded_by)
  values (v_id, p_program_id, p_kind, p_storage_path, p_file_name, p_content_type, p_size_bytes, lower(p_sha256), auth.uid());

  insert into public.program_acceptance_history(program_id, action, to_status, document_id, details, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, case when v_old is null then 'document_uploaded' else 'document_replaced' end, v_acc.status, v_id,
          jsonb_build_object('kind', p_kind, 'replaces', v_old, 'file_name', p_file_name), auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_acceptance.document_attached', 'event_program', p_program_id::text, null,
    jsonb_build_object('document_id', v_id, 'kind', p_kind, 'replaces', v_old, 'sha256', lower(p_sha256)),
    v_grant, v_program.owner_org_id, p_request_id);
  return v_id;
end;
$$;

create or replace function public.withdraw_program_acceptance_document(
  p_document_id uuid, p_reason text, p_request_id text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_doc     public.program_acceptance_documents%rowtype;
  v_program public.event_programs%rowtype;
  v_grant   uuid;
  v_acc     public.program_acceptances%rowtype;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_doc from public.program_acceptance_documents where id = p_document_id;
  if v_doc.id is null then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  select * into v_program from public.event_programs where id = v_doc.program_id;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  select * into v_acc from public.program_acceptances where program_id = v_doc.program_id for update;
  if v_acc.status not in ('draft', 'needs_changes') then raise exception 'ACCEPTANCE_NOT_EDITABLE'; end if;
  if v_doc.withdrawn_at is not null or v_doc.superseded_at is not null then raise exception 'INVALID_TRANSITION'; end if;
  if char_length(coalesce(v_reason, '')) < 10 then raise exception 'REASON_REQUIRED'; end if;
  update public.program_acceptance_documents
  set withdrawn_at = now(), withdrawn_by = auth.uid(), withdraw_reason = v_reason where id = p_document_id;
  insert into public.program_acceptance_history(program_id, action, to_status, reason, document_id, actor_user_id, actor_role_grant_id, request_id)
  values (v_doc.program_id, 'document_withdrawn', v_acc.status, v_reason, p_document_id, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_acceptance.document_withdrawn', 'event_program', v_doc.program_id::text, null,
    jsonb_build_object('document_id', p_document_id, 'reason', v_reason), v_grant, v_program.owner_org_id, p_request_id);
  return 'withdrawn';
end;
$$;

-- Thành phần hồ sơ còn thiếu (đang hiện hành).
create or replace function public.program_acceptance_missing(p_program_id uuid)
returns text[]
language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when not exists (select 1 from public.program_acceptance_documents d where d.program_id = p_program_id
           and d.kind = 'proposal' and d.superseded_at is null and d.withdrawn_at is null) then 'proposal' end,
    case when not exists (select 1 from public.program_acceptance_documents d where d.program_id = p_program_id
           and d.kind = 'report' and d.superseded_at is null and d.withdrawn_at is null) then 'report' end,
    case when not exists (select 1 from public.program_acceptance_documents d where d.program_id = p_program_id
           and d.kind = 'evidence' and d.withdrawn_at is null) then 'evidence' end
  ], null);
$$;

-- ── 10. RPC: BTC nộp hồ sơ ───────────────────────────────────────────────────
create or replace function public.submit_program_acceptance(p_program_id uuid, p_request_id text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_program public.event_programs%rowtype;
  v_grant   uuid;
  v_acc     public.program_acceptances%rowtype;
  v_missing text[];
  v_docs    jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_program from public.event_programs where id = p_program_id;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if v_program.status = 'cancelled' then raise exception 'PROGRAM_CANCELLED'; end if;
  select * into v_acc from public.program_acceptances where program_id = p_program_id for update;
  if v_acc.program_id is null or not v_acc.attendance_locked then raise exception 'ATTENDANCE_NOT_LOCKED'; end if;
  if v_acc.status not in ('draft', 'needs_changes') then raise exception 'INVALID_TRANSITION'; end if;
  v_missing := public.program_acceptance_missing(p_program_id);
  if cardinality(v_missing) > 0 then raise exception 'MISSING_DOCUMENTS:%', array_to_string(v_missing, ','); end if;

  select jsonb_agg(d.id order by d.kind, d.uploaded_at) into v_docs
  from public.program_acceptance_documents d
  where d.program_id = p_program_id and d.superseded_at is null and d.withdrawn_at is null;

  update public.program_acceptances
  set status = 'submitted', submission_count = submission_count + 1, submitted_at = now(), updated_at = now()
  where program_id = p_program_id;
  insert into public.program_acceptance_history(program_id, action, from_status, to_status, details, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, 'submitted', v_acc.status, 'submitted',
          jsonb_build_object('submission', v_acc.submission_count + 1, 'documents', v_docs), auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_acceptance.submitted', 'event_program', p_program_id::text,
    jsonb_build_object('status', v_acc.status),
    jsonb_build_object('status', 'submitted', 'submission', v_acc.submission_count + 1, 'documents', v_docs),
    v_grant, v_program.owner_org_id, p_request_id);
  return 'submitted';
end;
$$;

-- ── 11. RPC: Văn phòng nghiệm thu ────────────────────────────────────────────
create or replace function public.review_program_acceptance(
  p_program_id uuid,
  p_decision   text,
  p_reason     text,
  p_request_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_program   public.event_programs%rowtype;
  v_grant     uuid;
  v_acc       public.program_acceptances%rowtype;
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_to        text;
  v_action    text;
  v_term      uuid;
  v_version   integer;
  v_penalties integer := 0;
  v_missing   text[];
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  v_grant := public.event_program_reviewer_grant();
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if p_decision not in ('accept', 'request_changes', 'reject') then raise exception 'INVALID_DECISION'; end if;
  if p_decision <> 'accept' and char_length(coalesce(v_reason, '')) < 10 then raise exception 'REASON_REQUIRED'; end if;

  select * into v_program from public.event_programs where id = p_program_id;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  select * into v_acc from public.program_acceptances where program_id = p_program_id for update;
  if v_acc.program_id is null then raise exception 'ACCEPTANCE_NOT_FOUND'; end if;
  -- Không tự nghiệm thu: người đã nộp hồ sơ, hoặc người đang giữ vai trò BTC của chương trình.
  if public.event_program_manager_grant(v_program.owner_org_id) is not null or exists (
    select 1 from public.program_acceptance_history h
    where h.program_id = p_program_id and h.action = 'submitted' and h.actor_user_id = auth.uid()
  ) then
    raise exception 'SELF_REVIEW_FORBIDDEN';
  end if;
  -- Nghiệm thu lặp lại: đã nghiệm thu thì không chạy lại (và sổ uy tín cũng chặn trừ lần hai).
  if v_acc.status <> 'submitted' then raise exception 'INVALID_TRANSITION'; end if;

  if p_decision = 'accept' then
    if v_program.status = 'cancelled' then raise exception 'PROGRAM_CANCELLED'; end if;
    if v_program.status <> 'approved' then raise exception 'PROGRAM_NOT_APPROVED'; end if;
    v_missing := public.program_acceptance_missing(p_program_id);
    if cardinality(v_missing) > 0 then raise exception 'MISSING_DOCUMENTS:%', array_to_string(v_missing, ','); end if;
    v_term := public.academic_term_at(v_program.starts_at);
    if v_term is null then raise exception 'TERM_NOT_CONFIGURED'; end if;
    v_version := public.write_acceptance_snapshot(p_program_id, 'accepted', null, v_term);
    v_penalties := public.apply_absence_penalties(p_program_id, v_term, v_grant);
    v_to := 'accepted';
    v_action := 'accepted';
    update public.program_acceptances
    set status = 'accepted', decided_at = now(), decided_by = auth.uid(), term_id = v_term,
        current_snapshot_version = v_version, updated_at = now()
    where program_id = p_program_id;
  else
    v_to := case p_decision when 'reject' then 'rejected' else 'needs_changes' end;
    v_action := case p_decision when 'reject' then 'rejected' else 'changes_requested' end;
    update public.program_acceptances
    set status = v_to, decided_at = case when v_to = 'rejected' then now() end,
        decided_by = case when v_to = 'rejected' then auth.uid() end, updated_at = now()
    where program_id = p_program_id;
  end if;

  insert into public.program_acceptance_history(program_id, action, from_status, to_status, reason, details,
    actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, v_action, 'submitted', v_to, v_reason,
          case when v_to = 'accepted' then jsonb_build_object('snapshot_version', v_version, 'term_id', v_term,
                                                               'penalties', v_penalties) end,
          auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_acceptance.' || v_action, 'event_program', p_program_id::text,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', v_to, 'reason', v_reason, 'snapshot_version', v_version, 'penalties', v_penalties),
    v_grant, v_program.owner_org_id, p_request_id);
  return jsonb_build_object('status', v_to, 'snapshot_version', v_version, 'penalties', v_penalties);
end;
$$;

-- ── 12. RPC: khiếu nại ────────────────────────────────────────────────────────
create or replace function public.file_attendance_complaint(
  p_program_id uuid, p_session_id uuid, p_message text, p_request_id text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_acc     public.program_acceptances%rowtype;
  v_reg     public.program_registrations%rowtype;
  v_session public.program_attendance_sessions%rowtype;
  v_end     date;
  v_id      uuid;
  v_message text := btrim(coalesce(p_message, ''));
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_acc from public.program_acceptances where program_id = p_program_id;
  if v_acc.program_id is null or v_acc.status <> 'accepted' then raise exception 'PROGRAM_NOT_ACCEPTED'; end if;
  select * into v_reg from public.program_registrations where program_id = p_program_id and user_id = auth.uid();
  if v_reg.id is null or v_reg.status <> 'accepted' then raise exception 'REGISTRATION_NOT_ACCEPTED'; end if;
  select * into v_session from public.program_attendance_sessions where id = p_session_id and program_id = p_program_id;
  if v_session.id is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.open_count = 0 then raise exception 'SESSION_NEVER_OPENED'; end if;
  select ends_on into v_end from public.academic_terms where id = v_acc.term_id;
  if (now() at time zone 'Asia/Ho_Chi_Minh')::date > v_end then raise exception 'COMPLAINT_DEADLINE_PASSED'; end if;
  if char_length(v_message) < 10 then raise exception 'MESSAGE_REQUIRED'; end if;
  if exists (select 1 from public.program_attendance_records where session_id = p_session_id and user_id = auth.uid()) then
    raise exception 'ALREADY_CHECKED_IN';
  end if;
  begin
    insert into public.program_attendance_complaints(program_id, user_id, registration_id, session_id, message, request_id)
    values (p_program_id, auth.uid(), v_reg.id, p_session_id, v_message, p_request_id)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'COMPLAINT_EXISTS';
  end;
  insert into public.program_acceptance_history(program_id, action, to_status, complaint_id, details, actor_user_id, request_id)
  values (p_program_id, 'complaint_filed', 'accepted', v_id, jsonb_build_object('session_id', p_session_id), auth.uid(), p_request_id);
  perform public.write_audit('program_acceptance.complaint_filed', 'program_attendance_complaint', v_id::text, null,
    jsonb_build_object('program_id', p_program_id, 'session_id', p_session_id), null,
    (select owner_org_id from public.event_programs where id = p_program_id), p_request_id);
  return v_id;
end;
$$;

create or replace function public.resolve_attendance_complaint(
  p_complaint_id uuid, p_decision text, p_reason text, p_request_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_c        public.program_attendance_complaints%rowtype;
  v_program  public.event_programs%rowtype;
  v_grant    uuid;
  v_acc      public.program_acceptances%rowtype;
  v_session  public.program_attendance_sessions%rowtype;
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_record   uuid;
  v_penalty  public.reputation_adjustments%rowtype;
  v_refunded integer := 0;
  v_version  integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_decision not in ('accept', 'reject') then raise exception 'INVALID_DECISION'; end if;
  select * into v_c from public.program_attendance_complaints where id = p_complaint_id;
  if v_c.id is null then raise exception 'COMPLAINT_NOT_FOUND'; end if;
  select * into v_program from public.event_programs where id = v_c.program_id;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if v_c.user_id = auth.uid() then raise exception 'SELF_DECISION_FORBIDDEN'; end if;
  if char_length(coalesce(v_reason, '')) < 10 then raise exception 'REASON_REQUIRED'; end if;

  -- Khóa hồ sơ nghiệm thu: các khiếu nại cùng chương trình được xử lý tuần tự (đúng thứ tự phiên bản).
  select * into v_acc from public.program_acceptances where program_id = v_c.program_id for update;
  select * into v_c from public.program_attendance_complaints where id = p_complaint_id for update;
  if v_c.status <> 'pending' then raise exception 'INVALID_TRANSITION'; end if;

  if p_decision = 'reject' then
    update public.program_attendance_complaints
    set status = 'rejected', resolved_at = now(), resolved_by = auth.uid(), resolver_role_grant_id = v_grant,
        resolution_reason = v_reason
    where id = p_complaint_id;
  else
    select * into v_session from public.program_attendance_sessions where id = v_c.session_id;
    insert into public.program_attendance_records(session_id, program_id, user_id, registration_id, generation,
      is_supplementary, request_id, source, complaint_id)
    values (v_c.session_id, v_c.program_id, v_c.user_id, v_c.registration_id, greatest(v_session.open_count, 1),
      true, p_request_id, 'complaint', p_complaint_id)
    returning id into v_record;
    update public.program_attendance_complaints
    set status = 'accepted', resolved_at = now(), resolved_by = auth.uid(), resolver_role_grant_id = v_grant,
        resolution_reason = v_reason, record_id = v_record
    where id = p_complaint_id;

    -- Hoàn +5 đúng một lần nếu người này đã bị trừ vì vắng ở chương trình này.
    select * into v_penalty from public.reputation_adjustments
    where program_id = v_c.program_id and user_id = v_c.user_id and kind = 'absence_penalty';
    if v_penalty.id is not null then
      insert into public.reputation_adjustments(user_id, term_id, delta, reason, program_id, kind, complaint_id,
        created_by, actor_role_grant_id)
      values (v_c.user_id, v_penalty.term_id, 5, 'Hoàn điểm: khiếu nại điểm danh được chấp nhận — ' || v_reason,
        v_c.program_id, 'absence_refund', p_complaint_id, auth.uid(), v_grant)
      on conflict (program_id, user_id) where kind = 'absence_refund' do nothing;
      get diagnostics v_refunded = row_count;
    end if;

    v_version := public.write_acceptance_snapshot(v_c.program_id, 'complaint_accepted', p_complaint_id, v_acc.term_id);
    update public.program_acceptances set current_snapshot_version = v_version, updated_at = now()
    where program_id = v_c.program_id;
  end if;

  insert into public.program_acceptance_history(program_id, action, to_status, reason, complaint_id, details,
    actor_user_id, actor_role_grant_id, request_id)
  values (v_c.program_id, case when p_decision = 'accept' then 'complaint_accepted' else 'complaint_rejected' end,
          v_acc.status, v_reason, p_complaint_id,
          case when p_decision = 'accept' then jsonb_build_object('record_id', v_record, 'snapshot_version', v_version) end,
          auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_acceptance.complaint_' || case when p_decision = 'accept' then 'accepted' else 'rejected' end,
    'program_attendance_complaint', p_complaint_id::text, jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', case when p_decision = 'accept' then 'accepted' else 'rejected' end,
                       'reason', v_reason, 'record_id', v_record, 'refunded', v_refunded > 0, 'snapshot_version', v_version),
    v_grant, v_program.owner_org_id, p_request_id);
  return jsonb_build_object('status', case when p_decision = 'accept' then 'accepted' else 'rejected' end,
                            'snapshot_version', v_version);
end;
$$;

-- ── 13. Đọc: sổ uy tín của chương trình (chỉ Văn phòng) ──────────────────────
create or replace function public.program_reputation_ledger(p_program_id uuid)
returns table (
  id bigint, user_id uuid, student_code text, full_name text, delta integer, kind text, reason text,
  term_name text, complaint_id uuid, actor_name text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.event_program_reviewer_grant() is null then raise exception 'FORBIDDEN'; end if;
  return query
  select ra.id, ra.user_id, a.student_code, sp.full_name, ra.delta, ra.kind, ra.reason,
         t.academic_year || ' · ' || t.name, ra.complaint_id,
         coalesce(asp.full_name, aa.student_code), ra.created_at
  from public.reputation_adjustments ra
  join public.accounts a on a.user_id = ra.user_id
  left join public.student_profiles sp on sp.user_id = ra.user_id
  join public.academic_terms t on t.id = ra.term_id
  left join public.accounts aa on aa.user_id = ra.created_by
  left join public.student_profiles asp on asp.user_id = ra.created_by
  where ra.program_id = p_program_id
  order by ra.created_at, ra.id;
end;
$$;

-- ── 14. Đọc: kết quả của sinh viên (không có điểm uy tín, xếp hạng hay sổ trừ/hoàn) ──
create or replace function public.my_program_results()
returns table (
  program_id        uuid,
  title             text,
  starts_at         timestamptz,
  program_status    text,
  organization_name text,
  registration_status text,
  accepted          boolean,
  participation     text,
  attended_sessions jsonb,
  complaint_deadline date
)
language sql stable security definer set search_path = public as $$
  select p.id, p.title, p.starts_at, p.status, ou.name, r.status,
    coalesce(acc.status = 'accepted', false),
    case when r.status <> 'accepted' then null
         when acc.status = 'accepted' then res.participation
         else null end,
    case when r.status <> 'accepted' then '[]'::jsonb
         when acc.status = 'accepted' then res.attended_sessions
         else coalesce((select jsonb_agg(jsonb_build_object('session_id', s.id, 'label', s.label,
                                'supplementary', ar.is_supplementary) order by s.sort_order)
                        from public.program_attendance_records ar
                        join public.program_attendance_sessions s on s.id = ar.session_id
                        where ar.program_id = p.id and ar.user_id = r.user_id), '[]'::jsonb) end,
    case when acc.status = 'accepted' then t.ends_on end
  from public.program_registrations r
  join public.event_programs p on p.id = r.program_id
  join public.organization_units ou on ou.id = p.owner_org_id
  left join public.program_acceptances acc on acc.program_id = p.id
  left join public.academic_terms t on t.id = acc.term_id
  left join lateral (
    select x.participation, x.attended_sessions from public.program_acceptance_results x
    where x.program_id = p.id and x.user_id = r.user_id order by x.version desc limit 1
  ) res on true
  where r.user_id = auth.uid()
  order by p.starts_at desc nulls last;
$$;

-- ── 15. Học kỳ: cấu hình theo khoảng ngày ────────────────────────────────────
create or replace function public.save_academic_term(
  p_id            uuid,
  p_academic_year text,
  p_term_code     text,
  p_name          text,
  p_starts_on     date,
  p_ends_on       date,
  p_request_id    text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_grant  uuid;
  v_old    public.academic_terms%rowtype;
  v_id     uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  v_grant := public.academic_term_manager_grant();
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on then raise exception 'INVALID_TERM_DATES'; end if;
  begin
    if p_id is null then
      insert into public.academic_terms(academic_year, term_code, name, starts_on, ends_on, created_by)
      values (btrim(p_academic_year), btrim(p_term_code), btrim(p_name), p_starts_on, p_ends_on, auth.uid())
      returning id into v_id;
    else
      select * into v_old from public.academic_terms where id = p_id for update;
      if v_old.id is null then raise exception 'TERM_NOT_FOUND'; end if;
      -- Học kỳ đã có nghiệm thu/giao dịch uy tín: không đổi năm học, mã hay ngày (sẽ làm sai học kỳ của các giao dịch).
      if (exists (select 1 from public.reputation_adjustments where term_id = p_id)
          or exists (select 1 from public.program_acceptances where term_id = p_id))
         and (v_old.starts_on <> p_starts_on or v_old.ends_on <> p_ends_on
              or v_old.academic_year <> btrim(p_academic_year) or v_old.term_code <> btrim(p_term_code)) then
        raise exception 'TERM_IN_USE';
      end if;
      update public.academic_terms
      set academic_year = btrim(p_academic_year), term_code = btrim(p_term_code), name = btrim(p_name),
          starts_on = p_starts_on, ends_on = p_ends_on
      where id = p_id;
      v_id := p_id;
    end if;
  exception
    when exclusion_violation then raise exception 'TERM_OVERLAP';
    when unique_violation then raise exception 'TERM_CODE_EXISTS';
    when check_violation then raise exception 'INVALID_TERM';
  end;
  perform public.write_audit(case when p_id is null then 'academic_term.created' else 'academic_term.updated' end,
    'academic_term', v_id::text, case when p_id is null then null else to_jsonb(v_old) end,
    (select to_jsonb(t) from public.academic_terms t where t.id = v_id), v_grant, null, p_request_id);
  return v_id;
end;
$$;

-- ── 16. RPC: hủy chương trình ────────────────────────────────────────────────
create or replace function public.cancel_event_program(p_program_id uuid, p_reason text, p_request_id text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_program public.event_programs%rowtype;
  v_grant   uuid;
  v_role    text;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_program from public.event_programs where id = p_program_id for update;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is not null then
    select role_code into v_role from public.role_grants where id = v_grant;
    if v_role <> 'faculty_manager' then v_grant := null; end if;
  end if;
  if v_grant is null then v_grant := public.event_program_reviewer_grant(); end if;
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if v_program.status <> 'approved' then raise exception 'INVALID_TRANSITION'; end if;
  if exists (select 1 from public.program_acceptances where program_id = p_program_id and status = 'accepted') then
    raise exception 'PROGRAM_ALREADY_ACCEPTED';
  end if;
  if char_length(coalesce(v_reason, '')) < 10 then raise exception 'REASON_REQUIRED'; end if;

  update public.program_attendance_sessions set status = 'closed', closed_at = now()
  where program_id = p_program_id and status = 'open';
  update public.program_registration_settings set status = 'closed', closed_at = now()
  where program_id = p_program_id and status = 'open';
  update public.event_programs set status = 'cancelled', cancelled_at = now(), cancel_reason = v_reason, updated_at = now()
  where id = p_program_id;
  insert into public.event_program_history(program_id, action, from_status, to_status, reason, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, 'cancelled', 'approved', 'cancelled', v_reason, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('event_program.cancelled', 'event_program', p_program_id::text,
    jsonb_build_object('status', 'approved'), jsonb_build_object('status', 'cancelled', 'reason', v_reason),
    v_grant, v_program.owner_org_id, p_request_id);
  return 'cancelled';
end;
$$;

-- ── 17. Storage: bucket riêng tư cho hồ sơ nghiệm thu ────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('program-acceptance-files', 'program-acceptance-files', false, 5242880,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_upload_program_acceptance_object(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'
    and exists (
      select 1 from public.program_acceptances a
      where a.program_id::text = split_part(p_name, '/', 1)
        and a.attendance_locked and a.status in ('draft', 'needs_changes')
        and public.program_registration_manager_grant(a.program_id) is not null
    );
$$;

create or replace function public.can_read_program_acceptance_object(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.program_acceptance_documents d
    where d.storage_path = p_name and public.can_view_program_acceptance(d.program_id)
  );
$$;

drop policy if exists program_acceptance_files_insert on storage.objects;
create policy program_acceptance_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'program-acceptance-files' and public.can_upload_program_acceptance_object(name));
drop policy if exists program_acceptance_files_read on storage.objects;
create policy program_acceptance_files_read on storage.objects for select to authenticated
  using (bucket_id = 'program-acceptance-files' and public.can_read_program_acceptance_object(name));

-- ── 18. Quyền thực thi ────────────────────────────────────────────────────────
revoke all on function public.prevent_append_only_change() from public, anon, authenticated;
revoke all on function public.enforce_attendance_lock() from public, anon, authenticated;
revoke all on function public.enforce_registration_attendance_lock() from public, anon, authenticated;
revoke all on function public.program_attendance_rows(uuid) from public, anon, authenticated;
revoke all on function public.write_acceptance_snapshot(uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_absence_penalties(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.attendance_is_locked(uuid) from public, anon;
revoke all on function public.can_view_program_acceptance(uuid) from public, anon;
revoke all on function public.academic_term_manager_grant() from public, anon;
revoke all on function public.program_acceptance_attendance(uuid) from public, anon;
revoke all on function public.program_acceptance_totals(uuid, integer) from public, anon;
revoke all on function public.program_acceptance_missing(uuid) from public, anon;
revoke all on function public.lock_program_attendance(uuid, text) from public, anon;
revoke all on function public.unlock_program_attendance(uuid, text, text) from public, anon;
revoke all on function public.attach_program_acceptance_document(uuid, text, text, text, text, integer, text, text) from public, anon;
revoke all on function public.withdraw_program_acceptance_document(uuid, text, text) from public, anon;
revoke all on function public.submit_program_acceptance(uuid, text) from public, anon;
revoke all on function public.review_program_acceptance(uuid, text, text, text) from public, anon;
revoke all on function public.file_attendance_complaint(uuid, uuid, text, text) from public, anon;
revoke all on function public.resolve_attendance_complaint(uuid, text, text, text) from public, anon;
revoke all on function public.program_reputation_ledger(uuid) from public, anon;
revoke all on function public.my_program_results() from public, anon;
revoke all on function public.save_academic_term(uuid, text, text, text, date, date, text) from public, anon;
revoke all on function public.cancel_event_program(uuid, text, text) from public, anon;
revoke all on function public.can_upload_program_acceptance_object(text) from public, anon;
revoke all on function public.can_read_program_acceptance_object(text) from public, anon;

grant execute on function public.attendance_is_locked(uuid) to authenticated;
grant execute on function public.can_view_program_acceptance(uuid) to authenticated;
grant execute on function public.academic_term_manager_grant() to authenticated;
grant execute on function public.program_acceptance_attendance(uuid) to authenticated;
grant execute on function public.program_acceptance_missing(uuid) to authenticated;
grant execute on function public.program_acceptance_totals(uuid, integer) to authenticated;
grant execute on function public.lock_program_attendance(uuid, text) to authenticated;
grant execute on function public.unlock_program_attendance(uuid, text, text) to authenticated;
grant execute on function public.attach_program_acceptance_document(uuid, text, text, text, text, integer, text, text) to authenticated;
grant execute on function public.withdraw_program_acceptance_document(uuid, text, text) to authenticated;
grant execute on function public.submit_program_acceptance(uuid, text) to authenticated;
grant execute on function public.review_program_acceptance(uuid, text, text, text) to authenticated;
grant execute on function public.file_attendance_complaint(uuid, uuid, text, text) to authenticated;
grant execute on function public.resolve_attendance_complaint(uuid, text, text, text) to authenticated;
grant execute on function public.program_reputation_ledger(uuid) to authenticated;
grant execute on function public.my_program_results() to authenticated;
grant execute on function public.save_academic_term(uuid, text, text, text, date, date, text) to authenticated;
grant execute on function public.cancel_event_program(uuid, text, text) to authenticated;
grant execute on function public.can_upload_program_acceptance_object(text) to authenticated;
grant execute on function public.can_read_program_acceptance_object(text) to authenticated;

comment on table public.program_acceptances is 'UC9: hồ sơ nghiệm thu của chương trình; attendance_locked khóa điểm danh.';
comment on table public.program_acceptance_snapshots is 'UC9: phiên bản kết quả chốt khi nghiệm thu và sau mỗi khiếu nại được chấp nhận (chỉ thêm).';
comment on table public.program_attendance_complaints is 'UC9: khiếu nại điểm danh của sinh viên sau nghiệm thu, hạn đến hết học kỳ.';
