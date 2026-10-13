import { HttpError } from "@/lib/http";

const known: Array<[code: string, status: number, message: string]> = [
  ["UNAUTHENTICATED", 401, "Vui lòng đăng nhập để tiếp tục."],
  ["ACCOUNT_NOT_ACTIVE", 403, "Tài khoản chưa kích hoạt nên chưa đăng ký được."],
  ["SELF_DECISION_FORBIDDEN", 403, "Bạn không thể tự duyệt đăng ký của chính mình."],
  ["FORBIDDEN", 403, "Bạn không có quyền thực hiện thao tác này với chương trình."],
  ["AUDIENCE_NOT_MET", 403, "Bạn không thuộc đối tượng được đăng ký chương trình này."],
  ["PROGRAM_NOT_FOUND", 404, "Không tìm thấy chương trình."],
  ["REGISTRATION_NOT_FOUND", 404, "Không tìm thấy đăng ký."],
  ["PROGRAM_NOT_APPROVED", 409, "Chương trình chưa được Văn phòng chấp thuận nên chưa thể mở đăng ký."],
  ["SETTINGS_LOCKED_WHILE_OPEN", 409, "Đang mở đăng ký; hãy đóng đăng ký trước khi sửa cấu hình."],
  ["SETTINGS_REQUIRED", 409, "Cần lưu cấu hình đăng ký trước khi mở."],
  ["PROGRAM_ENDED", 409, "Chương trình đã kết thúc."],
  ["DEADLINE_PASSED", 409, "Hạn đăng ký đã qua; hãy sửa hạn trước khi mở lại."],
  ["REGISTRATION_NOT_OPEN", 409, "Chương trình chưa mở hoặc đã đóng đăng ký."],
  ["REGISTRATION_CLOSED", 409, "Đã hết hạn đăng ký."],
  ["ALREADY_REGISTERED", 409, "Bạn đã đăng ký chương trình này."],
  ["REGISTRATION_FULL", 409, "Chương trình đã đủ chỗ cho nhóm của bạn."],
  ["QUOTA_FULL", 409, "Không còn chỗ phù hợp cho người này (đã đủ tổng số hoặc chỉ tiêu nhóm)."],
  ["ATTENDANCE_LOCKED", 409, "Điểm danh đã khóa để nghiệm thu nên không nhận thêm đăng ký."],
  ["INVALID_TRANSITION", 409, "Trạng thái hiện tại không cho phép thao tác này."],
  ["PENDING_REGISTRATIONS_EXIST", 409, "Còn đăng ký chờ duyệt nên chưa thể bỏ yêu cầu duyệt."],
  ["FORM_LOCKED_AFTER_REGISTRATION", 409, "Đã có người đăng ký nên không đổi mẫu đăng ký."],
  ["QUOTA_IN_USE", 409, "Nhóm chỉ tiêu đã có người được nhận nên không xóa được."],
  ["CAPACITY_BELOW_ACCEPTED", 409, "Số chỗ không được nhỏ hơn số người đã được nhận."],
  ["SKIP_REASON_REQUIRED", 422, "Còn người uy tín cao hơn đang chờ duyệt; nhập lý do (tối thiểu 10 ký tự) để duyệt ngoại lệ."],
  ["REASON_REQUIRED", 422, "Từ chối phải ghi lý do (tối thiểu 10 ký tự)."],
  ["QUOTAS_REQUIRE_CAPACITY", 422, "Chia chỉ tiêu cần đặt tổng số chỗ."],
  ["QUOTAS_EXCEED_CAPACITY", 422, "Tổng chỉ tiêu các nhóm vượt tổng số chỗ."],
  ["RELEASE_REQUIRES_QUOTAS", 422, "Chỉ đặt hạn chuyển chỉ tiêu khi có nhóm chỉ tiêu."],
  ["FORM_NOT_USABLE", 422, "Mẫu đăng ký phải là biểu mẫu đã phát hành của chính Đoàn Khoa."],
  ["REQUIRED_QUESTION_MISSING", 422, "Vui lòng trả lời đầy đủ các câu hỏi bắt buộc."],
  ["FORM_CLOSED", 422, "Mẫu đăng ký đã hết thời gian nhận phản hồi."],
  ["FORM_NOT_YET_OPEN", 422, "Mẫu đăng ký chưa mở nhận phản hồi."],
  ["ALREADY_SUBMITTED", 409, "Bạn đã gửi mẫu này trước đó."],
];

export function registrationRpcError(message: string): HttpError {
  const match = known.find(([code]) => message.includes(code));
  if (match) return new HttpError(match[1], match[0], match[2]);
  return new HttpError(500, "INTERNAL_ERROR", "Không thể xử lý đăng ký. Vui lòng thử lại.");
}
