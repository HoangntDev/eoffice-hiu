import Link from "next/link";
import { redirect } from "next/navigation";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";
import { participationLabels, type Participation } from "@/modules/program-attendance/schemas";
import { registrationStatusLabels, type RegistrationStatus } from "@/modules/program-registrations/schemas";

type Result = {
  program_id: string; title: string; starts_at: string | null; program_status: string; organization_name: string;
  registration_status: RegistrationStatus; accepted: boolean; participation: Participation | null;
  attended_sessions: Array<{ label: string }>;
};

// Sinh viên xem kết quả tham gia và thống kê chương trình của mình.
// Theo quy tắc riêng tư đã chốt: không có điểm uy tín, xếp hạng uy tín hay lịch sử trừ/hoàn.
export default async function MyParticipationPage() {
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/participation");
  const { data } = await supabase.rpc("my_program_results");
  const results = (data ?? []) as Result[];
  const accepted = results.filter((r) => r.registration_status === "accepted");
  const finalized = accepted.filter((r) => r.accepted);
  const count = (p: Participation) => finalized.filter((r) => r.participation === p).length;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Cá nhân</p>
          <h1>Kết quả tham gia chương trình</h1>
        </div>
      </div>
      <section className="panel">
        <h2>Thống kê</h2>
        <p data-testid="participation-stats">
          Đã đăng ký {results.length} · được nhận {accepted.length} · đã nghiệm thu {finalized.length}:
          Hoàn thành {count("completed")}, Có tham gia {count("participated")}, Đăng ký nhưng không tham gia {count("absent")}
        </p>
      </section>
      <section className="panel">
        <h2>Chương trình</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Chương trình</th><th>Thời gian</th><th>Đăng ký</th><th>Kết quả</th></tr></thead>
            <tbody>
              {results.length === 0 && <tr><td colSpan={4} className="muted">Bạn chưa đăng ký chương trình nào.</td></tr>}
              {results.map((r) => (
                <tr key={r.program_id} data-testid="participation-row">
                  <td><Link href={`/programs/${r.program_id}`}>{r.title}</Link><br /><span className="muted">{r.organization_name}</span></td>
                  <td>{formatVietnamDateTime(r.starts_at)}</td>
                  <td>{registrationStatusLabels[r.registration_status] ?? r.registration_status}</td>
                  <td>
                    {r.program_status === "cancelled" ? "Chương trình đã hủy"
                      : r.registration_status !== "accepted" ? "—"
                      : r.accepted && r.participation ? <span className="status">{participationLabels[r.participation]}</span>
                      : "Chưa nghiệm thu"}
                    {r.attended_sessions.length > 0 && <><br /><span className="muted">{r.attended_sessions.map((s) => s.label).join(", ")}</span></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
