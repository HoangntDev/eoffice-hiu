export type FormManagementBasePath = "/forms" | "/admin/forms";

export function formManagementPath(basePath: FormManagementBasePath, ...segments: string[]) {
  return [basePath, ...segments.map((segment) => encodeURIComponent(segment))].join("/");
}
