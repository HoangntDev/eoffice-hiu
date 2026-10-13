import type { AudienceRule } from "@/modules/forms/schemas";

// Điều kiện đối tượng của UC7 dùng chung định dạng audience_rule của hệ thống biểu mẫu.
// Trình soạn của BTC chỉ tạo dạng: SV HIU [và (Khoa… hoặc ngành…)] [và Đoàn viên].

export type AudienceSelection = { facultyIds: string[]; majorIds: string[]; unionOnly: boolean };
export type QuotaKind = "faculty" | "major" | "union_member";
export type NameLookup = { faculties: Map<string, string>; majors: Map<string, string> };

export function buildAudienceRule(selection: AudienceSelection): AudienceRule {
  const conditions: AudienceRule[] = [{ type: "hiu_student" }];
  const scope: AudienceRule[] = [
    ...selection.facultyIds.map((id): AudienceRule => ({ type: "faculty", faculty_id: id })),
    ...selection.majorIds.map((id): AudienceRule => ({ type: "major", program_id: id })),
  ];
  if (scope.length === 1) conditions.push(scope[0]);
  if (scope.length > 1) conditions.push({ type: "or", conditions: scope });
  if (selection.unionOnly) conditions.push({ type: "union_member" });
  return conditions.length === 1 ? conditions[0] : { type: "and", conditions };
}

export function parseAudienceRule(rule: AudienceRule | null | undefined): AudienceSelection {
  const selection: AudienceSelection = { facultyIds: [], majorIds: [], unionOnly: false };
  const visit = (node: AudienceRule) => {
    if (node.type === "faculty") selection.facultyIds.push(node.faculty_id);
    else if (node.type === "major") selection.majorIds.push(node.program_id);
    else if (node.type === "union_member") selection.unionOnly = true;
    else if (node.type === "and" || node.type === "or") node.conditions.forEach(visit);
  };
  if (rule) visit(rule);
  return selection;
}

export function quotaRule(kind: QuotaKind, targetId: string | null): AudienceRule {
  if (kind === "faculty" && targetId) return { type: "faculty", faculty_id: targetId };
  if (kind === "major" && targetId) return { type: "major", program_id: targetId };
  return { type: "union_member" };
}

export function parseQuotaRule(rule: AudienceRule): { kind: QuotaKind; targetId: string | null } {
  if (rule.type === "faculty") return { kind: "faculty", targetId: rule.faculty_id };
  if (rule.type === "major") return { kind: "major", targetId: rule.program_id };
  return { kind: "union_member", targetId: null };
}

export function describeAudience(rule: AudienceRule, names: NameLookup): string {
  switch (rule.type) {
    case "any": return "Mọi người";
    case "hiu_student": return "Sinh viên HIU";
    case "faculty": return `Khoa ${names.faculties.get(rule.faculty_id) ?? "(không rõ)"}`;
    case "major": return `Ngành ${names.majors.get(rule.program_id) ?? "(không rõ)"}`;
    case "union_member": return "Đoàn viên";
    case "and": return rule.conditions.map((c) => describeAudience(c, names)).join(" · ");
    case "or": return rule.conditions.map((c) => describeAudience(c, names)).join(" hoặc ");
  }
}
