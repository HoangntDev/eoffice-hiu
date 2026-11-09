"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OrganizationSessionActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function switchOfficer() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/organization/switch", { method: "POST" });
      const result = await response.json() as { next?: string };
      if (response.ok && result.next) {
        router.replace(result.next);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return <button className="secondary small" disabled={busy} onClick={() => void switchOfficer()}>Đổi cán bộ</button>;
}
