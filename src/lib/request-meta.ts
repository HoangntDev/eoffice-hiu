// Thông tin request dùng cho log và giới hạn số lần thử. Không đọc cookie hay header xác thực.
type HeaderSource = { get(name: string): string | null };

export function clientIp(headers: HeaderSource): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? headers.get("x-real-ip")
    ?? "unknown";
}
