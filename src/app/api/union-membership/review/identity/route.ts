import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";

const schema = z.object({ applicationId: z.uuid() }).strict();

export async function POST(request: Request) {
  try {
    const { supabase } = await requireUser();
    const { applicationId } = schema.parse(await readJson(request));
    const { data, error } = await supabase.rpc("read_union_identity_for_review", { p_application_id: applicationId }).single();
    if (error?.code === "42501") throw new HttpError(403, "FORBIDDEN", "Hồ sơ không thuộc phạm vi xét duyệt của bạn.");
    if (error?.code === "P0002") throw new HttpError(404, "IDENTITY_NOT_FOUND", "Hồ sơ chưa có thông tin định danh.");
    if (error || !data) throw new Error("IDENTITY_READ_FAILED");
    return NextResponse.json({ identity: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
