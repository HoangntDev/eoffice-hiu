import Link from "next/link";
import { createUserSupabase } from "@/lib/supabase/server";
import { displayOrgName } from "@/modules/organization-catalog/display";

const statusLabels: Record<string, string> = {
  draft: "Bản nháp", published: "Đang mở", paused: "Tạm dừng",
  closed: "Đã đóng", archived: "Lưu trữ",
};

function formPeriod(opensAt: string | null, closesAt: string | null) {
  const date = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  if (opensAt && closesAt) return `${date(opensAt)} – ${date(closesAt)}`;
  if (closesAt) return `Đến ${date(closesAt)}`;
  if (opensAt) return `Từ ${date(opensAt)}`;
  return "Không giới hạn";
}

export default async function FormsPage() {
  const supabase = await createUserSupabase();

  const { data: { user } } = await supabase.auth.getUser();

  let forms: Array<Record<string, unknown>> = [];
  // Đơn vị người dùng có vai trò: chỉ những đơn vị này mới tạo/quản lý biểu mẫu.
  let orgIds: string[] = [];
  if (user) {
    const { data: grants } = await supabase
      .from("role_grants").select("organization_id").is("revoked_at", null).eq("user_id", user.id);
    orgIds = (grants ?? []).map((g) => g.organization_id as string);

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
        {orgIds.length > 0 && (
          <Link className="button primary" href="/forms/new">
            Tạo biểu mẫu
          </Link>
        )}
      </div>

      {forms.length === 0 ? (
        <p className="notice">Chưa có biểu mẫu nào đang mở.</p>
      ) : (
        <div className="table-wrap">
          <table className="cards-on-mobile">
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
                const orgName = displayOrgName((f.organization_units as { name: string } | null)?.name);
                return (
                  <tr key={f.id as string}>
                    <td className="cell-title">{f.title as string}</td>
                    <td data-label="Đơn vị">{orgName}</td>
                    <td data-label="Trạng thái">
                      <span className={`badge badge-${f.status as string}`}>
                        {statusLabels[f.status as string] ?? f.status as string}
                      </span>
                    </td>
                    <td data-label="Thời gian">{formPeriod(f.opens_at as string | null, f.closes_at as string | null)}</td>
                    <td className="cell-action">
                      <div className="inline" style={{ gap: "0.5rem" }}>
                        {f.status === "published" && (
                          <Link href={`/forms/${f.id as string}`} className="button primary small">Điền</Link>
                        )}
                        {orgIds.includes(f.owner_org_id as string) && (
                          <Link href={`/forms/${f.id as string}/edit`} className="button secondary small">Quản lý</Link>
                        )}
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
