// Seed dữ liệu demo tiếng Việt cho stack Supabase DEMO tách biệt (xem docs/TH2/demo-data.md).
//
// An toàn:
//   - Không đọc .env.local: chỉ nhận DEMO_SUPABASE_URL và DEMO_SERVICE_ROLE_KEY truyền tường minh.
//   - Chỉ chạy với Supabase local (127.0.0.1/localhost) và khi có cờ --confirm-demo.
//   - Từ chối nếu DB đã có tài khoản (DB đang dùng hằng ngày, hoặc đã seed rồi).
//
// Cách dùng:
//   DEMO_SUPABASE_URL=http://127.0.0.1:55321 DEMO_SERVICE_ROLE_KEY=<service_role của stack demo> \
//     node scripts/seed-demo.mjs --confirm-demo
//
// Mọi tài khoản demo dùng PIN 123456. Họ tên, MSSV, CCCD, số điện thoại đều là dữ liệu giả.

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEMO_PIN = "123456";
const CYCLE = "2026-2027";

const url = process.env.DEMO_SUPABASE_URL;
const key = process.env.DEMO_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`SEED_DEMO_REFUSED: ${message}`);
  process.exit(1);
}

if (!process.argv.includes("--confirm-demo")) fail("thiếu cờ --confirm-demo.");
if (!url || !key) fail("thiếu DEMO_SUPABASE_URL hoặc DEMO_SERVICE_ROLE_KEY (script không đọc .env.local).");
const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host)) fail(`chỉ chạy với Supabase local, không chạy với ${host}.`);

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function q(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

const { count: accountCount, error: countError } = await db.from("accounts").select("user_id", { count: "exact", head: true });
if (countError) fail(`không đọc được bảng accounts: ${countError.message}`);
if ((accountCount ?? 0) > 0) fail(`DB đã có ${accountCount} tài khoản. Script chỉ seed DB demo mới dựng, không ghi vào DB đang dùng.`);

// ── Danh mục có sẵn sau khi import CSV ───────────────────────────────────────
const classes = await q(db.from("classes").select("id, current_code").in("current_code", ["TH22DH-CN1", "TH22DH-CN2", "DS22DH-DS1"]), "classes");
const classId = (code) => {
  const row = classes.find((c) => c.current_code === code);
  if (!row) fail(`chưa có lớp ${code}. Chạy import danh mục (catalog:import) trước khi seed.`);
  return row.id;
};
const faculty = await q(db.from("faculties").select("id").eq("current_name", "Khoa Công Nghệ - Kỹ Thuật").single(), "faculty CNKT");
const cnktUnion = await q(db.from("organization_units").select("id").eq("unit_type", "faculty_union").eq("faculty_id", faculty.id).single(), "Đoàn Khoa CNKT");
const office = await q(db.from("organization_units").select("id").eq("code", "OFFICE").single(), "Văn phòng");
const school = await q(db.from("organization_units").select("id").eq("code", "SCHOOL_UNION").single(), "Đoàn Trường");
const refs = await q(db.from("reference_options").select("id, category, code, label")
  .in("category", ["education_level", "specialization", "political_theory", "it_level", "foreign_language", "occupation"]), "reference_options");
const province = await q(db.from("reference_options").select("code, label").eq("category", "province").ilike("label", "%Hồ Chí Minh%").limit(1).single(), "tỉnh/thành");
const ward = await q(db.from("reference_options").select("code, label").eq("category", "ward").eq("parent_code", province.code).ilike("label", "%Bến Thành%").limit(1).single(), "phường/xã");
const ref = (category) => refs.find((r) => r.category === category)?.id ?? fail(`thiếu danh mục ${category}`);

// ── Tài khoản ────────────────────────────────────────────────────────────────
// Email: phần số = 3 chữ số đầu + 4 chữ số cuối của MSSV (quy tắc @student.hiu.vn).
const people = {
  an:   { code: "2211110101", name: "Nguyễn Văn An",       gender: "male",   cls: "TH22DH-CN1", phone: "0901000101", nick: "an.nv" },
  ngoc: { code: "2211110102", name: "Võ Thị Bích Ngọc",    gender: "female", cls: "TH22DH-CN1", phone: "0901000102", nick: "ngoc.vtb" },
  han:  { code: "2211110103", name: "Huỳnh Gia Hân",       gender: "female", cls: "TH22DH-CN2", phone: "0901000103", nick: "han.hg" },
  phuc: { code: "2241110104", name: "Đặng Hoàng Phúc",     gender: "male",   cls: "DS22DH-DS1", phone: "0901000104", nick: "phuc.dh" },
  quan: { code: "2201110201", name: "Lê Minh Quân",        gender: "male",   cls: "TH22DH-CN2", phone: "0901000201", nick: "quan.lm" },
  mai:  { code: "2201110202", name: "Trần Thị Mai",        gender: "female", cls: "TH22DH-CN1", phone: "0901000202", nick: "mai.tt" },
  bao:  { code: "2201110203", name: "Phạm Quốc Bảo",       gender: "male",   cls: "TH22DH-CN1", phone: "0901000203", nick: "bao.pq" },
};

const now = new Date();
const at = (days, hour = 8, minute = 0) => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour - 7, minute, 0, 0); // giờ Việt Nam (UTC+7)
  return d.toISOString();
};
const day = (days) => at(days).slice(0, 10);

for (const p of Object.values(people)) {
  const email = `${p.nick}${p.code.slice(0, 3)}${p.code.slice(-4)}@student.hiu.vn`;
  const { data, error } = await db.auth.admin.createUser({ email, password: DEMO_PIN, email_confirm: true });
  if (error) throw new Error(`tạo auth user ${p.code}: ${error.message}`);
  p.id = data.user.id;
  p.email = email;
  await q(db.from("accounts").insert({ user_id: p.id, student_code: p.code, status: "active" }), `accounts ${p.code}`);
  await q(db.from("account_emails").insert({ user_id: p.id, email, verified_at: now.toISOString() }), `account_emails ${p.code}`);
  await q(db.from("student_profiles").insert({
    user_id: p.id, full_name: p.name, gender: p.gender, phone: p.phone, class_id: classId(p.cls), completed_at: now.toISOString(),
  }), `student_profiles ${p.code}`);
}

const grant = async (person, role, orgId, reason) =>
  (await q(db.from("role_grants").insert({ user_id: person.id, role_code: role, organization_id: orgId, reason }).select("id").single(), `role ${role}`)).id;
await grant(people.bao, "school_admin", school.id, "Demo: quản trị Đoàn Trường");
const officeGrant = await grant(people.mai, "office", office.id, "Demo: cán bộ Văn phòng Đoàn – Hội");
const facultyGrant = await grant(people.quan, "faculty_manager", cnktUnion.id, "Demo: Bí thư Đoàn Khoa CNKT");

// ── Biểu mẫu ─────────────────────────────────────────────────────────────────
const opt = (labels) => labels.map((label, order) => ({ id: randomUUID(), label, order }));
const question = (order, type, label, extra = {}) => ({ id: randomUUID(), type, label, order, required: false, ...extra });

const forms = [
  {
    key: "survey", status: "published", title: "Khảo sát nhu cầu bồi dưỡng kỹ năng mềm",
    description: "Đoàn Khoa CNKT khảo sát để xây dựng chuỗi workshop học kỳ II. Thời gian điền khoảng 2 phút.",
    closes_at: at(14, 23, 59),
    questions: [
      question(0, "single_choice", "Bạn đang là sinh viên năm mấy?", { required: true, options: opt(["Năm 1", "Năm 2", "Năm 3", "Năm 4"]) }),
      question(1, "multi_choice", "Kỹ năng bạn muốn được bồi dưỡng", { options: opt(["Giao tiếp", "Thuyết trình", "Làm việc nhóm", "Quản lý thời gian", "Viết CV và phỏng vấn"]) }),
      question(2, "dropdown", "Hình thức tổ chức phù hợp", { options: opt(["Trực tiếp tại trường", "Trực tuyến qua Google Meet", "Kết hợp"]) }),
      question(3, "long_text", "Góp ý thêm cho Ban Chấp hành Đoàn Khoa"),
    ],
  },
  {
    key: "mhx", status: "published", title: "Phiếu đăng ký chiến sĩ Mùa hè xanh 2026",
    description: "Phiếu đi kèm đăng ký chương trình Mùa hè xanh; BTC xét chọn theo phiếu.",
    closes_at: null,
    questions: [
      question(0, "single_choice", "Cỡ áo chiến sĩ", { required: true, options: opt(["S", "M", "L", "XL"]) }),
      question(1, "multi_choice", "Mảng bạn muốn tham gia", { options: opt(["Xây dựng nông thôn mới", "Dạy học cho thiếu nhi", "Khám bệnh, phát thuốc", "Truyền thông"]) }),
      question(2, "short_text", "Kinh nghiệm tình nguyện trước đây (nếu có)"),
    ],
  },
  {
    key: "feedback", status: "closed", title: "Phiếu góp ý hoạt động Đoàn Khoa học kỳ I",
    description: "Đã kết thúc nhận góp ý. Cảm ơn các bạn đã tham gia.",
    closes_at: null,
    questions: [
      question(0, "single_choice", "Mức độ hài lòng với các hoạt động", { options: opt(["Rất hài lòng", "Hài lòng", "Bình thường", "Chưa hài lòng"]) }),
      question(1, "long_text", "Điều bạn muốn Đoàn Khoa cải thiện"),
    ],
  },
];
const formIds = {};
for (const f of forms) {
  const row = await q(db.from("forms").insert({
    owner_org_id: cnktUnion.id, title: f.title, description: f.description, status: f.status,
    audience_rule: { type: "hiu_student" }, questions: f.questions, closes_at: f.closes_at,
    confirmation_message: "Đoàn Khoa đã nhận phản hồi của bạn.", created_by: people.quan.id,
  }).select("id").single(), `form ${f.key}`);
  formIds[f.key] = row.id;
}

// ── Chương trình (kế hoạch) ──────────────────────────────────────────────────
const programs = [
  {
    key: "blood", status: "approved", title: "Ngày hội Hiến máu tình nguyện “Giọt hồng HIU” 2026",
    summary: "Phối hợp Bệnh viện Truyền máu Huyết học tổ chức hiến máu tại trường; có khám sàng lọc và quà tặng cho tình nguyện viên.",
    location: "Sảnh tòa nhà A, cơ sở chính", starts_at: at(10, 7, 30), ends_at: at(10, 11, 30), expected: 150, plan: "05/KH-ĐKCNKT",
  },
  {
    key: "cv", status: "approved", title: "Workshop “Viết CV và phỏng vấn xin việc ngành CNTT”",
    summary: "Chuyên gia tuyển dụng hướng dẫn viết CV, luyện phỏng vấn thử theo nhóm nhỏ. Giới hạn chỗ để bảo đảm thực hành.",
    location: "Phòng hội thảo B2.05", starts_at: at(5, 14, 0), ends_at: at(5, 16, 30), expected: 40, plan: "06/KH-ĐKCNKT",
  },
  {
    key: "mhx", status: "approved", title: "Chiến dịch Tình nguyện Mùa hè xanh 2026",
    summary: "Tuyển chọn chiến sĩ tham gia chiến dịch tại xã Tân Hòa; BTC xét duyệt theo phiếu đăng ký.",
    location: "Xã Tân Hòa, tỉnh Đồng Nai", starts_at: at(30, 6, 0), ends_at: at(37, 18, 0), expected: 30, plan: "07/KH-ĐKCNKT",
  },
  {
    key: "football", status: "submitted", title: "Giải bóng đá nam sinh viên Khoa CNKT mở rộng 2026",
    summary: "Giải đấu giao lưu giữa các chi đoàn, thi đấu vòng bảng và loại trực tiếp vào các buổi chiều thứ Bảy.",
    location: "Sân bóng cơ sở 2", starts_at: at(21, 15, 0), ends_at: at(42, 18, 0), expected: 200, plan: "08/KH-ĐKCNKT",
  },
];
const programIds = {};
for (const p of programs) {
  const approved = p.status === "approved";
  const row = await q(db.from("event_programs").insert({
    owner_org_id: cnktUnion.id, faculty_id: faculty.id, title: p.title, summary: p.summary, location: p.location,
    starts_at: p.starts_at, ends_at: p.ends_at, expected_participants: p.expected, plan_number: p.plan, plan_signed_on: day(-7),
    status: p.status, submission_count: 1, created_by: people.quan.id, submitted_at: at(-6, 9, 0),
    decided_at: approved ? at(-4, 10, 0) : null, decided_by: approved ? people.mai.id : null,
  }).select("id").single(), `program ${p.key}`);
  programIds[p.key] = row.id;
  const history = [
    { action: "created", from_status: null, to_status: "draft", actor_user_id: people.quan.id, actor_role_grant_id: facultyGrant, occurred_at: at(-8, 9, 0) },
    { action: "submitted", from_status: "draft", to_status: "submitted", actor_user_id: people.quan.id, actor_role_grant_id: facultyGrant, occurred_at: at(-6, 9, 0) },
  ];
  if (approved) history.push({ action: "approved", from_status: "submitted", to_status: "approved", actor_user_id: people.mai.id, actor_role_grant_id: officeGrant, occurred_at: at(-4, 10, 0) });
  await q(db.from("event_program_history").insert(history.map((h) => ({ ...h, program_id: row.id }))), `history ${p.key}`);
}

// ── Cấu hình đăng ký và đăng ký của sinh viên ────────────────────────────────
const cnktOnly = { type: "and", conditions: [{ type: "hiu_student" }, { type: "faculty", faculty_id: faculty.id }] };
const settings = [
  { key: "blood", status: "open", audience_rule: { type: "hiu_student" }, capacity: 150, requires_approval: false, closes_at: at(8, 23, 59),
    instructions: "Ăn sáng nhẹ, không thức khuya trước ngày hiến máu; mang theo CCCD." },
  { key: "cv", status: "open", audience_rule: cnktOnly, capacity: 2, requires_approval: false, closes_at: at(4, 12, 0),
    instructions: "Mang theo bản CV nháp (in hoặc trên laptop)." },
  { key: "mhx", status: "closed", audience_rule: { type: "hiu_student" }, capacity: 30, requires_approval: true, closes_at: at(-1, 23, 59),
    form: "mhx", instructions: "BTC thông báo kết quả xét chọn trước ngày xuất quân." },
];
for (const s of settings) {
  await q(db.from("program_registration_settings").insert({
    program_id: programIds[s.key], status: s.status, audience_rule: s.audience_rule, capacity: s.capacity,
    requires_approval: s.requires_approval, form_id: s.form ? formIds[s.form] : null, closes_at: s.closes_at,
    instructions: s.instructions, opened_at: at(-3, 8, 0), closed_at: s.status === "closed" ? at(-1, 23, 59) : null,
    updated_by: people.quan.id,
  }), `settings ${s.key}`);
}
const registrations = [
  { program: "blood", who: "an", status: "accepted" },
  { program: "blood", who: "ngoc", status: "accepted" },
  { program: "cv", who: "an", status: "accepted" },
  { program: "cv", who: "ngoc", status: "accepted" },
  { program: "mhx", who: "han", status: "pending" },
  { program: "mhx", who: "an", status: "accepted", decided_by: "quan" },
  { program: "mhx", who: "ngoc", status: "rejected", decided_by: "quan", reason: "Trùng lịch thi học kỳ hè; BTC ưu tiên bạn ở đợt tuyển sau." },
];
for (const r of registrations) {
  const decided = r.status !== "pending";
  await q(db.from("program_registrations").insert({
    program_id: programIds[r.program], user_id: people[r.who].id, status: r.status, registered_at: at(-2, 9, 30),
    decided_at: decided ? at(-1, 15, 0) : null, decided_by: r.decided_by ? people[r.decided_by].id : null, decision_reason: r.reason ?? null,
  }), `registration ${r.program}/${r.who}`);
}

// ── Hồ sơ Đoàn viên ở các trạng thái khác nhau ───────────────────────────────
const applications = [
  { who: "an", status: "recognized" },
  { who: "ngoc", status: "submitted" },
  { who: "han", status: "collaborator_recommended" },
  { who: "phuc", status: "needs_changes", reason: "Ảnh CCCD mặt trước bị mờ; vui lòng tải lại bản chụp rõ nét." },
];
for (const [index, a] of applications.entries()) {
  const person = people[a.who];
  const recognized = a.status === "recognized";
  const app = await q(db.from("union_applications").insert({
    user_id: person.id, cycle_key: CYCLE, status: a.status, submitted_at: at(-20 + index, 10, 0),
    decided_at: recognized ? at(-15, 9, 0) : null, decision_reason: a.reason ?? null,
    profile_snapshot: { full_name: person.name, student_code: person.code, class_code: person.cls },
  }).select("id").single(), `application ${a.who}`);
  await q(db.from("union_identity_details").insert({
    application_id: app.id, date_of_birth: `2004-0${index + 3}-1${index}`, ethnicity: "Kinh", religion: "Không",
    citizen_id: `0792040${String(index + 1).padStart(5, "0")}`, citizen_issued_on: "2021-06-15",
    citizen_issued_by: "Cục Cảnh sát QLHC về TTXH",
    hometown_province_code: province.code, hometown_province_name: province.label, hometown_ward_code: ward.code, hometown_ward_name: ward.label,
    permanent_province_code: province.code, permanent_province_name: province.label, permanent_ward_code: ward.code, permanent_ward_name: ward.label,
  }), `identity ${a.who}`);
  await q(db.from("union_membership_details").insert({
    application_id: app.id, joined_union_on: "2019-03-26", joined_union_at: "Chi đoàn 10A1, THPT Nguyễn Du",
  }), `membership details ${a.who}`);
  await q(db.from("union_qualification_details").insert({
    application_id: app.id, education_level_id: ref("education_level"), specialization_id: ref("specialization"),
    political_theory_id: ref("political_theory"), it_level_id: ref("it_level"), foreign_language_id: ref("foreign_language"),
    occupation_id: ref("occupation"),
  }), `qualification ${a.who}`);
  if (recognized) {
    await q(db.from("union_memberships").insert({
      user_id: person.id, recognized_application_id: app.id, recognized_on: day(-15), recognized_by: people.mai.id, role_grant_id: officeGrant,
    }), `union_memberships ${a.who}`);
  }
}

console.log("SEED_DEMO_OK");
console.table(Object.values(people).map((p) => ({ MSSV: p.code, "Họ tên": p.name, Lớp: p.cls, Email: p.email })));
console.log(`PIN của mọi tài khoản demo: ${DEMO_PIN}`);
