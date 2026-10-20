// Thực thi test case UC-A..D (docs/TH2/test-cases.md) trên bản build chạy với stack demo.
// Chỉ dùng cho stack demo đã seed theo docs/TH2/demo-data.md (tài khoản giả, PIN 123456).
// Chạy: BASE_URL=http://localhost:3200 node docs/TH2/evidence/test-run/run-test-cases.mjs
// Kết quả trong DB được đọc bằng psql trong container DB của stack demo (không phải DB đang dùng).
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const DB_CONTAINER = "supabase_db_hiu-eoffice-demo";
const PIN = "123456";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE)) throw new Error("Chỉ chạy với web local trỏ vào stack demo.");

const sql = (query) =>
  execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-At", "-F", "|", "-c", query], { encoding: "utf8" }).trim();

class Session {
  constructor(label) { this.label = label; this.cookies = new Map(); }
  async request(method, path, body) {
    const headers = { origin: BASE };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* HTML hoặc rỗng */ }
    return { status: res.status, location: res.headers.get("location"), json };
  }
  async login(studentCode) {
    const r = await this.request("POST", "/api/auth/login", { studentCode, pin: PIN });
    if (r.status !== 200) throw new Error(`Đăng nhập ${studentCode} thất bại: ${r.status}`);
    return r;
  }
}

const results = [];
function record(id, expected, actual, pass) {
  results.push({ id, pass });
  console.log(`\n### ${id} — ${pass ? "PASS" : "FAIL"}\nMong đợi: ${expected}\nThực tế:  ${actual}`);
}
const show = (r) => `HTTP ${r.status}${r.location ? ` → ${r.location}` : ""} ${r.json ? JSON.stringify(r.json) : ""}`.trim();
const id = (q) => sql(q);

console.log(`# Chạy lúc ${new Date().toISOString()} — BASE_URL=${BASE}`);
console.log(`# Web build từ commit: ${process.env.BUILD_COMMIT ?? "(không ghi)"}`);

const ids = {
  blood: id("select id from event_programs where title like 'Ngày hội Hiến máu%'"),
  cv: id("select id from event_programs where title like 'Workshop%'"),
  mhx: id("select id from event_programs where title like 'Chiến dịch%'"),
  football: id("select id from event_programs where title like 'Giải bóng đá%'"),
  officeGrant: id("select rg.id from role_grants rg join accounts a using(user_id) where a.student_code='2201110202' and rg.role_code='office'"),
  appNgoc: id("select ua.id from union_applications ua join accounts a using(user_id) where a.student_code='2211110102'"),
  appHan: id("select ua.id from union_applications ua join accounts a using(user_id) where a.student_code='2211110103'"),
  userHan: id("select user_id from accounts where student_code='2211110103'"),
  userAn: id("select user_id from accounts where student_code='2211110101'"),
  regHanMhx: id("select r.id from program_registrations r join accounts a using(user_id) where a.student_code='2211110103' and r.program_id=(select id from event_programs where title like 'Chiến dịch%')"),
};

const an = new Session("An"); await an.login("2211110101");
const han = new Session("Hân"); await han.login("2211110103");
const phuc = new Session("Phúc"); await phuc.login("2241110104");
const quan = new Session("Quân"); await quan.login("2201110201");
const mai = new Session("Mai"); await mai.login("2201110202");
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

// ── UC-A Hồ sơ Đoàn viên ──────────────────────────────────────────────────────
{
  const book = await mai.request("POST", "/api/union-membership/paper-book", {
    userId: ids.userHan, applicationId: ids.appHan, eventType: "received", eventDate: today, roleGrantId: ids.officeGrant,
  });
  const rec = await mai.request("POST", "/api/union-membership/review", {
    applicationId: ids.appHan, outcome: "recognize", reason: "Đủ hồ sơ, đã nhận Sổ Đoàn", roleGrantId: ids.officeGrant,
  });
  const db = sql(`select ua.status, um.status from union_applications ua left join union_memberships um using(user_id) where ua.id='${ids.appHan}'`);
  record("TC-UCA-01", "Ghi nhận Sổ Đoàn 200; công nhận 200 status=recognized; DB: hồ sơ recognized, union_memberships recognized",
    `Sổ Đoàn: ${show(book)} | Công nhận: ${show(rec)} | DB: ${db}`,
    book.status === 200 && rec.status === 200 && rec.json?.status === "recognized" && db === "recognized|recognized");
}
{
  const rec = await mai.request("POST", "/api/union-membership/review", {
    applicationId: ids.appNgoc, outcome: "recognize", reason: "Thử công nhận khi chưa nhận Sổ", roleGrantId: ids.officeGrant,
  });
  const db = sql(`select status from union_applications where id='${ids.appNgoc}'`);
  record("TC-UCA-02", "422 REVIEW_FAILED, không công nhận khi Văn phòng chưa tiếp nhận Sổ Đoàn; DB giữ submitted",
    `${show(rec)} | DB: ${db}`, rec.status === 422 && db === "submitted");
}
{
  const rec = await an.request("POST", "/api/union-membership/review", {
    applicationId: ids.appNgoc, outcome: "recognize", reason: "Sinh viên tự công nhận", roleGrantId: ids.officeGrant,
  });
  const db = sql(`select status from union_applications where id='${ids.appNgoc}'`);
  record("TC-UCA-03", "403 FORBIDDEN với sinh viên không có vai trò xử lý; DB giữ submitted", `${show(rec)} | DB: ${db}`,
    rec.status === 403 && db === "submitted");
}

// ── UC-B Kế hoạch chương trình ────────────────────────────────────────────────
{
  const r = await quan.request("POST", `/api/event-programs/${ids.football}/review`, { decision: "approve" });
  const db = sql(`select status from event_programs where id='${ids.football}'`);
  record("TC-UCB-01", "Đoàn Khoa (người lập) không tự duyệt được: lỗi 403/422; DB giữ submitted", `${show(r)} | DB: ${db}`,
    r.status >= 400 && r.status < 500 && db === "submitted");
}
{
  const r = await mai.request("POST", `/api/event-programs/${ids.football}/review`, { decision: "request_changes", reason: "Thiếu" });
  const db = sql(`select status from event_programs where id='${ids.football}'`);
  record("TC-UCB-02", "422 VALIDATION_ERROR ở trường reason: trả sửa phải có lý do ≥ 10 ký tự; DB giữ submitted", `${show(r)} | DB: ${db}`,
    r.status === 422 && r.json?.fields?.reason !== undefined && db === "submitted");
}
{
  const r = await mai.request("POST", `/api/event-programs/${ids.football}/review`, { decision: "approve" });
  const db = sql(`select status from event_programs where id='${ids.football}'`);
  record("TC-UCB-03", "200 status=approved; DB approved", `${show(r)} | DB: ${db}`,
    r.status === 200 && r.json?.status === "approved" && db === "approved");
}

// ── UC-C Đăng ký tham gia ─────────────────────────────────────────────────────
{
  const r = await phuc.request("POST", `/api/event-programs/${ids.blood}/registrations`, { answers: [] });
  const db = sql(`select r.status from program_registrations r join accounts a using(user_id) where a.student_code='2241110104' and r.program_id='${ids.blood}'`);
  record("TC-UCC-01", "201 status=accepted (không cần duyệt, còn chỗ); DB có 1 đăng ký accepted", `${show(r)} | DB: ${db}`,
    r.status === 201 && r.json?.status === "accepted" && db === "accepted");
}
{
  const r = await han.request("POST", `/api/event-programs/${ids.cv}/registrations`, { answers: [] });
  const db = sql(`select count(*) from program_registrations where program_id='${ids.cv}'`);
  record("TC-UCC-02", "Chương trình đủ chỉ tiêu (2/2): từ chối với lỗi hết chỗ; DB vẫn 2 đăng ký", `${show(r)} | DB: ${db}`,
    r.status >= 400 && r.status < 500 && db === "2");
}
{
  const r = await phuc.request("POST", `/api/event-programs/${ids.cv}/registrations`, { answers: [] });
  const db = sql(`select count(*) from program_registrations r join accounts a using(user_id) where a.student_code='2241110104' and r.program_id='${ids.cv}'`);
  record("TC-UCC-03", "SV Khoa Dược đăng ký chương trình chỉ cho Khoa CNKT: lỗi không thuộc đối tượng; DB không có đăng ký", `${show(r)} | DB: ${db}`,
    r.status >= 400 && r.status < 500 && db === "0");
}
{
  const r = await quan.request("POST", `/api/event-programs/${ids.mhx}/registrations/${ids.regHanMhx}/decision`, { decision: "approve" });
  const db = sql(`select status from program_registrations where id='${ids.regHanMhx}'`);
  record("TC-UCC-04", "BTC duyệt đăng ký chờ: 200 status=accepted; DB accepted", `${show(r)} | DB: ${db}`,
    r.status === 200 && r.json?.status === "accepted" && db === "accepted");
}

// ── UC-D Điểm danh QR ─────────────────────────────────────────────────────────
const plan = await quan.request("PUT", `/api/event-programs/${ids.blood}/attendance`, {
  maxPoints: 5, ruleType: "sum_sessions", tiers: [], tiersRequireRequired: false,
  sessions: [{ label: "Buổi sáng", points: 2, isRequired: false }, { label: "Buổi chiều", points: 3, isRequired: false }],
});
const s1 = sql(`select id from program_attendance_sessions where program_id='${ids.blood}' order by sort_order limit 1`);
const open = await quan.request("POST", `/api/attendance/sessions/${s1}/status`, { status: "open" });
console.log(`\n(Chuẩn bị UC-D) Lưu kế hoạch điểm danh: ${show(plan)} | Mở lượt 1: ${show(open)}`);
const qr = await quan.request("POST", `/api/attendance/sessions/${s1}/qr`);
const token = new URL(qr.json.url).searchParams.get("t");
console.log(`(Chuẩn bị UC-D) Phát QR: HTTP ${qr.status}, url=${qr.json.url.replace(/\.[0-9a-f]{32}$/, ".<chữ ký>")}, ttl=${qr.json.ttlSeconds}s`);
{
  const r = await an.request("POST", "/api/attendance/check-in", { sessionId: s1, token });
  const pts = sql(`select public.attendance_expected_points('${ids.blood}', '${ids.userAn}')`);
  record("TC-UCD-01", "201 điểm danh lượt \"Buổi sáng\"; điểm dự kiến đề nghị = 2", `${show(r)} | attendance_expected_points = ${pts}`,
    r.status === 201 && pts === "2");
}
{
  const r = await an.request("POST", "/api/attendance/check-in", { sessionId: s1, token });
  const n = sql(`select count(*) from program_attendance_records where session_id='${s1}' and user_id='${ids.userAn}'`);
  record("TC-UCD-02", "Quét lại cùng lượt: lỗi đã điểm danh (ALREADY_CHECKED_IN); DB vẫn 1 bản ghi", `${show(r)} | DB: ${n} bản ghi`,
    r.status >= 400 && r.status < 500 && n === "1");
}
{
  const r = await han.request("POST", "/api/attendance/check-in", { sessionId: s1, token });
  record("TC-UCD-03", "SV chưa có đăng ký được nhận ở chương trình: từ chối (REGISTRATION_NOT_ACCEPTED)", show(r),
    r.status >= 400 && r.status < 500);
}
{
  // K1: mở link QR khi chưa đăng nhập, đăng nhập rồi phải quay lại đúng link có ?t=.
  const guest = new Session("Khách");
  const qr2 = await quan.request("POST", `/api/attendance/sessions/${s1}/qr`);
  const qrPath = new URL(qr2.json.url).pathname + new URL(qr2.json.url).search;
  const r1 = await guest.request("GET", qrPath);
  const loginPage = r1.location ? new URL(r1.location, BASE) : null;
  const nextParam = loginPage?.searchParams.get("next") ?? "";
  // Mô phỏng trang /login: gửi kèm next lấy từ URL (bản chưa sửa từ chối trường lạ bằng 422, khi đó gửi lại không kèm next).
  let r2 = await guest.request("POST", "/api/auth/login", { studentCode: "2211110102", pin: PIN, next: nextParam || undefined });
  if (r2.status === 422) r2 = await guest.request("POST", "/api/auth/login", { studentCode: "2211110102", pin: PIN });
  const keepsToken = nextParam.includes("?t=") && (r2.json?.next ?? "").includes("?t=");
  record("TC-UCD-04 (K1)",
    "Chuyển tới /login?next=<đường dẫn có ?t=>; sau đăng nhập API trả next = đúng link QR để quay lại điểm danh",
    `GET ${qrPath.replace(/\.[0-9a-f]{32}$/, ".<chữ ký>")} → ${show(r1)} | next=${nextParam} | đăng nhập: ${show(r2)}`,
    keepsToken);
}
{
  await new Promise((resolve) => setTimeout(resolve, 31_000));
  const ngoc = new Session("Ngọc"); await ngoc.login("2211110102");
  const r = await ngoc.request("POST", "/api/attendance/check-in", { sessionId: s1, token });
  record("TC-UCD-05", "Token QR phát quá 30 giây: từ chối (QR_EXPIRED), không ghi điểm danh", show(r),
    r.status >= 400 && r.status < 500 && r.json?.error !== undefined);
}

const failed = results.filter((r) => !r.pass).map((r) => r.id);
console.log(`\n# Tổng: ${results.length} TC, PASS ${results.length - failed.length}, FAIL ${failed.length}${failed.length ? ` (${failed.join(", ")})` : ""}`);
