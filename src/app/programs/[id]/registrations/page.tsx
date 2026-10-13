import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RegistrationDecision } from "@/components/registration-decision";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";
import type { RegistrationListRow } from "@/modules/program-registrations/export";
import { registrationStatusLabels, settingsStatusLabels, type SettingsStatus } from "@/modules/program-registrations/schemas";

type HistoryRow = {
  id: number;
  action: string;
  reason: string | null;
  skipped_higher_reputation: boolean;
  actor_name: string | null;
  occurred_at: string;
  registration_id: string | null;
};

const actionLabels: Record<string, string> = {
  settings_saved: "Lưu cấu hình",
  opened: "Mở đăng ký",
  closed: "Đóng đăng ký",
  registered: "Đăng ký",
  auto_accepted: "Tự xác nhận (theo thứ tự)",
  approved: "BTC duyệt",
  rejected: "BTC từ chối",
};

export default async function ProgramRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/programs/${id}/registrations`);

  const { data: program } = await supabase.from("event_programs").select("id, title").eq("id", id).maybeSingle();
  if (!program) notFound();
  // RPC chỉ trả dữ liệu cho BTC (Đoàn Khoa sở hữu chương trình).
  const { data, error } = await supabase.rpc("list_program_registrations", { p_program_id: id });
  if (error) notFound();
  const rows = (data ?? []) as RegistrationListRow[];
  const [{ data: settings }, { data: historyData }] = await Promise.all([
    supabase.from("program_registration_settings").select("status, capacity, requires_approval").eq("program_id", id).maybeSingle(),
    supabase.from("program_registration_history")
      .select("id, action, reason, skipped_higher_reputation, actor_name, occurred_at, registration_id")
      .eq("program_id", id).in("action", ["settings_saved", "opened", "closed", "approved", "rejected"])
      .order("occurred_at", { ascending: false }).limit(50),
  ]);
  const usesReputation = Boolean(settings?.capacity && settings?.requires_approval);
  const history = (historyData ?? []) as HistoryRow[];
  const nameById = new Map(rows.map((r) => [r.registration_id, `${r.full_name ?? ""} (${r.student_code})`]));
  const counts = { pending: 0, accepted: 0, rejected: 0 };
  for (const row of rows) counts[row.status] += 1;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href={`/programs/${id}`}>{program.title as string}</Link></p>
          <h1>Danh sách đăng ký</h1>
          <p className="inline">
            <span className="status">{settingsStatusLabels[(settings?.status ?? "draft") as SettingsStatus]}</span>
            <span className="muted">
              Đã xác nhận {counts.accepted}{settings?.capacity ? `/${settings.capacity}` : ""} · Chờ duyệt {counts.pending} · Từ chối {counts.rejected}
            </span>
          </p>
        </div>
        <div className="inline">
          <a className="button secondary" href={`/api/event-programs/${id}/registrations/export?status=accepted`}>Xuất danh sách tham gia (CSV)</a>
          <a className="button secondary" href={`/api/event-programs/${id}/registrations/export?status=all`}>Xuất tất cả</a>
        </div>
      </div>

      {usesReputation && counts.pending > 0 && (
        <p className="notice">
          Chương trình giới hạn chỗ và cần duyệt: danh sách chờ được gợi ý theo điểm uy tín rồi thời điểm đăng ký.
          Duyệt người xếp sau khi người xếp trước còn có thể nhận phải ghi lý do.
        </p>
      )}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {usesReputation && <th>Gợi ý</th>}
                <th>Sinh viên</th><th>Lớp / Khoa</th><th>Trạng thái</th><th>Đăng ký lúc</th>
                {usesReputation && <th>Uy tín</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} className="muted">Chưa có đăng ký.</td></tr>}
              {rows.map((row) => (
                <tr key={row.registration_id}>
                  {usesReputation && <td>{row.suggested_rank ?? ""}</td>}
                  <td>{row.full_name ?? "—"}<br /><span className="muted">{row.student_code}</span></td>
                  <td>{row.class_code ?? "—"}<br /><span className="muted">{row.faculty_name ?? ""}</span></td>
                  <td>
                    <span className="status">{registrationStatusLabels[row.status]}</span>
                    {row.quota_label && <><br /><span className="muted">{row.quota_label}</span></>}
                    {row.decision_reason && <><br /><span className="muted">{row.decision_reason}</span></>}
                  </td>
                  <td>{formatVietnamDateTime(row.registered_at)}</td>
                  {usesReputation && <td>{row.reputation_score ?? "—"}</td>}
                  <td>
                    {row.status === "pending" && (
                      <RegistrationDecision programId={id} registrationId={row.registration_id}
                        studentLabel={row.full_name ?? row.student_code} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {history.length > 0 && (
        <section className="panel">
          <h2>Lịch sử thao tác của BTC</h2>
          <ol>
            {history.map((entry) => (
              <li key={entry.id}>
                <strong>{actionLabels[entry.action] ?? entry.action}</strong>
                {entry.registration_id && nameById.get(entry.registration_id) ? ` — ${nameById.get(entry.registration_id)}` : ""}
                {entry.skipped_higher_reputation && <span className="status"> Duyệt ngoại lệ uy tín</span>}
                <br />
                <span className="muted">{formatVietnamDateTime(entry.occurred_at)} · {entry.actor_name ?? "—"}</span>
                {entry.reason && <p className="muted">{entry.reason}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
