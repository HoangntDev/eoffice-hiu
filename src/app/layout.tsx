import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/account-menu";
import { getViewer } from "@/lib/auth/viewer";
import { paymentEnabled } from "@/lib/payments";
import "./globals.css";

export const metadata: Metadata = {
  title: "HIU Youth E-Office",
  description: "Văn phòng điện tử Đoàn – Hội HIU",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  const paymentsAvailable = viewer?.accountType === "student" ? await paymentEnabled() : false;
  // Mã yêu cầu do proxy gắn; trang lỗi (error.tsx) hiển thị làm mã tham chiếu khi lỗi không có digest.
  const requestId = (await headers()).get("x-request-id");
  return (
    <html lang="vi">
      <body>
        {requestId ? <meta name="x-request-id" content={requestId} /> : null}
        <header className="site-header">
          {/* Tier 1: brand bar */}
          <div className="header-brand-bar">
            <Link className="brand" href="/">
              <svg className="brand-logo" viewBox="0 0 32 32" fill="none" aria-hidden>
                <rect width="32" height="32" rx="8" fill="currentColor" opacity=".12"/>
                <path d="M8 10h16M8 16h16M8 22h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
              <span className="brand-text">
                <span className="brand-name">HIU Youth E-Office</span>
                <span className="brand-sub">Văn phòng điện tử Đoàn – Hội</span>
              </span>
            </Link>
            {viewer ? (
              <AccountMenu fullName={viewer.fullName} studentCode={viewer.studentCode} email={viewer.email} organization={viewer.accountType === "organization"} paymentEnabled={paymentsAvailable} />
            ) : (
              <div className="header-user">
                <Link href="/register" className="header-link">Tạo tài khoản</Link>
                <Link href="/login" className="header-login">Đăng nhập</Link>
              </div>
            )}
          </div>
          {/* Tier 2: nav bar */}
          <nav className="header-nav" aria-label="Điều hướng chính">
            <Link href="/">Trang chủ</Link>
            {viewer?.accountType !== "organization" && <Link href="/forms">Biểu mẫu</Link>}
            {viewer?.accountType === "organization" ? <Link href="/admin">Quản trị tổ chức</Link> : viewer && (
              <>
                <Link href="/programs">Chương trình</Link>
                {paymentsAvailable && <Link href="/payments">Đoàn phí</Link>}
                {viewer.access.organization && <Link href="/organization">Cơ cấu</Link>}
                {viewer.access.membershipReview && <Link href="/office/membership">Xử lý hồ sơ</Link>}
              </>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
