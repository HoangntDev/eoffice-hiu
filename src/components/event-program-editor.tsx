"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./event-programs.module.css";
import { fromVietnamInputValue, toVietnamInputValue } from "@/modules/event-programs/dates";

export type EventProgramFormValues = {
  title: string;
  summary: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  expected_participants: number | null;
  plan_number: string | null;
  plan_signed_on: string | null;
};

type Props =
  | { mode: "create"; orgs: Array<{ id: string; name: string }> }
  | { mode: "edit"; programId: string; initial: EventProgramFormValues };

export function EventProgramEditor(props: Props) {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    setFieldErrors({});
    const raw = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const body = {
      ...(props.mode === "create" ? { ownerOrgId: raw.ownerOrgId } : {}),
      title: raw.title,
      summary: raw.summary || null,
      location: raw.location || null,
      startsAt: fromVietnamInputValue(raw.startsAt),
      endsAt: fromVietnamInputValue(raw.endsAt),
      expectedParticipants: raw.expectedParticipants ? Number(raw.expectedParticipants) : null,
      planNumber: raw.planNumber || null,
      planSignedOn: raw.planSignedOn || null,
    };
    try {
      const response = await fetch(props.mode === "create" ? "/api/event-programs" : `/api/event-programs/${props.programId}`, {
        method: props.mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setFieldErrors(result.fields ?? {});
        throw new Error(result.message ?? "Không thể lưu kế hoạch.");
      }
      if (props.mode === "create") {
        router.push(`/programs/${result.id}`);
      } else {
        setMessage(result.message ?? "Đã lưu kế hoạch.");
        router.refresh();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu kế hoạch.");
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (name: string) =>
    fieldErrors[name]?.length ? <small className={styles.fieldError}>{fieldErrors[name][0]}</small> : null;

  return (
    <form className="form-grid" onSubmit={(event) => void onSubmit(event)} noValidate>
      {error && <p className="notice error full" role="alert">{error}</p>}
      {message && <p className="notice full" role="status">{message}</p>}
      {props.mode === "create" && (
        <label className="full">
          Đoàn Khoa lập kế hoạch
          <select name="ownerOrgId" required defaultValue={props.orgs.length === 1 ? props.orgs[0].id : ""}>
            {props.orgs.length !== 1 && <option value="">Chọn đơn vị</option>}
            {props.orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </label>
      )}
      <label className="full">
        Tên chương trình *
        <input name="title" required minLength={5} maxLength={200} defaultValue={initial?.title ?? ""} />
        {fieldError("title")}
      </label>
      <label className="full">
        Nội dung, mục đích
        <textarea name="summary" rows={4} maxLength={5000} defaultValue={initial?.summary ?? ""} />
      </label>
      <label>
        Địa điểm
        <input name="location" maxLength={300} defaultValue={initial?.location ?? ""} />
      </label>
      <label>
        Số người dự kiến
        <input name="expectedParticipants" type="number" min={1} max={100000} defaultValue={initial?.expected_participants ?? ""} />
        {fieldError("expectedParticipants")}
      </label>
      <label>
        Bắt đầu (giờ Việt Nam)
        <input name="startsAt" type="datetime-local" defaultValue={toVietnamInputValue(initial?.starts_at)} />
      </label>
      <label>
        Kết thúc (giờ Việt Nam)
        <input name="endsAt" type="datetime-local" defaultValue={toVietnamInputValue(initial?.ends_at)} />
        {fieldError("endsAt")}
      </label>
      <label>
        Số kế hoạch (trên văn bản đã ký)
        <input name="planNumber" maxLength={100} placeholder="VD: 12/KH-ĐK" defaultValue={initial?.plan_number ?? ""} />
      </label>
      <label>
        Ngày ký kế hoạch
        <input name="planSignedOn" type="date" defaultValue={initial?.plan_signed_on ?? ""} />
      </label>
      <p className="muted full">
        Bản nháp có thể lưu khi chưa đủ thông tin. Khi gửi Văn phòng, hệ thống kiểm tra đủ các trường và bản PDF đã ký.
      </p>
      <div className="full">
        <button className="primary" disabled={saving}>
          {saving ? "Đang lưu…" : props.mode === "create" ? "Tạo bản nháp" : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}
