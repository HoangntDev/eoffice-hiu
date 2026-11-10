export type EventProgramBasePath = "/programs" | "/admin/programs" | "/admin/reviews";

export function eventProgramPath(basePath: EventProgramBasePath, ...segments: string[]) {
  return [basePath, ...segments.map((segment) => encodeURIComponent(segment))].join("/");
}
