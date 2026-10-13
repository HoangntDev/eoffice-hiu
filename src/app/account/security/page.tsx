import { AccountSecurityPanel } from "@/components/account-security-panel";
import { requireUser } from "@/lib/auth/dal";

export default async function SecurityPage() {
  await requireUser();
  return <main className="page narrow"><div className="page-header"><div><p className="eyebrow">Tài khoản cá nhân</p><h1>Bảo mật tài khoản</h1></div></div><AccountSecurityPanel /></main>;
}
