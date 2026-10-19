import Link from "next/link";
import { EventProgramStatusBadge } from "@/components/event-program-status";
import type { Viewer } from "@/lib/auth/viewer";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDate, formatVietnamDateTime } from "@/modules/event-programs/dates";
import { loadEventProgramViewer } from "@/modules/event-programs/viewer";
import { registrationStatusLabels, type RegistrationStatus } from "@/modules/program-registrations/schemas";
import { applicationStatusLabel, REVIEW_QUEUE_STATUSES } from "@/modules/union-membership/labels";

type ProgramRow = { id: string; title: string; starts_at: string | null; status: string };

function count(rows: Array<{ status: string }>, status: string) {
  return rows.filter((row) => row.status === status).length;
}

// Khối "Việc của tôi" trên trang chủ: mỗi vai trò thấy đúng phần việc của mình.
// Chỉ đọc qua RLS bằng phiên người dùng; không có quyền thì truy vấn trả rỗng.
export async function MyTasks({ viewer }: { viewer: Viewer }) {
  const supabase = await createUserSupabase();
  const programViewer = await loadEventProgramViewer(supabase, viewer.userId);
  const managedIds = programViewer.managedOrgs.map((org) => org.id);

  const [{ data: regRows }, { data: membership }, { data: application }, { data: orgPrograms }, { data: submitted }, { data: queue }] =
    await Promise.all([
      supabase.from("program_registrations").select("program_id, status, registered_at")
        .eq("user_id", viewer.userId).order("registered_at", { ascending: false }).limit(5),
      supabase.from("union_memberships").select("status, recognized_on").eq("user_id", viewer.userId).maybeSingle(),
      supabase.from("union_applications").select("status, decision_reason").eq("user_id", viewer.userId)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      managedIds.length > 0
        ? supabase.from("event_programs").select("id, title, starts_at, status").in("owner_org_id", managedIds)
        : Promise.resolve({ data: [] as ProgramRow[] }),
      programViewer.isReviewer
        ? supabase.from("event_programs").select("id").eq("status", "submitted")
        : Promise.resolve({ data: [] as Array<{ id: string }> }),
      viewer.access.membershipReview
        ? supabase.from("union_applications").select("id").in("status", [...REVIEW_QUEUE_STATUSES])
        : Promise.resolve({ data: [] as Array<{ id: string }> }),
    ]);

  const registrations = (regRows ?? []) as Array<{ program_id: string; status: RegistrationStatus; registered_at: string }>;
  const ownPrograms = (orgPrograms ?? []) as ProgramRow[];
  const regProgramIds = registrations.map((row) => row.program_id);
  const approvedOwnIds = ownPrograms.filter((p) => p.status === "approved").map((p) => p.id);

  const [{ data: regPrograms }, { data: pendingRows }] = await Promise.all([
    regProgramIds.length > 0
      ? supabase.from("event_programs").select("id, title, starts_at").in("id", regProgramIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; starts_at: string | null }> }),
    approvedOwnIds.length > 0
      ? supabase.from("program_registrations").select("program_id").eq("status", "pending").in("program_id", approvedOwnIds)
      : Promise.resolve({ data: [] as Array<{ program_id: string }> }),
  ]);
  const titleOf = new Map((regPrograms ?? []).map((p) => [p.id as string, p]));
  const pendingByProgram = new Map<string, number>();
  for (const row of pendingRows ?? []) pendingByProgram.set(row.program_id, (pendingByProgram.get(row.program_id) ?? 0) + 1);

  const isMember = membership?.status === "recognized";
  const unionStatus = isMember ? "recognized" : (application?.status as string | undefined);

  return (
    <section className="portal-section">
      <h2 className="portal-section-title">Việc của tôi</h2>
      <div className="task-grid">
        <article className="panel task-card">
          <header className="task-card-head">
            <h3>Đăng ký chương trình</h3>
            <Link href="/programs" className="task-more">Xem chương trình</Link>
          </header>
          {registrations.length === 0 ? (
            <p className="muted">Bạn chưa đăng ký chương trình nào.</p>
          ) : (
            <ul className="task-list">
              {registrations.map((row) => {
                const program = titleOf.get(row.program_id);
                return (
                  <li key={row.program_id}>
                    <Link href={`/programs/${row.program_id}`}>{program?.title ?? "Chương trình"}</Link>
                    <span className="muted">{formatVietnamDateTime(program?.starts_at ?? null)}</span>
                    <span className={`status reg-${row.status}`}>{registrationStatusLabels[row.status]}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="panel task-card">
          <header className="task-card-head">
            <h3>Hồ sơ Đoàn viên của tôi</h3>
            <Link href="/union-membership" className="task-more">Mở hồ sơ</Link>
          </header>
          <p className="inline">
            <span className={`status union-${unionStatus ?? "none"}`}>{applicationStatusLabel(unionStatus)}</span>
            {isMember && membership?.recognized_on && <span className="muted">Công nhận ngày {formatVietnamDate(membership.recognized_on)}</span>}
          </p>
          {unionStatus === "needs_changes" && application?.decision_reason && (
            <p className="notice warning">Cần bổ sung: {application.decision_reason}</p>
          )}
          {!viewer.fullName && (
            <p className="muted">Bạn chưa hoàn thiện <Link href="/onboarding/profile">hồ sơ sinh viên</Link>; cần có Lớp để đăng ký đúng đối tượng.</p>
          )}
        </article>

        {programViewer.managedOrgs.length > 0 && (
          <article className="panel task-card">
            <header className="task-card-head">
              <h3>Đoàn Khoa: kế hoạch và đăng ký</h3>
              <Link href="/programs" className="task-more">Quản lý</Link>
            </header>
            <ul className="task-stats">
              <li><strong>{count(ownPrograms, "draft")}</strong><span>Bản nháp</span></li>
              <li><strong>{count(ownPrograms, "needs_changes")}</strong><span>Cần chỉnh sửa</span></li>
              <li><strong>{count(ownPrograms, "submitted")}</strong><span>Chờ Văn phòng xét</span></li>
              <li><strong>{[...pendingByProgram.values()].reduce((a, b) => a + b, 0)}</strong><span>Đăng ký chờ duyệt</span></li>
            </ul>
            {ownPrograms.filter((p) => p.status === "needs_changes" || pendingByProgram.has(p.id)).slice(0, 4).map((p) => (
              <p key={p.id} className="inline task-line">
                <Link href={pendingByProgram.has(p.id) ? `/programs/${p.id}/registrations` : `/programs/${p.id}`}>{p.title}</Link>
                {pendingByProgram.has(p.id)
                  ? <span className="status reg-pending">{pendingByProgram.get(p.id)} đăng ký chờ duyệt</span>
                  : <EventProgramStatusBadge status={p.status} />}
              </p>
            ))}
          </article>
        )}

        {(programViewer.isReviewer || viewer.access.membershipReview) && (
          <article className="panel task-card">
            <header className="task-card-head"><h3>Văn phòng: việc chờ xét</h3></header>
            <ul className="task-stats">
              {programViewer.isReviewer && (
                <li><Link href="/programs"><strong>{(submitted ?? []).length}</strong><span>Kế hoạch chờ xét</span></Link></li>
              )}
              {viewer.access.membershipReview && (
                <li><Link href="/office/membership"><strong>{(queue ?? []).length}</strong><span>Hồ sơ Đoàn viên chờ xử lý</span></Link></li>
              )}
            </ul>
          </article>
        )}
      </div>
    </section>
  );
}
