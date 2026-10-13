import Link from "next/link";
import { redirect } from "next/navigation";
import { AcademicTermForm, type AcademicTermValues } from "@/components/acceptance-actions";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";

const vnDate = (day: string) => new Date(`${day}T00:00:00+07:00`).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

// Cấu hình học kỳ theo khoảng ngày (Đoàn Trường hoặc Văn phòng Đoàn – Hội). Điểm uy tín tính theo học kỳ;
// chương trình có ngày bắt đầu ngoài mọi học kỳ không nghiệm thu được cho đến khi cấu hình.
export default async function AcademicTermsPage() {
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/office/terms");
  const [{ data: grant }, { data: termData }, { data: programData }] = await Promise.all([
    supabase.rpc("academic_term_manager_grant"),
    supabase.from("academic_terms").select("id, academic_year, term_code, name, starts_on, ends_on").order("starts_on"),
    supabase.from("event_programs").select("id, title, starts_at").eq("status", "approved").order("starts_at").limit(500),
  ]);
  const canManage = Boolean(grant);
  const terms = (termData ?? []) as AcademicTermValues[];
  const dayOf = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  const uncovered = ((programData ?? []) as Array<{ id: string; title: string; starts_at: string | null }>)
    .filter((p) => p.starts_at && !terms.some((t) => dayOf(p.starts_at!) >= t.starts_on && dayOf(p.starts_at!) <= t.ends_on));

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Cấu hình</p>
          <h1>Học kỳ</h1>
          <p className="lead">Mỗi năm học tự đặt ngày bắt đầu, kết thúc từng học kỳ; hai học kỳ không được chồng ngày.</p>
        </div>
      </div>
      {!canManage && <p className="notice">Chỉ Đoàn Trường hoặc Văn phòng Đoàn – Hội được thay đổi học kỳ. Bạn đang xem ở chế độ chỉ đọc.</p>}
      {uncovered.length > 0 && (
        <section className="panel">
          <h2>Chương trình chưa thuộc học kỳ nào</h2>
          <p className="notice warning" data-testid="uncovered-programs">
            {uncovered.length} chương trình đã chấp thuận có ngày bắt đầu ngoài mọi học kỳ: chưa nghiệm thu được và chưa chốt điểm uy tín.
          </p>
          <ul>
            {uncovered.map((p) => <li key={p.id}><Link href={`/programs/${p.id}`}>{p.title}</Link> — {formatVietnamDateTime(p.starts_at)}</li>)}
          </ul>
        </section>
      )}
      <section className="panel">
        <h2>Danh sách học kỳ</h2>
        {terms.length === 0 && <p className="muted">Chưa có học kỳ nào.</p>}
        {terms.map((t) => (
          <div key={t.id} className="stack" data-testid="term-row">
            <p><strong>{t.name}</strong> ({t.term_code}) năm học {t.academic_year}: {vnDate(t.starts_on)} – {vnDate(t.ends_on)}</p>
            {canManage && <AcademicTermForm initial={t} />}
          </div>
        ))}
      </section>
      {canManage && (
        <section className="panel">
          <h2>Thêm học kỳ</h2>
          <AcademicTermForm />
        </section>
      )}
    </main>
  );
}
