import AttendanceQrPage from "@/app/programs/[id]/attendance/[sessionId]/qr/page";

export default function AdminAttendanceQrPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  return <AttendanceQrPage params={params} basePath="/admin/programs" />;
}
