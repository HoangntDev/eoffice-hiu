import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { passwordSchema } from "@/modules/auth-account/schemas";

const schema = z.object({ password: passwordSchema });

export async function PATCH(request: Request) {
  try {
    const input = schema.parse(await readJson(request));
    const { supabase } = await requireUser();
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw new HttpError(400, "PASSWORD_UPDATE_FAILED", "Không thể cập nhật mật khẩu.");
    return NextResponse.json({ message: "Đã cập nhật mật khẩu." });
  } catch (error) {
    return apiError(error);
  }
}
