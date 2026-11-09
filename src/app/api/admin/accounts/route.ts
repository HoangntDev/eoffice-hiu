import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, HttpError, readJson } from "@/lib/http";
import { createUserSupabase } from "@/lib/supabase/server";

const schema = z.object({
  organizationId: z.uuid(), action: z.enum(["create", "reset_pin", "lock", "unlock"]),
  pin: z.union([z.string().regex(/^\d{6}$/), z.literal("")]).optional(), reason: z.string().trim().min(3),
}).strict();

export async function POST(request: Request) {
  try {
    const input = schema.parse(await readJson(request));
    const supabase = await createUserSupabase();
    const { data, error } = await supabase.rpc("manage_organization_account", {
      p_organization_id: input.organizationId, p_action: input.action,
      p_pin: input.pin || null, p_reason: input.reason,
    });
    if (error || typeof data !== "string") throw new HttpError(422, "ACCOUNT_MANAGEMENT_FAILED", "Không thể cập nhật tài khoản tổ chức.");
    return NextResponse.json({ id: data, message: "Đã cập nhật tài khoản tổ chức." });
  } catch (error) { return apiError(error); }
}
