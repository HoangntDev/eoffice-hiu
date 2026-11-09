import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { errorFields, logEvent } from "@/lib/log";
import { clientIp } from "@/lib/request-meta";
import { configMessage } from "@/lib/user-messages";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Các mã do route tự ghi log chi tiết hơn (đăng nhập sai, quá số lần thử), apiError không ghi lại.
const SELF_LOGGED_CODES = new Set(["INVALID_CREDENTIALS", "TOO_MANY_ATTEMPTS"]);

type RequestContext = { requestId?: string; path?: string; ip?: string };

// Header do src/proxy.ts gắn cho mọi request. Ngoài phạm vi request (ví dụ Vitest) thì trả về rỗng.
async function requestContext(): Promise<RequestContext> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return { requestId: h.get("x-request-id") ?? undefined, path: h.get("x-request-path") ?? undefined, ip: clientIp(h) };
  } catch {
    return {};
  }
}

// Mã ngắn người dùng nhìn thấy; khớp 8 ký tự đầu của requestId trong log.
function referenceFor(context: RequestContext) {
  return (context.requestId ?? crypto.randomUUID()).slice(0, 8);
}

async function currentStudent(): Promise<{ userId?: string; studentCode?: string }> {
  try {
    const { createUserSupabase } = await import("@/lib/supabase/server");
    const supabase = await createUserSupabase();
    const { data } = await supabase.auth.getClaims();
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : undefined;
    if (!userId) return {};
    const { data: account } = await supabase.from("accounts").select("student_code").eq("user_id", userId).maybeSingle();
    return { userId, studentCode: account?.student_code ?? undefined };
  } catch {
    return {};
  }
}

export async function apiError(error: unknown) {
  if (error instanceof HttpError) {
    if ((error.status === 401 || error.status === 403) && !SELF_LOGGED_CODES.has(error.code)) {
      const context = await requestContext();
      const student = error.status === 403 ? await currentStudent() : {};
      logEvent("warn", "auth.access_denied", { source: "api", ...context, code: error.code, status: error.status, ...student });
    }
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Dữ liệu chưa hợp lệ.", fields: error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const context = await requestContext();
  const reference = referenceFor(context);
  // Thiếu (MISSING_ENV) hoặc sai (CONFIG_INVALID) cấu hình: log tên biến, người dùng thấy 503 kèm mã tham chiếu.
  const config = error instanceof Error ? /^(MISSING_ENV|CONFIG_INVALID):(.+)$/.exec(error.message) : null;
  if (config) {
    const [, kind, variable] = config;
    logEvent("error", kind === "MISSING_ENV" ? "config.missing_env" : "config.invalid", {
      source: "api", ...context, reference, variable, problem: kind === "MISSING_ENV" ? "missing" : "rejected",
    });
    return NextResponse.json({ error: "SERVICE_NOT_CONFIGURED", message: configMessage(reference), reference }, { status: 503 });
  }
  logEvent("error", "api.unhandled_error", { source: "api", ...context, reference, ...errorFields(error) });
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: `Không thể xử lý yêu cầu. Vui lòng thử lại. Mã tham chiếu: ${reference}.`, reference },
    { status: 500 },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Nội dung yêu cầu không phải JSON hợp lệ.");
  }
}
