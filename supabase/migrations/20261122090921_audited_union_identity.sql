-- Chủ hồ sơ đọc trực tiếp. Cán bộ phải đọc qua RPC để việc đọc và audit cùng giao dịch.
alter policy union_identity_read_scoped on public.union_identity_details using (
  exists (select 1 from public.union_applications a
          where a.id = application_id and a.user_id = (select auth.uid()))
);

create function public.read_union_identity_for_review(p_application_id uuid)
returns public.union_identity_details
language plpgsql security definer set search_path = ''
as $$
declare
  v_grant public.role_grants%rowtype;
  v_identity public.union_identity_details%rowtype;
begin
  select g.* into v_grant
  from public.role_grants g
  join public.accounts actor on actor.user_id = g.user_id and actor.status = 'active'
  join public.union_applications a on a.id = p_application_id and a.status <> 'draft'
  where g.user_id = auth.uid() and g.revoked_at is null and (
    (g.role_code in ('office', 'school_admin')
      and public.management_account_allowed()
      and public.management_officer_has_role(g.role_code, g.organization_id))
    or (g.role_code = 'collaborator' and actor.account_type = 'student' and exists (
      select 1 from public.membership_application_assignments m
      where m.application_id = a.id and m.collaborator_user_id = g.user_id
        and m.organization_id = g.organization_id
    ))
  )
  order by g.granted_at, g.id limit 1;
  if not found then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select * into strict v_identity from public.union_identity_details where application_id = p_application_id;
  perform public.write_audit('union_application.identity_viewed', 'union_application', p_application_id::text,
    null, null, v_grant.id, v_grant.organization_id);
  return v_identity;
end;
$$;

revoke all on function public.read_union_identity_for_review(uuid) from public, anon;
grant execute on function public.read_union_identity_for_review(uuid) to authenticated;

-- Một mã câu hỏi có thể được đổi nhãn sau khi đã có phản hồi.
-- Cả hai đường xuất CSV dùng chung danh sách cột đã đối chiếu với bản chụp lúc nộp.
create function public.form_csv_questions(p_form_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_form public.forms%rowtype;
begin
  select * into v_form from public.forms where id = p_form_id;
  if not found or auth.uid() is null or not (
    public.user_can_manage_forms_for_org(v_form.owner_org_id) or public.has_active_role('school_admin')
    or exists (select 1 from public.program_registration_settings s where s.form_id = p_form_id
      and public.program_registration_manager_grant(s.program_id) is not null)
  ) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  return (
    with versions as (
      select v_form.questions as questions
      union
      select r.questions_snapshot from public.form_responses r where r.form_id = p_form_id
    ), private_ids as (
      select distinct q->>'id' as id from versions v, lateral jsonb_array_elements(v.questions) q
      where concat_ws(' ', q->>'id', q->>'label', q->>'prefill_from') ~*
        '(cccd|cmnd|căn[ _-]*cước|can[ _-]*cuoc|chứng minh (nhân dân|thư)|t[oô]n[ _-]*gi[aá]o|religion|citizen[ _-]*id|national[ _-]*id)'
    )
    select coalesce(jsonb_agg(q order by pos), '[]'::jsonb)
    from jsonb_array_elements(v_form.questions) with ordinality as current_question(q,pos)
    where not exists (select 1 from private_ids where id = q->>'id')
  );
end;
$$;
revoke all on function public.form_csv_questions(uuid) from public, anon;
grant execute on function public.form_csv_questions(uuid) to authenticated;
