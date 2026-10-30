// SPIKE CR-01-TaiKhoanToChuc (#37), phương án ưu tiên. Không merge. Chạy sau spike-cr01-seed.mjs và
// migration 202610300003, trên stack tách biệt eoffice-cr01-spike:
//   APP=http://localhost:3401 node scripts/spike-cr01.mjs
// Mọi MSSV/email là dữ liệu giả (999…).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile?.(".env.local");
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const APP = process.env.APP ?? "http://localhost:3401";
if (!URL_?.includes(":573")) throw new Error("Chỉ chạy trên stack spike (cổng 573xx).");
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const psql = (sql) => execFileSync("docker", ["exec", "-i", "supabase_db_eoffice-cr01-spike", "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql }).toString().trim();
const fx = JSON.parse(readFileSync(".spike-fixture.json", "utf8"));
const { facultyOrg, facultyOrg2, SCHOOL, OFFICE, BAN } = fx;
const { a, b, c, d, e, x } = fx.people;
const PIN = "123456", ORG_PIN = "246810";
const results = [];
const check = (id, pass, detail) => { results.push({ id, pass }); console.log(`[${id}] ${pass ? "PASS" : "FAIL"} – ${detail}`); };
const orgAccountOf = (org) => psql(`select user_id from public.accounts where organization_id = '${org}';`);

// ── M1. Migration dữ liệu ──────────────────────────────────────────────────
const orgF = orgAccountOf(facultyOrg), orgO = orgAccountOf(OFFICE), orgS = orgAccountOf(SCHOOL);
const orgGrants = psql(`select string_agg(ou.code || ':' || rg.role_code, ',' order by ou.code) from public.role_grants rg
  join public.accounts ac on ac.user_id = rg.user_id and ac.account_type = 'organization'
  join public.organization_units ou on ou.id = rg.organization_id where rg.revoked_at is null;`);
const personalMgmt = psql(`select count(*) from public.role_grants rg join public.accounts ac on ac.user_id = rg.user_id
  where ac.account_type = 'student' and rg.revoked_at is null and rg.role_code in ('school_admin','office','faculty_manager','faculty_executive');`);
const members = psql(`select string_agg(ac.student_code || '@' || ou.code || ':' || m.member_role, ',' order by ac.student_code, ou.code)
  from public.organization_members m join public.accounts ac on ac.user_id = m.user_id join public.organization_units ou on ou.id = m.organization_id;`);
const ctvActive = psql(`select count(*) from public.role_grants where user_id = '${x.id}' and role_code = 'collaborator' and revoked_at is null;`);
const migratedAudit = psql(`select count(*) from public.audit_events where action = 'role.migrated_to_organization';`);
const statuses = psql(`select string_agg(distinct status, ',') from public.accounts where account_type = 'organization';`);
check("M1", orgF && orgO && orgS && personalMgmt === "0" && ctvActive === "1" && migratedAudit === "5" && statuses === "pending_pin",
  `tài khoản tổ chức: 3 (trạng thái ${statuses}); role_grants tổ chức: ${orgGrants}; vai trò quản lý còn trên tài khoản cá nhân: ${personalMgmt}; ` +
  `thành viên: ${members}; CTV còn hiệu lực: ${ctvActive}; audit role.migrated_to_organization: ${migratedAudit}`);
check("M1b", !orgAccountOf(facultyOrg2), `Đoàn Khoa không có vai trò quản lý nào → không tạo tài khoản tổ chức: ${orgAccountOf(facultyOrg2) || "đúng"}`);

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
  const set = res.headers.getSetCookie().map((v) => v.split(";")[0]);
  return { status: res.status, json: await res.json().catch(() => null), set, ms };
}
const jar = (...sets) => { const m = new Map(); for (const s of sets.flat()) { const [k, v] = s.split(/=(.*)/s); if (v) m.set(k, v); else m.delete(k); } return [...m].map(([k, v]) => `${k}=${v}`).join("; "); };
function tokenFrom(cookie, field = "access_token") {
  const parts = cookie.split("; ").filter((p) => p.includes("-auth-token")).sort();
  if (!parts.length) return null;
  const raw = parts.map((p) => decodeURIComponent(p.slice(p.indexOf("=") + 1))).join("");
  return JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64").toString("utf8"))[field];
}
const asToken = (token) => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
const sessionOf = (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).session_id;
const timings = { step1: [], step2: [] };
async function step1(org, pin = ORG_PIN, ip) { const r = await post("/api/admin/login", { organizationId: org, organizationPin: pin }, { ip }); timings.step1.push(r.ms); return r; }
async function step2(cookie, person, pin = PIN) { const r = await post("/api/admin/login/officer", { studentCode: person.code ?? person, pin }, { cookie }); timings.step2.push(r.ms); return r; }
async function orgLogin(org, person) {
  const s1 = await step1(org); const c1 = jar(s1.set);
  const s2 = await step2(c1, person); const cookie = jar(s1.set, s2.set);
  return { s1, s2, cookie, token: tokenFrom(cookie) };
}
const programArgs = (org, title) => ({
  p_id: null, p_owner_org_id: org, p_title: title, p_summary: "Tóm tắt spike", p_location: "Hội trường",
  p_starts_at: "2026-11-20T01:00:00Z", p_ends_at: "2026-11-20T04:00:00Z", p_expected_participants: 50,
  p_plan_number: "01-KH/SPK", p_plan_signed_on: "2026-10-30", p_request_id: null,
});

// ── M2. Sau migration, tài khoản cá nhân của cán bộ mất quyền (RPC không sửa) ─
const personalA = await post("/api/auth/login", { studentCode: a.code, pin: PIN });
const { error: m2 } = await asToken(tokenFrom(jar(personalA.set))).rpc("save_event_program", programArgs(facultyOrg, "Tạo bằng tài khoản cá nhân"));
check("M2", personalA.status === 200 && m2?.message === "FORBIDDEN", `A đăng nhập cá nhân ${personalA.status}; save_event_program → ${m2?.message}`);

// Đặt PIN tổ chức (thao tác của Đoàn Trường; spike gọi bằng service role).
for (const acc of [orgF, orgO, orgS]) await admin.rpc("set_organization_pin", { p_account_user_id: acc, p_pin: ORG_PIN });

// ── L1. Bước 1 → phiên tạm, chưa thao tác được ────────────────────────────
const s1 = await step1(facultyOrg);
const tempCookie = jar(s1.set);
const tempApi = await post("/api/event-programs", { ownerOrgId: facultyOrg, title: "Gọi API bằng phiên tạm" }, { cookie: tempCookie });
const challenge = psql(`select round(extract(epoch from expires_at - created_at)) from public.organization_login_challenges order by created_at desc limit 1;`);
check("L1", s1.status === 200 && /org_login=/.test(tempCookie) && !tokenFrom(tempCookie) && tempApi.status === 401,
  `bước 1 → ${s1.status}, cookie org_login, không có phiên Auth; hạn phiên tạm ${challenge} giây; POST /api/event-programs bằng phiên tạm → ${tempApi.status}`);

// ── L2. Bước 2 → vào /admin; RPC giữ nguyên chạy với tài khoản tổ chức; ghi cán bộ ─
const s2 = await step2(tempCookie, a);
const fA = jar(s1.set, s2.set), tokFA = tokenFrom(fA);
const fAClient = asToken(tokFA);
const { data: programId, error: createErr } = await fAClient.rpc("save_event_program", programArgs(facultyOrg, "Chương trình spike CR-01"));
const hist = programId ? psql(`select actor_user_id || '|' || actor_officer_user_id || '|' || actor_name from public.event_program_history where program_id = '${programId}' and action = 'created';`) : "";
const audit = programId ? psql(`select actor_user_id || '|' || officer_user_id || '|' || organization_id || '|' || organization_session_id from public.audit_events where action = 'event_program.created' and target_id = '${programId}';`) : "";
check("L2", s2.status === 200 && s2.json?.next === "/admin" && !createErr && hist.startsWith(`${orgF}|${a.id}|`) && audit === `${orgF}|${a.id}|${facultyOrg}|${sessionOf(tokFA)}`,
  `bước 2 → ${s2.status} next=${s2.json?.next}; save_event_program ${createErr?.message ?? "OK"}; history: actor = tài khoản tổ chức, officer = A, tên "${hist.split("|")[2]}"; audit: tổ chức | A | đơn vị | phiên ${audit ? "đủ" : "thiếu"}`);
const replay = await step2(tempCookie, a);
check("L2b", replay.status === 401, `dùng lại phiên tạm đã dùng → ${replay.status}`);
const { error: otherErr } = await fAClient.rpc("save_event_program", programArgs(facultyOrg2, "Chương trình khoa khác"));
check("L2c", otherErr?.message === "FORBIDDEN", `phiên Đoàn Khoa tạo chương trình cho Đoàn Khoa khác → ${otherErr?.message}`);

// ── L3. Mỗi bước sai đều trả một thông báo chung ──────────────────────────
const msgs = new Map();
const note = (k, r) => msgs.set(k, `${r.status} ${r.json?.message}`);
note("bước 1: sai PIN tổ chức", await step1(OFFICE, "000000"));
note("bước 1: đơn vị chưa có tài khoản", await step1(facultyOrg2));
const t = jar((await step1(facultyOrg)).set);
note("bước 2: sai MSSV", await step2(t, "9990000099"));
note("bước 2: sai PIN cá nhân", await step2(t, a, "654321"));
note("bước 2: không phải thành viên (B thuộc Văn phòng)", await step2(t, b));
note("bước 2: sinh viên không vai trò", await step2(t, d));
note("bước 2: không qua bước 1", await step2("", a));
const distinct = new Set(msgs.values());
check("L3", distinct.size === 1 && [...distinct][0].startsWith("401"), `${msgs.size} tình huống → ${distinct.size} thông báo: ${[...distinct].join(" / ")}`);

// ── L4. Phiên tạm hết hạn sau 5 phút ──────────────────────────────────────
const t4 = await step1(facultyOrg);
psql(`update public.organization_login_challenges set expires_at = now() - interval '1 second' where id = '${decodeURIComponent(jar(t4.set).split("=")[1])}';`);
const late = await step2(jar(t4.set), a);
check("L4", late.status === 401 && late.json?.message === [...distinct][0].slice(4), `bước 2 sau khi phiên tạm hết hạn → ${late.status}, cùng thông báo chung`);

// ── L5. "Đổi cán bộ": về bước 2, không nhập lại PIN tổ chức ────────────────
const sw = await post("/api/admin/switch-officer", {}, { cookie: fA });
const swCookie = jar(sw.set.filter((s) => s.startsWith("org_login=")));
const { error: oldTokenErr } = await fAClient.rpc("save_event_program", programArgs(facultyOrg, "Token cũ sau khi đổi cán bộ"));
const sC = await step2(swCookie, c);
const tokFC = tokenFrom(jar(sw.set, sC.set));
const { data: p2, error: cErr } = await asToken(tokFC).rpc("save_event_program", programArgs(facultyOrg, "Chương trình do cán bộ C lập"));
const auditC = p2 ? psql(`select officer_user_id from public.audit_events where action = 'event_program.created' and target_id = '${p2}';`) : "";
check("L5", sw.status === 200 && sw.json?.next === "/admin/login/officer" && oldTokenErr?.message === "OFFICER_REQUIRED" && sC.status === 200 && !cErr && auditC === c.id,
  `đổi cán bộ → ${sw.status} next=${sw.json?.next}; token của A sau khi đổi → ${oldTokenErr?.message}; bước 2 với C (không PIN tổ chức) → ${sC.status}; thao tác ghi officer = ${auditC === c.id ? "C" : auditC}`);

// ── L6. Người lập không tự duyệt, xét theo cán bộ ─────────────────────────
const docPath = `${programId}/${crypto.randomUUID()}.pdf`;
psql(`insert into storage.objects(bucket_id, name) values ('event-program-plans', '${docPath}');`);
const fA2 = await orgLogin(facultyOrg, a);
const fA2c = asToken(fA2.token);
const { error: attErr } = await fA2c.rpc("attach_event_program_document", { p_program_id: programId, p_storage_path: docPath, p_file_name: "kh.pdf", p_size_bytes: 1000, p_sha256: "0".repeat(64), p_request_id: null });
const { error: subErr } = await fA2c.rpc("submit_event_program", { p_program_id: programId, p_request_id: null });
const oA = await orgLogin(OFFICE, a);
const review = (tok) => asToken(tok).rpc("review_event_program", { p_program_id: programId, p_decision: "approve", p_reason: null, p_request_id: null });
const { error: selfErr } = await review(oA.token);
const oB = await orgLogin(OFFICE, b);
const { data: reviewed, error: bErr } = await review(oB.token);
check("L6", !attErr && !subErr && selfErr?.message === "SELF_REVIEW_FORBIDDEN" && reviewed === "approved",
  `A nộp bằng phiên Đoàn Khoa (${attErr?.message ?? subErr?.message ?? "OK"}); A duyệt bằng phiên Văn phòng → ${selfErr?.message}; B phiên Văn phòng → ${bErr?.message ?? reviewed}`);

// ── L7. Phiên Auth của tài khoản tổ chức không qua bước 2 (không có cán bộ) ──
const orgEmail = (await admin.auth.admin.getUserById(orgF)).data.user.email;
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: orgEmail });
const bypass = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: bySession } = await bypass.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
const byClient = asToken(bySession.session.access_token);
const { error: byWrite } = await byClient.rpc("save_event_program", programArgs(facultyOrg, "Không có cán bộ"));
const { data: byRead } = await byClient.from("event_programs").select("id").eq("owner_org_id", facultyOrg);
check("L7", byWrite?.message === "OFFICER_REQUIRED",
  `ghi bằng phiên tổ chức không có cán bộ → ${byWrite?.message}; đọc kế hoạch của đơn vị qua RLS vẫn được: ${byRead?.length ?? 0} dòng (rủi ro đã ghi)`);

// ── L8. Không đăng nhập thẳng vào Auth bằng tài khoản tổ chức ──────────────
const { error: directErr } = await bypass.auth.signInWithPassword({ email: orgEmail, password: ORG_PIN });
check("L8", Boolean(directErr), `signInWithPassword(email tổ chức, PIN tổ chức) → ${directErr?.message}`);

// ── L9. Thu hồi thành viên làm mất quyền ngay ─────────────────────────────
psql(`update public.organization_members set revoked_at = now() where user_id = '${a.id}' and organization_id = '${facultyOrg}';`);
const { error: revokedErr } = await fA2c.rpc("save_event_program", programArgs(facultyOrg, "Sau khi thu hồi thành viên"));
const again = await orgLogin(facultyOrg, a);
check("L9", revokedErr?.message === "OFFICER_REQUIRED" && again.s2.status === 401,
  `phiên đang mở của A sau khi thu hồi → ${revokedErr?.message}; đăng nhập lại bước 2 → ${again.s2.status}`);

// ── L10. Khóa tạm PIN tổ chức ─────────────────────────────────────────────
const ip = "10.98.0.1", wrong = [];
for (let i = 0; i < 5; i++) wrong.push((await step1(SCHOOL, "111111", ip)).status);
const sixth = await step1(SCHOOL, ORG_PIN, ip), otherIp = await step1(SCHOOL, ORG_PIN, "10.98.0.2");
check("L10", wrong.every((s) => s === 401) && sixth.status === 429 && otherIp.status === 200,
  `5 lần sai → ${wrong.join(",")}; lần 6 PIN đúng → ${sixth.status}; IP khác → ${otherIp.status}`);

// ── L11. DB chặn Chi đoàn, Ban; vai trò quản lý không cấp lại cho cá nhân ─
const err = (sql) => { try { psql(sql); return "cho phép (sai)"; } catch (ex) { return (String(ex.stderr).match(/ERROR:\s+(\w+)/) ?? [])[1]; } };
const classUnit = psql(`with p as (insert into public.programs(current_code, current_name, current_faculty_id) select 'SPKP', 'Ngành spike', faculty_id from public.organization_units where id = '${facultyOrg}' returning id),
  co as (insert into public.cohorts(code, display_name) values ('SPKK', 'Khóa spike') returning id)
  insert into public.classes(current_code, current_name, current_program_id, current_cohort_id) select 'SPKL', 'Lớp spike', p.id, co.id from p, co returning id;
  select ou.id from public.organization_units ou join public.classes cl on cl.id = ou.class_id where cl.current_code = 'SPKL';`).split("\n").pop();
const eClass = err(`select public.create_organization_account('${classUnit}', 'thử');`);
const eBan = err(`select public.create_organization_account('${BAN}', 'thử');`);
const eGrant = err(`insert into public.role_grants(user_id, role_code, organization_id, reason) values ('${d.id}', 'faculty_manager', '${facultyOrg}', 'thử');`);
check("L11", eClass === "ORG_ACCOUNT_UNIT_NOT_ALLOWED" && eBan === "ORG_ACCOUNT_UNIT_NOT_ALLOWED" && eGrant === "MANAGEMENT_ROLE_REQUIRES_ORGANIZATION_ACCOUNT",
  `Chi đoàn → ${eClass}; Ban → ${eBan}; cấp faculty_manager cho sinh viên → ${eGrant}`);

// ── L12. Sinh viên không đổi: đăng nhập, CTV vẫn dùng tài khoản cá nhân ────
const dLogin = await post("/api/auth/login", { studentCode: d.code, pin: PIN });
const xLogin = await post("/api/auth/login", { studentCode: x.code, pin: PIN });
const { data: xCollab } = await asToken(tokenFrom(jar(xLogin.set))).rpc("has_active_role", { p_role_code: "collaborator" });
check("L12", dLogin.status === 200 && xLogin.status === 200 && xCollab === true,
  `sinh viên đăng nhập /login → ${dLogin.status}; CTV đăng nhập cá nhân → ${xLogin.status}, has_active_role('collaborator') = ${xCollab}`);

const ms = (arr) => arr.map((v) => v.toFixed(0)).join(", ");
console.log(`\nThời gian bước 1 (ms): ${ms(timings.step1.slice(0, 6))}`);
console.log(`Thời gian bước 2 thành công (ms): ${ms([s2.ms, sC.ms])}`);
console.log(`Kết quả: ${results.filter((r) => r.pass).length}/${results.length} PASS`);
