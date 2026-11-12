import Link from "next/link";
import { UnionFeeCampaignForm } from "@/components/union-fee-campaign-form";
import type { createUserSupabase } from "@/lib/supabase/server";

type Campaign = { id: string; calendar_year: number; monthly_amount: number; created_at: string };
type ReportRow = {
  student_user_id: string;
  student_code: string;
  full_name: string;
  class_id: string;
  class_code: string;
  monthly_amount: number;
  paid_months: number;
  paid_at: string | null;
  transaction_ref: string | null;
};

export async function UnionFeeManagement({
  supabase,
  searchParams,
  basePath,
}: {
  supabase: Awaited<ReturnType<typeof createUserSupabase>>;
  searchParams: Promise<{ campaign?: string; class?: string }>;
  basePath: "/admin/payments" | "/payments/manage";
}) {
  const query = await searchParams;
  const { data: campaignData } = await supabase
    .from("union_fee_campaigns")
    .select("id, calendar_year, monthly_amount, created_at")
    .order("calendar_year", { ascending: false });
  const campaigns = (campaignData ?? []) as Campaign[];
  const campaignId = query.campaign && campaigns.some((campaign) => campaign.id === query.campaign)
    ? query.campaign
    : campaigns[0]?.id;
  let report: ReportRow[] = [];
  if (campaignId) {
    const { data } = await supabase.rpc("faculty_union_fee_report", {
      p_campaign_id: campaignId,
      p_class_id: query.class || null,
    });
    report = (data ?? []) as ReportRow[];
  }
  const classes = [...new Map(report.map((row) => [row.class_id, row.class_code])).entries()];

  return <main className="page">
    <div className="page-header"><div>
      <p className="eyebrow">Đối chiếu hệ thống Trung ương</p>
      <h1>Quản lý Đoàn phí</h1>
      <p className="lead">Tạo một mức thu chung cho cả Khoa; hệ thống theo dõi riêng tháng 1–12 để cán bộ nhập lại dữ liệu.</p>
    </div></div>
    <section className="panel"><h2>Tạo khoản thu năm</h2><UnionFeeCampaignForm /></section>
    <section className="panel">
      <div className="page-header"><div><h2>Danh sách đã đóng / chưa đóng</h2></div>
        {campaignId && <a className="button secondary" href={`/api/payments/report?campaignId=${encodeURIComponent(campaignId)}${query.class ? `&classId=${encodeURIComponent(query.class)}` : ""}`}>Xuất CSV</a>}
      </div>
      {campaigns.length === 0 ? <p className="muted">Chưa có khoản thu nào.</p> : <>
        <div className="inline">
          <span>Năm:</span>
          {campaigns.map((campaign) => <Link key={campaign.id} className="button secondary small" href={`${basePath}?campaign=${campaign.id}`}>
            {campaign.calendar_year} · {campaign.monthly_amount.toLocaleString("vi-VN")} đ/tháng
          </Link>)}
        </div>
        {classes.length > 0 && <div className="inline">
          <Link href={`${basePath}?campaign=${campaignId}`} className="button secondary small">Tất cả lớp</Link>
          {classes.map(([id, code]) => <Link key={id} href={`${basePath}?campaign=${campaignId}&class=${id}`} className="button secondary small">{code}</Link>)}
        </div>}
        <div className="table-wrap"><table className="cards-on-mobile"><thead><tr>
          <th>MSSV</th><th>Họ tên</th><th>Lớp</th><th>Mức/tháng</th><th>Tháng đã đóng</th><th>Ngày đóng</th><th>Mã giao dịch</th>
        </tr></thead><tbody>{report.map((row) => <tr key={row.student_user_id}>
          <td>{row.student_code}</td><td>{row.full_name}</td><td>{row.class_code}</td>
          <td>{row.monthly_amount.toLocaleString("vi-VN")} đ</td>
          <td><span className={`status ${row.paid_months === 12 ? "reg-accepted" : "reg-pending"}`}>{row.paid_months === 12 ? "1–12" : "Chưa đóng"}</span></td>
          <td>{row.paid_at ? new Date(row.paid_at).toLocaleString("vi-VN") : "—"}</td><td>{row.transaction_ref ?? "—"}</td>
        </tr>)}</tbody></table></div>
      </>}
    </section>
  </main>;
}
