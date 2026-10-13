import type { Question } from "@/modules/forms/schemas";
import { registrationStatusLabels, type RegistrationStatus } from "./schemas";

export type RegistrationListRow = {
  registration_id: string;
  user_id: string;
  student_code: string;
  full_name: string | null;
  class_code: string | null;
  program_name: string | null;
  faculty_name: string | null;
  status: RegistrationStatus;
  quota_label: string | null;
  registered_at: string;
  decided_at: string | null;
  decision_reason: string | null;
  reputation_score: number | null;
  suggested_rank: number | null;
  answers: Record<string, unknown>;
};

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  // Chặn công thức khi mở bằng Excel (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function answerText(question: Question, raw: unknown): unknown {
  const options = new Map((question.options ?? []).map((o) => [o.id, o.label]));
  if (Array.isArray(raw)) return raw.map((id) => options.get(String(id)) ?? String(id));
  if (raw !== null && raw !== undefined && options.size > 0) return options.get(String(raw)) ?? raw;
  return raw;
}

const vnTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "";

// Điểm uy tín không xuất ra tệp: tệp có thể bị chuyển tiếp ngoài BTC.
export function buildRegistrationCsv(rows: RegistrationListRow[], questions: Question[]): string {
  const sorted = [...questions].sort((a, b) => a.order - b.order);
  const header = ["STT", "MSSV", "Họ tên", "Lớp", "Ngành", "Khoa", "Trạng thái", "Nhóm chỉ tiêu",
    "Thời điểm đăng ký", "Thời điểm xử lý", "Lý do từ chối", ...sorted.map((q) => q.label)];
  const lines = rows.map((row, index) => [
    index + 1, row.student_code, row.full_name, row.class_code, row.program_name, row.faculty_name,
    registrationStatusLabels[row.status] ?? row.status, row.quota_label ?? (row.status === "accepted" ? "Chung" : ""),
    vnTime(row.registered_at), vnTime(row.decided_at), row.decision_reason,
    ...sorted.map((q) => answerText(q, row.answers?.[q.id])),
  ].map(escapeCsv).join(","));
  return "﻿" + [header.map(escapeCsv).join(","), ...lines].join("\r\n");
}
