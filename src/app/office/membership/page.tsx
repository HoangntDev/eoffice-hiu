import { AccessDenied } from "@/components/access-denied";
import { MembershipReviewConsole } from "@/components/membership-review-console";
import { getViewer } from "@/lib/auth/viewer";

export default async function OfficeMembershipPage() {
  const viewer = await getViewer();
  if (!viewer?.access.membershipReview) {
    return <AccessDenied title="Tiếp nhận và công nhận" reason="Trang này dành cho CTV, Văn phòng Đoàn – Hội và Đoàn Trường. Tài khoản của bạn chưa được cấp vai trò xử lý hồ sơ." />;
  }
  return <main className="page"><div className="page-header"><div><p className="eyebrow">CTV và Văn phòng</p><h1>Tiếp nhận và công nhận</h1><p className="lead">CTV kiểm tra và đề xuất. Chỉ Văn phòng/Đoàn Trường có quyền quyết định cuối.</p></div></div><MembershipReviewConsole/></main>;
}
