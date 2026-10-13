import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { apiError } from "@/lib/http";
import { appUrl } from "@/lib/env";
import { attendanceRpcError } from "@/modules/program-attendance/errors";

// BTC lấy mã QR mới của lượt (gọi lại mỗi 30 giây). Token do database ký theo đồng hồ server.
export async function POST(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const sessionId = z.uuid().parse((await params).sessionId);
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("issue_attendance_qr", { p_session_id: sessionId });
    if (error) throw attendanceRpcError(error.message);
    const qr = data as { token: string; issued_at: string; expires_at: string; ttl_seconds: number };
    const url = `${appUrl().replace(/\/$/, "")}/attend/${sessionId}?t=${encodeURIComponent(qr.token)}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return NextResponse.json(
      { url, svg, issuedAt: qr.issued_at, expiresAt: qr.expires_at, ttlSeconds: qr.ttl_seconds, serverNow: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
