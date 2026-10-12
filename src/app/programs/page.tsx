import Link from "next/link";
import { redirect } from "next/navigation";
import { EventProgramStatusBadge } from "@/components/event-program-status";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";
import { loadEventProgramViewer } from "@/modules/event-programs/viewer";

type Row = {
  id: string;
  owner_org_id: string;
  title: string;
  location: string | null;
  starts_at: string | null;
  status: string;
  submission_count: number;
  submitted_at: string | null;
  organization_units: { name: string } | null;
};

const columns = "id, owner_org_id, title, location, starts_at, status, submission_count, submitted_at, organization_units(name)";

function ProgramTable({ rows, empty, showStatus = true }: { rows: Row[]; empty: string; showStatus?: boolean }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Chương trình</th>
            <th>Đơn vị</th>
            <th>Thời gian</th>
            {showStatus && <th>Trạng thái</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.title}{row.location ? <><br /><span className="muted">{row.location}</span></> : null}</td>
              <td>{row.organization_units?.name ?? "—"}</td>
              <td>{formatVietnamDateTime(row.starts_at)}</td>
              {showStatus && (
                <td>
                  <EventProgramStatusBadge status={row.status} />
                  {row.submission_count > 1 && <><br /><span className="muted">Lần nộp {row.submission_count}</span></>}
                </td>
              )}
              <td><Link className="button secondary small" href={`/programs/${row.id}`}>Xem</Link></td>
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
        <ProgramTable rows={(approved.data ?? []) as unknown as Row[]} empty="Chưa có chương trình nào được chấp thuận." showStatus={false} />
      </section>
    </main>
  );
}
