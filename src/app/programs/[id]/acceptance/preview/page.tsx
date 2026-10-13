import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createUserSupabase } from "@/lib/supabase/server";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";
import { sessionText, type AcceptanceAttendanceRow } from "@/modules/program-acceptance/export";
import { participationLabels, ruleLabels } from "@/modules/program-attendance/schemas";

// Bản xem trước dữ liệu để lập Đơn đề nghị cấp điểm. Repo chưa có mẫu đơn chính thức, nên trang này
// KHÔNG phải mẫu đơn: BTC dùng số liệu ở đây điền vào mẫu chính thức của trường, ký và scan PDF.
export default async function AcceptancePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/programs/${id}/acceptance/preview`);

  const { data: rowsData, error } = await supabase.rpc("program_acceptance_attendance", { p_program_id: id });
  if (error) notFound();
  const [{ data: program }, { data: plan }] = await Promise.all([
    supabase.from("event_programs").select("title, location, starts_at, ends_at, plan_number, organization_units(name)").eq("id", id).maybeSingle(),
    supabase.from("program_attendance_plans").select("max_points, rule_type").eq("program_id", id).maybeSingle(),
  ]);
  if (!program) notFound();
  const rows = (rowsData ?? []) as AcceptanceAttendanceRow[];
  const proposed = rows.filter((row) => row.expected_points >= 1);
  const org = program.organization_units as unknown as { name: string } | null;

  return (
    <main className="page">
      <p className="eyebrow"><Link href={`/programs/${id}/acceptance`}>Nghiệm thu</Link></p>
      <p className="notice warning" data-testid="preview-disclaimer">
        BẢN XEM TRƯỚC DỮ LIỆU — không phải mẫu Đơn đề nghị chính thức. Điểm là điểm rèn luyện dự kiến đề nghị,
        chưa được Thư ký Khoa cấp.
      </p>
      <section className="panel">
        <h1>Dữ liệu đề nghị cấp điểm rèn luyện</h1>
        <dl>
          <dt>Chương trình</dt><dd>{program.title as string}</dd>
          <dt>Ban Tổ chức</dt><dd>{org?.name ?? "—"}</dd>
          <dt>Thời gian</dt><dd>{formatVietnamDateTime(program.starts_at as string)} – {formatVietnamDateTime(program.ends_at as string)}</dd>
          <dt>Địa điểm</dt><dd>{(program.location as string) ?? "—"}</dd>
          <dt>Số kế hoạch</dt><dd>{(program.plan_number as string) ?? "—"}</dd>
          <dt>Quy tắc</dt><dd>{plan ? `Tối đa ${plan.max_points} điểm · ${ruleLabels[plan.rule_type as keyof typeof ruleLabels]}` : "—"}</dd>
        </dl>
        <p className="muted">
          {rows.length} sinh viên được nhận · {proposed.length} sinh viên đề nghị cấp điểm (điểm dự kiến ≥ 1) ·{" "}
          {rows.filter((r) => r.participation === "absent").length} đăng ký nhưng không tham gia.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>STT</th><th>MSSV</th><th>Họ tên</th><th>Lớp</th><th>Lượt có mặt</th><th>Kết quả</th><th>Điểm dự kiến đề nghị</th></tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.registration_id}>
                  <td>{index + 1}</td><td>{row.student_code}</td><td>{row.full_name ?? "—"}</td><td>{row.class_code ?? "—"}</td>
                  <td>{sessionText(row) || "—"}</td><td>{participationLabels[row.participation]}</td><td>{row.expected_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">Chữ ký Trưởng BTC: ký trên bản đơn chính thức, scan PDF và tải vào mục “Đơn đề nghị” của hồ sơ nghiệm thu.</p>
      </section>
    </main>
  );
}
