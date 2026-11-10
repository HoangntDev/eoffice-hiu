import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, HttpError, readJson } from "@/lib/http";
import { createUserSupabase } from "@/lib/supabase/server";

const schema = z.object({
  key: z.enum(["ORG_ACCOUNTS_ENABLED", "PAYMENT_ENABLED"]),
  enabled: z.boolean(),
  reason: z.string().trim().min(3),
}).strict();

export async function POST(request: Request) {
  try {
    const input = schema.parse(await readJson(request));
    const supabase = await createUserSupabase();
    const { data, error } = await supabase.rpc("set_feature_flag", {
      p_key: input.key, p_enabled: input.enabled, p_reason: input.reason,
    });
    if (error || data !== true) throw new HttpError(403, "FORBIDDEN", "Không thể đổi công tắc hệ thống.");
    const label = input.key === "PAYMENT_ENABLED" ? "thanh toán Đoàn phí" : "tài khoản tổ chức";
    return NextResponse.json({ message: `Đã ${input.enabled ? "bật" : "tắt"} ${label}.` });
  } catch (error) { return apiError(error); }
}
