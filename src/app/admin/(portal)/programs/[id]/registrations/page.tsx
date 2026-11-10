import ProgramRegistrationsPage from "@/app/programs/[id]/registrations/page";

export default function AdminProgramRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProgramRegistrationsPage params={params} basePath="/admin/programs" />;
}
