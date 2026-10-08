import { notFound } from "next/navigation";
import Link from "next/link";
import { createUserSupabase } from "@/lib/supabase/server";
import { FormEditor } from "@/components/form-editor";
import type { Question, AudienceRule } from "@/modules/forms/schemas";

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createUserSupabase();

  const [{ data: form }, { data: grants }, { data: templates }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", id).single(),
    supabase.from("role_grants").select("organization_id").is("revoked_at", null),
    supabase.from("form_templates").select("id, title").eq("status", "published").order("title"),
  ]);

  if (!form) notFound();

  const orgIds = [...new Set((grants ?? []).map((g) => g.organization_id as string))];
  const { data: orgData } = orgIds.length > 0
    ? await supabase.from("organization_units").select("id, name, unit_type").in("id", orgIds)
    : { data: [] };
  const orgs = (orgData ?? []) as Array<{ id: string; name: string; unit_type: string }>;

  const statusLabels: Record<string, string> = {
    draft: "Bản nháp", published: "Đang phát hành", paused: "Tạm dừng",
    closed: "Đã đóng", archived: "Đã lưu trữ",
  };

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Biểu mẫu / Chỉnh sửa</p>
          <h1>{form.title as string}</h1>
          <p className="lead">
            Trạng thái: <strong>{statusLabels[form.status as string] ?? form.status as string}</strong>
            {" · "}
            <Link href={`/forms/${id}/responses`}>Xem phản hồi</Link>
            {" · "}
            <Link href={`/forms/${id}`} target="_blank">Xem trang điền</Link>
          </p>
        </div>
      </div>
      <FormEditor
        form={{
          id: form.id as string,
          owner_org_id: form.owner_org_id as string,
          title: form.title as string,
          description: form.description as string | null,
          audience_rule: form.audience_rule as AudienceRule,
          questions: (form.questions as Question[]) ?? [],
          allow_multiple_submissions: form.allow_multiple_submissions as boolean,
          opens_at: form.opens_at as string | null,
          closes_at: form.closes_at as string | null,
          confirmation_message: form.confirmation_message as string | null,
          status: form.status as string,
        }}
        orgs={orgs}
        templates={templates ?? []}
      />
    </main>
  );
}
