-- Đổi email xác thực tài khoản từ Gmail sang email sinh viên HIU (@student.hiu.vn).
--
-- Quyết định của người dùng ngày 13/10/2026, thay quy tắc "một Gmail đã xác thực" ở Prompt 01.
-- UI/schema (src/modules/auth-account/schemas.ts) đã yêu cầu @student.hiu.vn từ 09–10/10 nhưng
-- DB vẫn chỉ nhận @gmail.com, khiến đăng ký qua UI luôn bị từ chối. Migration này đồng bộ DB.
--
-- Ràng buộc mới dùng NOT VALID: chỉ kiểm tra dòng thêm/sửa từ nay; tài khoản Gmail đã có
-- (dữ liệu test local) vẫn đăng nhập được. Ở DB tạo mới không có dòng Gmail nào.
-- Tên cột/tham số "gmail" giữ nguyên để không phải đổi API/RPC (xem alias gmailSchema).

alter table public.account_emails drop constraint if exists account_emails_gmail;
alter table public.account_emails drop constraint if exists account_emails_student_email;
alter table public.account_emails add constraint account_emails_student_email
  check (email::text ~* '^[^@[:space:]]+@student\.hiu\.vn$') not valid;

alter table public.email_change_requests drop constraint if exists email_change_requests_gmail;
alter table public.email_change_requests drop constraint if exists email_change_requests_student_email;
alter table public.email_change_requests add constraint email_change_requests_student_email
  check (requested_email::text ~* '^[^@[:space:]]+@student\.hiu\.vn$') not valid;

alter table public.pending_account_registrations drop constraint if exists pending_registration_gmail;
alter table public.pending_account_registrations drop constraint if exists pending_registration_student_email;
alter table public.pending_account_registrations add constraint pending_registration_student_email
  check (gmail::text ~* '^[^@[:space:]]+@student\.hiu\.vn$') not valid;

-- Phần số của email phải khớp MSSV: 3 chữ số đầu + 4 chữ số cuối (cùng quy tắc với registerSchema).
create or replace function public.reserve_account_registration(
  p_student_code text,
  p_gmail citext
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_valid_student_code(p_student_code, current_date)
    or p_gmail::text !~* '^[^@[:space:]]+@student\.hiu\.vn$'
    or split_part(lower(p_gmail::text), '@', 1) not like
         '%' || substr(p_student_code, 1, 3) || substr(p_student_code, 7) then
    return false;
  end if;

  delete from public.pending_account_registrations
  where consumed_at is null and expires_at <= now();

  if exists (select 1 from public.accounts where student_code = p_student_code)
    or exists (select 1 from public.account_emails where email = p_gmail)
    or exists (
      select 1 from public.pending_account_registrations
      where consumed_at is null and (student_code = p_student_code or gmail = p_gmail)
    ) then
    return false;
  end if;

  insert into public.pending_account_registrations(student_code, gmail)
  values (p_student_code, lower(p_gmail::text)::citext);
  return true;
exception
  when unique_violation then return false;
end;
$$;

comment on table public.account_emails is 'Private student-email (@student.hiu.vn) mapping. Never expose through broad profile/list endpoints.';
