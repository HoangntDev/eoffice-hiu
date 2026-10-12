import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { eventProgramRpcError } from "@/modules/event-programs/errors";
import { saveEventProgramSchema } from "@/modules/event-programs/schemas";

const listColumns =
  "id, owner_org_id, title, location, starts_at, ends_at, status, submission_count, submitted_at, decided_at, updated_at, organization_units(name)";

// RLS decides visibility: approved for everyone, own faculty for Đoàn Khoa, non-draft for Văn phòng.
export async function GET(request: Request) {
  try {
    const { supabase } = await requireUser();
    const status = new URL(request.url).searchParams.get("status");
    let query = supabase.from("event_programs").select(listColumns).order("updated_at", { ascending: false }).limit(500);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new Error("LIST_EVENT_PROGRAMS_FAILED");
    return NextResponse.json({ programs: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const input = saveEventProgramSchema.parse(await readJson(request));
    if (!input.ownerOrgId) throw new HttpError(422, "OWNER_REQUIRED", "Chọn Đoàn Khoa lập kế hoạch.");
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("save_event_program", {
      p_id: null,
      p_owner_org_id: input.ownerOrgId,
      p_title: input.title,
      p_summary: input.summary,
      p_location: input.location,
      p_starts_at: input.startsAt ?? null,
      p_ends_at: input.endsAt ?? null,
      p_expected_participants: input.expectedParticipants ?? null,
      p_plan_number: input.planNumber,
      p_plan_signed_on: input.planSignedOn ?? null,
      p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "event_program.create_rejected", { requestId, userId: user.id, code: error.message });
      throw eventProgramRpcError(error.message);
    }
    logEvent("info", "event_program.created", { requestId, userId: user.id, programId: data });
    return NextResponse.json({ id: data }, { status: 201, headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
