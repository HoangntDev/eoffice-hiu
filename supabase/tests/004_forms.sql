-- pgTAP tests for Prompt 02: forms schema, audience validation, and permission model
-- Run with: supabase test db

begin;
select plan(14);

-- ── Setup: create test accounts and roles ─────────────────────────────────────

-- school_admin (Đoàn Trường)
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'admin@test.local'),
  ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'student@test.local'),
  ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'committee@test.local')
on conflict do nothing;

insert into public.accounts (user_id, student_code, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, '2000000001', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, '2000000002', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, '2000000003', 'active')
on conflict do nothing;

insert into public.role_grants (user_id, role_code, organization_id, granted_by, reason) values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'school_admin',
   '00000000-0000-4000-8000-000000000001'::uuid,
   'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'Bootstrap'),
  ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'committee_manager',
   '00000000-0000-4000-8000-000000000003'::uuid,
   'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'Test setup')
on conflict do nothing;

-- ── 1. audience validation: any ───────────────────────────────────────────────
select ok(
  public.evaluate_audience_rule('{"type":"any"}'::jsonb, null),
  'audience "any" passes for anonymous user'
);

select ok(
  public.evaluate_audience_rule('{"type":"any"}'::jsonb, 'aaaaaaaa-0000-4000-8000-000000000002'::uuid),
  'audience "any" passes for authenticated user'
);

-- ── 2. audience validation: hiu_student ──────────────────────────────────────
select ok(
  public.evaluate_audience_rule('{"type":"hiu_student"}'::jsonb, 'aaaaaaaa-0000-4000-8000-000000000002'::uuid),
  'audience "hiu_student" passes for active account'
);

select ok(
  not public.evaluate_audience_rule('{"type":"hiu_student"}'::jsonb, null),
  'audience "hiu_student" denies anonymous'
);

-- ── 3. audience validation: union_member ──────────────────────────────────────
select ok(
  not public.evaluate_audience_rule('{"type":"union_member"}'::jsonb, 'aaaaaaaa-0000-4000-8000-000000000002'::uuid),
  'audience "union_member" denies student without recognized membership'
);

-- ── 4. audience validation: and / or ─────────────────────────────────────────
select ok(
  public.evaluate_audience_rule(
    '{"type":"or","conditions":[{"type":"hiu_student"},{"type":"any"}]}'::jsonb,
    'aaaaaaaa-0000-4000-8000-000000000002'::uuid),
  'audience "or" passes when first condition matches'
);

select ok(
  not public.evaluate_audience_rule(
    '{"type":"and","conditions":[{"type":"hiu_student"},{"type":"union_member"}]}'::jsonb,
    'aaaaaaaa-0000-4000-8000-000000000002'::uuid),
  'audience "and" denies when second condition fails'
);

-- ── 5. user_can_manage_forms_for_org ─────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select ok(
  public.user_can_manage_forms_for_org('00000000-0000-4000-8000-000000000001'::uuid),
  'school_admin can manage forms for school_union org'
);

set local "request.jwt.claims" to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select ok(
  not public.user_can_manage_forms_for_org('00000000-0000-4000-8000-000000000001'::uuid),
  'plain student cannot manage forms for school_union org'
);

-- ── 6. save_form_template: only school_admin ─────────────────────────────────
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($$
  select public.save_form_template(
    null, 'Mẫu kiểm tra', 'Mô tả', '{"type":"hiu_student"}'::jsonb, '[]'::jsonb, 'draft')
$$, 'school_admin can create form template');

set local "request.jwt.claims" to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_like($$
  select public.save_form_template(
    null, 'Mẫu không hợp lệ', null, '{"type":"hiu_student"}'::jsonb, '[]'::jsonb, 'draft')
$$, '%FORBIDDEN%', 'non-school_admin cannot create template');

-- ── 7. save_form: committee_manager can manage their org ─────────────────────
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$
  select public.save_form(
    null,
    '00000000-0000-4000-8000-000000000003'::uuid,
    'Biểu mẫu Ban TC-KT',
    null,
    '{"type":"hiu_student"}'::jsonb,
    '[]'::jsonb,
    false, null, null, null, null)
$$, 'committee_manager can create form for their org');

set local "request.jwt.claims" to '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_like($$
  select public.save_form(
    null,
    '00000000-0000-4000-8000-000000000001'::uuid,
    'Biểu mẫu trái phép',
    null,
    '{"type":"hiu_student"}'::jsonb,
    '[]'::jsonb,
    false, null, null, null, null)
$$, '%FORBIDDEN%', 'committee_manager cannot create form for unrelated org');

-- ── 8. direct insert into form_responses is revoked ──────────────────────────
set local "request.jwt.claims" to '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$
  insert into public.form_responses(form_id, form_version, questions_snapshot)
  values (gen_random_uuid(), 1, '[]'::jsonb)
$$, null, null, 'direct insert into form_responses is denied');

select * from finish();
rollback;
