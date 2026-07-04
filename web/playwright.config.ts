import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "rm -f prisma/dev.db && pnpm db:migrate --name plan3_editor_templates && pnpm db:seed && pnpm dev",
    env: {
      LLM_PROVIDER: "mock",
      DEEPSEEK_API_KEY: "",
    },
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
