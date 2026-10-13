import { z } from "zod";

// Dãy 10 chữ số liền: dạng MSSV. Bài công khai không được chứa (DB cũng chặn bằng publication_text_violation).
export const STUDENT_CODE_PATTERN = /(^|\D)\d{10}(\D|$)/;
export const FACEBOOK_URL_PATTERN = /^https:\/\/(((www|m|web)\.)?facebook\.com|fb\.watch)\/\S+$/;

export function containsStudentCode(text: string) {
  return STUDENT_CODE_PATTERN.test(text);
}

const noStudentCode = "Bài công khai không được chứa MSSV.";
const title = z.string().trim().min(10, "Tiêu đề tối thiểu 10 ký tự.").max(200)
  .refine((value) => !containsStudentCode(value), noStudentCode);
const body = z.string().trim().min(50, "Nội dung tối thiểu 50 ký tự.").max(20000)
  .refine((value) => !containsStudentCode(value), noStudentCode);
const optionalReason = z.string().trim().max(2000).nullish().transform((value) => value || null);

export const publicationSources = ["manual", "generated", "proposal"] as const;
export type PublicationSource = (typeof publicationSources)[number];

export const proposalSchema = z.object({ title, body }).strict();

export const savePublicationSchema = z
  .object({ title, body, source: z.enum(publicationSources), proposalId: z.uuid().nullish(), reason: optionalReason })
  .strict()
  .refine((input) => (input.source === "proposal") === Boolean(input.proposalId), {
    path: ["proposalId"],
    message: "Bản nháp từ đề xuất phải chọn đề xuất.",
  });

export const facebookPostSchema = z
  .object({
    url: z.string().trim().min(1, "Nhập đường dẫn bài Facebook.").max(500)
      .regex(FACEBOOK_URL_PATTERN, "Đường dẫn phải là bài trên facebook.com (https)."),
    postedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Nhập thời gian đăng thực tế."),
    reason: optionalReason,
  })
  .strict();

export type PublicationStatus = "awaiting" | "published";

export const publicationStatusLabels: Record<PublicationStatus, string> = {
  awaiting: "Chờ đăng bài",
  published: "Đã đăng bài",
};

export const sourceLabels: Record<PublicationSource, string> = {
  manual: "Ban tự viết",
  generated: "Bản nháp sinh từ dữ liệu chương trình",
  proposal: "Nội dung đề xuất của Khoa",
};

export const revisionActionLabels: Record<string, string> = {
  awaiting: "Nghiệm thu xong, chuyển sang Chờ đăng bài",
  proposal_submitted: "Khoa gửi nội dung đề xuất",
  draft_saved: "Ban lưu bản nháp",
  edited_after_publish: "Ban sửa bài đã đăng",
  cover_set: "Ban đặt ảnh đại diện",
  eoffice_published: "Xuất bản trên cổng E-Office",
  facebook_recorded: "Ghi bài Facebook",
  completed: "Đánh dấu Đã đăng bài",
};

export const publicationMissingLabels: Record<string, string> = {
  title: "Tiêu đề",
  body: "Nội dung",
  cover: "Ảnh đại diện",
  eoffice: "Bài trên cổng E-Office",
  facebook_url: "Đường dẫn bài Facebook",
  facebook_posted_at: "Thời gian đăng Facebook",
};
