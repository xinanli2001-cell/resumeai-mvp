import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `rm -f prisma/dev.db && pnpm db:migrate --name plan3_editor_templates && pnpm db:seed && pnpm exec next dev -p ${e2ePort}`,
    env: {
      LLM_PROVIDER: "mock",
      DEEPSEEK_API_KEY: "",
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
