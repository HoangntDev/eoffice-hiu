import { HttpError } from "@/lib/http";

const known: Array<[code: string, status: number, message: string]> = [
  ["UNAUTHENTICATED", 401, "Vui lòng đăng nhập rồi quét lại mã QR."],
  ["AMEND_FORBIDDEN", 403, "Đã bắt đầu điểm danh: chỉ BCH Đoàn Khoa (faculty_manager) được điều chỉnh quy tắc."],
  ["FORBIDDEN", 403, "Bạn không có quyền thực hiện thao tác điểm danh này."],
  ["REGISTRATION_NOT_ACCEPTED", 403, "Bạn chưa có đăng ký được chấp nhận cho chương trình này."],
  ["PROGRAM_NOT_FOUND", 404, "Không tìm thấy chương trình."],
  ["SESSION_NOT_FOUND", 404, "Không tìm thấy lượt điểm danh."],
  ["PROGRAM_NOT_APPROVED", 409, "Chương trình chưa được Văn phòng chấp thuận."],
  ["SESSION_NOT_OPEN", 409, "Lượt điểm danh chưa mở hoặc đã đóng."],
  ["SESSION_IN_USE", 409, "Không xóa được lượt đã mở điểm danh."],
  ["INVALID_TRANSITION", 409, "Trạng thái lượt không cho phép thao tác này."],
  ["ALREADY_CHECKED_IN", 409, "Bạn đã được ghi nhận điểm danh ở lượt này."],
  ["QR_EXPIRED", 410, "Mã QR đã hết hiệu lực. Vui lòng quét mã mới đang hiển thị."],
  ["WRONG_SESSION", 422, "Mã QR không thuộc lượt điểm danh này."],
  ["QR_INVALID", 422, "Mã QR không hợp lệ. Vui lòng quét mã mới đang hiển thị."],
  ["AMEND_REASON_REQUIRED", 422, "Đã bắt đầu điểm danh: điều chỉnh quy tắc phải ghi lý do (tối thiểu 10 ký tự)."],
  ["REOPEN_REASON_REQUIRED", 422, "Mở lại lượt để điểm danh bổ sung phải ghi lý do (tối thiểu 10 ký tự)."],
  ["REQUIRED_SESSION_NEEDED", 422, "Quy tắc này cần ít nhất một lượt bắt buộc."],
  ["INVALID_SESSION_POINTS", 422, "Điểm một lượt phải là số nguyên không vượt điểm tối đa."],
  ["INVALID_TIERS", 422, "Bậc điểm không hợp lệ (số lượt, điểm nguyên ≤ điểm tối đa, không trùng)."],
  ["INVALID_MAX_POINTS", 422, "Điểm tối đa phải là số nguyên từ 0 đến 100."],
  ["SESSIONS_REQUIRED", 422, "Cần ít nhất một lượt điểm danh."],
];

export function attendanceRpcError(message: string): HttpError {
  const match = known.find(([code]) => message.includes(code));
  if (match) return new HttpError(match[1], match[0], match[2]);
  return new HttpError(500, "INTERNAL_ERROR", "Không thể xử lý điểm danh. Vui lòng thử lại.");
}
