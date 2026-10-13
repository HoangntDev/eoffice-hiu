import { HttpError } from "@/lib/http";
import { missingLabels } from "./schemas";

const known: Array<[code: string, status: number, message: string]> = [
  ["UNAUTHENTICATED", 401, "Vui lòng đăng nhập."],
  ["SELF_REVIEW_FORBIDDEN", 403, "Người nộp hoặc BTC của chương trình không tự nghiệm thu."],
  ["SELF_DECISION_FORBIDDEN", 403, "Không tự xử lý khiếu nại của chính mình."],
  ["REGISTRATION_NOT_ACCEPTED", 403, "Bạn chưa có đăng ký được chấp nhận cho chương trình này."],
  ["FORBIDDEN", 403, "Bạn không có quyền thực hiện thao tác này."],
  ["PROGRAM_NOT_FOUND", 404, "Không tìm thấy chương trình."],
  ["DOCUMENT_NOT_FOUND", 404, "Không tìm thấy tệp."],
  ["COMPLAINT_NOT_FOUND", 404, "Không tìm thấy khiếu nại."],
  ["SESSION_NOT_FOUND", 404, "Không tìm thấy lượt điểm danh."],
  ["TERM_NOT_FOUND", 404, "Không tìm thấy học kỳ."],
  ["ACCEPTANCE_NOT_FOUND", 404, "Chương trình chưa có hồ sơ nghiệm thu."],
  ["TERM_NOT_CONFIGURED", 409, "Ngày bắt đầu chương trình chưa thuộc học kỳ nào. Cần cấu hình học kỳ trước khi nghiệm thu."],
  ["TERM_IN_USE", 409, "Học kỳ đã có nghiệm thu hoặc giao dịch uy tín: không đổi năm học, mã hay ngày."],
  ["TERM_OVERLAP", 409, "Khoảng ngày chồng lên một học kỳ khác."],
  ["TERM_CODE_EXISTS", 409, "Năm học đã có học kỳ với mã này."],
  ["PROGRAM_CANCELLED", 409, "Chương trình đã hủy."],
  ["PROGRAM_ALREADY_ACCEPTED", 409, "Chương trình đã nghiệm thu, không hủy được."],
  ["PROGRAM_NOT_APPROVED", 409, "Chương trình chưa được Văn phòng chấp thuận."],
  ["PROGRAM_NOT_ACCEPTED", 409, "Chương trình chưa được nghiệm thu."],
  ["ATTENDANCE_PLAN_REQUIRED", 409, "Chưa có kế hoạch điểm danh."],
  ["SESSION_STILL_OPEN", 409, "Còn lượt điểm danh đang mở. Đóng tất cả lượt trước khi khóa."],
  ["REGISTRATION_STILL_OPEN", 409, "Đăng ký tham gia còn đang mở. Đóng đăng ký trước khi khóa điểm danh."],
  ["ATTENDANCE_NOT_LOCKED", 409, "Cần khóa điểm danh trước khi lập hồ sơ."],
  ["ATTENDANCE_LOCKED", 409, "Điểm danh đã khóa để nghiệm thu."],
  ["ACCEPTANCE_NOT_EDITABLE", 409, "Hồ sơ đang chờ xét hoặc đã có kết quả, không sửa được."],
  ["SESSION_NEVER_OPENED", 409, "Lượt này chưa từng mở điểm danh."],
  ["ALREADY_CHECKED_IN", 409, "Bạn đã có điểm danh ở lượt này."],
  ["COMPLAINT_EXISTS", 409, "Bạn đã gửi khiếu nại cho lượt này."],
  ["COMPLAINT_DEADLINE_PASSED", 409, "Đã hết hạn khiếu nại (hết học kỳ của chương trình)."],
  ["INVALID_TRANSITION", 409, "Trạng thái hiện tại không cho phép thao tác này."],
  ["DOCUMENT_NOT_UPLOADED", 422, "Tệp chưa được tải lên."],
  ["INVALID_STORAGE_PATH", 422, "Đường dẫn tệp không hợp lệ."],
  ["REASON_REQUIRED", 422, "Cần ghi lý do (tối thiểu 10 ký tự)."],
  ["MESSAGE_REQUIRED", 422, "Nội dung khiếu nại tối thiểu 10 ký tự."],
  ["INVALID_TERM_DATES", 422, "Ngày học kỳ không hợp lệ."],
  ["INVALID_TERM", 422, "Thông tin học kỳ không hợp lệ."],
];

export function acceptanceRpcError(message: string): HttpError {
  const missing = /MISSING_DOCUMENTS:([a-z,]+)/.exec(message);
  if (missing) {
    const parts = missing[1].split(",").map((part) => missingLabels[part] ?? part);
    return new HttpError(422, "MISSING_DOCUMENTS", `Hồ sơ còn thiếu: ${parts.join(", ")}.`);
  }
  const match = known.find(([code]) => message.includes(code));
  if (match) return new HttpError(match[1], match[0], match[2]);
  return new HttpError(500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu. Vui lòng thử lại.");
}
