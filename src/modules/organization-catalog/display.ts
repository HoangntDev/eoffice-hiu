// Tên Đoàn Khoa được ghép tự động từ "Đoàn Khoa" + tên khoa trong danh mục, mà tên khoa
// đã có sẵn chữ "Khoa" ("Đoàn Khoa Khoa Dược"). Chỉ sửa khi hiển thị; dữ liệu giữ nguyên.
export function displayOrgName(name: string | null | undefined): string {
  if (!name) return "—";
  return name.replace(/^Đoàn Khoa Khoa /, "Đoàn Khoa ");
}
