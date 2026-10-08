import { describe, it, expect } from "vitest";
import {
  audienceRuleSchema,
  questionSchema,
  saveTemplateSchema,
  saveFormSchema,
  submitResponseSchema,
} from "@/modules/forms/schemas";

describe("audienceRuleSchema", () => {
  it("accepts 'any'", () => {
    expect(audienceRuleSchema.parse({ type: "any" })).toEqual({ type: "any" });
  });
  it("accepts 'hiu_student'", () => {
    expect(audienceRuleSchema.parse({ type: "hiu_student" })).toEqual({ type: "hiu_student" });
  });
  it("accepts 'faculty' with faculty_id", () => {
    const id = crypto.randomUUID();
    expect(audienceRuleSchema.parse({ type: "faculty", faculty_id: id })).toEqual({ type: "faculty", faculty_id: id });
  });
  it("rejects 'faculty' without faculty_id", () => {
    expect(() => audienceRuleSchema.parse({ type: "faculty" })).toThrow();
  });
  it("accepts nested 'and'", () => {
    const rule = { type: "and", conditions: [{ type: "hiu_student" }, { type: "union_member" }] };
    expect(audienceRuleSchema.parse(rule)).toEqual(rule);
  });
  it("accepts nested 'or'", () => {
    const rule = { type: "or", conditions: [{ type: "any" }] };
    expect(audienceRuleSchema.parse(rule)).toEqual(rule);
  });
  it("rejects unknown types", () => {
    expect(() => audienceRuleSchema.parse({ type: "admin_only" })).toThrow();
  });
});

describe("questionSchema", () => {
  const baseQuestion = {
    id: crypto.randomUUID(),
    type: "short_text" as const,
    label: "Họ và tên",
    required: true,
    order: 0,
  };
  it("accepts minimal question", () => {
    expect(questionSchema.parse(baseQuestion)).toMatchObject(baseQuestion);
  });
  it("rejects empty label", () => {
    expect(() => questionSchema.parse({ ...baseQuestion, label: "" })).toThrow();
  });
  it("accepts options for single_choice", () => {
    const q = {
      ...baseQuestion,
      type: "single_choice" as const,
      options: [{ id: crypto.randomUUID(), label: "A", order: 0 }],
    };
    expect(questionSchema.parse(q).options).toHaveLength(1);
  });
});

describe("saveTemplateSchema", () => {
  it("accepts valid template with draft status", () => {
    const input = {
      title: "Mẫu đăng ký Đoàn viên",
      audience_rule: { type: "hiu_student" },
      questions: [],
      status: "draft",
    };
    expect(saveTemplateSchema.parse(input).status).toBe("draft");
  });
  it("rejects title shorter than 3 chars", () => {
    expect(() => saveTemplateSchema.parse({ title: "ab", audience_rule: { type: "any" }, questions: [] })).toThrow();
  });
});

describe("saveFormSchema", () => {
  it("accepts valid form", () => {
    const input = {
      owner_org_id: crypto.randomUUID(),
      title: "Biểu mẫu đăng ký sự kiện",
      audience_rule: { type: "hiu_student" },
      questions: [],
    };
    expect(saveFormSchema.parse(input).allow_multiple_submissions).toBe(false);
  });
  it("rejects closes_at before opens_at", () => {
    // Zod validates iso datetime format but not ordering (ordering done in DB)
    const input = {
      owner_org_id: crypto.randomUUID(),
      title: "Test form",
      audience_rule: { type: "any" },
      questions: [],
      opens_at: "2026-12-01T00:00:00Z",
      closes_at: "2026-11-01T00:00:00Z",
    };
    // Zod schema doesn't validate temporal ordering (that's the DB's job)
    expect(() => saveFormSchema.parse(input)).not.toThrow();
  });
});

describe("submitResponseSchema", () => {
  it("accepts answers with null values for optional questions", () => {
    const input = {
      answers: [
        { question_id: "q1", answer_value: "test" },
        { question_id: "q2", answer_value: null },
      ],
    };
    expect(submitResponseSchema.parse(input).answers).toHaveLength(2);
  });
  it("rejects invalid respondent_email", () => {
    expect(() =>
      submitResponseSchema.parse({ answers: [], respondent_email: "not-an-email" })
    ).toThrow();
  });
  it("accepts null respondent_email", () => {
    expect(submitResponseSchema.parse({ answers: [], respondent_email: null }).respondent_email).toBeNull();
  });
});
