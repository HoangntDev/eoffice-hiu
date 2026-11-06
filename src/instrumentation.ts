import type { Instrumentation } from "next";
import { errorFields, logEvent } from "@/lib/log";

export async function register() {
  // winston chỉ chạy được trên Node; runtime khác vẫn ghi console qua logEvent().
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startFileLogging } = await import("@/lib/log-node");
    startFileLogging();
  }
}

function header(headers: Record<string, string | string[] | undefined>, name: string) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

// Lỗi chưa được xử lý ở trang, route handler, server action, proxy.
// Người dùng chỉ thấy trang lỗi thân thiện kèm mã tham chiếu (digest, xem src/app/error.tsx);
// chi tiết kỹ thuật chỉ nằm trong log.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  logEvent("error", "app.unhandled_error", {
    source: `next.${context.routeType}`,
    requestId: header(request.headers, "x-request-id"),
    reference: digest,
    method: request.method,
    // Bỏ query string: có thể chứa mã xác nhận hoặc token trong liên kết email.
    path: request.path.split("?")[0],
    routePath: context.routePath,
    ...errorFields(error),
  });
};
