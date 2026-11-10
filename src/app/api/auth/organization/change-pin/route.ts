import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, HttpError, readJson } from "@/lib/http";
import { createUserSupabase } from "@/lib/supabase/server";

const schema = z.object({ currentPin: z.string().regex(/^\d{6}$/), newPin: z.string().regex(/^\d{6}$/) }).strict();

export async function POST(request: Request) {
  try {
    const input = schema.parse(await readJson(request));
    const supabase = await createUserSupabase();
    const { data, error } = await supabase.rpc("change_organization_pin", {
      p_current_pin: input.currentPin,
      p_new_pin: input.newPin,
    });
    if (error || data !== true) throw new HttpError(422, "PIN_CHANGE_FAILED", "Không thể đổi PIN tổ chức.");
    return NextResponse.json({ message: "Đã đổi PIN tổ chức." });
  } catch (error) {
    return apiError(error);
  }
}
