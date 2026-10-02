import { redirect } from "next/navigation";
import { PinSetupForm } from "@/components/pin-setup-form";
import { requireSessionUser } from "@/lib/auth/dal";

export default async function CreatePinPage() {
  const { user, supabase } = await requireSessionUser();
  const { data: account } = await supabase.from("accounts").select("status").eq("user_id", user.id).maybeSingle();
  if (account?.status === "active") redirect("/onboarding/profile");
  if (account?.status !== "pending_pin") redirect("/login");
  return <main className="page narrow"><div className="page-header"><div><p className="eyebrow">Bước 2 của SIGN UP</p><h1>Tạo PIN</h1></div></div><PinSetupForm mode="create" /></main>;
}
