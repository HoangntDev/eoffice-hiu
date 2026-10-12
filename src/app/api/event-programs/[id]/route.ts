import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { eventProgramRpcError } from "@/modules/event-programs/errors";
import { saveEventProgramSchema } from "@/modules/event-programs/schemas";

const idSchema = z.uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = idSchema.parse((await params).id);
    const { supabase } = await requireUser();
    const { data: program, error } = await supabase
      .from("event_programs")
      .select("*, organization_units(name)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error("READ_EVENT_PROGRAM_FAILED");
    if (!program) throw new HttpError(404, "PROGRAM_NOT_FOUND", "Không tìm thấy kế hoạch.");
    // Documents/history are filtered by RLS: empty for viewers who only see the approved listing.
    const [{ data: documents }, { data: history }] = await Promise.all([
      supabase.from("event_program_documents")
        .select("id, original_file_name, size_bytes, sha256, uploaded_at")
        .eq("program_id", id).order("uploaded_at", { ascending: false }),
      supabase.from("event_program_history")
        .select("id, action, from_status, to_status, reason, document_id, actor_name, actor_role_code, occurred_at")
        .eq("program_id", id).order("occurred_at", { ascending: true }),
    ]);
    return NextResponse.json({ program, documents: documents ?? [], history: history ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = idSchema.parse((await params).id);
    const input = saveEventProgramSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { error } = await supabase.rpc("save_event_program", {
      p_id: id,
      p_owner_org_id: input.ownerOrgId ?? null,
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
      logEvent("warn", "event_program.update_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw eventProgramRpcError(error.message);
    }
    logEvent("info", "event_program.updated", { requestId, userId: user.id, programId: id });
    return NextResponse.json({ id, message: "Đã lưu kế hoạch." }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return apiError(error);
  }
}
