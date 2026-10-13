import Link from "next/link";
import { createPublicSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";

type Post = { program_id: string; title: string; body: string; has_cover: boolean; published_at: string; organization_name: string };

// Cổng tin công khai: chỉ bài đã xuất bản, đọc qua public_program_posts() (không MSSV, điểm danh, hồ sơ, uy tín).
export default async function NewsPage() {
  const { data } = await createPublicSupabase().rpc("public_program_posts");
  const posts = (data ?? []) as Post[];
  return (
    <main className="page">
      <section className="panel">
        <h1>Tin hoạt động</h1>
        {posts.length === 0 ? <p className="muted">Chưa có bài viết.</p> : (
          <ul className="stack">
            {posts.map((post) => (
              <li key={post.program_id} data-testid="news-item">
                <Link href={`/news/${post.program_id}`}><strong>{post.title}</strong></Link>
                <p className="muted">{post.organization_name} · {formatVietnamDateTime(post.published_at)}</p>
                <p>{post.body.split(/\n{2,}/)[0].slice(0, 240)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
