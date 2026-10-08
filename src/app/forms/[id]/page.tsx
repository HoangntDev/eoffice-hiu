import { notFound } from "next/navigation";
import Link from "next/link";
import { createUserSupabase } from "@/lib/supabase/server";
import { FormViewer } from "@/components/form-viewer";
import type { Question } from "@/modules/forms/schemas";

export default async function FillFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createUserSupabase();

  const { data: form } = await supabase
    .from("forms")
    .select("id, title, description, questions, audience_rule, status, opens_at, closes_at, confirmation_message")
    .eq("id", id)
    .single();

  if (!form || form.status !== "published") notFound();

  // Check if form is within open/close window
  const now = new Date();
  if (form.opens_at && new Date(form.opens_at as string) > now) {
    return (
      <main className="page">
        <div className="page-header"><div><h1>{form.title as string}</h1></div></div>
        <p className="notice">Biểu mẫu chưa mở nhận phản hồi. Mở từ: {new Date(form.opens_at as string).toLocaleString("vi-VN")}</p>
      </main>
    );
  }
  if (form.closes_at && new Date(form.closes_at as string) < now) {
    return (
      <main className="page">
        <div className="page-header"><div><h1>{form.title as string}</h1></div></div>
        <p className="notice">Biểu mẫu đã hết thời gian nhận phản hồi.</p>
      </main>
    );
  }

  // Try to get user profile for prefill
  const { data: { user } } = await supabase.auth.getUser();
  let prefill: Record<string, string> = {};
  if (user) {
    const { data: profile } = await supabase
      .from("student_profiles")
      .select("full_name, student_code:accounts(student_code), phone")
      .eq("user_id", user.id)
      .single();
    if (profile) {
      prefill = {
        full_name: (profile.full_name as string) ?? "",
        student_code: (profile.student_code as unknown as { student_code: string } | null)?.student_code ?? "",
        phone: (profile.phone as string) ?? "",
      };
    }
  }

  const questions: Question[] = (form.questions as Question[]) ?? [];

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>{form.title as string}</h1>
          {form.description && <p className="lead">{form.description as string}</p>}
        </div>
      </div>

      {!user && (
        <p className="notice">
          <Link href={`/login?next=/forms/${id}`}>Đăng nhập</Link> để thông tin của bạn được điền sẵn.
        </p>
      )}

      <FormViewer
        form={{
          id: form.id as string,
          title: form.title as string,
          description: form.description as string | null,
          confirmation_message: form.confirmation_message as string | null,
          questions,
          closes_at: form.closes_at as string | null,
        }}
        prefill={prefill}
        isAuthenticated={!!user}
      />
    </main>
  );
}
