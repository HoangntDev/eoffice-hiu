import { PinSetupForm } from "@/components/pin-setup-form";
import { requireUser } from "@/lib/auth/dal";

export default async function RecoverPinPage() {
  await requireUser();
  return <main className="auth-page"><PinSetupForm mode="recover" /></main>;
}
