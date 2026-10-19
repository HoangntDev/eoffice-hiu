"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { nameInitials } from "@/lib/auth/roles";

const items = [
  { href: "/account", label: "Tổng quan tài khoản" },
  { href: "/onboarding/profile", label: "Hồ sơ sinh viên" },
  { href: "/union-membership", label: "Hồ sơ Đoàn viên" },
  { href: "/account/security", label: "Đổi PIN" },
];

// Menu tài khoản ở góc trên bên phải: bấm để mở, đóng khi chọn mục, bấm ra ngoài hoặc nhấn Esc.
type Props = { fullName: string | null; studentCode: string | null; email: string | null };

export function AccountMenu({ fullName, studentCode, email }: Props) {
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

  const name = fullName ?? (studentCode ? `MSSV ${studentCode}` : "Tài khoản");
  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-avatar" aria-hidden>{nameInitials(fullName, studentCode)}</span>
        <span className="account-menu-label">
          <span className="account-menu-name">{name}</span>
          {fullName && studentCode && <span className="account-menu-code">{studentCode}</span>}
        </span>
        <span className="account-menu-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="account-menu-panel" role="menu">
          <div className="account-menu-head">
            <strong>{name}</strong>
            {fullName && studentCode && <span>MSSV {studentCode}</span>}
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
