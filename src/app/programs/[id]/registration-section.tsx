import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FormViewer } from "@/components/form-viewer";
import {
  ProgramRegistrationSettings, type RegistrationSettingsValues,
} from "@/components/program-registration-settings";
import styles from "@/components/event-programs.module.css";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";
import { loadFormPrefill } from "@/modules/forms/prefill";
import type { Question } from "@/modules/forms/schemas";
import { describeAudience } from "@/modules/program-registrations/audience";
import { blockReasonLabels, registrationBlockReason, type BlockReason } from "@/modules/program-registrations/eligibility";
import {
  registrationStatusLabels, settingsStatusLabels, type RegistrationStatus,
} from "@/modules/program-registrations/schemas";

type Summary = {
  capacity: number | null;
  accepted: number;
  pending: number;
  quotas: Array<{ id: string; label: string; seats: number; accepted: number }>;
  quotas_released: boolean;
};

type Props = {
  supabase: SupabaseClient;
  userId: string;
  program: { id: string; owner_org_id: string; ends_at?: string | null };
  isManager: boolean;
};

// UC7 trên trang chi tiết chương trình đã chấp thuận: BTC cấu hình/mở/đóng; sinh viên xem điều kiện và đăng ký.
export async function RegistrationSection({ supabase, userId, program, isManager }: Props) {
  const [{ data: settingsRow }, { data: quotaRows }, { data: summaryData }, { data: own }, { data: faculties }, { data: majors }] =
    await Promise.all([
      supabase.from("program_registration_settings")
        .select("status, audience_rule, capacity, requires_approval, form_id, closes_at, quota_release_at, instructions")
        .eq("program_id", program.id).maybeSingle(),
      supabase.from("program_registration_quotas")
        .select("id, label, audience_rule, seats, sort_order").eq("program_id", program.id).order("sort_order"),
      supabase.rpc("program_registration_summary", { p_program_id: program.id }),
      supabase.from("program_registrations")
        .select("status, registered_at, decided_at, decision_reason")
        .eq("program_id", program.id).eq("user_id", userId).maybeSingle(),
      supabase.from("faculties").select("id, current_name").eq("is_active", true).order("current_name"),
      supabase.from("programs").select("id, current_name").eq("is_active", true).order("current_name"),
    ]);

  const settings = settingsRow
    ? ({ ...settingsRow, quotas: quotaRows ?? [] } as unknown as RegistrationSettingsValues)
    : null;
  const summary = summaryData as Summary | null;
  const names = {
    faculties: new Map((faculties ?? []).map((f) => [f.id as string, f.current_name as string])),
    majors: new Map((majors ?? []).map((m) => [m.id as string, m.current_name as string])),
  };

  let managerPanel = null;
  if (isManager) {
    const { data: forms } = await supabase.from("forms").select("id, title")
      .eq("owner_org_id", program.owner_org_id).eq("status", "published").order("created_at", { ascending: false });
    managerPanel = (
      <section className="panel stack">
        <h2>Cấu hình đăng ký tham gia (BTC)</h2>
        <p className="inline">
          <span className="status">{settingsStatusLabels[settings?.status ?? "draft"]}</span>
          {summary && (
            <span className="muted">
              Đã xác nhận {summary.accepted}{summary.capacity ? `/${summary.capacity}` : ""} · Chờ duyệt {summary.pending}
            </span>
          )}
          {settings && <Link className="button secondary small" href={`/programs/${program.id}/registrations`}>Danh sách đăng ký</Link>}
        </p>
        <ProgramRegistrationSettings
          programId={program.id}
          initial={settings}
          faculties={(faculties ?? []).map((f) => ({ id: f.id as string, name: f.current_name as string }))}
          majors={(majors ?? []).map((m) => ({ id: m.id as string, name: m.current_name as string }))}
          forms={(forms ?? []).map((f) => ({ id: f.id as string, name: f.title as string }))}
        />
      </section>
    );
  }

  if (!settings || settings.status === "draft") {
    if (isManager) return managerPanel;
    return (
      <section className="panel stack">
        <h2>Đăng ký tham gia</h2>
        <p className="inline">
          <span className="status reg-blocked">{blockReasonLabels[settings ? "not_open" : "not_configured"]}</span>
          <span className="muted">Ban tổ chức chưa mở đăng ký trên hệ thống cho chương trình này.</span>
        </p>
      </section>
    );
  }

  const { data: audienceOk } = own
    ? { data: null }
    : await supabase.rpc("evaluate_audience_rule", { p_rule: settings.audience_rule, p_user_id: userId });
  const blockReason = own ? null : registrationBlockReason({
    settingsStatus: settings.status as "open" | "closed",
    closesAt: settings.closes_at,
    programEndsAt: program.ends_at ?? null,
    capacity: summary?.capacity ?? null,
    accepted: summary?.accepted ?? 0,
    requiresApproval: settings.requires_approval,
    audienceOk: typeof audienceOk === "boolean" ? audienceOk : null,
  });
  const blockDetail: Record<BlockReason, string> = {
    not_configured: "Ban tổ chức chưa cấu hình đăng ký.",
    not_open: "Ban tổ chức chưa mở đăng ký.",
    closed: settings.closes_at ? `Hạn đăng ký đã hết lúc ${formatVietnamDateTime(settings.closes_at)}.` : "Ban tổ chức đã đóng đăng ký.",
    full: `Đã đủ ${summary?.capacity ?? 0} chỗ theo thứ tự đăng ký.`,
    audience: `Chương trình dành cho: ${describeAudience(settings.audience_rule, names)}. Nếu bạn thuộc đối tượng, kiểm tra Lớp trong hồ sơ sinh viên.`,
  };

  let studentPanel;
  if (own) {
    const status = own.status as RegistrationStatus;
    studentPanel = (
      <div className="stack">
        <p className="inline">
          <span className={`status reg-${status}`}>{registrationStatusLabels[status]}</span>
          <span className="muted">Đăng ký lúc {formatVietnamDateTime(own.registered_at as string)}</span>
        </p>
        {status === "pending" && <p className="muted">Ban tổ chức sẽ xét duyệt; kết quả hiển thị tại đây.</p>}
        {status === "accepted" && <p className="muted">Bạn đã có tên trong danh sách tham gia. Điểm danh sẽ thực hiện tại chương trình.</p>}
        {status === "rejected" && own.decision_reason && <p className="notice error">Lý do: {own.decision_reason as string}</p>}
      </div>
    );
  } else if (blockReason) {
    studentPanel = (
      <p className="inline">
        <span className="status reg-blocked">{blockReasonLabels[blockReason]}</span>
        <span className="muted">{blockDetail[blockReason]}</span>
      </p>
    );
  } else {
    type RegistrationForm = { id: string; title: string; description: string | null; questions: Question[] };
    let form: RegistrationForm | null = null;
    if (settings.form_id) {
      const { data } = await supabase.from("forms")
        .select("id, title, description, questions").eq("id", settings.form_id).maybeSingle();
      form = data as RegistrationForm | null;
    }
    const prefill = await loadFormPrefill(supabase, userId);
    studentPanel = (
      <FormViewer
        form={{
          id: form?.id ?? settings.form_id ?? program.id,
          title: form?.title ?? "Đăng ký tham gia",
          description: form?.description ?? null,
          confirmation_message: null,
          questions: form?.questions ?? [],
          closes_at: settings.closes_at,
        }}
        prefill={prefill}
        isAuthenticated
        submitUrl={`/api/event-programs/${program.id}/registrations`}
        submitLabel="Gửi đăng ký"
      />
    );
  }

  return (
    <>
      {managerPanel}
      <section className="panel stack">
        <h2>Đăng ký tham gia</h2>
        <dl className={styles.facts}>
          <div><dt>Đối tượng</dt><dd>{describeAudience(settings.audience_rule, names)}</dd></div>
          <div>
            <dt>Số chỗ</dt>
            <dd>
              {summary?.capacity
                ? `${summary.capacity} (còn ${Math.max(0, summary.capacity - summary.accepted)})`
                : "Không giới hạn"}
            </dd>
          </div>
          <div><dt>Cách nhận</dt><dd>{settings.requires_approval ? "Ban tổ chức xét duyệt" : "Theo thứ tự đăng ký"}</dd></div>
          <div><dt>Hạn đăng ký</dt><dd>{settings.closes_at ? formatVietnamDateTime(settings.closes_at) : "Đến khi BTC đóng"}</dd></div>
          {summary && summary.quotas.length > 0 && (
            <div className={styles.wide}>
              <dt>Chỉ tiêu nhóm{summary.quotas_released ? " (đã chuyển phần dư thành chỉ tiêu chung)" : ""}</dt>
              <dd>{summary.quotas.map((q) => `${q.label}: ${q.accepted}/${q.seats}`).join(" · ")}</dd>
            </div>
          )}
          {settings.instructions && <div className={styles.wide}><dt>Hướng dẫn</dt><dd>{settings.instructions}</dd></div>}
        </dl>
        {studentPanel}
      </section>
    </>
  );
}
