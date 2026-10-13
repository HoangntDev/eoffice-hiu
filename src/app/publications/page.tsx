import Link from "next/link";
import { redirect } from "next/navigation";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";
import { publicationStatusLabels, type PublicationStatus } from "@/modules/program-publication/schemas";

type Row = {
  program_id: string; status: PublicationStatus; title: string | null; eoffice_published_at: string | null;
  completed_at: string | null; created_at: string; event_programs: { title: string } | null;
};

// Hàng đợi đăng bài. RLS: Ban Tuyên giáo và Văn phòng thấy mọi chương trình đã nghiệm thu; BTC thấy chương trình của Khoa.
export default async function PublicationsPage() {
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/publications");
  const { data } = await supabase.from("program_publications")
    .select("program_id, status, title, eoffice_published_at, completed_at, created_at, event_programs(title)")
    .order("status").order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  const groups: PublicationStatus[] = ["awaiting", "published"];
  return (
    <main className="page">
      <section className="panel">
        <h1>Đăng bài sau nghiệm thu</h1>
        <p className="muted">Chương trình được Văn phòng nghiệm thu sẽ vào danh sách Chờ đăng bài. Ban Tuyên giáo – Truyền thông xuất bản trên cổng E-Office và Facebook.</p>
      </section>
      {groups.map((status) => {
        const list = rows.filter((r) => r.status === status);
        return (
          <section className="panel" key={status} data-testid={`publications-${status}`}>
            <h2>{publicationStatusLabels[status]} ({list.length})</h2>
            {list.length === 0 ? <p className="muted">Không có chương trình.</p> : (
              <ul>
                {list.map((r) => (
                  <li key={r.program_id}>
                    <Link href={`/programs/${r.program_id}/publication`}>{r.event_programs?.title ?? r.program_id}</Link>
                    <span className="muted">
                      {" · "}{r.eoffice_published_at ? `E-Office ${formatVietnamDateTime(r.eoffice_published_at)}` : "chưa lên E-Office"}
                      {r.completed_at ? ` · Đã đăng bài ${formatVietnamDateTime(r.completed_at)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
