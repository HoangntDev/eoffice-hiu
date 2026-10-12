import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { createUserSupabase } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "HIU Youth E-Office",
  description: "Cổng nghiệp vụ Đoàn – Hội HIU",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = await createUserSupabase();
  const { data } = await supabase.auth.getUser();
  return (
    <html lang="vi">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">HIU Youth E-Office</Link>
          <nav aria-label="Điều hướng chính">
            <Link href="/onboarding/profile">Hồ sơ sinh viên</Link>
            <Link href="/programs">Chương trình</Link>
            <Link href="/union-membership">Xác thực Đoàn viên</Link>
            <Link href="/organization">Cơ cấu</Link>
            <Link href="/office/membership">Xử lý hồ sơ</Link>
            <Link href="/account/security">Tài khoản</Link>
            {data.user ? <LogoutButton /> : <Link href="/login">SIGN IN</Link>}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
