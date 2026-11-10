import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { paymentEnabled } from "@/lib/payments";
import { createUserSupabase } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ vnp_TxnRef?: string }> };

export default async function PaymentReturnPage({ searchParams }: Props) {
  if (!await paymentEnabled()) notFound();
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/payments");
  const { vnp_TxnRef } = await searchParams;
  const { data: order } = vnp_TxnRef
    ? await supabase.from("union_fee_orders")
      .select("order_ref, amount, status, transaction_ref, paid_at, union_fee_campaigns(calendar_year, monthly_amount)")
      .eq("order_ref", vnp_TxnRef).maybeSingle()
    : { data: null };
  if (!order) notFound();
  const campaign = order.union_fee_campaigns as unknown as { calendar_year: number; monthly_amount: number };
  const success = order.status === "paid";
  return <main className="page"><section className="panel">
    <p className="eyebrow">Kết quả thanh toán</p>
    <h1>{success ? "Đã ghi nhận Đoàn phí" : "Đang chờ xác nhận"}</h1>
    <p className={success ? "notice" : "notice warning"}>{success
      ? "IPN hợp lệ đã xác nhận giao dịch và ghi đủ tháng 1–12."
      : "Hệ thống chưa nhận IPN hợp lệ. Trang này không tự cập nhật trạng thái thanh toán."}</p>
    <dl>
      <dt>Mã đơn</dt><dd>{order.order_ref}</dd>
      <dt>Mã giao dịch</dt><dd>{order.transaction_ref ?? "Chưa có"}</dd>
      <dt>Số tiền</dt><dd>{order.amount.toLocaleString("vi-VN")} đồng</dd>
      <dt>Mức/tháng</dt><dd>{campaign.monthly_amount.toLocaleString("vi-VN")} đồng</dd>
      <dt>Năm</dt><dd>{campaign.calendar_year}</dd>
      <dt>Thời gian</dt><dd>{order.paid_at ? new Date(order.paid_at).toLocaleString("vi-VN") : "Chưa xác nhận"}</dd>
    </dl>
    <Link className="button secondary" href="/payments">Quay lại Đoàn phí</Link>
  </section></main>;
}
