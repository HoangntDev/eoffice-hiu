import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";

type Post = {
  program_id: string; title: string; body: string; has_cover: boolean; published_at: string; organization_name: string;
  program_starts_at: string; location: string | null; facebook_url: string | null; updated_at: string;
};

export default async function NewsPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await createPublicSupabase().rpc("public_program_posts", { p_program_id: id });
  const post = ((data ?? []) as Post[])[0];
  if (!post) notFound();
  return (
    <main className="page">
      <p className="eyebrow"><Link href="/news">Tin hoạt động</Link></p>
      <article className="panel" data-testid="news-post">
        <h1>{post.title}</h1>
        <p className="muted">{post.organization_name} · Đăng {formatVietnamDateTime(post.published_at)}</p>
        {post.has_cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/news/${post.program_id}/cover`} alt={post.title} style={{ maxWidth: "100%", maxHeight: 420, objectFit: "cover" }} />
        )}
        {post.body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        {post.facebook_url && (
          <p><a href={post.facebook_url} target="_blank" rel="noopener noreferrer">Xem bài trên Facebook</a></p>
        )}
      </article>
    </main>
  );
}
