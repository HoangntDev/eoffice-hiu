// Programs happen at HIU, so datetime inputs are interpreted in Vietnam time (UTC+07:00, no DST)
// on both server render and browser, avoiding timezone-dependent hydration differences.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function toVietnamInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 16);
}

export function fromVietnamInputValue(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return `${value}:00+07:00`;
}

export function formatVietnamDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
}
