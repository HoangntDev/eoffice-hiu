import Link from "next/link";
import { redirect } from "next/navigation";
import { EventProgramEditor } from "@/components/event-program-editor";
import { createUserSupabase } from "@/lib/supabase/server";
import { loadEventProgramViewer } from "@/modules/event-programs/viewer";

export default async function NewProgramPage() {
  const supabase = await createUserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/programs/new");
  const { managedOrgs } = await loadEventProgramViewer(supabase, user.id);

  return (
    <main className="page narrow">
      <div className="page-header">
        <div>
          <p className="eyebrow">Kế hoạch chương trình</p>
          <h1>Lập kế hoạch mới</h1>
          <p className="lead">Tạo bản nháp trong phạm vi Đoàn Khoa của bạn, sau đó tải PDF đã ký và gửi Văn phòng.</p>
        </div>
      </div>
      {managedOrgs.length === 0 ? (
        <p className="notice warning">
          Tài khoản chưa được cấp vai trò BCH Đoàn Khoa nên không thể lập kế hoạch. <Link href="/programs">Quay lại</Link>
        </p>
      ) : (
        <section className="panel">
          <EventProgramEditor mode="create" orgs={managedOrgs} />
        </section>
      )}
    </main>
  );
}
