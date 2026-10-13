-- UC10: Đăng bài sau nghiệm thu.
-- Sau khi Văn phòng nghiệm thu (UC9), chương trình sang "Chờ đăng bài". Chỉ Ban Tuyên giáo – Truyền thông biên tập
-- và xuất bản; BTC (Đoàn Khoa) chỉ gửi nội dung đề xuất. Bài E-Office do hệ thống xuất bản; bài Facebook do Ban đăng
-- tay rồi nhập đường dẫn và thời gian thực tế (chưa tích hợp Facebook API). "Đã đăng bài" chỉ khi đủ dữ liệu.
-- Bài công khai không chứa MSSV, danh sách điểm danh, hồ sơ ký hay điểm uy tín: cổng công khai chỉ đọc qua
-- public_program_posts(), và nội dung có dãy 10 chữ số (dạng MSSV) bị chặn.
-- Không sửa hàm UC6–UC9: trạng thái chờ đăng bài được tạo bằng trigger trên program_acceptances.

-- ── 1. Đơn vị Ban Tuyên giáo – Truyền thông ───────────────────────────────────
insert into public.organization_units (id, code, name, unit_type, parent_id)
values ('00000000-0000-4000-8000-000000000004', 'PROPAGANDA_MEDIA', 'Ban Tuyên giáo – Truyền thông', 'school_committee',
        '00000000-0000-4000-8000-000000000001')
on conflict (code) do nothing;

-- Role grant của người dùng hiện tại trong Ban Tuyên giáo – Truyền thông (trưởng ban hoặc cộng tác viên), hoặc null.
create or replace function public.publication_publisher_grant()
returns uuid
language sql stable security definer set search_path = public as $$
  select rg.id
  from public.role_grants rg
  join public.organization_units ou on ou.id = rg.organization_id
  where rg.user_id = auth.uid()
    and rg.revoked_at is null
    and rg.role_code in ('committee_manager', 'collaborator')
    and ou.code = 'PROPAGANDA_MEDIA'
    and ou.unit_type = 'school_committee'
    and ou.is_active
  order by case rg.role_code when 'committee_manager' then 0 else 1 end, rg.granted_at
  limit 1;
$$;

-- ── 2. Bảng ───────────────────────────────────────────────────────────────────
create table if not exists public.program_publications (
  program_id           uuid primary key references public.event_programs(id) on delete restrict,
  status               text not null default 'awaiting' check (status in ('awaiting', 'published')),
  title                text check (title is null or char_length(btrim(title)) between 10 and 200),
  body                 text check (body is null or char_length(btrim(body)) between 50 and 20000),
  draft_source         text check (draft_source in ('manual', 'generated', 'proposal')),
  source_proposal_id   uuid,
  cover_path           text,
  cover_content_type   text check (cover_content_type in ('image/jpeg', 'image/png', 'image/webp')),
  eoffice_path         text,
  eoffice_published_at timestamptz,
  eoffice_published_by uuid references public.accounts(user_id) on delete restrict,
  facebook_url         text check (facebook_url is null or char_length(facebook_url) <= 500),
  facebook_posted_at   timestamptz,
  facebook_recorded_by uuid references public.accounts(user_id) on delete restrict,
  completed_at         timestamptz,
  completed_by         uuid references public.accounts(user_id) on delete restrict,
  version              integer not null default 0 check (version >= 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references public.accounts(user_id) on delete restrict,
  check ((cover_path is null) = (cover_content_type is null)),
  check ((facebook_url is null) = (facebook_posted_at is null)),
  check ((eoffice_published_at is null) = (eoffice_path is null)),
  check (eoffice_published_at is null or (title is not null and body is not null and cover_path is not null)),
  check ((status = 'published') = (completed_at is not null)),
  check (status <> 'published' or (eoffice_published_at is not null and facebook_url is not null))
);
create index if not exists program_publications_status_idx on public.program_publications (status, updated_at desc);

-- Nội dung đề xuất của Khoa (BTC). Chỉ thêm; Ban có thể dùng làm bản nháp.
create table if not exists public.program_publication_proposals (
  id                  uuid primary key default gen_random_uuid(),
  program_id          uuid not null references public.program_publications(program_id) on delete restrict,
  title               text not null check (char_length(btrim(title)) between 10 and 200),
  body                text not null check (char_length(btrim(body)) between 50 and 20000),
  submitted_by        uuid not null references public.accounts(user_id) on delete restrict,
  actor_role_grant_id uuid references public.role_grants(id) on delete set null,
  submitted_at        timestamptz not null default now()
);
create index if not exists program_publication_proposals_program_idx on public.program_publication_proposals (program_id, submitted_at desc);
alter table public.program_publications drop constraint if exists program_publications_source_proposal_fk;
alter table public.program_publications add constraint program_publications_source_proposal_fk
  foreign key (source_proposal_id) references public.program_publication_proposals(id) on delete restrict;

-- Lịch sử chỉnh sửa: mỗi thay đổi lưu nguyên giá trị sau khi đổi. Chỉ thêm.
create table if not exists public.program_publication_revisions (
  id                  bigint generated always as identity primary key,
  program_id          uuid not null references public.program_publications(program_id) on delete restrict,
  version             integer not null,
  action              text not null check (action in (
                        'awaiting', 'proposal_submitted', 'draft_saved', 'edited_after_publish', 'cover_set',
                        'eoffice_published', 'facebook_recorded', 'completed')),
  title               text,
  body                text,
  draft_source        text,
  proposal_id         uuid references public.program_publication_proposals(id) on delete restrict,
  cover_path          text,
  facebook_url        text,
  facebook_posted_at  timestamptz,
  reason              text,
  actor_user_id       uuid not null references public.accounts(user_id) on delete restrict,
  actor_role_grant_id uuid references public.role_grants(id) on delete set null,
  actor_role_code     text,
  actor_name          text,
  request_id          text,
  occurred_at         timestamptz not null default now()
);
drop trigger if exists program_publication_revisions_fill_actor on public.program_publication_revisions;
create trigger program_publication_revisions_fill_actor before insert on public.program_publication_revisions
  for each row execute function public.fill_event_program_history_actor();
create index if not exists program_publication_revisions_program_idx on public.program_publication_revisions (program_id, id);

drop trigger if exists program_publication_proposals_append_only on public.program_publication_proposals;
create trigger program_publication_proposals_append_only before update or delete on public.program_publication_proposals
  for each row execute function public.prevent_append_only_change();
drop trigger if exists program_publication_revisions_append_only on public.program_publication_revisions;
create trigger program_publication_revisions_append_only before update or delete on public.program_publication_revisions
  for each row execute function public.prevent_append_only_change();

-- ── 3. Nghiệm thu → Chờ đăng bài ─────────────────────────────────────────────
create or replace function public.open_program_publication()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status is distinct from 'accepted') then
    insert into public.program_publications(program_id, created_at, updated_at)
    values (new.program_id, coalesce(new.decided_at, now()), coalesce(new.decided_at, now()))
    on conflict (program_id) do nothing;
    if found then
      insert into public.program_publication_revisions(program_id, version, action, actor_user_id)
      values (new.program_id, 0, 'awaiting', coalesce(new.decided_by, auth.uid()));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists program_acceptances_open_publication on public.program_acceptances;
create trigger program_acceptances_open_publication after insert or update of status on public.program_acceptances
  for each row execute function public.open_program_publication();

-- Chương trình đã nghiệm thu trước khi có UC10.
insert into public.program_publications(program_id, created_at, updated_at)
select a.program_id, a.decided_at, a.decided_at from public.program_acceptances a where a.status = 'accepted'
on conflict (program_id) do nothing;
insert into public.program_publication_revisions(program_id, version, action, actor_user_id, occurred_at)
select a.program_id, 0, 'awaiting', a.decided_by, a.decided_at
from public.program_acceptances a
where a.status = 'accepted'
  and not exists (select 1 from public.program_publication_revisions r where r.program_id = a.program_id);

-- ── 4. Quyền xem và RLS ───────────────────────────────────────────────────────
-- Xem bản nháp, đề xuất, lịch sử: Ban Tuyên giáo, BTC của chương trình, Văn phòng.
create or replace function public.can_view_program_publication(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.program_publications where program_id = p_program_id)
    and (public.publication_publisher_grant() is not null
         or public.event_program_reviewer_grant() is not null
         or exists (select 1 from public.event_programs p
                    where p.id = p_program_id and public.event_program_manager_grant(p.owner_org_id) is not null));
$$;

alter table public.program_publications          enable row level security;
alter table public.program_publication_proposals enable row level security;
alter table public.program_publication_revisions enable row level security;

drop policy if exists program_publications_read on public.program_publications;
create policy program_publications_read on public.program_publications for select to authenticated
  using (public.can_view_program_publication(program_id));
drop policy if exists program_publication_proposals_read on public.program_publication_proposals;
create policy program_publication_proposals_read on public.program_publication_proposals for select to authenticated
  using (public.can_view_program_publication(program_id));
drop policy if exists program_publication_revisions_read on public.program_publication_revisions;
create policy program_publication_revisions_read on public.program_publication_revisions for select to authenticated
  using (public.can_view_program_publication(program_id));

revoke all on public.program_publications, public.program_publication_proposals, public.program_publication_revisions
  from anon, public;
revoke insert, update, delete on public.program_publications, public.program_publication_proposals,
  public.program_publication_revisions from authenticated;
grant select on public.program_publications, public.program_publication_proposals, public.program_publication_revisions
  to authenticated;

-- ── 5. Kiểm tra nội dung công khai ───────────────────────────────────────────
-- Trả về mã lỗi nếu nội dung có dãy 10 chữ số liền (dạng MSSV), ngược lại null.
create or replace function public.publication_text_violation(p_text text)
returns text
language sql immutable as $$
  select case when coalesce(p_text, '') ~ '(^|[^0-9])[0-9]{10}([^0-9]|$)' then 'CONTAINS_STUDENT_CODE' end;
$$;

-- Số liệu tổng hợp (không danh sách, không MSSV, không điểm) để sinh bản nháp.
create or replace function public.program_publication_facts(p_program_id uuid)
returns table (
  program_title text, organization_name text, starts_at timestamptz, ends_at timestamptz, location text,
  session_count integer, participant_count integer, accepted_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_view_program_publication(p_program_id) then raise exception 'FORBIDDEN'; end if;
  return query
  select p.title, ou.name, p.starts_at, p.ends_at, p.location,
         (select count(*)::integer from public.program_attendance_sessions s where s.program_id = p.id and s.open_count > 0),
         (select count(*)::integer from public.program_acceptance_results r
          where r.program_id = p.id and r.version = a.current_snapshot_version and r.participation <> 'absent'),
         a.decided_at
  from public.event_programs p
  join public.organization_units ou on ou.id = p.owner_org_id
  join public.program_acceptances a on a.program_id = p.id
  where p.id = p_program_id;
end;
$$;

-- ── 6. RPC ────────────────────────────────────────────────────────────────────
-- Khóa dòng bài đăng; báo PROGRAM_NOT_ACCEPTED nếu chương trình chưa nghiệm thu.
create or replace function public.lock_program_publication(p_program_id uuid)
returns public.program_publications
language plpgsql security definer set search_path = public as $$
declare v_pub public.program_publications%rowtype;
begin
  if not exists (select 1 from public.event_programs where id = p_program_id) then raise exception 'PROGRAM_NOT_FOUND'; end if;
  select * into v_pub from public.program_publications where program_id = p_program_id for update;
  if v_pub.program_id is null
     or not exists (select 1 from public.program_acceptances where program_id = p_program_id and status = 'accepted') then
    raise exception 'PROGRAM_NOT_ACCEPTED';
  end if;
  return v_pub;
end;
$$;

create or replace function public.submit_publication_proposal(
  p_program_id uuid, p_title text, p_body text, p_request_id text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_grant uuid;
  v_pub   public.program_publications%rowtype;
  v_id    uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select owner_org_id into v_owner from public.event_programs where id = p_program_id;
  v_grant := public.event_program_manager_grant(v_owner);
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  v_pub := public.lock_program_publication(p_program_id);
  if v_pub.status <> 'awaiting' then raise exception 'PUBLICATION_COMPLETED'; end if;
  if public.publication_text_violation(p_title || ' ' || p_body) is not null then raise exception 'CONTAINS_STUDENT_CODE'; end if;

  insert into public.program_publication_proposals(program_id, title, body, submitted_by, actor_role_grant_id)
  values (p_program_id, btrim(p_title), btrim(p_body), auth.uid(), v_grant)
  returning id into v_id;
  insert into public.program_publication_revisions(program_id, version, action, title, body, proposal_id,
    actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, v_pub.version, 'proposal_submitted', btrim(p_title), btrim(p_body), v_id, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_publication.proposal_submitted', 'event_program', p_program_id::text, null,
    jsonb_build_object('proposal_id', v_id), v_grant, v_owner, p_request_id);
  return v_id;
end;
$$;

-- Lưu tiêu đề và nội dung. Sau khi bài E-Office đã lên, mọi chỉnh sửa phải có lý do.
create or replace function public.save_program_publication(
  p_program_id  uuid,
  p_title       text,
  p_body        text,
  p_source      text,
  p_proposal_id uuid default null,
  p_reason      text default null,
  p_request_id  text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_grant  uuid;
  v_pub    public.program_publications%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_action text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  v_grant := public.publication_publisher_grant();
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  v_pub := public.lock_program_publication(p_program_id);
  if p_source not in ('manual', 'generated', 'proposal') then raise exception 'INVALID_SOURCE'; end if;
  if (p_source = 'proposal') <> (p_proposal_id is not null) then raise exception 'INVALID_SOURCE'; end if;
  if p_proposal_id is not null and not exists (
    select 1 from public.program_publication_proposals where id = p_proposal_id and program_id = p_program_id
  ) then raise exception 'PROPOSAL_NOT_FOUND'; end if;
  if public.publication_text_violation(p_title || ' ' || p_body) is not null then raise exception 'CONTAINS_STUDENT_CODE'; end if;
  v_action := case when v_pub.eoffice_published_at is null then 'draft_saved' else 'edited_after_publish' end;
  if v_action = 'edited_after_publish' and char_length(coalesce(v_reason, '')) < 10 then raise exception 'REASON_REQUIRED'; end if;

  update public.program_publications
  set title = btrim(p_title), body = btrim(p_body), draft_source = p_source, source_proposal_id = p_proposal_id,
      version = version + 1, updated_at = now(), updated_by = auth.uid()
  where program_id = p_program_id;
  insert into public.program_publication_revisions(program_id, version, action, title, body, draft_source, proposal_id,
    cover_path, facebook_url, facebook_posted_at, reason, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, v_pub.version + 1, v_action, btrim(p_title), btrim(p_body), p_source, p_proposal_id,
    v_pub.cover_path, v_pub.facebook_url, v_pub.facebook_posted_at, v_reason, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_publication.' || v_action, 'event_program', p_program_id::text,
    jsonb_build_object('version', v_pub.version), jsonb_build_object('version', v_pub.version + 1, 'source', p_source),
    v_grant, '00000000-0000-4000-8000-000000000004', p_request_id);
  return v_pub.version + 1;
end;
$$;

create or replace function public.set_program_publication_cover(
  p_program_id uuid, p_storage_path text, p_content_type text, p_reason text default null, p_request_id text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_grant  uuid;
  v_pub    public.program_publications%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  v_grant := public.publication_publisher_grant();
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  v_pub := public.lock_program_publication(p_program_id);
  if p_storage_path !~ ('^' || p_program_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then raise exception 'INVALID_STORAGE_PATH'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'program-publication-covers' and o.name = p_storage_path) then
    raise exception 'DOCUMENT_NOT_UPLOADED';
  end if;
  if v_pub.eoffice_published_at is not null and char_length(coalesce(v_reason, '')) < 10 then raise exception 'REASON_REQUIRED'; end if;

  update public.program_publications
  set cover_path = p_storage_path, cover_content_type = p_content_type, version = version + 1,
      updated_at = now(), updated_by = auth.uid()
  where program_id = p_program_id;
  insert into public.program_publication_revisions(program_id, version, action, title, body, draft_source, cover_path,
    facebook_url, facebook_posted_at, reason, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, v_pub.version + 1, 'cover_set', v_pub.title, v_pub.body, v_pub.draft_source, p_storage_path,
    v_pub.facebook_url, v_pub.facebook_posted_at, v_reason, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_publication.cover_set', 'event_program', p_program_id::text,
    jsonb_build_object('cover_path', v_pub.cover_path), jsonb_build_object('cover_path', p_storage_path), v_grant, '00000000-0000-4000-8000-000000000004', p_request_id);
  return v_pub.version + 1;
end;
$$;

create or replace function public.publication_missing(p_program_id uuid)
returns text[]
language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when p.title is null then 'title' end,
    case when p.body is null then 'body' end,
    case when p.cover_path is null then 'cover' end,
    case when p.eoffice_published_at is null then 'eoffice' end,
    case when p.facebook_url is null then 'facebook_url' end,
    case when p.facebook_posted_at is null then 'facebook_posted_at' end
  ], null)
  from public.program_publications p
  where p.program_id = p_program_id and public.can_view_program_publication(p_program_id);
$$;

-- Xuất bản bài trên cổng E-Office (hệ thống đăng): cần tiêu đề, nội dung, ảnh đại diện.
create or replace function public.publish_program_eoffice(p_program_id uuid, p_request_id text default null)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_grant   uuid;
  v_pub     public.program_publications%rowtype;
  v_missing text[];
  v_status  text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  v_grant := public.publication_publisher_grant();
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  v_pub := public.lock_program_publication(p_program_id);
  select status into v_status from public.event_programs where id = p_program_id;
  if v_status = 'cancelled' then raise exception 'PROGRAM_CANCELLED'; end if;
  if v_pub.eoffice_published_at is not null then raise exception 'ALREADY_PUBLISHED'; end if;
  v_missing := array_remove(array[
    case when v_pub.title is null then 'title' end,
    case when v_pub.body is null then 'body' end,
    case when v_pub.cover_path is null then 'cover' end], null);
  if cardinality(v_missing) > 0 then raise exception 'MISSING_PUBLICATION_DATA:%', array_to_string(v_missing, ','); end if;
  if public.publication_text_violation(v_pub.title || ' ' || v_pub.body) is not null then raise exception 'CONTAINS_STUDENT_CODE'; end if;

  update public.program_publications
  set eoffice_published_at = now(), eoffice_published_by = auth.uid(), eoffice_path = '/news/' || p_program_id::text,
      version = version + 1, updated_at = now(), updated_by = auth.uid()
  where program_id = p_program_id;
  insert into public.program_publication_revisions(program_id, version, action, title, body, draft_source, cover_path,
    facebook_url, facebook_posted_at, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, v_pub.version + 1, 'eoffice_published', v_pub.title, v_pub.body, v_pub.draft_source, v_pub.cover_path,
    v_pub.facebook_url, v_pub.facebook_posted_at, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_publication.eoffice_published', 'event_program', p_program_id::text, null,
    jsonb_build_object('path', '/news/' || p_program_id::text, 'version', v_pub.version + 1), v_grant, '00000000-0000-4000-8000-000000000004', p_request_id);
  return now();
end;
$$;

-- Ghi bài Facebook do Ban đăng tay. Sửa sau khi đã hoàn tất phải có lý do.
create or replace function public.record_program_facebook_post(
  p_program_id uuid, p_url text, p_posted_at timestamptz, p_reason text default null, p_request_id text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_grant    uuid;
  v_pub      public.program_publications%rowtype;
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_accepted timestamptz;
  v_url      text := btrim(coalesce(p_url, ''));
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  v_grant := public.publication_publisher_grant();
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  v_pub := public.lock_program_publication(p_program_id);
  if v_url = '' then raise exception 'FACEBOOK_URL_REQUIRED'; end if;
  if v_url !~ '^https://((www|m|web)\.)?facebook\.com/[^[:space:]]+$' and v_url !~ '^https://fb\.watch/[^[:space:]]+$' then
    raise exception 'INVALID_FACEBOOK_URL';
  end if;
  if p_posted_at is null then raise exception 'FACEBOOK_TIME_REQUIRED'; end if;
  select decided_at into v_accepted from public.program_acceptances where program_id = p_program_id;
  if p_posted_at > now() + interval '5 minutes' then raise exception 'FACEBOOK_TIME_IN_FUTURE'; end if;
  if p_posted_at < v_accepted then raise exception 'FACEBOOK_TIME_BEFORE_ACCEPTANCE'; end if;
  if v_pub.status = 'published' and char_length(coalesce(v_reason, '')) < 10 then raise exception 'REASON_REQUIRED'; end if;

  update public.program_publications
  set facebook_url = v_url, facebook_posted_at = p_posted_at, facebook_recorded_by = auth.uid(),
      version = version + 1, updated_at = now(), updated_by = auth.uid()
  where program_id = p_program_id;
  insert into public.program_publication_revisions(program_id, version, action, title, body, draft_source, cover_path,
    facebook_url, facebook_posted_at, reason, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, v_pub.version + 1, 'facebook_recorded', v_pub.title, v_pub.body, v_pub.draft_source, v_pub.cover_path,
    v_url, p_posted_at, v_reason, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_publication.facebook_recorded', 'event_program', p_program_id::text,
    jsonb_build_object('url', v_pub.facebook_url, 'posted_at', v_pub.facebook_posted_at),
    jsonb_build_object('url', v_url, 'posted_at', p_posted_at), v_grant, '00000000-0000-4000-8000-000000000004', p_request_id);
  return v_pub.version + 1;
end;
$$;

-- Đánh dấu Đã đăng bài: chỉ khi đủ tiêu đề, nội dung, ảnh, bài E-Office, URL và thời gian Facebook.
create or replace function public.complete_program_publication(p_program_id uuid, p_request_id text default null)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_grant   uuid;
  v_pub     public.program_publications%rowtype;
  v_missing text[];
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  v_grant := public.publication_publisher_grant();
  if v_grant is null then raise exception 'FORBIDDEN'; end if;
  v_pub := public.lock_program_publication(p_program_id);
  if v_pub.status = 'published' then raise exception 'PUBLICATION_COMPLETED'; end if;
  v_missing := public.publication_missing(p_program_id);
  if cardinality(v_missing) > 0 then raise exception 'MISSING_PUBLICATION_DATA:%', array_to_string(v_missing, ','); end if;

  update public.program_publications
  set status = 'published', completed_at = now(), completed_by = auth.uid(), version = version + 1,
      updated_at = now(), updated_by = auth.uid()
  where program_id = p_program_id;
  insert into public.program_publication_revisions(program_id, version, action, title, body, draft_source, cover_path,
    facebook_url, facebook_posted_at, actor_user_id, actor_role_grant_id, request_id)
  values (p_program_id, v_pub.version + 1, 'completed', v_pub.title, v_pub.body, v_pub.draft_source, v_pub.cover_path,
    v_pub.facebook_url, v_pub.facebook_posted_at, auth.uid(), v_grant, p_request_id);
  perform public.write_audit('program_publication.completed', 'event_program', p_program_id::text,
    jsonb_build_object('status', 'awaiting'), jsonb_build_object('status', 'published'), v_grant, '00000000-0000-4000-8000-000000000004', p_request_id);
  return now();
end;
$$;

-- ── 7. Cổng công khai (anon) ─────────────────────────────────────────────────
-- Chỉ các trường an toàn của bài đã lên E-Office. Không MSSV, không danh sách, không hồ sơ, không uy tín.
create or replace function public.public_program_posts(p_program_id uuid default null)
returns table (
  program_id uuid, title text, body text, has_cover boolean, published_at timestamptz,
  organization_name text, program_starts_at timestamptz, location text, facebook_url text, updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select pp.program_id, pp.title, pp.body, pp.cover_path is not null, pp.eoffice_published_at,
         ou.name, p.starts_at, p.location, pp.facebook_url, pp.updated_at
  from public.program_publications pp
  join public.event_programs p on p.id = pp.program_id
  join public.organization_units ou on ou.id = p.owner_org_id
  where pp.eoffice_published_at is not null
    and (p_program_id is null or pp.program_id = p_program_id)
  order by pp.eoffice_published_at desc
  limit 100;
$$;

-- ── 8. Storage ảnh đại diện ──────────────────────────────────────────────────
-- Bucket riêng tư. Cổng công khai đọc ảnh qua route máy chủ chỉ khi bài đã lên E-Office.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('program-publication-covers', 'program-publication-covers', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_upload_program_publication_cover(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and public.publication_publisher_grant() is not null
    and exists (select 1 from public.program_publications p where p.program_id::text = split_part(p_name, '/', 1));
$$;

create or replace function public.can_read_program_publication_cover(p_name text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.program_publications p
    where p.program_id::text = split_part(p_name, '/', 1) and public.can_view_program_publication(p.program_id)
  );
$$;

drop policy if exists program_publication_covers_insert on storage.objects;
create policy program_publication_covers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'program-publication-covers' and public.can_upload_program_publication_cover(name));
drop policy if exists program_publication_covers_read on storage.objects;
create policy program_publication_covers_read on storage.objects for select to authenticated
  using (bucket_id = 'program-publication-covers' and public.can_read_program_publication_cover(name));

-- ── 9. Quyền thực thi ────────────────────────────────────────────────────────
revoke all on function public.open_program_publication() from public, anon, authenticated;
revoke all on function public.lock_program_publication(uuid) from public, anon, authenticated;
revoke all on function public.publication_publisher_grant() from public, anon;
revoke all on function public.can_view_program_publication(uuid) from public, anon;
revoke all on function public.program_publication_facts(uuid) from public, anon;
revoke all on function public.publication_missing(uuid) from public, anon;
revoke all on function public.submit_publication_proposal(uuid, text, text, text) from public, anon;
revoke all on function public.save_program_publication(uuid, text, text, text, uuid, text, text) from public, anon;
revoke all on function public.set_program_publication_cover(uuid, text, text, text, text) from public, anon;
revoke all on function public.publish_program_eoffice(uuid, text) from public, anon;
revoke all on function public.record_program_facebook_post(uuid, text, timestamptz, text, text) from public, anon;
revoke all on function public.complete_program_publication(uuid, text) from public, anon;
revoke all on function public.can_upload_program_publication_cover(text) from public, anon;
revoke all on function public.can_read_program_publication_cover(text) from public, anon;
revoke all on function public.public_program_posts(uuid) from public;

grant execute on function public.publication_publisher_grant() to authenticated;
grant execute on function public.can_view_program_publication(uuid) to authenticated;
grant execute on function public.program_publication_facts(uuid) to authenticated;
grant execute on function public.publication_missing(uuid) to authenticated;
grant execute on function public.submit_publication_proposal(uuid, text, text, text) to authenticated;
grant execute on function public.save_program_publication(uuid, text, text, text, uuid, text, text) to authenticated;
grant execute on function public.set_program_publication_cover(uuid, text, text, text, text) to authenticated;
grant execute on function public.publish_program_eoffice(uuid, text) to authenticated;
grant execute on function public.record_program_facebook_post(uuid, text, timestamptz, text, text) to authenticated;
grant execute on function public.complete_program_publication(uuid, text) to authenticated;
grant execute on function public.can_upload_program_publication_cover(text) to authenticated;
grant execute on function public.can_read_program_publication_cover(text) to authenticated;
grant execute on function public.public_program_posts(uuid) to anon, authenticated;
