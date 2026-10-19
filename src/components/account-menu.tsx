"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/logout-button";

const items = [
  { href: "/account", label: "Tổng quan tài khoản" },
  { href: "/onboarding/profile", label: "Hồ sơ sinh viên" },
  { href: "/union-membership", label: "Hồ sơ Đoàn viên" },
  { href: "/account/security", label: "Đổi PIN" },
];

// Menu tài khoản ở góc trên bên phải: bấm để mở, đóng khi chọn mục, bấm ra ngoài hoặc nhấn Esc.
export function AccountMenu({ studentCode, email }: { studentCode: string | null; email: string | null }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = studentCode ?? "Tài khoản";
  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-avatar" aria-hidden>{label.slice(-2)}</span>
        <span className="account-menu-label">{label}</span>
        <span className="account-menu-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="account-menu-panel" role="menu">
          <div className="account-menu-head">
            <strong>{studentCode ? `MSSV ${studentCode}` : "Tài khoản"}</strong>
            {email && <span>{email}</span>}
          </div>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              aria-current={pathname === item.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="account-menu-foot"><LogoutButton /></div>
        </div>
      )}
    </div>
  );
}
