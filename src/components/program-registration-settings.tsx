"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { fromVietnamInputValue, toVietnamInputValue } from "@/modules/event-programs/dates";
import type { AudienceRule } from "@/modules/forms/schemas";
import {
  buildAudienceRule, parseAudienceRule, parseQuotaRule, quotaRule, type QuotaKind,
} from "@/modules/program-registrations/audience";
import type { SettingsStatus } from "@/modules/program-registrations/schemas";

type Option = { id: string; name: string };

export type RegistrationSettingsValues = {
  status: SettingsStatus;
  audience_rule: AudienceRule;
  capacity: number | null;
  requires_approval: boolean;
  form_id: string | null;
  closes_at: string | null;
  quota_release_at: string | null;
  instructions: string | null;
  quotas: Array<{ id: string; label: string; audience_rule: AudienceRule; seats: number; sort_order: number }>;
};

type QuotaRow = { key: string; id: string | null; label: string; kind: QuotaKind; targetId: string; seats: string };

type Props = {
  programId: string;
  initial: RegistrationSettingsValues | null;
  faculties: Option[];
  majors: Option[];
  forms: Option[];
};

// Ô nhập toàn cục có width: 100%; checkbox cần nằm cùng dòng với nhãn.
const checkboxLabel = { display: "flex", gap: "0.5rem", alignItems: "center" } as const;

let rowSeq = 0;
const nextKey = () => `row-${++rowSeq}`;

export function ProgramRegistrationSettings({ programId, initial, faculties, majors, forms }: Props) {
  const router = useRouter();
  const status = initial?.status ?? "draft";
  const locked = status === "open";
  const audience = parseAudienceRule(initial?.audience_rule);
  const [quotas, setQuotas] = useState<QuotaRow[]>(() =>
    (initial?.quotas ?? []).map((q) => {
      const parsed = parseQuotaRule(q.audience_rule);
      return { key: nextKey(), id: q.id, label: q.label, kind: parsed.kind, targetId: parsed.targetId ?? "", seats: String(q.seats) };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, init);
      const result = await response.json();
      if (!response.ok) {
        const firstField = result.fields ? Object.values(result.fields as Record<string, string[]>)[0]?.[0] : undefined;
        throw new Error(firstField ?? result.message ?? "Thao tác thất bại.");
      }
      setMessage(result.message ?? "Đã ghi nhận.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  }

  function updateQuota(key: string, patch: Partial<QuotaRow>) {
    setQuotas((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const capacity = text("capacity");
    const body = {
      audienceRule: buildAudienceRule({
        facultyIds: data.getAll("facultyIds").map(String),
        majorIds: data.getAll("majorIds").map(String),
        unionOnly: data.get("unionOnly") === "on",
      }),
      capacity: capacity ? Number(capacity) : null,
      requiresApproval: data.get("requiresApproval") === "on",
      formId: text("formId") || null,
      closesAt: fromVietnamInputValue(text("closesAt")),
      quotaReleaseAt: fromVietnamInputValue(text("quotaReleaseAt")),
      instructions: text("instructions") || null,
      quotas: quotas.map((row, index) => ({
        id: row.id,
        label: row.label,
        audienceRule: quotaRule(row.kind, row.targetId || null),
        seats: Number(row.seats),
        sortOrder: index,
      })),
    };
    await call(`/api/event-programs/${programId}/registration`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const setStatus = (next: "open" | "closed") =>
    call(`/api/event-programs/${programId}/registration/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });

  return (
    <div className="stack">
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}

      <div className="inline">
        {initial && status !== "open" && (
          <button className="primary" disabled={busy} onClick={() => void setStatus("open")}>Mở đăng ký</button>
        )}
        {status === "open" && (
          <button className="secondary" disabled={busy} onClick={() => void setStatus("closed")}>Đóng đăng ký</button>
        )}
      </div>
      {locked && <p className="notice warning">Đang mở đăng ký. Đóng đăng ký trước khi sửa cấu hình.</p>}

      <form className="form-grid" onSubmit={(event) => void save(event)}>
        <fieldset className="full stack" disabled={locked || busy}>
          <legend>Đối tượng được đăng ký</legend>
          <p className="muted">Để trống Khoa và ngành: mọi sinh viên HIU. Chọn nhiều mục: thuộc một trong các mục đã chọn.</p>
          <label>
            Khoa
            <select name="facultyIds" multiple size={Math.min(6, Math.max(3, faculties.length))} defaultValue={audience.facultyIds}>
              {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label>
            Ngành
            <select name="majorIds" multiple size={Math.min(6, Math.max(3, majors.length))} defaultValue={audience.majorIds}>
              {majors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label style={checkboxLabel}>
            <input type="checkbox" name="unionOnly" style={{ width: "auto" }} defaultChecked={audience.unionOnly} /> Chỉ Đoàn viên
          </label>
        </fieldset>

        <fieldset className="full form-grid" disabled={locked || busy}>
          <legend className="full">Cách nhận</legend>
          <label>
            Tổng số chỗ (để trống nếu không giới hạn)
            <input name="capacity" type="number" min={1} max={100000} defaultValue={initial?.capacity ?? ""} />
          </label>
          <label style={checkboxLabel}>
            <input type="checkbox" name="requiresApproval" style={{ width: "auto" }} defaultChecked={initial?.requires_approval ?? false} />
            BTC xét duyệt từng đăng ký (bỏ chọn: nhận theo thứ tự đăng ký)
          </label>
          <label>
            Hạn đăng ký (giờ Việt Nam, tùy chọn)
            <input name="closesAt" type="datetime-local" defaultValue={toVietnamInputValue(initial?.closes_at)} />
          </label>
          <label>
            Mẫu đăng ký (biểu mẫu đã phát hành của Khoa)
            <select name="formId" defaultValue={initial?.form_id ?? ""}>
              <option value="">— Không dùng mẫu, chỉ xác nhận đăng ký —</option>
              {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className="full">
            Hướng dẫn cho sinh viên
            <textarea name="instructions" rows={3} maxLength={2000} defaultValue={initial?.instructions ?? ""} />
          </label>
        </fieldset>

        <fieldset className="full stack" disabled={locked || busy}>
          <legend>Chỉ tiêu theo nhóm (cần tổng số chỗ)</legend>
          <p className="muted">Chỗ không chia cho nhóm nào là chỉ tiêu chung. Sau hạn chuyển, chỉ tiêu nhóm còn dư thành chỉ tiêu chung.</p>
          {quotas.map((row) => (
            <div key={row.key} className="inline">
              <input aria-label="Tên nhóm" placeholder="Tên nhóm" value={row.label} required
                onChange={(e) => updateQuota(row.key, { label: e.target.value })} />
              <select aria-label="Loại nhóm" value={row.kind}
                onChange={(e) => updateQuota(row.key, { kind: e.target.value as QuotaKind, targetId: "" })}>
                <option value="faculty">Theo Khoa</option>
                <option value="major">Theo ngành</option>
                <option value="union_member">Đoàn viên</option>
              </select>
              {row.kind !== "union_member" && (
                <select aria-label="Khoa/ngành" value={row.targetId} required
                  onChange={(e) => updateQuota(row.key, { targetId: e.target.value })}>
                  <option value="">— Chọn —</option>
                  {(row.kind === "faculty" ? faculties : majors).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              )}
              <input aria-label="Số chỗ" type="number" min={1} value={row.seats} required style={{ width: "6rem" }}
                onChange={(e) => updateQuota(row.key, { seats: e.target.value })} />
              <button type="button" className="secondary small"
                onClick={() => setQuotas((rows) => rows.filter((r) => r.key !== row.key))}>Xóa</button>
            </div>
          ))}
          <div>
            <button type="button" className="secondary small" onClick={() =>
              setQuotas((rows) => [...rows, { key: nextKey(), id: null, label: "", kind: "faculty", targetId: "", seats: "1" }])}>
              Thêm nhóm chỉ tiêu
            </button>
          </div>
          <label>
            Hạn chuyển chỉ tiêu dư thành chỉ tiêu chung (tùy chọn)
            <input name="quotaReleaseAt" type="datetime-local" defaultValue={toVietnamInputValue(initial?.quota_release_at)} />
          </label>
        </fieldset>

        <div className="full">
          <button className="primary" disabled={locked || busy}>Lưu cấu hình</button>
        </div>
      </form>
    </div>
  );
}
