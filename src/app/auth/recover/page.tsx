import { AuthFormV2 } from "@/components/auth-form-v2";

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthFormV2 mode="recover" initialError={error ? "Liên kết khôi phục không hợp lệ hoặc đã hết hạn. Hãy gửi yêu cầu mới." : ""} />;
}
