// fetch bọc quanh mọi lời gọi tới Supabase (PostgREST, Auth, Storage) để ghi log khi lỗi hoặc chậm.
// Chỉ ghi tên thao tác (bảng/hàm/endpoint), không ghi query string, header hay body: các phần đó có thể
// chứa MSSV, email, PIN hoặc token.
import { dbSlowMs } from "@/lib/env";
import { logEvent } from "@/lib/log";

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REST_VERB: Record<string, string> = { GET: "select", HEAD: "count", POST: "insert", PATCH: "update", PUT: "upsert", DELETE: "delete" };
// Mã lỗi Postgres/PostgREST cho thấy lỗi kết nối, tài nguyên hoặc lược đồ (thiếu bảng/hàm/cột).
// Không tính lỗi nghiệp vụ (P0001 do RAISE), RLS từ chối (42501), không có dòng (PGRST116), JWT hết hạn (PGRST3xx).
const INFRA_PG_CODE = /^(08|42(?!501)|53|54|57|58|XX|PGRST0|PGRST2)/;

function urlOf(input: RequestInfo | URL): URL | null {
  try {
    if (input instanceof URL) return input;
    return new URL(typeof input === "string" ? input : input.url);
  } catch {
    return null;
  }
}

export function supabaseOperation(input: RequestInfo | URL, method = "GET"): string {
  const url = urlOf(input);
  if (!url) return "unknown";
  const parts = url.pathname.split("/").filter(Boolean).map((part) => (UUID_LIKE.test(part) ? ":id" : part));
  const [service, , ...rest] = parts; // ví dụ: rest, v1, rpc, ten_ham
  if (service === "rest") {
    if (rest[0] === "rpc") return `rpc.${rest[1] ?? "?"}`;
    return `${REST_VERB[method.toUpperCase()] ?? method.toLowerCase()}.${rest[0] ?? "?"}`;
  }
  if (service === "auth") return `auth.${rest.slice(0, 2).join("/") || "?"}`;
  if (service === "storage") return `storage.${method.toLowerCase()}.${rest.slice(0, 2).join("/") || "?"}`;
  return `${service ?? "?"}.${method.toLowerCase()}`;
}

async function pgCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.clone().json()) as { code?: unknown; error_code?: unknown };
    const code = body.code ?? body.error_code;
    return code === undefined || code === null ? undefined : String(code);
  } catch {
    return undefined;
  }
}

export function instrumentedFetch(source: string, baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const operation = supabaseOperation(input, method);
    const started = performance.now();
    let response: Response;
    try {
      response = await baseFetch(input, init);
    } catch (error) {
      const cause = (error as { cause?: { code?: unknown } }).cause;
      logEvent("error", "db.call_failed", {
        source,
        operation,
        durationMs: Math.round(performance.now() - started),
        errorCode: cause?.code ? String(cause.code) : (error as Error)?.name ?? "FETCH_FAILED",
        errorMessage: (error as Error)?.message,
      });
      throw error;
    }
    const durationMs = Math.round(performance.now() - started);
    if (response.status >= 500) {
      logEvent("error", "db.call_failed", { source, operation, durationMs, status: response.status, errorCode: await pgCode(response) });
    } else if (response.status >= 400) {
      const code = await pgCode(response);
      if (code && INFRA_PG_CODE.test(code)) {
        logEvent("error", "db.call_failed", { source, operation, durationMs, status: response.status, errorCode: code });
      }
    }
    if (durationMs > dbSlowMs()) {
      logEvent("warn", "db.slow", { source, operation, durationMs, status: response.status, thresholdMs: dbSlowMs() });
    }
    return response;
  };
}
