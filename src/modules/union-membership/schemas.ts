import { z } from "zod";

const requiredText = z.string().trim().min(1).max(250);
const optionalText = z.string().trim().max(250).optional().nullable();

export const unionApplicationSchema = z.object({
  cycleKey: z.string().regex(/^\d{4}-\d{4}$/),
  submit: z.boolean().default(false),
  identity: z.object({
    dateOfBirth: z.iso.date(),
    ethnicity: requiredText,
    religion: requiredText,
    citizenId: z.string().regex(/^\d{9,12}$/),
    citizenIssuedOn: z.iso.date(),
    citizenIssuedBy: requiredText,
    hometownProvinceCode: optionalText,
    hometownProvinceName: requiredText,
    hometownWardCode: optionalText,
    hometownWardName: requiredText,
    permanentProvinceCode: optionalText,
    permanentProvinceName: requiredText,
    permanentWardCode: optionalText,
    permanentWardName: requiredText,
  }).strict(),
  membership: z.object({
    joinedUnionOn: z.iso.date(),
    joinedUnionAt: requiredText,
    admissionResolutionNumber: optionalText,
    unionCardNumber: optionalText,
    joinedPartyOn: z.union([z.iso.date(), z.literal(""), z.null()]).optional(),
  }).strict(),
  qualifications: z.object({
    educationLevelId: z.uuid(),
    specializationId: z.uuid(),
    politicalTheoryId: z.uuid(),
    itLevelId: z.uuid(),
    foreignLanguageId: z.uuid(),
    occupationId: z.uuid(),
  }).strict(),
}).strict();

export const reviewSchema = z.object({
  applicationId: z.uuid(),
  outcome: z.enum(["recommend", "needs_changes", "recognize", "reject"]),
  reason: z.string().trim().min(3).max(1000),
  roleGrantId: z.uuid(),
}).strict();

export const paperBookSchema = z.object({
  userId: z.uuid(),
  applicationId: z.uuid().nullable().optional(),
  eventType: z.enum(["received", "withdrawn"]),
  eventDate: z.iso.date(),
  roleGrantId: z.uuid(),
}).strict();

export const assignmentSchema = z.object({
  applicationId: z.uuid(),
  collaboratorUserId: z.uuid(),
  organizationId: z.uuid(),
  roleGrantId: z.uuid(),
}).strict();

export const checklistSchema = z.object({
  applicationId: z.uuid(),
  checklistItemId: z.uuid(),
  checked: z.boolean(),
  note: z.string().trim().max(500).optional().default(""),
  roleGrantId: z.uuid(),
}).strict();
