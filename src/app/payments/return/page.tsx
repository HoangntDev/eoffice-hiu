import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { paymentEnabled } from "@/lib/payments";
import { createUserSupabase } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ vnp_TxnRef?: string; order?: string; gateway_error?: string }> };

export default async function PaymentReturnPage({ searchParams }: Props) {
  if (!await paymentEnabled()) notFound();
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/payments");
  const { vnp_TxnRef, order: paypalOrderRef, gateway_error } = await searchParams;
  const orderRef = paypalOrderRef ?? vnp_TxnRef;
  const { data: order } = orderRef
    ? await supabase.from("union_fee_orders")
      .select("order_ref, amount, status, transaction_ref, paid_at, provider, union_fee_campaigns(calendar_year, monthly_amount)")
      .eq("order_ref", orderRef).maybeSingle()
    : { data: null };
  if (!order) notFound();
  const campaign = order.union_fee_campaigns as unknown as { calendar_year: number; monthly_amount: number };
  const success = order.status === "paid";
  const heading = success ? "Đã ghi nhận Đoàn phí"
    : order.status === "cancelled" ? "Đã hủy thanh toán"
      : order.status === "failed" ? "Thanh toán chưa thành công"
        : "Đang chờ xác nhận";
  const detail = success
    ? "Giao dịch đã được cổng thanh toán xác nhận và hệ thống đã ghi đủ tháng 1–12."
    : order.status === "cancelled"
      ? "Bạn đã hủy giao dịch. Có thể quay lại khoản thu để thanh toán bằng đơn mới."
      : gateway_error === "1"
        ? "PayPal tạm thời chưa phản hồi. Trạng thái chưa được thay đổi; vui lòng thử lại sau."
        : "Hệ thống chưa nhận được xác nhận hợp lệ. Trang này chỉ đọc trạng thái đã lưu trong cơ sở dữ liệu.";
  return <main className="page"><section className="panel">
    <p className="eyebrow">Kết quả thanh toán</p>
    <h1>{heading}</h1>
    <p className={success ? "notice" : "notice warning"}>{detail}</p>
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
