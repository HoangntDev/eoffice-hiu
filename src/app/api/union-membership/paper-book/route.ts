import { NextResponse } from "next/server";
import { requirePermission, requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { paperBookSchema } from "@/modules/union-membership/schemas";

export async function POST(request: Request) {
  try {
    const input = paperBookSchema.parse(await readJson(request));
    const { supabase } = await requireUser();
    await requirePermission(supabase, "paper_book.record");
    const { data, error } = await supabase.rpc("record_paper_book_event", {
      p_user_id: input.userId,
      p_application_id: input.applicationId ?? null,
      p_event_type: input.eventType,
      p_event_date: input.eventDate,
      p_role_grant_id: input.roleGrantId,
    });
    if (error) throw new HttpError(422, "PAPER_BOOK_EVENT_FAILED", "Không thể ghi nhận sự kiện Sổ Đoàn.");
    return NextResponse.json({ id: data, message: input.eventType === "received" ? "Đã ghi nhận tiếp nhận Sổ Đoàn." : "Đã ghi nhận sinh viên đã rút Sổ Đoàn." });
  } catch (error) {
    return apiError(error);
  }
}
