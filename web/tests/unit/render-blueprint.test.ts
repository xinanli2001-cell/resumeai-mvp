import { describe, expect, it } from "vitest";
import { validateRenderBlueprint } from "../../scripts/validate-render-blueprint";

const validBlueprint = `
databases:
  - name: resumeai-staging-db
    databaseName: resumeai
    user: resumeai
    plan: basic-256mb
services:
  - type: web
    name: resumeai-staging
    runtime: node
    rootDir: web
    plan: starter
    numInstances: 1
    buildCommand: pnpm install --frozen-lockfile --prod=false && pnpm db:generate:prod && pnpm build
    startCommand: pnpm db:migrate:prod && pnpm db:seed && pnpm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: APP_ENV
        value: staging
      - key: DATABASE_URL
        fromDatabase:
          name: resumeai-staging-db
          property: connectionString
      - key: SESSION_SECRET
        sync: false
      - key: LLM_PROVIDER
        value: deepseek
      - key: DEEPSEEK_API_KEY
        sync: false
      - key: ADMIN_PASSWORD
        sync: false
`;

describe("validateRenderBlueprint", () => {
  it("accepts the Render staging Blueprint shape", () => {
    expect(validateRenderBlueprint(validBlueprint)).toEqual([
      "one web service ok",
      "one postgres database ok",
      "web service config ok",
      "render env wiring ok",
    ]);
  });

  it("rejects a web service without the production migration command", () => {
    const invalid = validBlueprint.replace("pnpm db:migrate:prod && ", "");
    expect(() => validateRenderBlueprint(invalid)).toThrow("startCommand must include pnpm db:migrate:prod");
  });

  it("rejects a build command that can skip dev dependencies in production", () => {
    const invalid = validBlueprint.replace(" --prod=false", "");
    expect(() => validateRenderBlueprint(invalid)).toThrow("buildCommand must include --prod=false");
  });
});
