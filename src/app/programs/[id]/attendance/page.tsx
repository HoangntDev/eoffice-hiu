import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AttendancePlanEditor, type AttendancePlanValues } from "@/components/attendance-plan-editor";
import { AttendanceSessionControls } from "@/components/attendance-session-controls";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";
import { loadEventProgramViewer } from "@/modules/event-programs/viewer";
import {
  participationLabels, ruleLabels, sessionStatusLabels, type Participation, type SessionStatus,
} from "@/modules/program-attendance/schemas";

type SessionRow = {
  id: string; label: string; points: number; is_required: boolean; sort_order: number;
  status: SessionStatus; open_count: number; opened_at: string | null; closed_at: string | null;
};
type PreviewRow = {
  registration_id: string; student_code: string; full_name: string | null; class_code: string | null;
  attended_count: number; attended_sessions: Array<{ session_id: string; supplementary: boolean }>;
  participation: Participation; expected_points: number;
};
type HistoryRow = {
  id: number; action: string; session_id: string | null; reason: string | null; actor_name: string | null;
  actor_role_code: string | null; occurred_at: string;
};

const actionLabels: Record<string, string> = {
  plan_saved: "Lưu kế hoạch điểm danh",
  plan_amended: "Điều chỉnh quy tắc sau khi đã điểm danh",
  session_opened: "Mở lượt",
  session_reopened: "Mở lại lượt (điểm danh bổ sung)",
  session_closed: "Đóng lượt",
};

export default async function ProgramAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/programs/${id}/attendance`);

  const { data: program } = await supabase.from("event_programs").select("id, title, status, owner_org_id").eq("id", id).maybeSingle();
  if (!program || program.status !== "approved") notFound();
  const viewer = await loadEventProgramViewer(supabase, user.id);
  if (!viewer.managedOrgs.some((org) => org.id === program.owner_org_id)) notFound();

  const [{ data: plan }, { data: sessionData }, { data: previewData }, { data: historyData }, { data: grants }] = await Promise.all([
    supabase.from("program_attendance_plans").select("max_points, rule_type, tiers, tiers_require_required").eq("program_id", id).maybeSingle(),
    supabase.from("program_attendance_sessions")
      .select("id, label, points, is_required, sort_order, status, open_count, opened_at, closed_at")
      .eq("program_id", id).order("sort_order"),
    supabase.rpc("program_attendance_preview", { p_program_id: id }),
    supabase.from("program_attendance_history")
      .select("id, action, session_id, reason, actor_name, actor_role_code, occurred_at")
      .eq("program_id", id).order("occurred_at", { ascending: false }).limit(50),
    supabase.from("role_grants").select("role_code, organization_id").eq("user_id", user.id).is("revoked_at", null),
  ]);
  const sessions = (sessionData ?? []) as SessionRow[];
  const preview = (previewData ?? []) as PreviewRow[];
  const history = (historyData ?? []) as HistoryRow[];
  const locked = sessions.some((s) => s.open_count > 0);
  const canAmend = (grants ?? []).some((g) => g.role_code === "faculty_manager" && g.organization_id === program.owner_org_id);
  const initial: AttendancePlanValues | null = plan
    ? { ...(plan as Omit<AttendancePlanValues, "sessions">), sessions }
    : null;
  const labelById = new Map(sessions.map((s) => [s.id, s.label]));
  const counts = { completed: 0, participated: 0, absent: 0 };
  for (const row of preview) counts[row.participation] += 1;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href={`/programs/${id}`}>{program.title as string}</Link></p>
          <h1>Điểm danh</h1>
          {plan && <p className="muted">Tối đa {plan.max_points} điểm · {ruleLabels[plan.rule_type as keyof typeof ruleLabels]}</p>}
        </div>
      </div>

      <p className="notice">
        Điểm ở đây là điểm rèn luyện <strong>dự kiến đề nghị</strong>, dùng cho Đơn đề nghị cấp điểm sau này;
        không phải kết quả Thư ký Khoa cấp. Điểm danh không trừ điểm uy tín: việc đó chỉ thực hiện sau khi Văn phòng nghiệm thu chương trình.
      </p>

      {sessions.length > 0 && (
        <section className="panel">
          <h2>Các lượt</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Lượt</th><th>Điểm / bắt buộc</th><th>Trạng thái</th><th>Có mặt</th><th></th></tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.label}</td>
                    <td>{s.points} điểm{s.is_required ? " · bắt buộc" : ""}</td>
                    <td>
                      <span className="status">{sessionStatusLabels[s.status]}</span>
                      {s.open_count > 1 && <><br /><span className="muted">Đã mở {s.open_count} lần</span></>}
                    </td>
                    <td>{preview.filter((p) => p.attended_sessions.some((a) => a.session_id === s.id)).length}</td>
                    <td><AttendanceSessionControls programId={id} sessionId={s.id} label={s.label} status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Bảng xem trước điểm dự kiến</h2>
        <p className="muted">
          Hoàn thành {counts.completed} · Có tham gia (chưa có điểm) {counts.participated} · Đăng ký nhưng không tham gia {counts.absent}
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Sinh viên</th><th>Lớp</th><th>Lượt có mặt</th><th>Trạng thái</th><th>Điểm dự kiến</th></tr></thead>
            <tbody>
              {preview.length === 0 && <tr><td colSpan={5} className="muted">Chưa có đăng ký được nhận.</td></tr>}
              {preview.map((row) => (
                <tr key={row.registration_id}>
                  <td>{row.full_name ?? "—"}<br /><span className="muted">{row.student_code}</span></td>
                  <td>{row.class_code ?? "—"}</td>
                  <td>
                    {row.attended_sessions.length === 0 ? "—" : row.attended_sessions
                      .map((a) => `${labelById.get(a.session_id) ?? "?"}${a.supplementary ? " (bổ sung)" : ""}`).join(", ")}
                  </td>
                  <td><span className="status">{participationLabels[row.participation]}</span></td>
                  <td>{row.expected_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>{plan ? "Kế hoạch điểm danh" : "Lập kế hoạch điểm danh"}</h2>
        <AttendancePlanEditor programId={id} initial={initial} locked={locked} canAmend={canAmend} />
      </section>

      {history.length > 0 && (
        <section className="panel">
          <h2>Lịch sử</h2>
          <ol>
            {history.map((entry) => (
              <li key={entry.id}>
                <strong>{actionLabels[entry.action] ?? entry.action}</strong>
                {entry.session_id && labelById.get(entry.session_id) ? ` — ${labelById.get(entry.session_id)}` : ""}
                <br />
                <span className="muted">{formatVietnamDateTime(entry.occurred_at)} · {entry.actor_name ?? "—"}</span>
                {entry.reason && <p className="muted">Lý do: {entry.reason}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
