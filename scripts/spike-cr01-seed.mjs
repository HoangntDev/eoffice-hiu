// SPIKE CR-01 (#37), không merge. Bước 0: dựng hiện trạng TRƯỚC migration 202610300003 —
// vai trò quản lý đang gắn với tài khoản cá nhân. Ghi id vào .spike-fixture.json cho spike-cr01.mjs.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL_?.includes(":573")) throw new Error("Chỉ chạy trên stack spike (cổng 573xx).");
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const psql = (sql) => execFileSync("docker", ["exec", "-i", "supabase_db_eoffice-cr01-spike", "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql }).toString().trim();
const PIN = "123456";

async function student(code) {
  const email = `${code.slice(0, 3)}${code.slice(-4)}@student.hiu.vn`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PIN, email_confirm: true });
  if (error) throw error;
  psql(`insert into public.accounts(user_id, student_code, status) values ('${data.user.id}', '${code}', 'active');
        insert into public.account_emails(user_id, email, verified_at) values ('${data.user.id}', '${email}', now());`);
  return { id: data.user.id, code };
}
const faculty = psql(`insert into public.faculties(current_code, current_name) values ('SPK', 'Khoa Spike CR-01') returning id;`).split("\n")[0];
const facultyOrg = psql(`select id from public.organization_units where faculty_id = '${faculty}' and unit_type = 'faculty_union';`);
const faculty2 = psql(`insert into public.faculties(current_code, current_name) values ('SPKB', 'Khoa Spike 2') returning id;`).split("\n")[0];
const facultyOrg2 = psql(`select id from public.organization_units where faculty_id = '${faculty2}' and unit_type = 'faculty_union';`);
const SCHOOL = "00000000-0000-4000-8000-000000000001", OFFICE = "00000000-0000-4000-8000-000000000002", BAN = "00000000-0000-4000-8000-000000000003";
const s = {
  a: await student("9990000001"), // Bí thư Đoàn Khoa + cán bộ Văn phòng (kiểm tra tự duyệt)
  b: await student("9990000002"), // cán bộ Văn phòng
  c: await student("9990000003"), // Ban chấp hành Đoàn Khoa
  d: await student("9990000004"), // sinh viên, không vai trò
  e: await student("9990000005"), // quản trị Đoàn Trường
  x: await student("9990000006"), // CTV Ban TC-KT (giữ ở tài khoản cá nhân)
};
psql(`insert into public.role_grants(user_id, role_code, organization_id, reason) values
  ('${s.a.id}', 'faculty_manager', '${facultyOrg}', 'spike: Bí thư'), ('${s.a.id}', 'office', '${OFFICE}', 'spike: cán bộ VP'),
  ('${s.b.id}', 'office', '${OFFICE}', 'spike: cán bộ VP'), ('${s.c.id}', 'faculty_executive', '${facultyOrg}', 'spike: BCH'),
  ('${s.e.id}', 'school_admin', '${SCHOOL}', 'spike: quản trị'), ('${s.x.id}', 'collaborator', '${BAN}', 'spike: CTV');`);
const fixture = { facultyOrg, facultyOrg2, SCHOOL, OFFICE, BAN, people: s,
  before: psql(`select count(*) from public.role_grants where revoked_at is null;`) };
writeFileSync(".spike-fixture.json", JSON.stringify(fixture, null, 2));
console.log(`Hiện trạng trước migration: ${fixture.before} role_grants còn hiệu lực, tất cả trên tài khoản cá nhân.`);
