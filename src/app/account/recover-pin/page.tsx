import { PinSetupForm } from "@/components/pin-setup-form";
import { requireUser } from "@/lib/auth/dal";

export default async function RecoverPinPage() {
  await requireUser();
  return <main className="page narrow"><div className="page-header"><div><p className="eyebrow">Khôi phục tài khoản</p><h1>Đặt lại PIN</h1></div></div><PinSetupForm mode="recover" /></main>;
}
