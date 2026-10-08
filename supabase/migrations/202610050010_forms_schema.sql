-- Migration 010: Forms and dynamic template library (Prompt 02)
--
-- Design rationale:
-- - form_templates: Đoàn Trường manages master templates with audience_rule and questions.
-- - form_template_versions: immutable snapshots; publishing freezes questions for record-keeping.
-- - forms: any authorised org unit creates a form (standalone or from a template version).
--   Questions are stored as jsonb so the builder can edit freely; the snapshot is taken at
--   submission time, not at publish time, matching Google Forms behaviour.
-- - form_responses + form_response_answers: one row per submission; answers keyed by stable
--   question_id strings so history survives question label edits.
--
-- Audience rule jsonb format:
--   {"type":"any"} | {"type":"hiu_student"} | {"type":"faculty","faculty_id":"<uuid>"}
--   {"type":"union_member"} | {"type":"and","conditions":[...]} | {"type":"or","conditions":[...]}
--
-- Question jsonb array element:
--   { "id":"<uuid-str>", "type":"short_text|long_text|number|date|single_choice|multi_choice|dropdown",
--     "label":"...", "description":"...", "required":true,  "order":1,
--     "options":[{"id":"<uuid-str>","label":"...","order":1}],
--     "validation":{"minLength":1,"maxLength":500,"min":0,"max":100,"format":"email"|"phone"},
--     "prefill_from":"profile.full_name"|"profile.student_code"|null,
--     "base_question":true }   -- true when locked from template

-- Template library managed by Đoàn Trường (school_admin role)
create table if not exists public.form_templates (
  id          uuid    primary key default gen_random_uuid(),
  title       text    not null check (char_length(btrim(title)) between 3 and 200),
  description text    check (description is null or char_length(btrim(description)) <= 2000),
  audience_rule jsonb not null default '{"type":"hiu_student"}'::jsonb,
  status      text    not null default 'draft'
                check (status in ('draft','published','deprecated')),
  created_by  uuid    not null references public.accounts(user_id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Immutable version snapshots (published once, never mutated)
create table if not exists public.form_template_versions (
  id              uuid    primary key default gen_random_uuid(),
  template_id     uuid    not null references public.form_templates(id) on delete restrict,
  version_number  int     not null check (version_number >= 1),
  questions       jsonb   not null default '[]'::jsonb,
  notes           text,
  published_at    timestamptz not null default now(),
  published_by    uuid    not null references public.accounts(user_id) on delete restrict,
  constraint uq_template_version unique (template_id, version_number)
);

-- Form instance (standalone or derived from a template version)
create table if not exists public.forms (
  id                        uuid    primary key default gen_random_uuid(),
  owner_org_id              uuid    not null references public.organization_units(id) on delete restrict,
  template_id               uuid    references public.form_templates(id) on delete restrict,
  locked_template_version_id uuid   references public.form_template_versions(id) on delete restrict,
  title                     text    not null check (char_length(btrim(title)) between 3 and 200),
  description               text    check (description is null or char_length(btrim(description)) <= 2000),
  audience_rule             jsonb   not null default '{"type":"hiu_student"}'::jsonb,
  questions                 jsonb   not null default '[]'::jsonb,
  allow_multiple_submissions bool    not null default false,
  opens_at                  timestamptz,
  closes_at                 timestamptz,
  confirmation_message      text    check (confirmation_message is null or char_length(btrim(confirmation_message)) <= 500),
  form_version              int     not null default 1 check (form_version >= 1),
  status                    text    not null default 'draft'
                              check (status in ('draft','published','paused','closed','archived')),
  created_by                uuid    not null references public.accounts(user_id) on delete restrict,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check (opens_at is null or closes_at is null or closes_at > opens_at)
);

-- Response submission (one row per fill-and-submit action)
create table if not exists public.form_responses (
  id                  uuid    primary key default gen_random_uuid(),
  form_id             uuid    not null references public.forms(id) on delete restrict,
  form_version        int     not null,
  questions_snapshot  jsonb   not null,   -- copy of forms.questions at submission time
  respondent_user_id  uuid    references public.accounts(user_id) on delete restrict,
  respondent_email    text    check (respondent_email is null
                                or respondent_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  submitted_at        timestamptz not null default now(),
  identity_snapshot   jsonb       -- profile fields prefilled at submission time
);

-- Per-question answers keyed by stable question_id string
create table if not exists public.form_response_answers (
  id            uuid    primary key default gen_random_uuid(),
  response_id   uuid    not null references public.form_responses(id) on delete cascade,
  question_id   text    not null,
  answer_value  jsonb
);

create index if not exists form_responses_form_submitted_idx
  on public.form_responses (form_id, submitted_at desc);
create index if not exists form_responses_respondent_idx
  on public.form_responses (respondent_user_id) where respondent_user_id is not null;
create index if not exists form_response_answers_response_idx
  on public.form_response_answers (response_id);
create index if not exists forms_owner_status_idx
  on public.forms (owner_org_id, status);
create index if not exists forms_template_idx
  on public.forms (template_id) where template_id is not null;
