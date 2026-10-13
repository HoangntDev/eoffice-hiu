import type { SupabaseClient } from "@supabase/supabase-js";
import { ComplaintForm } from "@/components/acceptance-actions";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";
import { complaintStatusLabels } from "@/modules/program-acceptance/schemas";
import { participationLabels, type Participation } from "@/modules/program-attendance/schemas";

type Result = {
  program_id: string; registration_status: string; accepted: boolean; participation: Participation | null;
  attended_sessions: Array<{ session_id: string; label: string }>; complaint_deadline: string | null;
};

// UC9 trên trang chương trình (sinh viên): kết quả sau nghiệm thu và khiếu nại thiếu điểm danh.
// Không hiển thị điểm dự kiến, điểm uy tín hay giao dịch trừ/hoàn.
export async function ParticipationSection({ supabase, programId }: { supabase: SupabaseClient; programId: string }) {
  const { data } = await supabase.rpc("my_program_results");
  const result = ((data ?? []) as Result[]).find((r) => r.program_id === programId);
  if (!result || result.registration_status !== "accepted" || !result.accepted) return null;

  const [{ data: sessionData }, { data: complaintData }] = await Promise.all([
    supabase.from("program_attendance_sessions").select("id, label, open_count").eq("program_id", programId).order("sort_order"),
    supabase.from("program_attendance_complaints")
      .select("id, session_id, message, status, filed_at, resolution_reason").eq("program_id", programId).order("filed_at"),
  ]);
  const sessions = (sessionData ?? []) as Array<{ id: string; label: string; open_count: number }>;
  const complaints = (complaintData ?? []) as Array<{
    id: string; session_id: string; message: string; status: string; filed_at: string; resolution_reason: string | null;
  }>;
  const attended = new Set(result.attended_sessions.map((s) => s.session_id));
  const blocked = new Set(complaints.filter((c) => c.status !== "rejected").map((c) => c.session_id));
  const claimable = sessions.filter((s) => s.open_count > 0 && !attended.has(s.id) && !blocked.has(s.id));
  const deadline = result.complaint_deadline;
  const open = deadline !== null && new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }) <= deadline;
  const label = new Map(sessions.map((s) => [s.id, s.label]));

  return (
    <section className="panel" data-testid="participation-result">
      <h2>Kết quả tham gia</h2>
      <p>
        <span className="status">{result.participation ? participationLabels[result.participation] : "—"}</span>
        <span className="muted"> · Chương trình đã được Văn phòng nghiệm thu</span>
      </p>
      <p className="muted">
        Lượt có mặt: {result.attended_sessions.length ? result.attended_sessions.map((s) => s.label).join(", ") : "không có lượt nào"}
      </p>
      {complaints.length > 0 && (
        <ul>
          {complaints.map((c) => (
            <li key={c.id}>
              Khiếu nại lượt {label.get(c.session_id) ?? "?"} ({formatVietnamDateTime(c.filed_at)}):{" "}
              <span className="status">{complaintStatusLabels[c.status]}</span>
              {c.resolution_reason && <span className="muted"> — {c.resolution_reason}</span>}
            </li>
          ))}
        </ul>
      )}
      {open && claimable.length > 0 && (
        <>
          <h3>Khiếu nại thiếu điểm danh</h3>
          <p className="muted">
            Nhận đến hết ngày {new Date(`${deadline}T00:00:00+07:00`).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (hết học kỳ).
            BTC kiểm tra và bổ sung điểm danh nếu chấp nhận.
          </p>
          <ComplaintForm programId={programId} sessions={claimable.map((s) => ({ id: s.id, label: s.label }))} />
        </>
      )}
      {!open && deadline && <p className="muted">Đã hết hạn khiếu nại.</p>}
    </section>
  );
}
