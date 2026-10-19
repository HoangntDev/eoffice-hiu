import Link from "next/link";

export function AccessDenied({ title, reason }: { title: string; reason: string }) {
  return (
    <main className="page narrow">
      <div className="page-header"><div><p className="eyebrow">Không có quyền truy cập</p><h1>{title}</h1></div></div>
      <div className="notice warning">{reason}</div>
      <p><Link href="/account">Về trang tài khoản</Link></p>
    </main>
  );
}
