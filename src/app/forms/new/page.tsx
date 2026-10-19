import { createUserSupabase } from "@/lib/supabase/server";
import { AccessDenied } from "@/components/access-denied";
import { FormEditor } from "@/components/form-editor";

export default async function NewFormPage() {
  const supabase = await createUserSupabase();

  const [{ data: grants }, { data: templates }] = await Promise.all([
    supabase.from("role_grants").select("organization_id").is("revoked_at", null),
    supabase.from("form_templates").select("id, title").eq("status", "published").order("title"),
  ]);

  const orgIds = [...new Set((grants ?? []).map((g) => g.organization_id as string))];
  const { data: orgData } = orgIds.length > 0
    ? await supabase.from("organization_units").select("id, name, unit_type").in("id", orgIds)
    : { data: [] };
  const orgs = (orgData ?? []) as Array<{ id: string; name: string; unit_type: string }>;
  if (orgs.length === 0) {
    return <AccessDenied title="Tạo biểu mẫu" reason="Chỉ cán bộ Đoàn – Hội có vai trò tại một đơn vị mới tạo được biểu mẫu." />;
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Biểu mẫu động</p>
          <h1>Tạo biểu mẫu mới</h1>
          <p className="lead">Biểu mẫu có thể đứng độc lập hoặc tham chiếu từ một mẫu gốc Đoàn Trường đã phát hành.</p>
        </div>
      </div>
      <FormEditor orgs={orgs} templates={templates ?? []} />
    </main>
  );
}
