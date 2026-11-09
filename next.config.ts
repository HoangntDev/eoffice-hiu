import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // winston nạp file cấu hình/transport bằng require động; để Node tự nạp từ node_modules thay vì đóng gói.
  serverExternalPackages: ["winston", "winston-daily-rotate-file"],
};

export default nextConfig;
