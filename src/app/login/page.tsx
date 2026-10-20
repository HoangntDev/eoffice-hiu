import { AuthFormV2 } from "@/components/auth-form-v2";
import { safeNextPath } from "@/lib/auth/next-path";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string | string[] }> }) {
  const { error, next } = await searchParams;
  // Chỉ chuyển tiếp đường dẫn nội bộ hợp lệ; API đăng nhập kiểm tra lại lần nữa.
  const nextPath = typeof next === "string" ? safeNextPath(next, "") : "";
  return <AuthFormV2 mode="login" next={nextPath} initialError={error ? "Liên kết xác thực không hợp lệ hoặc đã hết hạn." : ""} />;
}
