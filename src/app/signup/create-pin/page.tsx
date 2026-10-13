import { redirect } from "next/navigation";
import { PinSetupForm } from "@/components/pin-setup-form";
import { requireSessionUser } from "@/lib/auth/dal";

export default async function CreatePinPage() {
  const { user, supabase } = await requireSessionUser();
  const { data: account } = await supabase.from("accounts").select("status").eq("user_id", user.id).maybeSingle();
  if (account?.status === "active") redirect("/onboarding/profile");
  if (account?.status !== "pending_pin") redirect("/login");
  return <main className="auth-page"><PinSetupForm mode="create" /></main>;
}
