import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { createUserSupabase } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "HIU Youth E-Office",
  description: "Văn phòng điện tử Đoàn – Hội HIU",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await createUserSupabase();
  const { data } = await supabase.auth.getUser();
  return (
    <html lang="vi">
      <body>
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
            {data.user && (
              <div className="header-user">
                <span className="user-label">Đã đăng nhập</span>
                <LogoutButton />
              </div>
            )}
          </div>
          {/* Tier 2: nav bar */}
          <nav className="header-nav" aria-label="Điều hướng chính">
            <Link href="/">Trang chủ</Link>
            <Link href="/forms">Biểu mẫu</Link>
            {data.user ? (
              <>
                <Link href="/onboarding/profile">Hồ sơ</Link>
                <Link href="/programs">Chương trình</Link>
                <Link href="/union-membership">Đoàn viên</Link>
                <Link href="/organization">Cơ cấu</Link>
                <Link href="/office/membership">Xử lý hồ sơ</Link>
                <Link href="/account/security">Tài khoản</Link>
              </>
            ) : (
              <>
                <Link href="/register">Tạo tài khoản</Link>
                <Link href="/login" className="nav-login-btn">Đăng nhập</Link>
              </>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
