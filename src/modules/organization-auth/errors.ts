// CR-01-TaiKhoanToChuc (#37): khung cho bước RED. Hàm nào chưa hiện thực thì ném lỗi này.
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`NOT_IMPLEMENTED: ${feature}`);
    this.name = "NotImplementedError";
  }
}
