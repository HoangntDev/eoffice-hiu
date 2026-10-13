// Bản nháp sinh từ dữ liệu chương trình. Chỉ dùng số liệu tổng hợp: không MSSV, không danh sách điểm danh,
// không hồ sơ ký, không điểm rèn luyện hay uy tín. Ban biên tập lại trước khi xuất bản.
export type PublicationFacts = {
  program_title: string;
  organization_name: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  session_count: number;
  participant_count: number;
};

function vnDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function buildGeneratedDraft(facts: PublicationFacts): { title: string; body: string } {
  const start = vnDate(facts.starts_at);
  const end = vnDate(facts.ends_at);
  const when = start === end ? `Ngày ${start}` : `Từ ngày ${start} đến ngày ${end}`;
  const where = facts.location ? ` tại ${facts.location}` : "";
  const title = `${facts.organization_name} tổ chức thành công chương trình “${facts.program_title}”`.slice(0, 200);
  const paragraphs = [
    `${when}, ${facts.organization_name} đã tổ chức chương trình “${facts.program_title}”${where}.`,
    facts.participant_count > 0
      ? `Chương trình thu hút ${facts.participant_count} sinh viên tham gia` +
        (facts.session_count > 1 ? `, gồm ${facts.session_count} hoạt động.` : ".")
      : "Chương trình đã diễn ra theo kế hoạch được Văn phòng Đoàn – Hội chấp thuận.",
    "Ban Tổ chức trân trọng cảm ơn các bạn đoàn viên, sinh viên đã đồng hành cùng chương trình.",
  ];
  return { title, body: paragraphs.join("\n\n") };
}
