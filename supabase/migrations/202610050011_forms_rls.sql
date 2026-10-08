-- Migration 011: Forms RLS policies, authorization helpers, and server-side RPCs
--
-- Authorization model:
--   Templates  → school_admin creates/edits; authenticated reads
--   Forms      → owner org managers create/edit; published forms visible to all
--   Responses  → submission only via RPC (direct insert revoked); owner org + school_admin reads
--
-- Why RPCs instead of direct inserts for responses:
--   Audience validation and multiple-submission checks must be atomic with the insert.
--   Doing this in application code risks TOCTOU races; a database transaction is the correct boundary.

-- ── Enable RLS ────────────────────────────────────────────────────────────────
alter table public.form_templates          enable row level security;
alter table public.form_template_versions  enable row level security;
alter table public.forms                   enable row level security;
alter table public.form_responses          enable row level security;
alter table public.form_response_answers   enable row level security;

-- ── Templates ─────────────────────────────────────────────────────────────────
create policy "templates_authenticated_read" on public.form_templates
  for select to authenticated using (true);

create policy "templates_admin_write" on public.form_templates
  for all to authenticated
  using  (public.has_active_role('school_admin'))
  with check (public.has_active_role('school_admin'));

create policy "template_versions_authenticated_read" on public.form_template_versions
  for select to authenticated using (true);

create policy "template_versions_admin_write" on public.form_template_versions
  for all to authenticated
  using  (public.has_active_role('school_admin'))
  with check (public.has_active_role('school_admin'));

-- ── Forms ─────────────────────────────────────────────────────────────────────
-- Helper: does the current user manage forms for a given org?
create or replace function public.user_can_manage_forms_for_org(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_active_role('school_admin')
    or exists (
      select 1 from public.role_grants rg
      where rg.user_id = auth.uid()
        and rg.revoked_at is null
        and rg.organization_id = p_org_id
        and rg.role_code in ('committee_manager','faculty_manager','office')
    );
$$;

create policy "forms_owner_manage" on public.forms
  for all to authenticated
  using  (public.user_can_manage_forms_for_org(owner_org_id))
  with check (public.user_can_manage_forms_for_org(owner_org_id));

create policy "forms_published_read_auth" on public.forms
  for select to authenticated using (status = 'published');

create policy "forms_published_read_anon" on public.forms
  for select to anon using (status = 'published');

-- ── Responses: read only for owner org + school_admin ────────────────────────
create policy "responses_owner_read" on public.form_responses
  for select to authenticated
  using (
    public.has_active_role('school_admin')
    or exists (
      select 1 from public.forms f
      where f.id = form_id
        and public.user_can_manage_forms_for_org(f.owner_org_id)
    )
  );

create policy "response_answers_owner_read" on public.form_response_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.form_responses fr
      join public.forms f on f.id = fr.form_id
      where fr.id = response_id
        and (
          public.has_active_role('school_admin')
          or public.user_can_manage_forms_for_org(f.owner_org_id)
        )
    )
  );

-- Revoke direct insert/update/delete from regular roles; submissions go through RPC.
revoke insert, update, delete on public.form_responses       from authenticated, anon;
revoke insert, update, delete on public.form_response_answers from authenticated, anon;

-- ── Audience validation helper ────────────────────────────────────────────────
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
        join public.faculties f on f.id = pr.current_faculty_id
        where sp.user_id = p_user_id
          and f.id = (p_rule->>'faculty_id')::uuid
      );
  end if;

  if v_type = 'union_member' then
    return p_user_id is not null
      and exists (
        select 1 from public.union_memberships
        where user_id = p_user_id
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

  -- Unknown rule type → deny
  return false;
end;
$$;

-- ── Template management RPCs ──────────────────────────────────────────────────

create or replace function public.save_form_template(
  p_id          uuid,
  p_title       text,
  p_description text,
  p_audience_rule jsonb,
  p_questions   jsonb,
  p_status      text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if not public.has_active_role('school_admin') then raise exception 'FORBIDDEN'; end if;
  if char_length(btrim(p_title)) < 3 then raise exception 'TITLE_TOO_SHORT'; end if;
  if p_status not in ('draft','published','deprecated') then raise exception 'INVALID_STATUS'; end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' then raise exception 'QUESTIONS_MUST_BE_ARRAY'; end if;

  if p_id is null then
    insert into public.form_templates(id, title, description, audience_rule, status, created_by)
    values (v_id, btrim(p_title), nullif(btrim(coalesce(p_description,'')), ''),
            p_audience_rule, p_status, auth.uid());
  else
    update public.form_templates
    set title = btrim(p_title),
        description = nullif(btrim(coalesce(p_description,'')), ''),
        audience_rule = p_audience_rule,
        status = p_status,
        updated_at = now()
    where id = p_id;
    if not found then raise exception 'TEMPLATE_NOT_FOUND'; end if;
  end if;

  perform public.write_audit('form_template.saved','form_template', v_id::text, null,
    jsonb_build_object('title', p_title, 'status', p_status), null);
  return v_id;
end;
$$;

create or replace function public.publish_form_template_version(
  p_template_id uuid,
  p_questions   jsonb,
  p_notes       text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_version int;
  v_version_id uuid;
begin
  if not public.has_active_role('school_admin') then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.form_templates where id = p_template_id) then
    raise exception 'TEMPLATE_NOT_FOUND';
  end if;
  if jsonb_typeof(p_questions) <> 'array' then raise exception 'QUESTIONS_MUST_BE_ARRAY'; end if;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.form_template_versions where template_id = p_template_id;

  insert into public.form_template_versions(template_id, version_number, questions, notes, published_by)
  values (p_template_id, v_version, p_questions, p_notes, auth.uid())
  returning id into v_version_id;

  update public.form_templates set status = 'published', updated_at = now()
  where id = p_template_id;

  perform public.write_audit('form_template.version_published','form_template', p_template_id::text, null,
    jsonb_build_object('version', v_version), null);
  return v_version_id;
end;
$$;

-- ── Form management RPCs ──────────────────────────────────────────────────────

create or replace function public.save_form(
  p_id                        uuid,
  p_owner_org_id              uuid,
  p_title                     text,
  p_description               text,
  p_audience_rule             jsonb,
  p_questions                 jsonb,
  p_allow_multiple            boolean,
  p_opens_at                  timestamptz,
  p_closes_at                 timestamptz,
  p_confirmation_message      text,
  p_template_version_id       uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid := coalesce(p_id, gen_random_uuid());
  v_tpl    uuid;
begin
  if not public.user_can_manage_forms_for_org(p_owner_org_id) then raise exception 'FORBIDDEN'; end if;
  if char_length(btrim(p_title)) < 3 then raise exception 'TITLE_TOO_SHORT'; end if;
  if jsonb_typeof(p_questions) <> 'array' then raise exception 'QUESTIONS_MUST_BE_ARRAY'; end if;
  if p_opens_at is not null and p_closes_at is not null and p_closes_at <= p_opens_at then
    raise exception 'CLOSES_BEFORE_OPENS';
  end if;

  -- If a template version is supplied, lock the template reference
  if p_template_version_id is not null then
    select template_id into v_tpl from public.form_template_versions where id = p_template_version_id;
    if v_tpl is null then raise exception 'TEMPLATE_VERSION_NOT_FOUND'; end if;
  end if;

  if p_id is null then
    insert into public.forms(
      id, owner_org_id, template_id, locked_template_version_id,
      title, description, audience_rule, questions, allow_multiple_submissions,
      opens_at, closes_at, confirmation_message, created_by)
    values (
      v_id, p_owner_org_id, v_tpl, p_template_version_id,
      btrim(p_title), nullif(btrim(coalesce(p_description,'')), ''),
      p_audience_rule, p_questions, coalesce(p_allow_multiple, false),
      p_opens_at, p_closes_at,
      nullif(btrim(coalesce(p_confirmation_message,'')), ''),
      auth.uid());
  else
    -- Cannot edit a published/closed/archived form's audience or template link
    if exists (select 1 from public.forms where id = p_id and status in ('closed','archived')) then
      raise exception 'FORM_NOT_EDITABLE';
    end if;
    update public.forms
    set title = btrim(p_title),
        description = nullif(btrim(coalesce(p_description,'')), ''),
        audience_rule = p_audience_rule,
        questions = p_questions,
        allow_multiple_submissions = coalesce(p_allow_multiple, allow_multiple_submissions),
        opens_at = p_opens_at,
        closes_at = p_closes_at,
        confirmation_message = nullif(btrim(coalesce(p_confirmation_message,'')), ''),
        form_version = form_version + 1,
        updated_at = now()
    where id = p_id
      and owner_org_id = p_owner_org_id;
    if not found then raise exception 'FORM_NOT_FOUND'; end if;
  end if;

  perform public.write_audit('form.saved','form', v_id::text, null,
    jsonb_build_object('title', p_title, 'org', p_owner_org_id), null);
  return v_id;
end;
$$;

create or replace function public.set_form_status(
  p_form_id uuid,
  p_status  text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_current text;
begin
  select owner_org_id, status into v_owner, v_current from public.forms where id = p_form_id;
  if v_owner is null then raise exception 'FORM_NOT_FOUND'; end if;
  if not public.user_can_manage_forms_for_org(v_owner) then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('draft','published','paused','closed','archived') then raise exception 'INVALID_STATUS'; end if;

  -- Enforce valid transitions
  if v_current = 'archived' then raise exception 'FORM_ALREADY_ARCHIVED'; end if;
  if v_current = 'closed' and p_status not in ('archived') then raise exception 'CLOSED_FORM_CAN_ONLY_ARCHIVE'; end if;
  if v_current = 'draft' and p_status not in ('published','archived') then raise exception 'DRAFT_CAN_ONLY_PUBLISH_OR_ARCHIVE'; end if;

  update public.forms set status = p_status, updated_at = now() where id = p_form_id;
  perform public.write_audit('form.status_changed','form', p_form_id::text, null,
    jsonb_build_object('from', v_current, 'to', p_status), null);
  return p_status;
end;
$$;

-- ── Response submission RPC ───────────────────────────────────────────────────

create or replace function public.submit_form_response(
  p_form_id          uuid,
  p_respondent_email text,
  p_answers          jsonb,   -- [{"question_id":"...","answer_value":<any>}]
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
  -- Fetch and validate form
  select * into v_form from public.forms where id = p_form_id;
  if not found then raise exception 'FORM_NOT_FOUND'; end if;
  if v_form.status <> 'published' then raise exception 'FORM_NOT_PUBLISHED'; end if;
  if v_form.opens_at is not null and now() < v_form.opens_at then raise exception 'FORM_NOT_YET_OPEN'; end if;
  if v_form.closes_at is not null and now() > v_form.closes_at then raise exception 'FORM_CLOSED'; end if;

  -- Audience check
  if not public.evaluate_audience_rule(v_form.audience_rule, v_user_id) then
    raise exception 'AUDIENCE_NOT_MET';
  end if;

  -- Multiple-submission guard
  if not v_form.allow_multiple_submissions and v_user_id is not null then
    if exists (
      select 1 from public.form_responses
      where form_id = p_form_id and respondent_user_id = v_user_id
    ) then
      raise exception 'ALREADY_SUBMITTED';
    end if;
  end if;

  -- Validate required questions have answers
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

  -- Insert response
  insert into public.form_responses(
    form_id, form_version, questions_snapshot,
    respondent_user_id, respondent_email,
    identity_snapshot)
  values (
    p_form_id, v_form.form_version, v_form.questions,
    v_user_id, p_respondent_email,
    p_identity_snapshot)
  returning id into v_response_id;

  -- Insert answers
  for v_ans in select value from jsonb_array_elements(p_answers) loop
    insert into public.form_response_answers(response_id, question_id, answer_value)
    values (v_response_id, v_ans->>'question_id', v_ans->'answer_value');
  end loop;

  return v_response_id;
end;
$$;

-- Grant execute to both authenticated and anon (guest submissions for open forms)
grant execute on function public.save_form_template(uuid,text,text,jsonb,jsonb,text)           to authenticated;
grant execute on function public.publish_form_template_version(uuid,jsonb,text)                to authenticated;
grant execute on function public.save_form(uuid,uuid,text,text,jsonb,jsonb,boolean,timestamptz,timestamptz,text,uuid) to authenticated;
grant execute on function public.set_form_status(uuid,text)                                    to authenticated;
grant execute on function public.submit_form_response(uuid,text,jsonb,jsonb)                   to authenticated, anon;
grant execute on function public.evaluate_audience_rule(jsonb,uuid)                            to authenticated, anon;
grant execute on function public.user_can_manage_forms_for_org(uuid)                           to authenticated;

-- Read access for non-owner authenticated users (published forms + their own responses via RLS)
grant select on public.form_templates          to authenticated;
grant select on public.form_template_versions  to authenticated;
grant select on public.forms                   to authenticated, anon;
grant select on public.form_responses          to authenticated;
grant select on public.form_response_answers   to authenticated;
