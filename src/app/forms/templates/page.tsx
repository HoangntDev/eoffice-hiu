import Link from "next/link";
import { createUserSupabase } from "@/lib/supabase/server";

export default async function TemplatesPage() {
  const supabase = await createUserSupabase();
  const { data: templates } = await supabase
    .from("form_templates")
    .select("id, title, description, status, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Đoàn Trường quản lý</p>
          <h1>Thư viện mẫu đối tượng</h1>
          <p className="lead">
            Mẫu gốc quy định đối tượng và câu hỏi nền bắt buộc cho các biểu mẫu của đơn vị tham chiếu.
            Chỉ Đoàn Trường được tạo và sửa mẫu gốc.
          </p>
        </div>
        <Link className="button primary" href="/forms/templates/new">
          Tạo mẫu mới
        </Link>
      </div>

      {!templates || templates.length === 0 ? (
        <p className="notice">Chưa có mẫu nào. Tạo mẫu đầu tiên để các đơn vị có thể dùng khi tạo biểu mẫu.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>
                    <span className={`badge badge-${t.status}`}>{t.status}</span>
                  </td>
                  <td>{new Date(t.updated_at as string).toLocaleDateString("vi-VN")}</td>
                  <td>
                    <Link href={`/forms/templates/${t.id}`} className="button secondary small">
                      Chỉnh sửa
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
