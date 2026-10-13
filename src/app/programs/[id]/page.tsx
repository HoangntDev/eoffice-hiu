import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EventProgramActions } from "@/components/event-program-actions";
import { EventProgramEditor, type EventProgramFormValues } from "@/components/event-program-editor";
import { EventProgramStatusBadge } from "@/components/event-program-status";
import styles from "@/components/event-programs.module.css";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";
import { statusLabels, type EventProgramStatus } from "@/modules/event-programs/schemas";
import { loadEventProgramViewer } from "@/modules/event-programs/viewer";
import { availableActions } from "@/modules/event-programs/workflow";
import { ReasonAction } from "@/components/acceptance-actions";
import { AttendanceSection } from "./attendance-section";
import { publicationStatusLabels, type PublicationStatus } from "@/modules/program-publication/schemas";
import { ParticipationSection } from "./participation-section";
import { RegistrationSection } from "./registration-section";

type Program = EventProgramFormValues & {
  id: string;
  owner_org_id: string;
  status: EventProgramStatus;
  submission_count: number;
  current_document_id: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  organization_units: { name: string } | null;
};

type HistoryRow = {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  document_id: string | null;
  actor_user_id: string;
  actor_name: string | null;
  actor_role_code: string | null;
  occurred_at: string;
};

const actionLabels: Record<string, string> = {
  created: "Tạo bản nháp",
  updated: "Cập nhật thông tin",
  document_attached: "Tải lên PDF kế hoạch",
  submitted: "Gửi Văn phòng",
  changes_requested: "Văn phòng yêu cầu chỉnh sửa",
  rejected: "Văn phòng từ chối",
  approved: "Văn phòng chấp thuận",
  cancelled: "Hủy chương trình",
};

const roleLabels: Record<string, string> = {
  faculty_manager: "BCH Đoàn Khoa",
  faculty_executive: "BTV Đoàn Khoa",
  office: "Văn phòng Đoàn – Hội",
  school_admin: "Đoàn Trường",
};

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/programs/${id}`);

  const { data } = await supabase.from("event_programs").select("*, organization_units(name)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const program = data as unknown as Program;

  const [viewer, { data: documents }, { data: historyData }] = await Promise.all([
    loadEventProgramViewer(supabase, user.id),
    supabase.from("event_program_documents")
      .select("id, original_file_name, size_bytes, sha256, uploaded_at")
      .eq("program_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("event_program_history")
      .select("id, action, from_status, to_status, reason, document_id, actor_user_id, actor_name, actor_role_code, occurred_at")
      .eq("program_id", id).order("occurred_at", { ascending: true }),
  ]);
  const history = (historyData ?? []) as HistoryRow[];
  const isManager = viewer.managedOrgs.some((org) => org.id === program.owner_org_id);
  const actions = availableActions(program.status, {
    isManager,
    isReviewer: viewer.isReviewer,
    hasSubmitted: history.some((h) => h.action === "submitted" && h.actor_user_id === user.id),
  });
  const lastFeedback = [...history].reverse().find((h) => h.action === "changes_requested" || h.action === "rejected");
  // Hủy: BCH Đoàn Khoa (faculty_manager) sở hữu hoặc Văn phòng, trước khi nghiệm thu (RPC kiểm lại).
  const { data: acceptance } = isManager || viewer.isReviewer
    ? await supabase.from("program_acceptances").select("status").eq("program_id", id).maybeSingle()
    : { data: null };
  const { data: managerGrant } = isManager
    ? await supabase.from("role_grants").select("id").eq("user_id", user.id).eq("organization_id", program.owner_org_id)
      .eq("role_code", "faculty_manager").is("revoked_at", null).limit(1).maybeSingle()
    : { data: null };
  // UC10: RLS chỉ trả dòng cho Ban Tuyên giáo, BTC của chương trình và Văn phòng, sau khi nghiệm thu.
  const { data: publication } = await supabase.from("program_publications").select("status").eq("program_id", id).maybeSingle();
  const canCancel = program.status === "approved" && acceptance?.status !== "accepted" && (Boolean(managerGrant) || viewer.isReviewer);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href="/programs">Chương trình sự kiện</Link> · {program.organization_units?.name}</p>
          <h1>{program.title}</h1>
          <p className="inline">
            <EventProgramStatusBadge status={program.status} />
            {program.submission_count > 0 && <span className="muted">Đã nộp {program.submission_count} lần</span>}
          </p>
        </div>
      </div>

      {program.status === "needs_changes" && lastFeedback?.reason && (
        <p className="notice warning">Văn phòng yêu cầu chỉnh sửa: {lastFeedback.reason}</p>
      )}
      {program.status === "cancelled" && (
        <p className="notice error">Chương trình đã hủy: {(program as unknown as { cancel_reason: string | null }).cancel_reason}</p>
      )}
      {program.status === "rejected" && lastFeedback?.reason && (
        <p className="notice error">Lý do từ chối: {lastFeedback.reason}</p>
      )}

      <section className="panel">
        <h2>Thông tin chương trình</h2>
        <dl className={styles.facts}>
          <div><dt>Bắt đầu</dt><dd>{formatVietnamDateTime(program.starts_at)}</dd></div>
          <div><dt>Kết thúc</dt><dd>{formatVietnamDateTime(program.ends_at)}</dd></div>
          <div><dt>Địa điểm</dt><dd>{program.location ?? "—"}</dd></div>
          <div><dt>Số người dự kiến</dt><dd>{program.expected_participants ?? "—"}</dd></div>
          <div><dt>Số kế hoạch</dt><dd>{program.plan_number ?? "—"}</dd></div>
          <div><dt>Ngày ký</dt><dd>{program.plan_signed_on ? new Date(`${program.plan_signed_on}T00:00:00+07:00`).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—"}</dd></div>
          <div className={styles.wide}><dt>Nội dung</dt><dd>{program.summary ?? "—"}</dd></div>
        </dl>
      </section>

      {program.status === "approved" && (
        <RegistrationSection supabase={supabase} userId={user.id} program={program} isManager={isManager} />
      )}
      {program.status === "approved" && (
        <AttendanceSection supabase={supabase} userId={user.id} programId={program.id} isManager={isManager} />
      )}
      {program.status === "approved" && !isManager && (
        <ParticipationSection supabase={supabase} programId={program.id} />
      )}
      {program.status === "approved" && (isManager || (viewer.isReviewer && acceptance)) && (
        <section className="panel inline">
          <h2>Nghiệm thu</h2>
          <Link className="button secondary" href={`/programs/${program.id}/acceptance`}>Hồ sơ nghiệm thu</Link>
        </section>
      )}
      {publication && (
        <section className="panel inline">
          <h2>Đăng bài</h2>
          <span className="status" data-testid="program-publication-status">
            {publicationStatusLabels[publication.status as PublicationStatus]}
          </span>
          <Link className="button secondary" href={`/programs/${program.id}/publication`}>Bài đăng chương trình</Link>
        </section>
      )}
      {canCancel && (
        <section className="panel">
          <h2>Hủy chương trình</h2>
          <p className="muted">Chương trình hủy không được nghiệm thu và không ai bị trừ điểm uy tín. Các lượt và đăng ký đang mở sẽ đóng.</p>
          <ReasonAction url={`/api/event-programs/${program.id}/cancel`} reasonLabel="Lý do hủy (bắt buộc, tối thiểu 10 ký tự)"
            choices={[{ value: null, label: "Hủy chương trình" }]} />
        </section>
      )}

      {actions.canEdit && (
        <section className="panel">
          <h2>{program.status === "needs_changes" ? "Sửa tiếp hồ sơ theo yêu cầu" : "Sửa bản nháp"}</h2>
          <EventProgramEditor mode="edit" programId={program.id} initial={program} />
        </section>
      )}

      <EventProgramActions
        programId={program.id}
        canEdit={actions.canEdit}
        canSubmit={actions.canSubmit}
        canReview={actions.canReview}
        hasDocument={Boolean(program.current_document_id)}
      />

      {(documents ?? []).length > 0 && (
        <section className="panel">
          <h2>Bản kế hoạch PDF</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tệp</th><th>Tải lên lúc</th><th>Dung lượng</th><th>SHA-256</th><th></th></tr></thead>
              <tbody>
                {(documents ?? []).map((doc) => (
                  <tr key={doc.id as string}>
                    <td>
                      {doc.original_file_name as string}
                      {doc.id === program.current_document_id && <><br /><span className="status">Bản hiện hành</span></>}
                    </td>
                    <td>{formatVietnamDateTime(doc.uploaded_at as string)}</td>
                    <td>{Math.ceil((doc.size_bytes as number) / 1024)} KB</td>
                    <td><code title={doc.sha256 as string}>{(doc.sha256 as string).slice(0, 12)}…</code></td>
                    <td><a className="button secondary small" href={`/api/event-programs/${program.id}/documents/${doc.id as string}`}>Mở</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="panel">
          <h2>Lịch sử xử lý</h2>
          <ol className={styles.timeline}>
            {history.map((entry) => (
              <li key={entry.id} className={entry.from_status !== entry.to_status ? styles.changed : undefined}>
                <strong>{actionLabels[entry.action] ?? entry.action}</strong>
                {entry.from_status && entry.from_status !== entry.to_status && (
                  <span className="muted">
                    {" "}— {statusLabels[entry.from_status as EventProgramStatus] ?? entry.from_status} →{" "}
                    {statusLabels[entry.to_status as EventProgramStatus] ?? entry.to_status}
                  </span>
                )}
                <br />
                <span className="muted">
                  {formatVietnamDateTime(entry.occurred_at)} · {entry.actor_name ?? "—"}
                  {entry.actor_role_code ? ` (${roleLabels[entry.actor_role_code] ?? entry.actor_role_code})` : ""}
                </span>
                {entry.reason && <p className={styles.reason}>{entry.reason}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
