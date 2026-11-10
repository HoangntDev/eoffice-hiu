import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, HttpError, readJson } from "@/lib/http";
import { createUserSupabase } from "@/lib/supabase/server";

const schema = z.object({ enabled: z.boolean(), reason: z.string().trim().min(3) }).strict();
export async function POST(request: Request) {
  try {
    const input = schema.parse(await readJson(request));
    const supabase = await createUserSupabase();
    const { data, error } = await supabase.rpc("set_feature_flag", {
      p_key: "ORG_ACCOUNTS_ENABLED", p_enabled: input.enabled, p_reason: input.reason,
    });
    if (error || data !== true) throw new HttpError(403, "FORBIDDEN", "Không thể đổi công tắc tài khoản tổ chức.");
    return NextResponse.json({ message: `Đã ${input.enabled ? "bật" : "tắt"} tài khoản tổ chức.` });
  } catch (error) { return apiError(error); }
}
