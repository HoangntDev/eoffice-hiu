import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError, readJson } from "@/lib/http";
import { logEvent, requestIdFrom } from "@/lib/log";
import { registrationRpcError } from "@/modules/program-registrations/errors";
import { registerSchema } from "@/modules/program-registrations/schemas";

// BTC xem danh sách (RPC chỉ trả cho Đoàn Khoa sở hữu; có điểm uy tín khi chương trình giới hạn + cần duyệt).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await params).id);
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("list_program_registrations", { p_program_id: id });
    if (error) throw registrationRpcError(error.message);
    return NextResponse.json({ registrations: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

// Sinh viên đăng ký: kiểm tra đối tượng, trùng, chỉ tiêu và mẫu đăng ký trong cùng một transaction.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    const id = z.uuid().parse((await params).id);
    const input = registerSchema.parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.rpc("register_for_program", {
      p_program_id: id,
      p_answers: input.answers,
      p_identity_snapshot: input.identity_snapshot ?? null,
      p_request_id: requestId,
    });
    if (error) {
      logEvent("warn", "program_registration.register_rejected", { requestId, userId: user.id, programId: id, code: error.message });
      throw registrationRpcError(error.message);
    }
    const result = data as { registration_id: string; status: "accepted" | "pending" };
    logEvent("info", "program_registration.registered", { requestId, userId: user.id, programId: id, status: result.status });
    return NextResponse.json(
      {
        ...result,
        message: result.status === "accepted"
          ? "Đăng ký thành công. Bạn đã được xác nhận tham gia."
          : "Đã gửi đăng ký. Ban tổ chức sẽ xét duyệt và cập nhật kết quả tại trang chương trình.",
      },
      { status: 201, headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    return apiError(error);
  }
}
