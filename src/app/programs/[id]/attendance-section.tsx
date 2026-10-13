import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatVietnamDateTime } from "@/modules/event-programs/dates";

type Props = { supabase: SupabaseClient; userId: string; programId: string; isManager: boolean };

// UC8 trên trang chương trình: BTC vào trang điểm danh; sinh viên xem các lượt mình đã được ghi nhận.
// Không hiển thị điểm dự kiến hay uy tín cho sinh viên.
export async function AttendanceSection({ supabase, userId, programId, isManager }: Props) {
  if (isManager) {
    return (
      <section className="panel inline">
        <h2>Điểm danh</h2>
        <Link className="button secondary" href={`/programs/${programId}/attendance`}>Quản lý lượt điểm danh</Link>
      </section>
    );
  }
  const { data } = await supabase.from("program_attendance_records")
    .select("recorded_at, is_supplementary, program_attendance_sessions(label)")
    .eq("program_id", programId).eq("user_id", userId).order("recorded_at");
  const records = (data ?? []) as unknown as Array<{
    recorded_at: string; is_supplementary: boolean; program_attendance_sessions: { label: string } | null;
  }>;
  if (records.length === 0) return null;
  return (
    <section className="panel">
      <h2>Điểm danh của bạn</h2>
      <ul>
        {records.map((r) => (
          <li key={r.recorded_at}>
            {r.program_attendance_sessions?.label ?? "Lượt"} — {formatVietnamDateTime(r.recorded_at)}
            {r.is_supplementary ? " (bổ sung)" : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
