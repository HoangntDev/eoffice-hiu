"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { attendanceRuleTypes, ruleLabels, type AttendanceRuleType } from "@/modules/program-attendance/schemas";

export type AttendancePlanValues = {
  max_points: number;
  rule_type: AttendanceRuleType;
  tiers: Array<{ min_sessions: number; points: number }>;
  tiers_require_required: boolean;
  sessions: Array<{ id: string; label: string; points: number; is_required: boolean; open_count: number }>;
};

type SessionRow = { key: string; id: string | null; label: string; points: string; isRequired: boolean; used: boolean };
type TierRow = { key: string; minSessions: string; points: string };

let seq = 0;
const nextKey = () => `k${++seq}`;
const checkboxLabel = { display: "flex", gap: "0.5rem", alignItems: "center" } as const;

type Props = { programId: string; initial: AttendancePlanValues | null; locked: boolean; canAmend: boolean };

// Kế hoạch điểm danh của BTC. Khi đã mở lượt (locked), chỉ faculty_manager điều chỉnh và phải ghi lý do.
export function AttendancePlanEditor({ programId, initial, locked, canAmend }: Props) {
  const router = useRouter();
  const [ruleType, setRuleType] = useState<AttendanceRuleType>(initial?.rule_type ?? "sum_sessions");
  const [sessions, setSessions] = useState<SessionRow[]>(() =>
    initial?.sessions.length
      ? initial.sessions.map((s) => ({ key: nextKey(), id: s.id, label: s.label, points: String(s.points), isRequired: s.is_required, used: s.open_count > 0 }))
      : [{ key: nextKey(), id: null, label: "Đầu giờ", points: "0", isRequired: false, used: false }],
  );
  const [tiers, setTiers] = useState<TierRow[]>(() =>
    (initial?.tiers ?? []).map((t) => ({ key: nextKey(), minSessions: String(t.min_sessions), points: String(t.points) })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const disabled = busy || (locked && !canAmend);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/event-programs/${programId}/attendance`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maxPoints: Number(data.get("maxPoints")),
          ruleType,
          tiers: ruleType === "tiers" ? tiers.map((t) => ({ minSessions: Number(t.minSessions), points: Number(t.points) })) : [],
          tiersRequireRequired: ruleType === "tiers" && data.get("tiersRequireRequired") === "on",
          sessions: sessions.map((s) => ({ id: s.id, label: s.label, points: Number(s.points), isRequired: s.isRequired })),
          reason: String(data.get("reason") ?? "").trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        const firstField = result.fields ? Object.values(result.fields as Record<string, string[]>)[0]?.[0] : undefined;
        throw new Error(firstField ?? result.message ?? "Lưu thất bại.");
      }
      setMessage(result.message ?? "Đã lưu.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lưu thất bại.");
    } finally {
      setBusy(false);
    }
  }

  const updateSession = (key: string, patch: Partial<SessionRow>) =>
    setSessions((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const updateTier = (key: string, patch: Partial<TierRow>) =>
    setTiers((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <form className="stack" onSubmit={(event) => void save(event)}>
      {error && <p className="notice error">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      {locked && (
        <p className="notice warning">
          Đã bắt đầu điểm danh nên quy tắc đã khóa. {canAmend
            ? "Bạn có thể điều chỉnh nếu thật sự cần; phải ghi lý do và thay đổi được lưu vào lịch sử."
            : "Chỉ BCH Đoàn Khoa (faculty_manager) được điều chỉnh."}
        </p>
      )}
      <fieldset className="form-grid" disabled={disabled}>
        <label>
          Điểm tối đa của chương trình (số nguyên)
          <input name="maxPoints" type="number" min={0} max={100} step={1} required defaultValue={initial?.max_points ?? 3} />
        </label>
        <label>
          Quy tắc cấp điểm
          <select value={ruleType} onChange={(event) => setRuleType(event.target.value as AttendanceRuleType)}>
            {attendanceRuleTypes.map((type) => <option key={type} value={type}>{ruleLabels[type]}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="stack" disabled={disabled}>
        <legend>Các lượt điểm danh</legend>
        {sessions.map((row) => (
          <div key={row.key} className="inline">
            <input aria-label="Tên lượt" value={row.label} required placeholder="Tên lượt" style={{ flex: "1 1 14rem", width: "auto" }}
              onChange={(event) => updateSession(row.key, { label: event.target.value })} />
            {ruleType === "sum_sessions" && (
              <input aria-label="Điểm của lượt" type="number" min={0} step={1} value={row.points} style={{ width: "6rem" }}
                onChange={(event) => updateSession(row.key, { points: event.target.value })} />
            )}
            {(ruleType === "all_required" || ruleType === "tiers") && (
              <label style={checkboxLabel}>
                <input type="checkbox" style={{ width: "auto" }} checked={row.isRequired}
                  onChange={(event) => updateSession(row.key, { isRequired: event.target.checked })} /> Bắt buộc
              </label>
            )}
            {!row.used && (
              <button type="button" className="secondary small"
                onClick={() => setSessions((rows) => rows.filter((r) => r.key !== row.key))}>Xóa</button>
            )}
          </div>
        ))}
        <div>
          <button type="button" className="secondary small" onClick={() =>
            setSessions((rows) => [...rows, { key: nextKey(), id: null, label: "", points: "0", isRequired: false, used: false }])}>
            Thêm lượt
          </button>
        </div>
      </fieldset>

      {ruleType === "tiers" && (
        <fieldset className="stack" disabled={disabled}>
          <legend>Bậc điểm theo số lượt có mặt</legend>
          {tiers.map((row) => (
            <div key={row.key} className="inline">
              <label>Từ số lượt
                <input type="number" min={1} step={1} value={row.minSessions} required style={{ width: "6rem" }}
                  onChange={(event) => updateTier(row.key, { minSessions: event.target.value })} />
              </label>
              <label>Điểm
                <input type="number" min={0} step={1} value={row.points} required style={{ width: "6rem" }}
                  onChange={(event) => updateTier(row.key, { points: event.target.value })} />
              </label>
              <button type="button" className="secondary small"
                onClick={() => setTiers((rows) => rows.filter((r) => r.key !== row.key))}>Xóa</button>
            </div>
          ))}
          <div>
            <button type="button" className="secondary small"
              onClick={() => setTiers((rows) => [...rows, { key: nextKey(), minSessions: String(rows.length + 1), points: "1" }])}>
              Thêm bậc
            </button>
          </div>
          <label style={checkboxLabel}>
            <input type="checkbox" name="tiersRequireRequired" style={{ width: "auto" }}
              defaultChecked={initial?.tiers_require_required ?? false} /> Phải có mặt đủ các lượt bắt buộc
          </label>
        </fieldset>
      )}

      {locked && canAmend && (
        <label>
          Lý do điều chỉnh (bắt buộc, tối thiểu 10 ký tự)
          <textarea name="reason" rows={2} maxLength={2000} required minLength={10} />
        </label>
      )}
      <div>
        <button className="primary" disabled={disabled}>{locked ? "Lưu điều chỉnh" : "Lưu kế hoạch điểm danh"}</button>
      </div>
    </form>
  );
}
