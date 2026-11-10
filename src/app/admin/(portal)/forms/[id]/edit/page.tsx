import EditFormPage from "@/app/forms/[id]/edit/page";

export default function AdminEditFormPage({ params }: { params: Promise<{ id: string }> }) {
  return <EditFormPage params={params} managementBasePath="/admin/forms" />;
}
