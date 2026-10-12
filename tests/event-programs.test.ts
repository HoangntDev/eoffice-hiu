import { describe, expect, it } from "vitest";
import { fromVietnamInputValue, toVietnamInputValue } from "@/modules/event-programs/dates";
import { eventProgramRpcError } from "@/modules/event-programs/errors";
import { checkPlanPdf, MAX_PLAN_PDF_BYTES, sanitizeFileName } from "@/modules/event-programs/pdf";
import { reviewEventProgramSchema, saveEventProgramSchema } from "@/modules/event-programs/schemas";
import { availableActions } from "@/modules/event-programs/workflow";

const pdfHead = new TextEncoder().encode("%PDF-1.7");
const orgId = "00000000-0000-4000-8000-0000000000aa";

describe("saveEventProgramSchema", () => {
  it("accepts a minimal draft with only owner and title", () => {
    const parsed = saveEventProgramSchema.parse({ ownerOrgId: orgId, title: "Ngày hội tình nguyện" });
    expect(parsed.summary).toBeNull();
    expect(parsed.location).toBeNull();
  });

  it("rejects end time before start time", () => {
    const result = saveEventProgramSchema.safeParse({
      title: "Ngày hội tình nguyện",
      startsAt: "2026-11-20T08:00:00+07:00",
      endsAt: "2026-11-20T07:00:00+07:00",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["endsAt"]);
  });

  it("rejects client-injected status or workflow fields", () => {
    const result = saveEventProgramSchema.safeParse({ title: "Ngày hội tình nguyện", status: "approved" });
    expect(result.success).toBe(false);
  });

  it("rejects short titles and non-integer participants", () => {
    expect(saveEventProgramSchema.safeParse({ title: "Abc" }).success).toBe(false);
    expect(saveEventProgramSchema.safeParse({ title: "Ngày hội tình nguyện", expectedParticipants: 1.5 }).success).toBe(false);
  });
});

describe("reviewEventProgramSchema", () => {
  it("allows approval without a reason", () => {
    expect(reviewEventProgramSchema.safeParse({ decision: "approve" }).success).toBe(true);
  });

  it("requires a reason of at least 10 characters for changes or rejection", () => {
    expect(reviewEventProgramSchema.safeParse({ decision: "reject" }).success).toBe(false);
    expect(reviewEventProgramSchema.safeParse({ decision: "request_changes", reason: "   ngắn   " }).success).toBe(false);
    expect(reviewEventProgramSchema.safeParse({ decision: "request_changes", reason: "Bổ sung kinh phí dự kiến" }).success).toBe(true);
  });

  it("rejects unknown decisions", () => {
    expect(reviewEventProgramSchema.safeParse({ decision: "publish" }).success).toBe(false);
  });
});

describe("checkPlanPdf", () => {
  it("accepts a PDF with the right extension, MIME type and magic bytes", () => {
    expect(checkPlanPdf({ name: "ke-hoach.pdf", type: "application/pdf", size: 2048 }, pdfHead)).toEqual({
      ok: true,
      fileName: "ke-hoach.pdf",
    });
  });

  it("rejects a renamed non-PDF file", () => {
    const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]);
    const result = checkPlanPdf({ name: "ke-hoach.pdf", type: "application/pdf", size: 2048 }, docx);
    expect(result).toMatchObject({ ok: false, code: "NOT_PDF" });
  });

  it("rejects wrong extension or MIME type even with PDF bytes", () => {
    expect(checkPlanPdf({ name: "ke-hoach.docx", type: "application/pdf", size: 10 }, pdfHead).ok).toBe(false);
    expect(checkPlanPdf({ name: "ke-hoach.pdf", type: "text/plain", size: 10 }, pdfHead).ok).toBe(false);
  });

  it("rejects empty and oversized files", () => {
    expect(checkPlanPdf({ name: "a.pdf", type: "application/pdf", size: 0 }, pdfHead)).toMatchObject({ code: "EMPTY_FILE" });
    expect(checkPlanPdf({ name: "a.pdf", type: "application/pdf", size: MAX_PLAN_PDF_BYTES + 1 }, pdfHead)).toMatchObject({
      code: "FILE_TOO_LARGE",
    });
  });

  it("strips directory components and control characters from file names", () => {
    expect(sanitizeFileName("../../etc/Kế hoạch\u0007.pdf")).toBe("Kế hoạch.pdf");
    expect(sanitizeFileName("C:\\Users\\a\\plan.pdf")).toBe("plan.pdf");
  });
});

describe("Vietnam time conversion", () => {
  it("round-trips datetime-local values as UTC+07:00", () => {
    const iso = fromVietnamInputValue("2026-11-20T08:00");
    expect(iso).toBe("2026-11-20T08:00:00+07:00");
    expect(toVietnamInputValue("2026-11-20T01:00:00Z")).toBe("2026-11-20T08:00");
    expect(fromVietnamInputValue("20/11/2026")).toBeNull();
  });
});

describe("availableActions", () => {
  const manager = { isManager: true, isReviewer: false, hasSubmitted: false };
  const office = { isManager: false, isReviewer: true, hasSubmitted: false };

  it("lets the faculty edit and submit only drafts or programs needing changes", () => {
    expect(availableActions("draft", manager)).toMatchObject({ canEdit: true, canSubmit: true, canReview: false });
    expect(availableActions("needs_changes", manager)).toMatchObject({ canEdit: true, canSubmit: true });
    expect(availableActions("submitted", manager)).toMatchObject({ canEdit: false, canSubmit: false });
    expect(availableActions("approved", manager)).toMatchObject({ canEdit: false, canSubmit: false });
  });

  it("lets the office review only submitted programs it did not submit", () => {
    expect(availableActions("submitted", office).canReview).toBe(true);
    expect(availableActions("draft", office).canReview).toBe(false);
    expect(availableActions("submitted", { ...office, hasSubmitted: true }).canReview).toBe(false);
  });
});

describe("eventProgramRpcError", () => {
  it("maps database codes to HTTP status and Vietnamese messages", () => {
    expect(eventProgramRpcError("FORBIDDEN")).toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(eventProgramRpcError("SELF_REVIEW_FORBIDDEN")).toMatchObject({ status: 403, code: "SELF_REVIEW_FORBIDDEN" });
    expect(eventProgramRpcError("PROGRAM_NOT_EDITABLE")).toMatchObject({ status: 409 });
    expect(eventProgramRpcError("PLAN_DOCUMENT_REQUIRED")).toMatchObject({ status: 422 });
  });

  it("lists missing required fields by label", () => {
    const error = eventProgramRpcError("MISSING_REQUIRED_FIELDS:location,plan_number");
    expect(error.status).toBe(422);
    expect(error.message).toContain("Địa điểm");
    expect(error.message).toContain("Số kế hoạch");
  });

  it("does not leak unknown database errors", () => {
    const error = eventProgramRpcError('duplicate key value violates unique constraint "x"');
    expect(error).toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
    expect(error.message).not.toContain("duplicate");
  });
});
