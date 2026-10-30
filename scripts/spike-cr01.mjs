// SPIKE CR-01-TaiKhoanToChuc (#37). Không merge. Chạy trên stack tách biệt eoffice-cr01-spike:
//   APP=http://localhost:3401 node scripts/spike-cr01.mjs
// Cần .env.local của worktree trỏ tới stack spike (cổng 573xx). Mọi MSSV/email là dữ liệu giả (999…).
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP ?? "http://localhost:3401";
const DB = "supabase_db_eoffice-cr01-spike";
if (!URL_?.includes(":573")) throw new Error("Chỉ chạy trên stack spike (cổng 573xx).");

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const psql = (sql) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql }).toString().trim();
const results = [];
const check = (id, pass, detail) => { results.push({ id, pass }); console.log(`[${id}] ${pass ? "PASS" : "FAIL"} – ${detail}`); };

// ── Dữ liệu giả ────────────────────────────────────────────────────────────
const ORG_PIN = "246810", PIN = "123456";
async function makeStaff(code) {
  const email = `${code.slice(0, 3)}${code.slice(-4)}@student.hiu.vn`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PIN, email_confirm: true });
  if (error) throw error;
  psql(`insert into public.accounts(user_id, student_code, status) values ('${data.user.id}', '${code}', 'active');
        insert into public.account_emails(user_id, email, verified_at) values ('${data.user.id}', '${email}', now());`);
  return { id: data.user.id, code, email };
}
const RUN = Date.now().toString().slice(-6); // mỗi lần chạy một bộ mã riêng, chạy lại không trùng
const facultyId = psql(`insert into public.faculties(current_code, current_name) values ('SPK${RUN}', 'Khoa Spike CR-01') returning id;`).split("\n")[0];
const facultyOrg = psql(`select id from public.organization_units where faculty_id = '${facultyId}' and unit_type = 'faculty_union';`);
const otherFacultyId = psql(`insert into public.faculties(current_code, current_name) values ('SPKB${RUN}', 'Khoa Spike 2') returning id;`).split("\n")[0];
const otherOrg = psql(`select id from public.organization_units where faculty_id = '${otherFacultyId}' and unit_type = 'faculty_union';`);
const OFFICE = "00000000-0000-4000-8000-000000000002";
const a = await makeStaff(`999${RUN}1`); // Đoàn Khoa + Văn phòng (kiểm tra tự duyệt)
const b = await makeStaff(`999${RUN}2`); // Văn phòng
const c = await makeStaff(`999${RUN}3`); // không có vai trò
psql(`insert into public.role_grants(user_id, role_code, organization_id, reason) values
  ('${a.id}', 'faculty_manager', '${facultyOrg}', 'spike'), ('${a.id}', 'office', '${OFFICE}', 'spike'),
  ('${b.id}', 'office', '${OFFICE}', 'spike');
  insert into public.organization_accounts(organization_id, pin_hash) values
  ('${facultyOrg}', extensions.crypt('${ORG_PIN}', extensions.gen_salt('bf', 10))),
  ('${otherOrg}',   extensions.crypt('${ORG_PIN}', extensions.gen_salt('bf', 10))),
  ('${OFFICE}',     extensions.crypt('${ORG_PIN}', extensions.gen_salt('bf', 10))) on conflict (organization_id) do nothing;`);

// ── Trợ giúp HTTP ──────────────────────────────────────────────────────────
let ipSeq = 0;
async function post(path, body, { cookie, ip } = {}) {
  const t0 = performance.now();
  const res = await fetch(APP + path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip ?? `10.99.0.${++ipSeq}`, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const ms = performance.now() - t0;
  const cookies = res.headers.getSetCookie().map((v) => v.split(";")[0]).filter((v) => !v.endsWith("="));
  return { status: res.status, json: await res.json().catch(() => null), cookie: cookies.join("; "), ms };
}
// Lấy access token từ cookie Supabase SSR (base64-<json>, có thể tách .0/.1).
function tokenFromCookie(cookie) {
  const parts = cookie.split("; ").filter((p) => p.includes("-auth-token")).sort();
  const raw = parts.map((p) => decodeURIComponent(p.slice(p.indexOf("=") + 1))).join("");
  return JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64").toString("utf8")).access_token;
}
const asToken = (token) => createClient(URL_, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${token}` } },
});
const sessionOf = (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).session_id;
const orgLogin = (org, staff, overrides = {}, ip) =>
  post("/api/admin/login", { organizationId: org, organizationPin: ORG_PIN, studentCode: staff.code, pin: PIN, ...overrides }, { ip });
const programArgs = (org, title) => ({
  p_id: null, p_owner_org_id: org, p_title: title, p_summary: "Tóm tắt spike", p_location: "Hội trường",
  p_starts_at: "2026-11-20T01:00:00Z", p_ends_at: "2026-11-20T04:00:00Z", p_expected_participants: 50,
  p_plan_number: "01-KH/SPK", p_plan_signed_on: "2026-10-30", p_request_id: null,
});

// ── S1. Đăng nhập tổ chức tạo phiên ────────────────────────────────────────
const timings = [];
const login = await orgLogin(facultyOrg, a); timings.push(login.ms);
const orgToken = login.status === 200 ? tokenFromCookie(login.cookie) : null;
const orgSession = orgToken ? sessionOf(orgToken) : null;
const row = orgSession ? psql(`select organization_id || '|' || staff_user_id from public.organization_sessions where session_id = '${orgSession}';`) : "";
check("S1", login.status === 200 && row === `${facultyOrg}|${a.id}`, `HTTP ${login.status}; organization_sessions(${orgSession}) = ${row || "không có"}`);

// ── S2. RPC nhận đúng đơn vị + cán bộ ──────────────────────────────────────
const orgClient = asToken(orgToken);
const { data: cur } = await orgClient.rpc("current_org_unit_id");
const { data: programId, error: createErr } = await orgClient.rpc("save_event_program", programArgs(facultyOrg, "Chương trình spike CR-01"));
const hist = programId ? psql(`select actor_user_id from public.event_program_history where program_id = '${programId}' and action = 'created';`) : "";
check("S2", cur === facultyOrg && !createErr && hist === a.id,
  `current_org_unit_id = ${cur === facultyOrg ? "Đoàn Khoa đã chọn" : cur}; save_event_program ${createErr ? "lỗi " + createErr.message : "OK"}; history.actor = ${hist === a.id ? "cán bộ A" : hist}`);
const { error: otherErr } = await orgClient.rpc("save_event_program", programArgs(otherOrg, "Chương trình khoa khác"));
check("S2b", otherErr?.message === "FORBIDDEN", `phiên Đoàn Khoa A tạo chương trình cho Đoàn Khoa khác → ${otherErr?.message ?? "OK (sai)"}`);

// ── S3. Tài khoản cá nhân bị chặn (cùng cán bộ, phiên cá nhân) ─────────────
const personal = await post("/api/auth/login", { studentCode: a.code, pin: PIN });
const personalClient = asToken(tokenFromCookie(personal.cookie));
const { error: pErr } = await personalClient.rpc("save_event_program", programArgs(facultyOrg, "Tạo bằng tài khoản cá nhân"));
const { data: pCur } = await personalClient.rpc("current_org_unit_id");
const { data: pHasOffice } = await personalClient.rpc("has_active_role", { p_role_code: "office" });
const apiPersonal = await post("/api/event-programs", { ownerOrgId: facultyOrg, title: "Gọi thẳng API bằng phiên cá nhân" }, { cookie: personal.cookie });
check("S3", personal.status === 200 && pErr?.message === "FORBIDDEN" && pCur === null && pHasOffice === false && apiPersonal.status === 403,
  `login cá nhân ${personal.status}; RPC save_event_program → ${pErr?.message}; current_org_unit_id = ${pCur}; has_active_role('office') = ${pHasOffice}; POST /api/event-programs → ${apiPersonal.status}`);

// ── S4. Audit ghi đủ đơn vị + cán bộ + phiên ───────────────────────────────
const audit = programId ? psql(`select actor_user_id || '|' || organization_id || '|' || acting_organization_id || '|' || organization_session_id
  from public.audit_events where action = 'event_program.created' and target_id = '${programId}';`) : "";
check("S4", audit === `${a.id}|${facultyOrg}|${facultyOrg}|${orgSession}`, `audit_events = actor cán bộ A | đơn vị | đơn vị thao tác | phiên tổ chức: ${audit ? "đủ" : "thiếu"} (${audit})`);
const startAudit = psql(`select count(*) from public.audit_events where action = 'organization_session.started' and organization_session_id = '${orgSession}';`);
check("S4b", startAudit === "1", `audit 'organization_session.started' cho phiên: ${startAudit}`);

// ── S5. Người lập không tự duyệt, xét theo cán bộ ──────────────────────────
const docPath = `${programId}/${crypto.randomUUID()}.pdf`;
psql(`insert into storage.objects(bucket_id, name) values ('event-program-plans', '${docPath}');`);
const { error: attErr } = await orgClient.rpc("attach_event_program_document", { p_program_id: programId, p_storage_path: docPath, p_file_name: "kh.pdf", p_size_bytes: 1000, p_sha256: "0".repeat(64), p_request_id: null });
const { error: subErr } = await orgClient.rpc("submit_event_program", { p_program_id: programId, p_request_id: null });
const officeA = await orgLogin(OFFICE, a); timings.push(officeA.ms);
const { error: selfErr } = await asToken(tokenFromCookie(officeA.cookie)).rpc("review_event_program", { p_program_id: programId, p_decision: "approve", p_reason: null, p_request_id: null });
const { error: personalReviewErr } = await asToken(tokenFromCookie((await post("/api/auth/login", { studentCode: b.code, pin: PIN })).cookie))
  .rpc("review_event_program", { p_program_id: programId, p_decision: "approve", p_reason: null, p_request_id: null });
const officeB = await orgLogin(OFFICE, b); timings.push(officeB.ms);
const { data: reviewed, error: bErr } = await asToken(tokenFromCookie(officeB.cookie)).rpc("review_event_program", { p_program_id: programId, p_decision: "approve", p_reason: null, p_request_id: null });
check("S5", !attErr && !subErr && selfErr?.message === "SELF_REVIEW_FORBIDDEN" && personalReviewErr?.message === "FORBIDDEN" && !bErr,
  `nộp ${attErr?.message ?? subErr?.message ?? "OK"}; A (phiên Văn phòng) duyệt → ${selfErr?.message}; B phiên cá nhân → ${personalReviewErr?.message}; B phiên Văn phòng → ${bErr?.message ?? reviewed}`);

// ── S6. Lỗi chung cho mọi thông tin sai ────────────────────────────────────
const cases = {
  "sai PIN tổ chức": await orgLogin(facultyOrg, a, { organizationPin: "000000" }),
  "sai MSSV": await orgLogin(facultyOrg, a, { studentCode: `999${RUN}9` }),
  "sai PIN cá nhân": await orgLogin(facultyOrg, a, { pin: "654321" }),
  "cán bộ không thuộc đơn vị": await orgLogin(facultyOrg, b),
  "không có vai trò": await orgLogin(facultyOrg, c),
};
const msgs = new Set(Object.values(cases).map((r) => `${r.status} ${r.json?.message}`));
check("S6", msgs.size === 1 && [...msgs][0].startsWith("401"), `${Object.keys(cases).length} tình huống → ${msgs.size} thông báo: ${[...msgs].join(" / ")}`);
const leaked = psql(`select count(*) from public.organization_sessions where staff_user_id in ('${b.id}', '${c.id}') and organization_id = '${facultyOrg}';`);
check("S6b", leaked === "0", `phiên tổ chức tạo cho tình huống sai: ${leaked}`);

// ── S7. Khóa tạm PIN tổ chức: 5 lần sai / 15 phút theo đơn vị + IP ──────────
const ip = "10.98.0.1";
const wrong = [];
for (let i = 0; i < 5; i++) wrong.push((await orgLogin(otherOrg, a, { organizationPin: "111111" }, ip)).status);
const sixth = await orgLogin(otherOrg, a, {}, ip);
const otherIp = await orgLogin(otherOrg, a, { organizationPin: "111111" }, "10.98.0.2");
const otherUnit = await orgLogin(facultyOrg, a, {}, ip);
check("S7", wrong.every((s) => s === 401) && sixth.status === 429 && otherIp.status === 401 && otherUnit.status === 200,
  `5 lần sai → ${wrong.join(",")}; lần 6 PIN đúng → ${sixth.status}; IP khác → ${otherIp.status}; đơn vị khác cùng IP → ${otherUnit.status}`);

// ── S8. DB chặn tài khoản Chi đoàn và Ban ──────────────────────────────────
// Thêm lớp thì trigger sync_class_organization_unit tự tạo Chi đoàn.
const classUnit = psql(`with p as (insert into public.programs(current_code, current_name, current_faculty_id) values ('SPKP${RUN}', 'Ngành spike', '${facultyId}') returning id),
  co as (insert into public.cohorts(code, display_name) values ('SPKK${RUN}', 'Khóa spike') returning id)
  insert into public.classes(current_code, current_name, current_program_id, current_cohort_id) select 'SPKL${RUN}', 'Lớp spike', p.id, co.id from p, co returning id;
  select ou.id from public.organization_units ou join public.classes c on c.id = ou.class_id where c.current_code = 'SPKL${RUN}';`).split("\n").pop() || null;
let classErr = "không có lớp để thử";
if (classUnit) { try { psql(`insert into public.organization_accounts(organization_id, pin_hash) values ('${classUnit}', 'x');`); classErr = "cho phép (sai)"; } catch (e) { classErr = /ORG_ACCOUNT_UNIT_NOT_ALLOWED/.test(String(e.stderr)) ? "ORG_ACCOUNT_UNIT_NOT_ALLOWED" : String(e.stderr); } }
let committeeErr;
try { psql(`insert into public.organization_accounts(organization_id, pin_hash) values ('00000000-0000-4000-8000-000000000003', 'x');`); committeeErr = "cho phép (sai)"; } catch (e) { committeeErr = /ORG_ACCOUNT_UNIT_NOT_ALLOWED/.test(String(e.stderr)) ? "ORG_ACCOUNT_UNIT_NOT_ALLOWED" : String(e.stderr); }
check("S8", committeeErr === "ORG_ACCOUNT_UNIT_NOT_ALLOWED" && (classErr === "ORG_ACCOUNT_UNIT_NOT_ALLOWED" || classErr === "không có lớp để thử"),
  `Chi đoàn → ${classErr}; Ban (school_committee) → ${committeeErr}`);

// ── S9. Đăng xuất/khóa tài khoản tổ chức làm mất quyền ngay ────────────────
psql(`update public.organization_accounts set status = 'locked' where organization_id = '${facultyOrg}';`);
const { error: lockedErr } = await orgClient.rpc("save_event_program", programArgs(facultyOrg, "Sau khi khóa tài khoản tổ chức"));
psql(`update public.organization_accounts set status = 'active' where organization_id = '${facultyOrg}';`);
await post("/api/auth/logout", {}, { cookie: login.cookie });
const { error: afterLogout } = await orgClient.rpc("save_event_program", programArgs(facultyOrg, "Sau khi đăng xuất"));
check("S9", lockedErr?.message === "FORBIDDEN" && afterLogout?.message === "FORBIDDEN",
  `token cũ sau khi khóa tài khoản tổ chức → ${lockedErr?.message}; sau đăng xuất → ${afterLogout?.message}`);

// ── S10. Làm mới token (refresh) giữ session_id, phiên tổ chức còn hiệu lực ─
const fresh = await orgLogin(OFFICE, b);
const freshParts = fresh.cookie.split("; ").filter((p) => p.includes("-auth-token")).sort();
const freshSession = JSON.parse(Buffer.from(freshParts.map((p) => decodeURIComponent(p.slice(p.indexOf("=") + 1))).join("").replace(/^base64-/, ""), "base64").toString("utf8"));
const refresher = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: refreshed, error: refreshErr } = await refresher.auth.refreshSession({ refresh_token: freshSession.refresh_token });
const { data: afterRefresh } = await asToken(refreshed.session.access_token).rpc("current_org_unit_id");
check("S10", !refreshErr && sessionOf(refreshed.session.access_token) === sessionOf(freshSession.access_token) && afterRefresh === OFFICE,
  `session_id trước/sau refresh: ${sessionOf(freshSession.access_token) === sessionOf(refreshed.session.access_token) ? "giống nhau" : "khác"}; current_org_unit_id sau refresh = ${afterRefresh === OFFICE ? "Văn phòng" : afterRefresh}`);

// ── S11. Chi phí kiểm phiên: 10.000 lần gọi has_active_role, so với thân hàm trước CR ─
const claims = JSON.stringify({ sub: b.id, role: "authenticated", session_id: sessionOf(refreshed.session.access_token) });
const cost = psql(`begin; select set_config('request.jwt.claims', '${claims}', true);
  create function pg_temp.old_has_active_role(p_role_code text) returns boolean language sql stable security definer set search_path = public as
  $f$ select exists (select 1 from public.role_grants rg where rg.user_id = auth.uid() and rg.role_code = p_role_code and rg.revoked_at is null) $f$;
  create temp table t on commit drop as select 'start'::text k, clock_timestamp() v;
  select count(*) filter (where pg_temp.old_has_active_role('office' || repeat('', g % 2))) from generate_series(1, 10000) g;
  insert into t select 'old', clock_timestamp();
  select count(*) filter (where public.has_active_role('office' || repeat('', g % 2))) from generate_series(1, 10000) g;
  insert into t select 'new', clock_timestamp();
  select string_agg(k || '=' || round(extract(epoch from v - lag) * 1000), ' ') from (select k, v, lag(v) over (order by v) lag from t) x where lag is not null;
  commit;`).split("\n").filter((l) => /^(\d+|old=.*)$/.test(l));
check("S11", cost[0] === "10000" && cost[1] === "10000", `10.000 lần gọi (ms): ${cost[2]} (old = thân hàm trước CR, new = has_active_role có kiểm phiên)`);

console.log(`\nThời gian /api/admin/login thành công (ms): ${timings.map((t) => t.toFixed(0)).join(", ")}`);
console.log(`Kết quả: ${results.filter((r) => r.pass).length}/${results.length} PASS`);
