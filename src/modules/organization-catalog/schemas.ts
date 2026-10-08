import { z } from "zod";

export const catalogMutationSchema = z.object({
  entityType: z.enum(["faculty", "program", "class"]),
  entityId: z.uuid().nullable().optional(),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  parentId: z.uuid().nullable().optional(),
  cohortId: z.uuid().nullable().optional(),
  sourceNumber: z.string().trim().max(100).nullable().optional(),
  sourceOrder: z.number().int().nullable().optional(),
  effectiveDate: z.iso.date(),
  isActive: z.boolean(),
  reason: z.string().trim().min(5).max(500),
  roleGrantId: z.uuid().nullable().optional(),
}).strict();

export const roleGrantSchema = z.object({
  userId: z.uuid(),
  roleCode: z.enum(["school_admin", "office", "committee_manager", "collaborator", "faculty_manager", "faculty_executive"]),
  organizationId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  actorRoleGrantId: z.uuid().nullable().optional(),
}).strict();

export const roleRevokeSchema = z.object({
  grantId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  actorRoleGrantId: z.uuid().nullable().optional(),
}).strict();
