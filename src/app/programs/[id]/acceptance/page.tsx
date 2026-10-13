import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AcceptanceUpload, ActionButton, ReasonAction } from "@/components/acceptance-actions";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";
import { loadEventProgramViewer } from "@/modules/event-programs/viewer";
import { sessionText, type AcceptanceAttendanceRow } from "@/modules/program-acceptance/export";
import {
  acceptanceActionLabels, acceptanceStatusLabels, complaintStatusLabels, documentKindLabels, missingLabels,
  type AcceptanceStatus, type DocumentKind,
} from "@/modules/program-acceptance/schemas";
import { participationLabels } from "@/modules/program-attendance/schemas";

type Acceptance = {
  status: AcceptanceStatus; attendance_locked: boolean; submission_count: number; submitted_at: string | null;
  decided_at: string | null; term_id: string | null; current_snapshot_version: number | null;
};
type DocumentRow = {
  id: string; kind: DocumentKind; original_file_name: string; size_bytes: number; sha256: string; uploaded_at: string;
  superseded_at: string | null; withdrawn_at: string | null; withdraw_reason: string | null;
};
type HistoryRow = {
  id: number; action: string; reason: string | null; document_id: string | null; actor_user_id: string;
  actor_name: string | null; actor_role_code: string | null; occurred_at: string;
};
type ComplaintRow = {
  id: string; user_id: string; session_id: string; message: string; status: string; filed_at: string;
  resolved_at: string | null; resolution_reason: string | null;
};
type SnapshotRow = { version: number; reason: string; created_at: string };
type LedgerRow = {
  id: number; student_code: string; full_name: string | null; delta: number; kind: string; reason: string;
  term_name: string; actor_name: string | null; created_at: string;
};

const vnDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";

export default async function ProgramAcceptancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/programs/${id}/acceptance`);

  const { data: program } = await supabase.from("event_programs")
    .select("id, title, status, owner_org_id, starts_at, cancel_reason").eq("id", id).maybeSingle();
  if (!program) notFound();
  const viewer = await loadEventProgramViewer(supabase, user.id);
  const isManager = viewer.managedOrgs.some((org) => org.id === program.owner_org_id);
  const { data: accData } = await supabase.from("program_acceptances")
    .select("status, attendance_locked, submission_count, submitted_at, decided_at, term_id, current_snapshot_version")
    .eq("program_id", id).maybeSingle();
  const acceptance = accData as Acceptance | null;
  // Văn phòng chỉ thấy hồ sơ sau lần nộp đầu tiên (RLS trả null trước đó).
  if (!isManager && !(viewer.isReviewer && acceptance)) notFound();

  const [rowsRes, sessionsRes, docsRes, historyRes, complaintsRes, snapshotsRes, termIdRes, missingRes] = await Promise.all([
    supabase.rpc("program_acceptance_attendance", { p_program_id: id }),
    supabase.from("program_attendance_sessions").select("id, label, status").eq("program_id", id).order("sort_order"),
    supabase.from("program_acceptance_documents")
      .select("id, kind, original_file_name, size_bytes, sha256, uploaded_at, superseded_at, withdrawn_at, withdraw_reason")
      .eq("program_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("program_acceptance_history")
      .select("id, action, reason, document_id, actor_user_id, actor_name, actor_role_code, occurred_at")
      .eq("program_id", id).order("occurred_at", { ascending: false }).limit(100),
    supabase.from("program_attendance_complaints")
      .select("id, user_id, session_id, message, status, filed_at, resolved_at, resolution_reason")
      .eq("program_id", id).order("filed_at"),
    supabase.from("program_acceptance_snapshots").select("version, reason, created_at").eq("program_id", id).order("version"),
    supabase.rpc("academic_term_at", { p_at: program.starts_at }),
    supabase.rpc("program_acceptance_missing", { p_program_id: id }),
  ]);
  const rows = (rowsRes.data ?? []) as AcceptanceAttendanceRow[];
  const sessions = (sessionsRes.data ?? []) as Array<{ id: string; label: string; status: string }>;
  const documents = (docsRes.data ?? []) as DocumentRow[];
  const history = (historyRes.data ?? []) as HistoryRow[];
  const complaints = (complaintsRes.data ?? []) as ComplaintRow[];
  const snapshots = (snapshotsRes.data ?? []) as SnapshotRow[];
  const missing = (missingRes.data ?? []) as string[];
  const termId = (acceptance?.term_id ?? termIdRes.data ?? null) as string | null;
  const { data: term } = termId
    ? await supabase.from("academic_terms").select("academic_year, name, ends_on").eq("id", termId).maybeSingle()
    : { data: null };
  const { data: ledgerData } = viewer.isReviewer
    ? await supabase.rpc("program_reputation_ledger", { p_program_id: id })
    : { data: null };
  const ledger = (ledgerData ?? []) as LedgerRow[];

  const status = acceptance?.status ?? null;
  const locked = acceptance?.attendance_locked ?? false;
  const editable = isManager && locked && (status === "draft" || status === "needs_changes");
  const hasSubmitted = history.some((h) => h.action === "submitted" && h.actor_user_id === user.id);
  const canReview = viewer.isReviewer && !isManager && !hasSubmitted && status === "submitted";
  const studentById = new Map(rows.map((r) => [r.user_id, `${r.full_name ?? "—"} (${r.student_code})`]));
  const sessionById = new Map(sessions.map((s) => [s.id, s.label]));
  const uploaderByDoc = new Map(history.filter((h) => h.document_id && h.action !== "document_withdrawn")
    .map((h) => [h.document_id!, h.actor_name]));
  const counts = { completed: 0, participated: 0, absent: 0 };
  for (const row of rows) counts[row.participation] += 1;
  const lastFeedback = history.find((h) => h.action === "changes_requested" || h.action === "rejected");

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href={`/programs/${id}`}>{program.title as string}</Link></p>
          <h1>Nghiệm thu chương trình</h1>
          <p className="inline">
            <span className="status" data-testid="acceptance-status">
              {status ? acceptanceStatusLabels[status] : "Chưa khóa điểm danh"}
            </span>
            {(acceptance?.submission_count ?? 0) > 0 && <span className="muted">Đã nộp {acceptance!.submission_count} lần</span>}
          </p>
        </div>
      </div>

      {program.status === "cancelled" && (
        <p className="notice error">Chương trình đã hủy ({program.cancel_reason as string}). Không nghiệm thu, không trừ điểm uy tín.</p>
      )}
      <p className="notice">
        Điểm trong trang này là điểm rèn luyện <strong>dự kiến đề nghị</strong> theo quy tắc điểm danh, dùng để lập Đơn đề nghị
        cấp điểm. Đây <strong>không phải</strong> điểm Thư ký Khoa đã cấp.
      </p>
      {term ? (
        <p className="muted" data-testid="acceptance-term">
          Học kỳ của chương trình: {term.name as string} năm học {term.academic_year as string} · hạn khiếu nại đến hết {vnDate(term.ends_on as string)}
        </p>
      ) : (
        <p className="notice warning" data-testid="acceptance-term">
          Ngày bắt đầu chương trình ({vnDate(program.starts_at as string)}) chưa thuộc học kỳ nào. Văn phòng chưa nghiệm thu được và
          hệ thống chưa chốt điểm uy tín cho tới khi Đoàn Trường hoặc Văn phòng <Link href="/office/terms">cấu hình học kỳ</Link>.
        </p>
      )}
      {status === "needs_changes" && lastFeedback?.reason && (
        <p className="notice warning">Văn phòng yêu cầu bổ sung: {lastFeedback.reason}</p>
      )}
      {status === "rejected" && lastFeedback?.reason && <p className="notice error">Lý do không nghiệm thu: {lastFeedback.reason}</p>}

      {isManager && program.status === "approved" && (!status || status === "draft" || status === "needs_changes") && (
        <section className="panel">
          <h2>Bước 1 · Khóa điểm danh</h2>
          {!locked ? (
            <>
              <p className="muted">Đóng mọi lượt và đóng đăng ký trước. Sau khi khóa, không mở lượt, không đổi quy tắc, không nhận thêm đăng ký.</p>
              <ActionButton url={`/api/event-programs/${id}/acceptance/lock`} body={{ action: "lock" }} label="Khóa điểm danh" />
            </>
          ) : (
            <ReasonAction url={`/api/event-programs/${id}/acceptance/lock`} body={{ action: "unlock" }}
              reasonLabel="Điểm danh đã khóa. Mở khóa (chỉ khi chưa nộp) — lý do, tối thiểu 10 ký tự"
              choices={[{ value: null, label: "Mở khóa điểm danh" }]} />
          )}
        </section>
      )}

      <section className="panel">
        <h2>Kết quả điểm danh</h2>
        <p className="muted" data-testid="acceptance-counts">
          {rows.length} đăng ký được nhận · Hoàn thành {counts.completed} · Có tham gia {counts.participated} · Đăng ký nhưng không tham gia {counts.absent}
        </p>
        <p className="inline">
          <a className="button secondary small" href={`/api/event-programs/${id}/acceptance/export`}>Xuất bảng (CSV)</a>
          <Link className="button secondary small" href={`/programs/${id}/acceptance/preview`}>Bản xem trước dữ liệu đơn đề nghị</Link>
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Sinh viên</th><th>Lớp</th><th>Lượt có mặt</th><th>Kết quả</th><th>Điểm dự kiến đề nghị</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="muted">Chưa có đăng ký được nhận.</td></tr>}
              {rows.map((row) => (
                <tr key={row.registration_id}>
                  <td>{row.full_name ?? "—"}<br /><span className="muted">{row.student_code}</span></td>
                  <td>{row.class_code ?? "—"}</td>
                  <td>{sessionText(row) || "—"}</td>
                  <td><span className="status">{participationLabels[row.participation]}</span></td>
                  <td>{row.expected_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {acceptance && (
        <section className="panel">
          <h2>Bước 2 · Hồ sơ nghiệm thu</h2>
          {missing.length > 0 && (
            <p className="notice warning" data-testid="acceptance-missing">Còn thiếu: {missing.map((m) => missingLabels[m] ?? m).join(", ")}.</p>
          )}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Loại</th><th>Tệp</th><th>Người tải · thời điểm</th><th>Phiên bản</th><th></th></tr></thead>
              <tbody>
                {documents.length === 0 && <tr><td colSpan={5} className="muted">Chưa có tệp.</td></tr>}
                {documents.map((doc) => {
                  const current = !doc.superseded_at && !doc.withdrawn_at;
                  return (
                    <tr key={doc.id}>
                      <td>{documentKindLabels[doc.kind]}</td>
                      <td>{doc.original_file_name}<br /><span className="muted">{Math.ceil(doc.size_bytes / 1024)} KB · <code>{doc.sha256.slice(0, 12)}…</code></span></td>
                      <td>{uploaderByDoc.get(doc.id) ?? "—"}<br /><span className="muted">{formatVietnamDateTime(doc.uploaded_at)}</span></td>
                      <td>
                        <span className="status">{current ? "Hiện hành" : doc.withdrawn_at ? "Đã rút" : "Đã thay bằng bản mới"}</span>
                        {doc.withdraw_reason && <><br /><span className="muted">{doc.withdraw_reason}</span></>}
                      </td>
                      <td className="stack">
                        <a className="button secondary small" href={`/api/event-programs/${id}/acceptance/documents/${doc.id}`}>Mở</a>
                        {editable && current && (
                          <ReasonAction url={`/api/event-programs/${id}/acceptance/documents/${doc.id}/withdraw`}
                            reasonLabel="Lý do rút" choices={[{ value: null, label: "Rút tệp" }]} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editable && (
            <>
              <h3>Tải tệp</h3>
              <p className="muted">
                Đơn đề nghị: in từ bảng dữ liệu, Trưởng BTC ký, scan PDF. Repo chưa có mẫu đơn chính thức nên hệ thống chỉ cung cấp bản xem trước dữ liệu.
              </p>
              <AcceptanceUpload programId={id} />
              <h3>Nộp Văn phòng</h3>
              <ActionButton url={`/api/event-programs/${id}/acceptance/submit`} label="Nộp hồ sơ nghiệm thu" />
            </>
          )}
        </section>
      )}

      {canReview && (
        <section className="panel">
          <h2>Văn phòng xét nghiệm thu</h2>
          <p className="muted">
            Nghiệm thu sẽ chốt kết quả (phiên bản 1) và trừ 5 điểm uy tín cho mỗi sinh viên được nhận mà không có lượt điểm danh nào.
          </p>
          <ReasonAction url={`/api/event-programs/${id}/acceptance/review`}
            reasonLabel="Lý do (bắt buộc khi yêu cầu bổ sung hoặc từ chối)"
            choices={[
              { value: "accept", label: "Nghiệm thu", className: "primary" },
              { value: "request_changes", label: "Yêu cầu bổ sung" },
              { value: "reject", label: "Không nghiệm thu" },
            ]} />
        </section>
      )}

      {snapshots.length > 0 && (
        <section className="panel">
          <h2>Các phiên bản kết quả đã chốt</h2>
          <ol>
            {snapshots.map((s) => (
              <li key={s.version}>
                Phiên bản {s.version} — {s.reason === "accepted" ? "chốt khi nghiệm thu" : "tính lại sau khiếu nại được chấp nhận"}
                <span className="muted"> · {formatVietnamDateTime(s.created_at)}</span>
                {s.version === acceptance?.current_snapshot_version && <span className="status"> Hiện hành</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {status === "accepted" && (
        <section className="panel">
          <h2>Khiếu nại điểm danh</h2>
          {complaints.length === 0 && <p className="muted">Chưa có khiếu nại.</p>}
          {complaints.map((c) => (
            <div key={c.id} className="stack" data-testid="complaint">
              <p>
                <strong>{studentById.get(c.user_id) ?? "Sinh viên"}</strong> — lượt {sessionById.get(c.session_id) ?? "?"}
                <span className="muted"> · {formatVietnamDateTime(c.filed_at)}</span>
                <br />{c.message}
              </p>
              <p><span className="status">{complaintStatusLabels[c.status]}</span>
                {c.resolution_reason && <span className="muted"> · {c.resolution_reason}</span>}</p>
              {isManager && c.status === "pending" && (
                <ReasonAction url={`/api/complaints/${c.id}/resolve`} reasonLabel="Kết quả kiểm tra (bắt buộc, tối thiểu 10 ký tự)"
                  choices={[{ value: "accept", label: "Chấp nhận, bổ sung điểm danh", className: "primary" }, { value: "reject", label: "Không chấp nhận" }]} />
              )}
            </div>
          ))}
        </section>
      )}

      {viewer.isReviewer && ledger.length > 0 && (
        <section className="panel">
          <h2>Sổ uy tín của chương trình (chỉ Văn phòng)</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Sinh viên</th><th>Giao dịch</th><th>Lý do</th><th>Học kỳ</th><th>Người xử lý · thời điểm</th></tr></thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id} data-testid="ledger-row">
                    <td>{l.full_name ?? "—"}<br /><span className="muted">{l.student_code}</span></td>
                    <td>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                    <td>{l.reason}</td>
                    <td>{l.term_name}</td>
                    <td>{l.actor_name ?? "—"}<br /><span className="muted">{formatVietnamDateTime(l.created_at)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="panel">
          <h2>Lịch sử</h2>
          <ol>
            {history.map((h) => (
              <li key={h.id}>
                <strong>{acceptanceActionLabels[h.action] ?? h.action}</strong>
                <br /><span className="muted">{formatVietnamDateTime(h.occurred_at)} · {h.actor_name ?? "—"}</span>
                {h.reason && <p className="muted">Lý do: {h.reason}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
