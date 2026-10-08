import { AuthFormV2 } from "@/components/auth-form-v2";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthFormV2 mode="login" initialError={error ? "Liên kết xác thực không hợp lệ hoặc đã hết hạn." : ""} />;
}
