// Log JSON có cấu trúc, mỗi sự kiện một dòng. Không bao giờ ghi nội dung PDF, PIN, token, cookie, email đầy đủ.
// File này chạy được ở mọi runtime: chỉ ghi console. Ghi file (winston) do src/lib/log-node.ts gắn vào
// lúc khởi động ở runtime Node, qua sink trên globalThis, nên các route không phải nạp winston.
import { logLevel, type LogLevel as Level } from "@/lib/env";

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogSink = (level: Level, line: string) => void;
const SINK_KEY = Symbol.for("eoffice.logSink");
type SinkHolder = { [SINK_KEY]?: LogSink };

export function setLogSink(sink: LogSink | undefined) {
  (globalThis as SinkHolder)[SINK_KEY] = sink;
}

export function requestIdFrom(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  return incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
}

// MSSV 10 số → "221***34": giữ 3 số đầu, 2 số cuối để tra cứu, che phần giữa.
export function maskStudentCode(value: unknown): string {
  const code = String(value ?? "").trim();
  if (code.length < 6) return "***";
  return `${code.slice(0, 3)}***${code.slice(-2)}`;
}

// "nguyenvana@student.hiu.vn" → "n***@student.hiu.vn".
export function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at < 1) return "***";
  return `${value[0]}***${value.slice(at)}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Khóa có tên như sau bị bỏ hẳn khỏi dòng log (không ghi cả giá trị lẫn tên).
const FORBIDDEN_KEY = /(pin|password|passwd|token|secret|cookie|authorization|pepper|(api|service_?role|private|secret|access|signing|publishable)_?key)$/i;
const STUDENT_CODE_KEY = /^(studentCode|student_code|mssv)$/i;

function sanitize(value: unknown, depth: number): unknown {
  if (typeof value === "string") return EMAIL_PATTERN.test(value) ? maskEmail(value) : value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return depth > 3 ? "[…]" : value.map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    if (depth > 3) return "[…]";
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key) || item === undefined) continue;
      if (STUDENT_CODE_KEY.test(key) && item === null) continue;
      out[key] = STUDENT_CODE_KEY.test(key) ? maskStudentCode(item) : sanitize(item, depth + 1);
    }
    return out;
  }
  return value;
}

export function formatLogLine(level: Level, event: string, fields: Record<string, unknown> = {}): string {
  const { source, requestId, ...rest } = sanitize(fields, 0) as Record<string, unknown>;
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    source: typeof source === "string" && source ? source : event.split(".")[0],
    event,
    ...(requestId ? { requestId } : {}),
    ...rest,
  });
}

export function isLevelEnabled(level: Level): boolean {
  return order[level] >= order[logLevel()];
}

export function logEvent(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (!isLevelEnabled(level)) return;
  const line = formatLogLine(level, event, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
  try {
    (globalThis as SinkHolder)[SINK_KEY]?.(level, line);
  } catch {
    // Ghi file lỗi không được làm hỏng request.
  }
}

// Lỗi → các trường an toàn để ghi log (stack chỉ ghi ở mức error).
export function errorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: { code?: unknown } }).cause;
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(cause && typeof cause === "object" && "code" in cause ? { errorCode: String(cause.code) } : {}),
      stack: error.stack?.split("\n").slice(0, 8).join("\n"),
    };
  }
  return { errorMessage: String(error) };
}
