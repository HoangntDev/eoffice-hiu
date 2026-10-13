import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import type { Question } from "@/modules/forms/schemas";
import { registrationRpcError } from "@/modules/program-registrations/errors";
import { buildRegistrationCsv, type RegistrationListRow } from "@/modules/program-registrations/export";
import { registrationStatuses } from "@/modules/program-registrations/schemas";

// ?status=accepted (mặc định) | pending | rejected | all
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const status = z.enum([...registrationStatuses, "all"]).catch("accepted")
      .parse(new URL(request.url).searchParams.get("status") ?? "accepted");
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("list_program_registrations", { p_program_id: id });
    if (error) throw registrationRpcError(error.message);
    const rows = ((data ?? []) as RegistrationListRow[])
      .filter((row) => status === "all" || row.status === status)
      .sort((a, b) => a.registered_at.localeCompare(b.registered_at));

    const { data: settings } = await supabase
      .from("program_registration_settings").select("form_id, forms(questions)").eq("program_id", id).maybeSingle();
    const questions = ((settings?.forms as unknown as { questions: Question[] } | null)?.questions ?? []) as Question[];

    logEvent("info", "program_registration.exported", { requestId, userId: user.id, programId: id, status, rows: rows.length });
    return new NextResponse(buildRegistrationCsv(rows, questions), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="dang-ky-${id.slice(0, 8)}-${status}.csv"`,
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
