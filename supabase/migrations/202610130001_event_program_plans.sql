-- Migration: UC6 — Quản lý kế hoạch chương trình sự kiện
--
-- Quy tắc đã chốt áp dụng:
-- - Mỗi người dùng tài khoản cá nhân; audit ghi actor thật + role grant thật đang dùng.
-- - Đoàn Khoa (faculty_manager/faculty_executive trên đơn vị faculty_union) lập và sửa
--   kế hoạch trong phạm vi Khoa mình; không chuyển hồ sơ sang Khoa khác.
-- - Chỉ Văn phòng Đoàn – Hội (role office trên đơn vị office) xét duyệt; school_admin không mặc
--   nhiên có quyền này. Người đã nộp hồ sơ không tự xét duyệt hồ sơ đó.
-- - Khi Văn phòng yêu cầu chỉnh sửa, Đoàn Khoa sửa tiếp đúng hồ sơ hiện có rồi nộp lại
--   (cùng id, tăng submission_count) — giống quy tắc "sửa tiếp hồ sơ hiện có".
-- - Văn phòng không xác nhận điểm rèn luyện trên hệ thống (Q&A 12.2); điểm danh QR, điểm rèn
--   luyện và mượn phòng nằm ngoài phạm vi migration này.
--
-- Vòng đời: draft → submitted → (needs_changes → submitted)* → approved | rejected
-- Mọi thay đổi dữ liệu đi qua RPC security definer; bảng chỉ cho SELECT theo RLS.

create table if not exists public.event_programs (
  id                    uuid primary key default gen_random_uuid(),
  owner_org_id          uuid not null references public.organization_units(id) on delete restrict,
  faculty_id            uuid not null references public.faculties(id) on delete restrict,
  title                 text not null check (char_length(btrim(title)) between 5 and 200),
  summary               text check (summary is null or char_length(summary) <= 5000),
  location              text check (location is null or char_length(location) <= 300),
  starts_at             timestamptz,
  ends_at               timestamptz,
  expected_participants integer check (expected_participants is null or expected_participants between 1 and 100000),
  plan_number           text check (plan_number is null or char_length(plan_number) <= 100),
  plan_signed_on        date,
  status                text not null default 'draft'
                          check (status in ('draft', 'submitted', 'needs_changes', 'approved', 'rejected')),
  submission_count      integer not null default 0 check (submission_count >= 0),
  current_document_id   uuid,
  created_by            uuid not null references public.accounts(user_id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  submitted_at          timestamptz,
  decided_at            timestamptz,
  decided_by            uuid references public.accounts(user_id) on delete restrict,
  check (starts_at is null or ends_at is null or ends_at > starts_at),
  check ((status in ('approved', 'rejected')) = (decided_at is not null))
);

-- Mỗi lần tải PDF tạo một bản ghi mới; bản cũ được giữ để đối chiếu lịch sử nộp.
create table if not exists public.event_program_documents (
  id                 uuid primary key default gen_random_uuid(),
  program_id         uuid not null references public.event_programs(id) on delete restrict,
  storage_path       text not null unique,
  original_file_name text not null check (char_length(original_file_name) between 1 and 255),
  size_bytes         integer not null check (size_bytes between 1 and 5242880),
  sha256             text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by        uuid not null references public.accounts(user_id) on delete restrict,
  uploaded_at        timestamptz not null default now()
);

alter table public.event_programs
  drop constraint if exists event_programs_current_document_fk;
alter table public.event_programs
  add constraint event_programs_current_document_fk
  foreign key (current_document_id) references public.event_program_documents(id) on delete restrict;

-- Lịch sử thao tác và chuyển trạng thái: append-only, ghi người thao tác, vai trò, thời điểm, lý do.
create table if not exists public.event_program_history (
  id                  bigint generated always as identity primary key,
  program_id          uuid not null references public.event_programs(id) on delete restrict,
  action              text not null check (action in (
                        'created', 'updated', 'document_attached', 'submitted',
                        'changes_requested', 'rejected', 'approved')),
  from_status         text,
  to_status           text not null,
  reason              text,
  document_id         uuid references public.event_program_documents(id) on delete restrict,
  actor_user_id       uuid not null references public.accounts(user_id) on delete restrict,
  actor_role_grant_id uuid references public.role_grants(id) on delete set null,
  -- Snapshot để hiển thị: Đoàn Khoa không có quyền đọc role_grants/accounts của Văn phòng.
  actor_role_code     text,
  actor_name          text,
  request_id          text,
  occurred_at         timestamptz not null default now(),
  check (action not in ('changes_requested', 'rejected') or char_length(btrim(coalesce(reason, ''))) >= 10)
);

create or replace function public.fill_event_program_history_actor()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select rg.role_code into new.actor_role_code from public.role_grants rg where rg.id = new.actor_role_grant_id;
  select coalesce(sp.full_name, a.student_code) into new.actor_name
  from public.accounts a
  left join public.student_profiles sp on sp.user_id = a.user_id
  where a.user_id = new.actor_user_id;
  return new;
end;
$$;

drop trigger if exists event_program_history_fill_actor on public.event_program_history;
create trigger event_program_history_fill_actor before insert on public.event_program_history
  for each row execute function public.fill_event_program_history_actor();

create index if not exists event_programs_owner_status_idx on public.event_programs (owner_org_id, status, updated_at desc);
create index if not exists event_programs_status_idx on public.event_programs (status, submitted_at);
create index if not exists event_program_documents_program_idx on public.event_program_documents (program_id, uploaded_at desc);
create index if not exists event_program_history_program_idx on public.event_program_history (program_id, occurred_at);

-- ── Quyền ─────────────────────────────────────────────────────────────────────
-- Trả về role grant Đoàn Khoa của người dùng hiện tại trên đơn vị faculty_union, hoặc null.
create or replace function public.event_program_manager_grant(p_org_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select rg.id
  from public.role_grants rg
  join public.organization_units ou on ou.id = rg.organization_id
  where rg.user_id = auth.uid()
    and rg.revoked_at is null
    and rg.organization_id = p_org_id
    and rg.role_code in ('faculty_manager', 'faculty_executive')
    and ou.unit_type = 'faculty_union'
    and ou.is_active
  order by case rg.role_code when 'faculty_manager' then 0 else 1 end, rg.granted_at
  limit 1;
$$;

-- Trả về role grant Văn phòng Đoàn – Hội của người dùng hiện tại, hoặc null.
-- school_admin không được tính: xét duyệt kế hoạch là thẩm quyền riêng của Văn phòng.
create or replace function public.event_program_reviewer_grant()
returns uuid
language sql stable security definer set search_path = public as $$
  select rg.id
  from public.role_grants rg
  join public.organization_units ou on ou.id = rg.organization_id
  where rg.user_id = auth.uid()
    and rg.revoked_at is null
    and rg.role_code = 'office'
    and ou.unit_type = 'office'
    and ou.is_active
  order by rg.granted_at
  limit 1;
$$;

-- Ai được xem hồ sơ nội bộ (tài liệu PDF, lịch sử): Đoàn Khoa sở hữu; người xét duyệt khi đã nộp.
create or replace function public.can_view_event_program_internals(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_programs p
    where p.id = p_program_id
      and (
        public.event_program_manager_grant(p.owner_org_id) is not null
        or (p.status <> 'draft' and public.event_program_reviewer_grant() is not null)
      )
  );
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.event_programs          enable row level security;
alter table public.event_program_documents enable row level security;
alter table public.event_program_history   enable row level security;

-- Chỉ chương trình đã được chấp thuận mới hiển thị công khai (cho mọi tài khoản đăng nhập).
drop policy if exists event_programs_read on public.event_programs;
create policy event_programs_read on public.event_programs for select to authenticated using (
  status = 'approved'
  or public.event_program_manager_grant(owner_org_id) is not null
  or (status <> 'draft' and public.event_program_reviewer_grant() is not null)
);

drop policy if exists event_program_documents_read on public.event_program_documents;
create policy event_program_documents_read on public.event_program_documents for select to authenticated
  using (public.can_view_event_program_internals(program_id));

drop policy if exists event_program_history_read on public.event_program_history;
create policy event_program_history_read on public.event_program_history for select to authenticated
  using (public.can_view_event_program_internals(program_id));

revoke insert, update, delete on public.event_programs          from anon, authenticated;
revoke insert, update, delete on public.event_program_documents from anon, authenticated;
revoke insert, update, delete on public.event_program_history   from anon, authenticated;
revoke all on public.event_programs, public.event_program_documents, public.event_program_history from anon;
grant select on public.event_programs, public.event_program_documents, public.event_program_history to authenticated;

-- ── RPC: lưu bản nháp ─────────────────────────────────────────────────────────
create or replace function public.save_event_program(
  p_id                    uuid,
  p_owner_org_id          uuid,
  p_title                 text,
  p_summary               text,
  p_location              text,
  p_starts_at             timestamptz,
  p_ends_at               timestamptz,
  p_expected_participants integer,
  p_plan_number           text,
  p_plan_signed_on        date,
  p_request_id            text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id      uuid;
  v_grant   uuid;
  v_faculty uuid;
  v_before  public.event_programs%rowtype;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if char_length(btrim(coalesce(p_title, ''))) < 5 then raise exception 'TITLE_TOO_SHORT'; end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'ENDS_BEFORE_STARTS';
  end if;

  if p_id is null then
    v_grant := public.event_program_manager_grant(p_owner_org_id);
    if v_grant is null then raise exception 'FORBIDDEN'; end if;
    select faculty_id into v_faculty from public.organization_units where id = p_owner_org_id;

    insert into public.event_programs(
      owner_org_id, faculty_id, title, summary, location, starts_at, ends_at,
      expected_participants, plan_number, plan_signed_on, created_by)
    values (
      p_owner_org_id, v_faculty, btrim(p_title), nullif(btrim(coalesce(p_summary, '')), ''),
      nullif(btrim(coalesce(p_location, '')), ''), p_starts_at, p_ends_at,
      p_expected_participants, nullif(btrim(coalesce(p_plan_number, '')), ''), p_plan_signed_on, auth.uid())
    returning id into v_id;

    insert into public.event_program_history(program_id, action, from_status, to_status, actor_user_id, actor_role_grant_id, request_id)
    values (v_id, 'created', null, 'draft', auth.uid(), v_grant, p_request_id);
    perform public.write_audit('event_program.created', 'event_program', v_id::text, null,
      jsonb_build_object('title', btrim(p_title), 'owner_org_id', p_owner_org_id), v_grant, p_owner_org_id, p_request_id);
    return v_id;
  end if;

  select * into v_before from public.event_programs where id = p_id for update;
  if v_before.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  v_grant := public.event_program_manager_grant(v_before.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if p_owner_org_id is not null and p_owner_org_id <> v_before.owner_org_id then
    raise exception 'OWNER_CHANGE_FORBIDDEN';
  end if;
  if v_before.status not in ('draft', 'needs_changes') then raise exception 'PROGRAM_NOT_EDITABLE'; end if;

  update public.event_programs
  set title = btrim(p_title),
      summary = nullif(btrim(coalesce(p_summary, '')), ''),
      location = nullif(btrim(coalesce(p_location, '')), ''),
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      expected_participants = p_expected_participants,
      plan_number = nullif(btrim(coalesce(p_plan_number, '')), ''),
      plan_signed_on = p_plan_signed_on,
      updated_at = now()
  where id = p_id;

  insert into public.event_program_history(program_id, action, from_status, to_status, actor_user_id, actor_role_grant_id, request_id)
  values (p_id, 'updated', v_before.status, v_before.status, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('event_program.updated', 'event_program', p_id::text,
    jsonb_build_object('title', v_before.title, 'starts_at', v_before.starts_at, 'ends_at', v_before.ends_at, 'location', v_before.location),
    jsonb_build_object('title', btrim(p_title), 'starts_at', p_starts_at, 'ends_at', p_ends_at, 'location', p_location),
    v_grant, v_before.owner_org_id, p_request_id);
  return p_id;
end;
$$;

-- ── RPC: ghi nhận PDF kế hoạch đã ký (sau khi tệp đã vào Storage) ────────────
create or replace function public.attach_event_program_document(
  p_program_id   uuid,
  p_storage_path text,
  p_file_name    text,
  p_size_bytes   integer,
  p_sha256       text,
  p_request_id   text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_program public.event_programs%rowtype;
  v_grant   uuid;
  v_doc_id  uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_program from public.event_programs where id = p_program_id for update;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if v_program.status not in ('draft', 'needs_changes') then raise exception 'PROGRAM_NOT_EDITABLE'; end if;
  if p_storage_path !~ ('^' || p_program_id::text || '/[0-9a-f-]{36}\.pdf$') then
    raise exception 'INVALID_STORAGE_PATH';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'event-program-plans' and o.name = p_storage_path
  ) then
    raise exception 'DOCUMENT_NOT_UPLOADED';
  end if;

  insert into public.event_program_documents(program_id, storage_path, original_file_name, size_bytes, sha256, uploaded_by)
  values (p_program_id, p_storage_path, p_file_name, p_size_bytes, lower(p_sha256), auth.uid())
  returning id into v_doc_id;

  update public.event_programs set current_document_id = v_doc_id, updated_at = now() where id = p_program_id;

  insert into public.event_program_history(program_id, action, from_status, to_status, document_id, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, 'document_attached', v_program.status, v_program.status, v_doc_id, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('event_program.document_attached', 'event_program', p_program_id::text, null,
    jsonb_build_object('document_id', v_doc_id, 'sha256', lower(p_sha256), 'size_bytes', p_size_bytes),
    v_grant, v_program.owner_org_id, p_request_id);
  return v_doc_id;
end;
$$;

-- ── RPC: gửi kế hoạch đến Văn phòng ──────────────────────────────────────────
create or replace function public.submit_event_program(
  p_program_id uuid,
  p_request_id text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_program public.event_programs%rowtype;
  v_grant   uuid;
  v_missing text[] := '{}'::text[];
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_program from public.event_programs where id = p_program_id for update;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  v_grant := public.event_program_manager_grant(v_program.owner_org_id);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if v_program.status not in ('draft', 'needs_changes') then raise exception 'INVALID_TRANSITION'; end if;

  if v_program.summary is null then v_missing := array_append(v_missing, 'summary'); end if;
  if v_program.location is null then v_missing := array_append(v_missing, 'location'); end if;
  if v_program.starts_at is null then v_missing := array_append(v_missing, 'starts_at'); end if;
  if v_program.ends_at is null then v_missing := array_append(v_missing, 'ends_at'); end if;
  if v_program.expected_participants is null then v_missing := array_append(v_missing, 'expected_participants'); end if;
  if v_program.plan_number is null then v_missing := array_append(v_missing, 'plan_number'); end if;
  if v_program.plan_signed_on is null then v_missing := array_append(v_missing, 'plan_signed_on'); end if;
  if cardinality(v_missing) > 0 then
    raise exception 'MISSING_REQUIRED_FIELDS:%', array_to_string(v_missing, ',');
  end if;
  if v_program.current_document_id is null then raise exception 'PLAN_DOCUMENT_REQUIRED'; end if;

  update public.event_programs
  set status = 'submitted',
      submission_count = submission_count + 1,
      submitted_at = now(),
      updated_at = now()
  where id = p_program_id;

  insert into public.event_program_history(program_id, action, from_status, to_status, document_id, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, 'submitted', v_program.status, 'submitted', v_program.current_document_id, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('event_program.submitted', 'event_program', p_program_id::text,
    jsonb_build_object('status', v_program.status),
    jsonb_build_object('status', 'submitted', 'submission', v_program.submission_count + 1, 'document_id', v_program.current_document_id),
    v_grant, v_program.owner_org_id, p_request_id);
  return 'submitted';
end;
$$;

-- ── RPC: Văn phòng xét duyệt ─────────────────────────────────────────────────
create or replace function public.review_event_program(
  p_program_id uuid,
  p_decision   text,
  p_reason     text,
  p_request_id text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_program public.event_programs%rowtype;
  v_grant   uuid;
  v_to      text;
  v_action  text;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  v_grant := public.event_program_reviewer_grant();
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  if p_decision not in ('approve', 'request_changes', 'reject') then raise exception 'INVALID_DECISION'; end if;
  if p_decision in ('request_changes', 'reject') and char_length(coalesce(v_reason, '')) < 10 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_program from public.event_programs where id = p_program_id for update;
  if v_program.id is null then raise exception 'PROGRAM_NOT_FOUND'; end if;
  if v_program.status <> 'submitted' then raise exception 'INVALID_TRANSITION'; end if;
  if exists (
    select 1 from public.event_program_history h
    where h.program_id = p_program_id and h.action = 'submitted' and h.actor_user_id = auth.uid()
  ) then
    raise exception 'SELF_REVIEW_FORBIDDEN';
  end if;

  v_to := case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'needs_changes' end;
  v_action := case p_decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'changes_requested' end;

  update public.event_programs
  set status = v_to,
      decided_at = case when v_to in ('approved', 'rejected') then now() end,
      decided_by = case when v_to in ('approved', 'rejected') then auth.uid() end,
      updated_at = now()
  where id = p_program_id;

  insert into public.event_program_history(program_id, action, from_status, to_status, reason, document_id, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, v_action, 'submitted', v_to, v_reason, v_program.current_document_id, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('event_program.' || v_action, 'event_program', p_program_id::text,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', v_to, 'reason', v_reason),
    v_grant, v_program.owner_org_id, p_request_id);
  return v_to;
end;
$$;

-- ── Storage: bucket riêng tư cho PDF kế hoạch đã ký ──────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-program-plans', 'event-program-plans', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Tải lên: chỉ Đoàn Khoa sở hữu, khi hồ sơ còn sửa được, đúng khuôn đường dẫn <program_id>/<uuid>.pdf.
create or replace function public.can_upload_event_program_object(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
    and exists (
      select 1 from public.event_programs p
      where p.id::text = split_part(p_name, '/', 1)
        and p.status in ('draft', 'needs_changes')
        and public.event_program_manager_grant(p.owner_org_id) is not null
    );
$$;

-- Đọc: chỉ tệp đã được ghi nhận vào hồ sơ và người xem có quyền xem hồ sơ nội bộ.
create or replace function public.can_read_event_program_object(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_program_documents d
    where d.storage_path = p_name
      and public.can_view_event_program_internals(d.program_id)
  );
$$;

drop policy if exists event_program_plans_insert on storage.objects;
create policy event_program_plans_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'event-program-plans' and public.can_upload_event_program_object(name));

drop policy if exists event_program_plans_read on storage.objects;
create policy event_program_plans_read on storage.objects for select to authenticated
  using (bucket_id = 'event-program-plans' and public.can_read_event_program_object(name));

-- ── Grants ───────────────────────────────────────────────────────────────────
revoke all on function public.event_program_manager_grant(uuid) from public, anon;
revoke all on function public.event_program_reviewer_grant() from public, anon;
revoke all on function public.can_view_event_program_internals(uuid) from public, anon;
revoke all on function public.can_upload_event_program_object(text) from public, anon;
revoke all on function public.can_read_event_program_object(text) from public, anon;
revoke all on function public.save_event_program(uuid, uuid, text, text, text, timestamptz, timestamptz, integer, text, date, text) from public, anon;
revoke all on function public.attach_event_program_document(uuid, text, text, integer, text, text) from public, anon;
revoke all on function public.submit_event_program(uuid, text) from public, anon;
revoke all on function public.review_event_program(uuid, text, text, text) from public, anon;

grant execute on function public.event_program_manager_grant(uuid) to authenticated;
grant execute on function public.event_program_reviewer_grant() to authenticated;
grant execute on function public.can_view_event_program_internals(uuid) to authenticated;
grant execute on function public.can_upload_event_program_object(text) to authenticated;
grant execute on function public.can_read_event_program_object(text) to authenticated;
grant execute on function public.save_event_program(uuid, uuid, text, text, text, timestamptz, timestamptz, integer, text, date, text) to authenticated;
grant execute on function public.attach_event_program_document(uuid, text, text, integer, text, text) to authenticated;
grant execute on function public.submit_event_program(uuid, text) to authenticated;
grant execute on function public.review_event_program(uuid, text, text, text) to authenticated;

comment on table public.event_programs is 'UC6: kế hoạch chương trình của Đoàn Khoa; chỉ status=approved được hiển thị như chương trình đã duyệt.';
comment on table public.event_program_history is 'Append-only: người thao tác, vai trò, thời điểm, lý do và chuyển trạng thái của kế hoạch.';
comment on table public.event_program_documents is 'PDF kế hoạch đã ký; mỗi lần tải là một bản ghi mới, không ghi đè bản đã nộp.';
