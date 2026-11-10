import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PaymentCheckoutButton } from "@/components/payment-checkout-button";
import { getViewer } from "@/lib/auth/viewer";
import { paymentEnabled } from "@/lib/payments";
import { createUserSupabase } from "@/lib/supabase/server";

type Order = {
  id: string;
  order_ref: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  transaction_ref: string | null;
  paid_at: string | null;
  created_at: string;
};
type Campaign = {
  id: string;
  calendar_year: number;
  monthly_amount: number;
  organization_units: { name: string } | null;
  union_fee_orders: Order[];
};

export default async function PaymentsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/payments");
  if (!await paymentEnabled()) notFound();
  const supabase = await createUserSupabase();
  const { data } = await supabase
    .from("union_fee_campaigns")
    .select("id, calendar_year, monthly_amount, organization_units(name), union_fee_orders(id, order_ref, amount, status, transaction_ref, paid_at, created_at)")
    .order("calendar_year", { ascending: false });
  const campaigns = (data ?? []) as unknown as Campaign[];
  const canManage = viewer.roles.some((role) => role === "faculty_manager" || role === "faculty_executive");

  return <main className="page">
    <div className="page-header"><div>
      <p className="eyebrow">Đoàn phí theo tháng</p><h1>Đoàn phí của tôi</h1>
      <p className="lead">Mỗi khoản thu áp dụng một mức theo tháng; sinh viên đóng gộp đủ 12 tháng trong một giao dịch.</p>
    </div>{canManage && <Link className="button secondary" href="/payments/manage">Quản lý Đoàn phí</Link>}</div>
    {campaigns.length === 0 ? <section className="panel"><p className="muted">Khoa chưa tạo khoản Đoàn phí.</p></section> : campaigns.map((campaign) => {
      const order = [...campaign.union_fee_orders].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const paid = order?.status === "paid";
      return <section className="panel" key={campaign.id}>
        <h2>Đoàn phí năm {campaign.calendar_year}</h2>
        <p><strong>{campaign.organization_units?.name}</strong></p>
        <p>Mức thu: <strong>{campaign.monthly_amount.toLocaleString("vi-VN")} đồng/tháng</strong> · Cả năm: <strong>{(campaign.monthly_amount * 12).toLocaleString("vi-VN")} đồng</strong></p>
        {paid ? <div className="notice">
          <strong>Đã đóng đủ tháng 1–12</strong>
          <p>Mã giao dịch: {order.transaction_ref} · Số tiền: {order.amount.toLocaleString("vi-VN")} đồng</p>
          <p>Thời gian: {order.paid_at ? new Date(order.paid_at).toLocaleString("vi-VN") : "Đang cập nhật"}</p>
        </div> : <>
          {order?.status === "pending" && <p className="notice warning">Đơn {order.order_ref} đang chờ IPN xác nhận. Bạn có thể mở lại cổng thanh toán.</p>}
          {(order?.status === "failed" || order?.status === "cancelled") && <p className="notice warning">Giao dịch trước không thành công; bạn có thể thanh toán lại.</p>}
          <PaymentCheckoutButton campaignId={campaign.id} />
        </>}
      </section>;
    })}
  </main>;
}
