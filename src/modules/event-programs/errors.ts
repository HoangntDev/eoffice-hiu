import { HttpError } from "@/lib/http";
import { requiredFieldLabels } from "./schemas";

const known: Array<[code: string, status: number, message: string]> = [
  ["UNAUTHENTICATED", 401, "Vui lòng đăng nhập để tiếp tục."],
  ["SELF_REVIEW_FORBIDDEN", 403, "Bạn đã nộp hồ sơ này nên không thể tự xét duyệt."],
  ["OWNER_CHANGE_FORBIDDEN", 403, "Không thể chuyển kế hoạch sang đơn vị khác."],
  ["FORBIDDEN", 403, "Bạn không có quyền thực hiện thao tác này với kế hoạch."],
  ["PROGRAM_NOT_FOUND", 404, "Không tìm thấy kế hoạch."],
  ["PROGRAM_NOT_EDITABLE", 409, "Kế hoạch đang chờ xét hoặc đã có kết quả nên không thể sửa."],
  ["INVALID_TRANSITION", 409, "Trạng thái hiện tại không cho phép thao tác này."],
  ["PLAN_DOCUMENT_REQUIRED", 422, "Cần tải lên bản kế hoạch PDF đã ký trước khi gửi."],
  ["REASON_REQUIRED", 422, "Yêu cầu chỉnh sửa hoặc từ chối phải ghi lý do (tối thiểu 10 ký tự)."],
  ["ENDS_BEFORE_STARTS", 422, "Thời gian kết thúc phải sau thời gian bắt đầu."],
  ["TITLE_TOO_SHORT", 422, "Tên chương trình tối thiểu 5 ký tự."],
  ["DOCUMENT_NOT_UPLOADED", 422, "Tệp chưa được lưu vào kho, vui lòng tải lại."],
  ["INVALID_STORAGE_PATH", 422, "Đường dẫn tệp không hợp lệ."],
];

export function eventProgramRpcError(message: string): HttpError {
  if (message.includes("MISSING_REQUIRED_FIELDS:")) {
    const fields = message.split("MISSING_REQUIRED_FIELDS:")[1]?.split(/[,\s]/).filter(Boolean) ?? [];
    const labels = fields.map((field) => requiredFieldLabels[field] ?? field).join(", ");
    return new HttpError(422, "MISSING_REQUIRED_FIELDS", `Chưa đủ thông tin bắt buộc: ${labels}.`);
  }
  const match = known.find(([code]) => message.includes(code));
  if (match) return new HttpError(match[1], match[0], match[2]);
  return new HttpError(500, "INTERNAL_ERROR", "Không thể xử lý kế hoạch. Vui lòng thử lại.");
}
