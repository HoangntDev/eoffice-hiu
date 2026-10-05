import { FormTemplateEditor } from "@/components/form-template-editor";

export default function NewTemplatePage() {
  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Thư viện mẫu</p>
          <h1>Tạo mẫu đối tượng mới</h1>
          <p className="lead">
            Mẫu xác định đối tượng và câu hỏi nền bắt buộc. Đơn vị tham chiếu mẫu không được xóa câu hỏi nền hoặc nới điều kiện đối tượng.
          </p>
        </div>
      </div>
      <FormTemplateEditor />
    </main>
  );
}
