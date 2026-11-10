import ProgramAttendancePage from "@/app/programs/[id]/attendance/page";

export default function AdminProgramAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  return <ProgramAttendancePage params={params} basePath="/admin/programs" />;
}
