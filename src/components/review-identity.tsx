"use client";

import { useState } from "react";

const fields = {
  citizen_id: "Số CCCD", religion: "Tôn giáo", date_of_birth: "Ngày sinh",
  ethnicity: "Dân tộc", citizen_issued_on: "Ngày cấp CCCD", citizen_issued_by: "Nơi cấp CCCD",
  hometown_ward_name: "Phường/xã quê quán", hometown_province_name: "Tỉnh/thành quê quán",
  permanent_ward_name: "Phường/xã thường trú", permanent_province_name: "Tỉnh/thành thường trú",
};

export function ReviewIdentity({ applicationId }: { applicationId: string }) {
  const [identity, setIdentity] = useState<Record<string, string> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function open() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/union-membership/review/identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Không thể mở thông tin định danh.");
      setIdentity(data.identity);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể mở thông tin định danh.");
    } finally {
      setPending(false);
    }
  }

  return <section>
    <button type="button" className="secondary" disabled={pending} aria-expanded={Boolean(identity)}
      onClick={() => identity ? setIdentity(null) : void open()}>
      {identity ? "Ẩn thông tin định danh" : "Xem thông tin định danh và tôn giáo"}
    </button>
    {error && <p role="alert">{error}</p>}
    {identity && <dl>{Object.entries(fields).map(([key, label]) =>
      <div key={key}><dt>{label}</dt><dd>{identity[key] ?? "—"}</dd></div>
    )}</dl>}
  </section>;
}
