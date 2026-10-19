import Link from "next/link";
import { redirect } from "next/navigation";
import { EventProgramStatusBadge } from "@/components/event-program-status";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";
import { loadEventProgramViewer } from "@/modules/event-programs/viewer";
import { displayOrgName } from "@/modules/organization-catalog/display";
import { blockReasonLabels, registrationBlockReason } from "@/modules/program-registrations/eligibility";
import { registrationStatusLabels, type RegistrationStatus } from "@/modules/program-registrations/schemas";

type Row = {
  id: string;
  owner_org_id: string;
  title: string;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  submission_count: number;
  submitted_at: string | null;
  organization_units: { name: string } | null;
};

const columns = "id, owner_org_id, title, location, starts_at, ends_at, status, submission_count, submitted_at, organization_units(name)";

type MyState = { label: string; tone: string };

function ProgramTable({ rows, empty, showStatus = true, mine }: { rows: Row[]; empty: string; showStatus?: boolean; mine?: Map<string, MyState> }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table className="cards-on-mobile">
        <thead>
          <tr>
            <th>Chương trình</th>
            <th>Đơn vị</th>
            <th>Thời gian</th>
            {showStatus && <th>Trạng thái</th>}
            {mine && <th>Đăng ký của tôi</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="cell-title">{row.title}{row.location ? <><br /><span className="muted">{row.location}</span></> : null}</td>
              <td data-label="Đơn vị">{displayOrgName(row.organization_units?.name)}</td>
              <td data-label="Thời gian">{formatVietnamDateTime(row.starts_at)}</td>
              {showStatus && (
                <td data-label="Trạng thái">
                  <EventProgramStatusBadge status={row.status} />
                  {row.submission_count > 1 && <><br /><span className="muted">Lần nộp {row.submission_count}</span></>}
                </td>
              )}
              {mine && (
                <td data-label="Đăng ký của tôi">{mine.has(row.id) ? <span className={`status ${mine.get(row.id)!.tone}`}>{mine.get(row.id)!.label}</span> : <span className="muted">—</span>}</td>
              )}
              <td className="cell-action"><Link className="button secondary small" href={`/programs/${row.id}`}>Xem</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ProgramsPage() {
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/programs");

  const viewer = await loadEventProgramViewer(supabase, user.id);
  const managedIds = viewer.managedOrgs.map((org) => org.id);

  const [approved, mine, queue] = await Promise.all([
    supabase.from("event_programs").select(columns).eq("status", "approved").order("starts_at", { ascending: true }).limit(200),
    managedIds.length > 0
      ? supabase.from("event_programs").select(columns).in("owner_org_id", managedIds).order("updated_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] }),
    viewer.isReviewer
      ? supabase.from("event_programs").select(columns).eq("status", "submitted").order("submitted_at", { ascending: true }).limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  const approvedRows = (approved.data ?? []) as unknown as Row[];
  const myStates = await loadMyRegistrationStates(supabase, user.id, approvedRows);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Kế hoạch chương trình</p>
          <h1>Chương trình sự kiện</h1>
          <p className="lead">
            Đoàn Khoa lập kế hoạch và nộp bản PDF đã ký; Văn phòng Đoàn – Hội xét duyệt. Chỉ chương trình được chấp thuận
            mới xuất hiện trong danh sách đã duyệt.
          </p>
        </div>
        {viewer.managedOrgs.length > 0 && <Link className="button primary" href="/programs/new">Lập kế hoạch</Link>}
      </div>

      {viewer.isReviewer && (
        <section className="panel">
          <h2>Chờ Văn phòng xét duyệt</h2>
          <ProgramTable rows={(queue.data ?? []) as unknown as Row[]} empty="Không có kế hoạch nào đang chờ xét." showStatus={false} />
        </section>
      )}

      {viewer.managedOrgs.length > 0 && (
        <section className="panel">
          <h2>Kế hoạch của Đoàn Khoa</h2>
          <ProgramTable rows={(mine.data ?? []) as unknown as Row[]} empty="Đoàn Khoa chưa lập kế hoạch nào." />
        </section>
      )}

      <section className="panel">
        <h2>Chương trình đã được chấp thuận</h2>
        <ProgramTable rows={approvedRows} empty="Chưa có chương trình nào được chấp thuận." showStatus={false} mine={myStates} />
      </section>
    </main>
  );
}

type Settings = {
  program_id: string; status: "draft" | "open" | "closed"; closes_at: string | null;
  capacity: number | null; requires_approval: boolean; audience_rule: unknown;
};

// Cột "Đăng ký của tôi": trạng thái đăng ký nếu đã gửi, nếu chưa thì vì sao chưa đăng ký được.
async function loadMyRegistrationStates(
  supabase: Awaited<ReturnType<typeof createUserSupabase>>, userId: string, rows: Row[],
): Promise<Map<string, MyState>> {
  const ids = rows.map((row) => row.id);
  const states = new Map<string, MyState>();
  if (ids.length === 0) return states;
  const [{ data: settingsRows }, { data: own }] = await Promise.all([
    supabase.from("program_registration_settings")
      .select("program_id, status, closes_at, capacity, requires_approval, audience_rule").in("program_id", ids),
    supabase.from("program_registrations").select("program_id, status").eq("user_id", userId).in("program_id", ids),
  ]);
  const settingsById = new Map(((settingsRows ?? []) as Settings[]).map((row) => [row.program_id, row]));
  const ownById = new Map((own ?? []).map((row) => [row.program_id as string, row.status as RegistrationStatus]));

  await Promise.all(rows.map(async (row) => {
    const status = ownById.get(row.id);
    if (status) {
      states.set(row.id, { label: registrationStatusLabels[status], tone: `reg-${status}` });
      return;
    }
    const settings = settingsById.get(row.id) ?? null;
    let audienceOk: boolean | null = null;
    let accepted = 0;
    if (settings?.status === "open") {
      const [{ data: ok }, { data: summary }] = await Promise.all([
        supabase.rpc("evaluate_audience_rule", { p_rule: settings.audience_rule, p_user_id: userId }),
        settings.capacity !== null ? supabase.rpc("program_registration_summary", { p_program_id: row.id }) : Promise.resolve({ data: null }),
      ]);
      audienceOk = typeof ok === "boolean" ? ok : null;
      accepted = (summary as { accepted?: number } | null)?.accepted ?? 0;
    }
    const reason = registrationBlockReason({
      settingsStatus: settings?.status ?? null,
      closesAt: settings?.closes_at ?? null,
      programEndsAt: row.ends_at,
      capacity: settings?.capacity ?? null,
      accepted,
      requiresApproval: settings?.requires_approval ?? false,
      audienceOk,
    });
    states.set(row.id, reason
      ? { label: blockReasonLabels[reason], tone: "reg-blocked" }
      : { label: "Đang mở đăng ký", tone: "reg-open" });
  }));
  return states;
}
