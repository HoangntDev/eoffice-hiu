create or replace function public.save_reference_option(
  p_category text,
  p_code text,
  p_label text,
  p_source_note text,
  p_is_active boolean,
  p_valid_from date,
  p_valid_to date,
  p_role_grant_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not (public.has_active_role('school_admin') or public.has_active_role('office')) then raise exception 'FORBIDDEN'; end if;
  if p_category not in ('education_level','specialization','political_theory','it_level','foreign_language','occupation') then raise exception 'INVALID_CATEGORY'; end if;
  if char_length(btrim(p_code)) < 1 or char_length(btrim(p_label)) < 1 or char_length(btrim(p_source_note)) < 5 then raise exception 'SOURCE_REQUIRED'; end if;
  insert into public.reference_options(category,code,label,is_active,valid_from,valid_to,source_note)
  values(p_category,upper(btrim(p_code)),btrim(p_label),p_is_active,p_valid_from,p_valid_to,btrim(p_source_note))
  on conflict(category,code) do update set label=excluded.label,is_active=excluded.is_active,
    valid_from=excluded.valid_from,valid_to=excluded.valid_to,source_note=excluded.source_note
  returning id into v_id;
  perform public.write_audit('reference_option.saved','reference_option',v_id::text,null,
    jsonb_build_object('category',p_category,'code',p_code,'label',p_label,'source',p_source_note),p_role_grant_id);
  return v_id;
end;
$$;

grant execute on function public.save_reference_option(text,text,text,text,boolean,date,date,uuid) to authenticated;
