import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./resumeai.test.db",
    },
    globalSetup: "./tests/global-setup.ts",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
