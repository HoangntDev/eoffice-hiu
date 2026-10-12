import { AuthFormV2 } from "@/components/auth-form-v2";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthFormV2 mode="register" initialError={error ? "Liên kết xác thực không hợp lệ hoặc đã hết hạn. Hãy nhập lại MSSV và email sinh viên HIU rồi chọn gửi lại." : ""} />;
}
