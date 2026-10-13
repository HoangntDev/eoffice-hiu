import { notFound } from "next/navigation";
import { AttendanceCheckIn } from "@/components/attendance-check-in";
import { createUserSupabase } from "@/lib/supabase/server";

// Liên kết trong QR: /attend/{sessionId}?t={token}. Proxy bắt đăng nhập; mọi kiểm tra nằm ở RPC check_in_attendance.
export default async function AttendPage({ params, searchParams }: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ sessionId }, { t }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();
  const supabase = await createUserSupabase();
  const { data: session } = await supabase.from("program_attendance_sessions")
    .select("label, program_id").eq("id", sessionId).maybeSingle();
  const { data: program } = session
    ? await supabase.from("event_programs").select("title").eq("id", session.program_id as string).maybeSingle()
    : { data: null };
  const title = program?.title as string | undefined;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          {title && <p className="eyebrow">{title}</p>}
          <h1>Điểm danh{session ? `: ${session.label as string}` : ""}</h1>
        </div>
      </div>
      <section className="panel">
        {t
          ? <AttendanceCheckIn sessionId={sessionId} token={t} programId={(session?.program_id as string | undefined) ?? null} />
          : <p className="notice error">Thiếu mã QR. Vui lòng quét lại mã đang hiển thị.</p>}
      </section>
    </main>
  );
}
