// Câu thông báo cho người dùng, dùng chung giữa proxy và route handler (không kéo theo module server-only).
export function configMessage(reference: string) {
  return `Hệ thống tạm thời chưa sẵn sàng do lỗi cấu hình. Vui lòng thử lại sau hoặc báo Văn phòng Đoàn – Hội. Mã tham chiếu: ${reference}.`;
}

export function authUnavailableMessage(reference: string) {
  return `Hệ thống tạm thời không kiểm tra được phiên đăng nhập. Vui lòng thử lại sau ít phút hoặc báo Văn phòng Đoàn – Hội. Mã tham chiếu: ${reference}.`;
}
