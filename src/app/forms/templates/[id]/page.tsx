import { notFound } from "next/navigation";
import { createUserSupabase } from "@/lib/supabase/server";
import { FormTemplateEditor } from "@/components/form-template-editor";
import type { Question, AudienceRule } from "@/modules/forms/schemas";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createUserSupabase();

  const { data: template } = await supabase
    .from("form_templates")
    .select("id, title, description, audience_rule, status")
    .eq("id", id)
    .single();

  if (!template) notFound();

  const { data: versionsData } = await supabase
    .from("form_template_versions")
    .select("id, version_number, questions, notes, published_at")
    .eq("template_id", id)
    .order("version_number", { ascending: false });

  const latestVersion = versionsData?.[0];
  const questions: Question[] = (latestVersion?.questions as Question[]) ?? [];

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Thư viện mẫu / Chỉnh sửa</p>
          <h1>{template.title}</h1>
          <p className="lead">
            Trạng thái: <strong>{template.status}</strong>
            {latestVersion && (
              <> · Phiên bản mới nhất: <strong>v{latestVersion.version_number}</strong>
               ({new Date(latestVersion.published_at as string).toLocaleDateString("vi-VN")})</>
            )}
          </p>
        </div>
      </div>

      <FormTemplateEditor
        template={{
          id: template.id,
          title: template.title,
          description: template.description as string | null,
          audience_rule: template.audience_rule as AudienceRule,
          status: template.status,
          questions,
        }}
      />

      {versionsData && versionsData.length > 0 && (
        <section className="panel" style={{ marginTop: "2rem" }}>
          <h2>Lịch sử phiên bản</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Phiên bản</th><th>Ghi chú</th><th>Ngày phát hành</th><th>Số câu hỏi</th></tr>
              </thead>
              <tbody>
                {versionsData.map((v) => (
                  <tr key={v.id}>
                    <td>v{v.version_number}</td>
                    <td>{(v.notes as string) ?? "—"}</td>
                    <td>{new Date(v.published_at as string).toLocaleDateString("vi-VN")}</td>
                    <td>{(v.questions as Question[]).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
