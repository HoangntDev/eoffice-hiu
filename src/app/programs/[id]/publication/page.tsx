import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionButton } from "@/components/acceptance-actions";
import {
  FacebookPostForm, PublicationCoverUpload, PublicationEditor, PublicationProposalForm,
} from "@/components/publication-actions";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime, toVietnamInputValue } from "@/modules/event-programs/dates";
import { loadEventProgramViewer } from "@/modules/event-programs/viewer";
import { buildGeneratedDraft, type PublicationFacts } from "@/modules/program-publication/draft";
import {
  publicationMissingLabels, publicationStatusLabels, revisionActionLabels, sourceLabels,
  type PublicationSource, type PublicationStatus,
} from "@/modules/program-publication/schemas";

type Publication = {
  status: PublicationStatus; title: string | null; body: string | null; draft_source: PublicationSource | null;
  cover_path: string | null; eoffice_path: string | null; eoffice_published_at: string | null; facebook_url: string | null;
  facebook_posted_at: string | null; completed_at: string | null; version: number;
};
type Revision = {
  id: number; version: number; action: string; title: string | null; reason: string | null; facebook_url: string | null;
  actor_name: string | null; actor_role_code: string | null; occurred_at: string;
};
type Proposal = { id: string; title: string; body: string; submitted_at: string };

// UC10: Ban Tuyên giáo – Truyền thông biên tập và xuất bản; Khoa gửi đề xuất; Văn phòng xem.
export default async function ProgramPublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/programs/${id}/publication`);

  const [{ data: pubData }, { data: program }, { data: publisherGrant }] = await Promise.all([
    supabase.from("program_publications")
      .select("status, title, body, draft_source, cover_path, eoffice_path, eoffice_published_at, facebook_url, facebook_posted_at, completed_at, version")
      .eq("program_id", id).maybeSingle(),
    supabase.from("event_programs").select("id, title, owner_org_id").eq("id", id).maybeSingle(),
    supabase.rpc("publication_publisher_grant"),
  ]);
  // RLS: chỉ Ban, BTC của chương trình, Văn phòng thấy; chương trình chưa nghiệm thu thì chưa có dòng.
  const publication = pubData as Publication | null;
  if (!publication || !program) notFound();
  const viewer = await loadEventProgramViewer(supabase, user.id);
  const isPublisher = Boolean(publisherGrant);
  const isManager = viewer.managedOrgs.some((org) => org.id === program.owner_org_id);

  const [{ data: factsData }, { data: proposalData }, { data: revisionData }, { data: missingData }, cover] = await Promise.all([
    supabase.rpc("program_publication_facts", { p_program_id: id }),
    supabase.from("program_publication_proposals").select("id, title, body, submitted_at").eq("program_id", id).order("submitted_at", { ascending: false }),
    supabase.from("program_publication_revisions")
      .select("id, version, action, title, reason, facebook_url, actor_name, actor_role_code, occurred_at")
      .eq("program_id", id).order("id", { ascending: false }).limit(100),
    supabase.rpc("publication_missing", { p_program_id: id }),
    publication.cover_path
      ? supabase.storage.from("program-publication-covers").createSignedUrl(publication.cover_path, 300)
      : Promise.resolve({ data: null }),
  ]);
  const facts = ((factsData ?? []) as PublicationFacts[])[0];
  const proposals = (proposalData ?? []) as Proposal[];
  const revisions = (revisionData ?? []) as Revision[];
  const missing = (missingData ?? []) as string[];
  const coverUrl = cover.data?.signedUrl ?? null;
  const onEoffice = Boolean(publication.eoffice_published_at);
  const done = publication.status === "published";
  const eofficeMissing = missing.filter((m) => ["title", "body", "cover"].includes(m));

  return (
    <main className="page">
      <p className="eyebrow"><Link href={`/programs/${id}`}>{program.title as string}</Link> · <Link href="/publications">Đăng bài</Link></p>
      <section className="panel">
        <h1>Đăng bài chương trình</h1>
        <p>
          <span className="status" data-testid="publication-status">{publicationStatusLabels[publication.status]}</span>
          {done && <span className="muted"> · {formatVietnamDateTime(publication.completed_at)}</span>}
        </p>
        {!done && missing.length > 0 && (
          <p className="muted" data-testid="publication-missing">
            Còn thiếu để Đã đăng bài: {missing.map((m) => publicationMissingLabels[m] ?? m).join(", ")}.
          </p>
        )}
        <dl>
          <dt>Cổng E-Office</dt>
          <dd>{onEoffice
            ? <><Link href={publication.eoffice_path!} data-testid="eoffice-link">{publication.eoffice_path}</Link> · {formatVietnamDateTime(publication.eoffice_published_at)}</>
            : "Chưa xuất bản"}</dd>
          <dt>Facebook</dt>
          <dd>{publication.facebook_url
            ? <><a href={publication.facebook_url} target="_blank" rel="noopener noreferrer">{publication.facebook_url}</a> · {formatVietnamDateTime(publication.facebook_posted_at)}</>
            : "Chưa ghi"}</dd>
          <dt>Nguồn bản nháp</dt><dd>{publication.draft_source ? sourceLabels[publication.draft_source] : "—"}</dd>
          <dt>Phiên bản</dt><dd>{publication.version}</dd>
        </dl>
        {!isPublisher && (
          <p className="muted">Chỉ Ban Tuyên giáo – Truyền thông được biên tập và xuất bản.{isManager ? " Khoa có thể gửi nội dung đề xuất bên dưới." : ""}</p>
        )}
      </section>

      <section className="panel">
        <h2>Bài viết</h2>
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="Ảnh đại diện" style={{ maxWidth: "100%", maxHeight: 280, objectFit: "cover" }} />
        )}
        {isPublisher && facts ? (
          <>
            <PublicationEditor programId={id} published={onEoffice}
              initial={{ title: publication.title ?? "", body: publication.body ?? "" }} initialSource={publication.draft_source}
              generated={buildGeneratedDraft(facts)}
              proposals={proposals.map((p, index) => ({ id: p.id, title: p.title, body: p.body, label: `#${proposals.length - index}` }))} />
            <PublicationCoverUpload programId={id} published={onEoffice} />
          </>
        ) : publication.title ? (
          <article>
            <h3>{publication.title}</h3>
            {(publication.body ?? "").split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          </article>
        ) : <p className="muted">Ban chưa soạn bài.</p>}
      </section>

      {isPublisher && (
        <section className="panel">
          <h2>Xuất bản</h2>
          <h3>1. Cổng E-Office</h3>
          {onEoffice ? <p className="muted">Đã xuất bản. Sửa nội dung ở trên (cần lý do) sẽ cập nhật bài.</p>
            : eofficeMissing.length > 0
              ? <p className="muted">Cần {eofficeMissing.map((m) => publicationMissingLabels[m]).join(", ")} trước khi xuất bản.</p>
              : <ActionButton url={`/api/event-programs/${id}/publication/publish`} label="Xuất bản trên cổng E-Office" />}
          <h3>2. Facebook (Ban đăng trên Fanpage rồi ghi lại)</h3>
          <FacebookPostForm programId={id} initialUrl={publication.facebook_url ?? ""}
            initialPostedAt={toVietnamInputValue(publication.facebook_posted_at)} requireReason={done} />
          <h3>3. Hoàn tất</h3>
          {done ? <p className="muted">Đã đánh dấu Đã đăng bài.</p>
            : <ActionButton url={`/api/event-programs/${id}/publication/complete`} label="Đánh dấu Đã đăng bài" />}
        </section>
      )}

      <section className="panel">
        <h2>Nội dung đề xuất của Khoa</h2>
        {proposals.length === 0 ? <p className="muted">Chưa có đề xuất.</p> : (
          <ul>
            {proposals.map((p) => (
              <li key={p.id}><strong>{p.title}</strong> <span className="muted">({formatVietnamDateTime(p.submitted_at)})</span></li>
            ))}
          </ul>
        )}
        {isManager && !done && <PublicationProposalForm programId={id} />}
      </section>

      <section className="panel">
        <h2>Lịch sử chỉnh sửa</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Thời gian</th><th>Thao tác</th><th>Phiên bản</th><th>Tiêu đề</th><th>Lý do</th><th>Người thực hiện</th></tr></thead>
            <tbody>
              {revisions.map((r) => (
                <tr key={r.id} data-testid="revision-row">
                  <td>{formatVietnamDateTime(r.occurred_at)}</td><td>{revisionActionLabels[r.action] ?? r.action}</td>
                  <td>{r.version}</td><td>{r.title ?? "—"}</td><td>{r.reason ?? "—"}</td>
                  <td>{r.actor_name ?? "—"}{r.actor_role_code ? ` (${r.actor_role_code})` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
