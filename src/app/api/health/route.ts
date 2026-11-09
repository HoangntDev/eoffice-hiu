import { NextResponse } from "next/server";
import { configStatus } from "@/lib/config-check";
import { logEvent, requestIdFrom } from "@/lib/log";
import { createPublicSupabase } from "@/lib/supabase/server";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

const DB_CHECK_TIMEOUT_MS = 3000;

// Kiểm tra trạng thái cho giám sát và smoke test. Không trả chi tiết nội bộ (URL, mã lỗi, thông điệp);
// chi tiết nằm trong log với cùng requestId.
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  let db: "ok" | "error" = "error";
  try {
    // Hàm cấp quyền cho anon, chỉ đọc; gọi được nghĩa là PostgREST và Postgres đều phản hồi.
    const { error } = await createPublicSupabase()
      .rpc("is_valid_student_code", { p_student_code: "0000000000" })
      .abortSignal(AbortSignal.timeout(DB_CHECK_TIMEOUT_MS));
    if (error) logEvent("warn", "health.db_unavailable", { requestId, code: error.code, errorMessage: error.message });
    else db = "ok";
  } catch (error) {
    logEvent("warn", "health.db_unavailable", { requestId, errorMessage: error instanceof Error ? error.message : String(error) });
  }
  // Cấu hình thiếu/sai (INC-01): báo "error" nhưng không trả tên biến; tên biến nằm trong log.
  const config = configStatus();
  if (!config.ok) logEvent("warn", "health.config_invalid", { requestId, problems: config.problems });
  const healthy = db === "ok" && config.ok;
  return NextResponse.json(
    { app: config.ok ? "ok" : "error", db, config: config.ok ? "ok" : "error", version: APP_VERSION },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
