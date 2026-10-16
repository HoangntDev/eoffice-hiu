import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      // Tính trên toàn bộ src/, kể cả file chưa có test, để số liệu không bị phóng đại.
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "json-summary", "html"],
    },
  },
});
