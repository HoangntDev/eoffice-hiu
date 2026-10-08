import { AccountSecurityPanel } from "@/components/account-security-panel";
import { requireUser } from "@/lib/auth/dal";

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ email?: string; error?: string }> }) {
  await requireUser();
  const { email, error } = await searchParams;
  const emailMessage = error
    ? "Liên kết xác minh Gmail không hợp lệ hoặc đã hết hạn. Hãy gửi lại yêu cầu đổi Gmail."
    : email === "updated"
    ? "Đã xác minh và cập nhật Gmail mới."
    : email === "pending"
      ? "Đã xác nhận một bước. Hãy tiếp tục bằng liên kết gửi tới Gmail mới."
      : "";
  return <main className="page narrow"><div className="page-header"><div><p className="eyebrow">Tài khoản cá nhân</p><h1>Bảo mật tài khoản</h1></div></div><AccountSecurityPanel initialMessage={emailMessage} /></main>;
}
