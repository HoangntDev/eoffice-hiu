export type UnionFeeCsvRow = {
  studentCode: string;
  fullName: string;
  classCode: string;
  monthlyAmount: number;
  paidMonths: number[];
  paidAt: string | null;
  transactionRef: string | null;
};

const HEADERS = [
  "MSSV", "Họ tên", "Lớp", "Mức/tháng",
  ...Array.from({ length: 12 }, (_, index) => `Tháng ${index + 1}`),
  "Ngày đóng", "Mã giao dịch",
];

function cell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildUnionFeeCsv(rows: UnionFeeCsvRow[]): string {
  const lines = [HEADERS.map(cell).join(",")];
  for (const row of rows) {
    const paid = new Set(row.paidMonths);
    lines.push([
      row.studentCode,
      row.fullName,
      row.classCode,
      row.monthlyAmount,
      ...Array.from({ length: 12 }, (_, index) => paid.has(index + 1) ? "Đã đóng" : "Chưa đóng"),
      row.paidAt ?? "",
      row.transactionRef ?? "",
    ].map(cell).join(","));
  }
  return lines.join("\n");
}
