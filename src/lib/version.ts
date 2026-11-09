// Phiên bản ứng dụng lấy từ package.json lúc build; dùng cho log app.start và /api/health.
import packageJson from "../../package.json";

export const APP_VERSION: string = packageJson.version;
