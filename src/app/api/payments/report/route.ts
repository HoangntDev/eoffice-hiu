import { requireUser } from "@/lib/auth/dal";
import { apiError, HttpError } from "@/lib/http";
import { buildUnionFeeCsv, type UnionFeeCsvRow } from "@/modules/payments/csv";

type ReportRow = {
  student_code: string;
  full_name: string;
  class_code: string;
  monthly_amount: number;
  paid_months: number;
  paid_at: string | null;
  transaction_ref: string | null;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");
    const classId = url.searchParams.get("classId");
    if (!campaignId || !/^[0-9a-f-]{36}$/i.test(campaignId)) throw new HttpError(422, "INVALID_CAMPAIGN", "Khoản thu không hợp lệ.");
    if (classId && !/^[0-9a-f-]{36}$/i.test(classId)) throw new HttpError(422, "INVALID_CLASS", "Lớp không hợp lệ.");
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("faculty_union_fee_report", {
      p_campaign_id: campaignId,
      p_class_id: classId || null,
    });
    if (error) throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền xuất danh sách của Khoa này.");
    const rows = (data ?? []) as ReportRow[];
    const csvRows: UnionFeeCsvRow[] = rows.map((row) => ({
      studentCode: row.student_code,
      fullName: row.full_name,
      classCode: row.class_code,
      monthlyAmount: row.monthly_amount,
      paidMonths: Array.from({ length: row.paid_months }, (_, index) => index + 1),
      paidAt: row.paid_at,
      transactionRef: row.transaction_ref,
    }));
    return new Response(`\uFEFF${buildUnionFeeCsv(csvRows)}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="doan-phi-${campaignId.slice(0, 8)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
