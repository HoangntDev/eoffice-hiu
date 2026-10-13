import { HttpError } from "@/lib/http";
import { publicationMissingLabels } from "./schemas";

const known: Array<[code: string, status: number, message: string]> = [
  ["UNAUTHENTICATED", 401, "Vui lòng đăng nhập."],
  ["FORBIDDEN", 403, "Chỉ Ban Tuyên giáo – Truyền thông được biên tập và xuất bản bài."],
  ["PROGRAM_NOT_FOUND", 404, "Không tìm thấy chương trình."],
  ["PROPOSAL_NOT_FOUND", 404, "Không tìm thấy nội dung đề xuất."],
  ["PROGRAM_NOT_ACCEPTED", 409, "Chương trình chưa được Văn phòng nghiệm thu, chưa đăng bài được."],
  ["PROGRAM_CANCELLED", 409, "Chương trình đã hủy."],
  ["ALREADY_PUBLISHED", 409, "Bài đã được xuất bản trên cổng E-Office."],
  ["PUBLICATION_COMPLETED", 409, "Chương trình đã được đánh dấu Đã đăng bài."],
  ["FACEBOOK_TIME_IN_FUTURE", 422, "Thời gian đăng Facebook không được ở tương lai."],
  ["FACEBOOK_TIME_BEFORE_ACCEPTANCE", 422, "Thời gian đăng Facebook phải sau khi chương trình được nghiệm thu."],
  ["FACEBOOK_URL_REQUIRED", 422, "Nhập đường dẫn bài Facebook."],
  ["FACEBOOK_TIME_REQUIRED", 422, "Nhập thời gian đăng Facebook."],
  ["INVALID_FACEBOOK_URL", 422, "Đường dẫn phải là bài trên facebook.com (https)."],
  ["CONTAINS_STUDENT_CODE", 422, "Bài công khai không được chứa MSSV."],
  ["REASON_REQUIRED", 422, "Bài đã đăng: sửa phải ghi lý do (tối thiểu 10 ký tự)."],
  ["DOCUMENT_NOT_UPLOADED", 422, "Ảnh chưa được tải lên."],
  ["INVALID_STORAGE_PATH", 422, "Đường dẫn ảnh không hợp lệ."],
  ["INVALID_SOURCE", 422, "Nguồn bản nháp không hợp lệ."],
];

export function publicationRpcError(message: string): HttpError {
  const missing = /MISSING_PUBLICATION_DATA:([a-z_,]+)/.exec(message);
  if (missing) {
    const parts = missing[1].split(",").map((part) => publicationMissingLabels[part] ?? part);
    return new HttpError(422, "MISSING_PUBLICATION_DATA", `Còn thiếu: ${parts.join(", ")}.`);
  }
  const match = known.find(([code]) => message.includes(code));
  if (match) return new HttpError(match[1], match[0], match[2]);
  return new HttpError(500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu. Vui lòng thử lại.");
}
