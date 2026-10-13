import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AttendanceQrDisplay } from "@/components/attendance-qr-display";
import { createUserSupabase } from "@/lib/supabase/server";

export default async function AttendanceQrPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: session }, { data: program }] = await Promise.all([
    supabase.from("program_attendance_sessions").select("id, label").eq("id", sessionId).eq("program_id", id).maybeSingle(),
    supabase.from("event_programs").select("title").eq("id", id).maybeSingle(),
  ]);
  if (!session) notFound();
  // Quyền phát QR do RPC issue_attendance_qr kiểm (chỉ BTC); trang này chỉ hiển thị.
  const title = (program?.title as string | undefined) ?? "";

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow"><Link href={`/programs/${id}/attendance`}>{title}</Link></p>
          <h1>Điểm danh: {session.label as string}</h1>
        </div>
      </div>
      <section className="panel">
        <AttendanceQrDisplay sessionId={sessionId} />
      </section>
    </main>
  );
}
