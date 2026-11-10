import ProgramDetailPage from "@/app/programs/[id]/page";

export default function AdminReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProgramDetailPage params={params} basePath="/admin/reviews" />;
}
