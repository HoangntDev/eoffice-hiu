import ProgramDetailPage from "@/app/programs/[id]/page";

export default function AdminProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProgramDetailPage params={params} basePath="/admin/programs" />;
}
