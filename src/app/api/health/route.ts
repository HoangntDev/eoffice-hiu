import { NextResponse } from "next/server";
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
  return NextResponse.json(
    { app: "ok", db, version: APP_VERSION },
    { status: db === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
