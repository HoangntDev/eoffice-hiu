import { participationLabels, type Participation } from "@/modules/program-attendance/schemas";

export type AcceptanceAttendanceRow = {
  registration_id: string;
  user_id: string;
  student_code: string;
  full_name: string | null;
  class_code: string | null;
  faculty_name: string | null;
  attended_count: number;
  attended_sessions: Array<{ session_id: string; label: string; supplementary: boolean; source: string }>;
  participation: Participation;
  expected_points: number;
};

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Chặn công thức khi mở bằng Excel (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function sessionText(row: AcceptanceAttendanceRow): string {
  return row.attended_sessions
    .map((s) => `${s.label}${s.source === "complaint" ? " (bổ sung qua khiếu nại)" : s.supplementary ? " (bổ sung)" : ""}`)
    .join("; ");
}

// Bảng dữ liệu để BTC lập Đơn đề nghị cấp điểm. Điểm là DỰ KIẾN ĐỀ NGHỊ, không phải điểm Thư ký Khoa đã cấp.
// Không có cột uy tín.
export function buildAcceptanceCsv(rows: AcceptanceAttendanceRow[]): string {
  const header = ["STT", "MSSV", "Họ tên", "Lớp", "Khoa", "Lượt có mặt", "Số lượt", "Kết quả tham gia",
    "Điểm rèn luyện dự kiến đề nghị (chưa được Thư ký Khoa cấp)"];
  const lines = rows.map((row, index) => [
    index + 1, row.student_code, row.full_name, row.class_code, row.faculty_name, sessionText(row), row.attended_count,
    participationLabels[row.participation], row.expected_points,
  ].map(escapeCsv).join(","));
  return `﻿${[header.map(escapeCsv).join(","), ...lines].join("\r\n")}\r\n`;
}
