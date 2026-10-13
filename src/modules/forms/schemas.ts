import { z } from "zod";

// ── Audience rule ─────────────────────────────────────────────────────────────

const baseAudienceRule = z.discriminatedUnion("type", [
  z.object({ type: z.literal("any") }),
  z.object({ type: z.literal("hiu_student") }),
  z.object({ type: z.literal("faculty"), faculty_id: z.string().uuid() }),
  z.object({ type: z.literal("major"), program_id: z.string().uuid() }),
  z.object({ type: z.literal("union_member") }),
]);

export type AudienceRule =
  | z.infer<typeof baseAudienceRule>
  | { type: "and"; conditions: AudienceRule[] }
  | { type: "or"; conditions: AudienceRule[] };

export const audienceRuleSchema: z.ZodType<AudienceRule> = z.lazy(() =>
  z.union([
    baseAudienceRule,
    z.object({ type: z.literal("and"), conditions: z.array(audienceRuleSchema).min(1) }),
    z.object({ type: z.literal("or"),  conditions: z.array(audienceRuleSchema).min(1) }),
  ])
);

// ── Question types ────────────────────────────────────────────────────────────

export const questionTypes = [
  "short_text",
  "long_text",
  "number",
  "date",
  "single_choice",
  "multi_choice",
  "dropdown",
] as const;

export type QuestionType = (typeof questionTypes)[number];

const questionOptionSchema = z.object({
  id:    z.string().min(1),
  label: z.string().min(1).max(300),
  order: z.number().int().min(0),
});

const questionValidationSchema = z.object({
  minLength:     z.number().int().min(0).optional(),
  maxLength:     z.number().int().min(1).optional(),
  min:           z.number().optional(),
  max:           z.number().optional(),
  minDate:       z.string().optional(),
  maxDate:       z.string().optional(),
  format:        z.enum(["email", "phone"]).optional(),
  minSelections: z.number().int().min(1).optional(),
  maxSelections: z.number().int().min(1).optional(),
}).optional();

export const questionSchema = z.object({
  id:           z.string().min(1),
  type:         z.enum(questionTypes),
  label:        z.string().min(1).max(500),
  description:  z.string().max(1000).optional().nullable(),
  required:     z.boolean(),
  order:        z.number().int().min(0),
  options:      z.array(questionOptionSchema).optional(),
  validation:   questionValidationSchema,
  prefill_from: z.string().optional().nullable(),
  base_question: z.boolean().optional(),
});

export type Question = z.infer<typeof questionSchema>;

export const questionsSchema = z.array(questionSchema);

// ── Template schemas ──────────────────────────────────────────────────────────

export const saveTemplateSchema = z.object({
  id:            z.string().uuid().optional().nullable(),
  title:         z.string().min(3).max(200),
  description:   z.string().max(2000).optional().nullable(),
  audience_rule: audienceRuleSchema,
  questions:     questionsSchema,
  status:        z.enum(["draft", "published", "deprecated"]).default("draft"),
});

export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>;

export const publishTemplateVersionSchema = z.object({
  questions: questionsSchema,
  notes:     z.string().max(500).optional().nullable(),
});

// ── Form schemas ──────────────────────────────────────────────────────────────

export const saveFormSchema = z.object({
  id:                        z.string().uuid().optional().nullable(),
  owner_org_id:              z.string().uuid(),
  title:                     z.string().min(3).max(200),
  description:               z.string().max(2000).optional().nullable(),
  audience_rule:             audienceRuleSchema,
  questions:                 questionsSchema,
  allow_multiple_submissions: z.boolean().default(false),
  opens_at:                  z.string().datetime({ offset: true }).optional().nullable(),
  closes_at:                 z.string().datetime({ offset: true }).optional().nullable(),
  confirmation_message:      z.string().max(500).optional().nullable(),
  template_version_id:       z.string().uuid().optional().nullable(),
});

export type SaveFormInput = z.infer<typeof saveFormSchema>;

export const setFormStatusSchema = z.object({
  status: z.enum(["draft", "published", "paused", "closed", "archived"]),
});

// ── Response submission schema ────────────────────────────────────────────────

const answerSchema = z.object({
  question_id:  z.string().min(1),
  answer_value: z.unknown().nullable(),
});

export const submitResponseSchema = z.object({
  respondent_email:   z.string().email("Email không hợp lệ.").optional().nullable(),
  answers:            z.array(answerSchema),
  identity_snapshot:  z.record(z.string(), z.unknown()).optional().nullable(),
});

export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
