import ResponsesPage from "@/app/forms/[id]/responses/page";

export default function AdminFormResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  return <ResponsesPage params={params} managementBasePath="/admin/forms" />;
}
