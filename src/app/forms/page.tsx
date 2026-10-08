import Link from "next/link";
import { createUserSupabase } from "@/lib/supabase/server";

const statusLabels: Record<string, string> = {
  draft: "Bản nháp", published: "Đang mở", paused: "Tạm dừng",
  closed: "Đã đóng", archived: "Lưu trữ",
};

export default async function FormsPage() {
  const supabase = await createUserSupabase();

  const { data: { user } } = await supabase.auth.getUser();

  let forms: Array<Record<string, unknown>> = [];
  if (user) {
    const { data: grants } = await supabase
      .from("role_grants").select("organization_id").is("revoked_at", null).eq("user_id", user.id);
    const orgIds = (grants ?? []).map((g) => g.organization_id as string);

    const { data } = orgIds.length > 0
      ? await supabase.from("forms")
          .select("id, title, description, status, opens_at, closes_at, owner_org_id, organization_units(name)")
          .or(`status.eq.published,owner_org_id.in.(${orgIds.join(",")})`)
          .order("updated_at", { ascending: false })
      : await supabase.from("forms")
          .select("id, title, description, status, opens_at, closes_at, owner_org_id, organization_units(name)")
          .eq("status", "published")
          .order("updated_at", { ascending: false });
    forms = (data ?? []) as Array<Record<string, unknown>>;
  } else {
    const { data } = await supabase.from("forms")
      .select("id, title, description, status, opens_at, closes_at, owner_org_id, organization_units(name)")
      .eq("status", "published")
      .order("updated_at", { ascending: false });
    forms = (data ?? []) as Array<Record<string, unknown>>;
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Biểu mẫu động</p>
          <h1>Biểu mẫu</h1>
          <p className="lead">Danh sách biểu mẫu đang mở và biểu mẫu bạn quản lý.</p>
        </div>
        {user && (
          <Link className="button primary" href="/forms/new">
            Tạo biểu mẫu
          </Link>
        )}
      </div>

      {forms.length === 0 ? (
        <p className="notice">Chưa có biểu mẫu nào đang mở.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Đơn vị</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => {
                const orgName = (f.organization_units as { name: string } | null)?.name ?? "—";
                return (
                  <tr key={f.id as string}>
                    <td>{f.title as string}</td>
                    <td>{orgName}</td>
                    <td>
                      <span className={`badge badge-${f.status as string}`}>
                        {statusLabels[f.status as string] ?? f.status as string}
                      </span>
                    </td>
                    <td>
                      {f.opens_at ? new Date(f.opens_at as string).toLocaleDateString("vi-VN") : "—"}
                      {f.closes_at ? ` → ${new Date(f.closes_at as string).toLocaleDateString("vi-VN")}` : ""}
                    </td>
                    <td>
                      <div className="inline" style={{ gap: "0.5rem" }}>
                        {f.status === "published" && (
                          <Link href={`/forms/${f.id as string}`} className="button primary small">Điền</Link>
                        )}
                        <Link href={`/forms/${f.id as string}/edit`} className="button secondary small">Quản lý</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
