import { describe, expect, it } from "vitest";
import { buildGeneratedDraft } from "@/modules/program-publication/draft";
import { publicationRpcError } from "@/modules/program-publication/errors";
import { facebookPostSchema, proposalSchema, savePublicationSchema } from "@/modules/program-publication/schemas";

const facts = {
  program_title: "Ngày hội Xuân tình nguyện", organization_name: "Đoàn Khoa Công nghệ – Kỹ thuật",
  starts_at: "2026-09-01T01:00:00Z", ends_at: "2026-09-01T10:00:00Z", location: "Hội trường A",
  session_count: 2, participant_count: 37,
};
const body = "Ngày 01/09/2026, Đoàn Khoa tổ chức chương trình tại Hội trường A với nhiều hoạt động ý nghĩa cho sinh viên.";

describe("UC10 bản nháp sinh từ dữ liệu", () => {
  it("chỉ dùng số liệu tổng hợp, đủ dài để lưu", () => {
    const draft = buildGeneratedDraft(facts);
    expect(draft.title).toContain("Ngày hội Xuân tình nguyện");
    expect(draft.body).toContain("01/09/2026");
    expect(draft.body).toContain("37 sinh viên");
    expect(draft.body).not.toMatch(/\d{10}/);
    expect(savePublicationSchema.safeParse({ ...draft, source: "generated" }).success).toBe(true);
  });
});

describe("UC10 kiểm tra nội dung công khai", () => {
  it("chặn MSSV trong tiêu đề và nội dung", () => {
    expect(proposalSchema.safeParse({ title: "Khen thưởng SV 2026990005", body }).success).toBe(false);
    expect(savePublicationSchema.safeParse({ title: "Tiêu đề hợp lệ dài", body: `${body} 2026990005`, source: "manual" }).success).toBe(false);
    expect(savePublicationSchema.safeParse({ title: "Tiêu đề hợp lệ dài", body, source: "manual" }).success).toBe(true);
  });
  it("bản nháp từ đề xuất phải chọn đề xuất", () => {
    expect(savePublicationSchema.safeParse({ title: "Tiêu đề hợp lệ dài", body, source: "proposal" }).success).toBe(false);
  });
});

describe("UC10 bài Facebook", () => {
  it("bắt buộc URL Facebook https và thời gian đăng", () => {
    expect(facebookPostSchema.safeParse({ url: "", postedAt: "2026-10-13T09:00" }).success).toBe(false);
    expect(facebookPostSchema.safeParse({ url: "https://example.com/p/1", postedAt: "2026-10-13T09:00" }).success).toBe(false);
    expect(facebookPostSchema.safeParse({ url: "http://facebook.com/p/1", postedAt: "2026-10-13T09:00" }).success).toBe(false);
    expect(facebookPostSchema.safeParse({ url: "https://www.facebook.com/doantruong/posts/1", postedAt: "" }).success).toBe(false);
    expect(facebookPostSchema.safeParse({ url: "https://www.facebook.com/doantruong/posts/1", postedAt: "2026-10-13T09:00" }).success).toBe(true);
  });
  it("lỗi thiếu dữ liệu được dịch sang tiếng Việt", () => {
    const error = publicationRpcError("MISSING_PUBLICATION_DATA:facebook_url,facebook_posted_at");
    expect(error.status).toBe(422);
    expect(error.message).toBe("Còn thiếu: Đường dẫn bài Facebook, Thời gian đăng Facebook.");
    expect(publicationRpcError("PROGRAM_NOT_ACCEPTED").status).toBe(409);
    expect(publicationRpcError("FORBIDDEN").status).toBe(403);
  });
});
