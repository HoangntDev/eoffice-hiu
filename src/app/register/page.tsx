import { AuthFormV2 } from "@/components/auth-form-v2";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthFormV2 mode="register" initialError={error ? "Liên kết xác thực không hợp lệ hoặc đã hết hạn. Hãy kiểm tra thông tin đăng ký rồi gửi lại email. Nếu bạn đăng ký trước khi có chính sách dữ liệu, hãy đọc chính sách, tích đồng ý và chọn Gửi xác thực." : ""} />;
}
