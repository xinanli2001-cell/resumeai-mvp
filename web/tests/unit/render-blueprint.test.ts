import { describe, expect, it } from "vitest";
import { validateRenderBlueprint } from "../../scripts/validate-render-blueprint";
import packageJson from "../../package.json";

const validBlueprint = `
databases:
  - name: resumeai-staging-db
    databaseName: resumeai
    user: resumeai
    plan: free
services:
  - type: web
    name: resumeai-staging
    runtime: node
    rootDir: web
    plan: free
    numInstances: 1
    buildCommand: pnpm install --frozen-lockfile --prod=false && pnpm db:generate:prod && pnpm build
    startCommand: pnpm db:push:prod && pnpm db:seed && pnpm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: APP_ENV
        value: staging
      - key: REGISTRATION_MODE
        value: invite_only
      - key: DATABASE_URL
        fromDatabase:
          name: resumeai-staging-db
          property: connectionString
      - key: SESSION_SECRET
        sync: false
      - key: LLM_PROVIDER
        value: openai
      - key: OPENAI_API_KEY
        sync: false
      - key: OPENAI_BASE_URL
        value: https://api.openai.com/v1
      - key: OPENAI_MODEL
        value: gpt-5.6
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

  it("rejects a web service without the production schema push command", () => {
    const invalid = validBlueprint.replace("pnpm db:push:prod && ", "");
    expect(() => validateRenderBlueprint(invalid)).toThrow("startCommand must include pnpm db:push:prod");
  });

  it("rejects the migration deploy command for first free staging deploys", () => {
    const invalid = validBlueprint.replace("pnpm db:push:prod", "pnpm db:migrate:prod");
    expect(() => validateRenderBlueprint(invalid)).toThrow("startCommand must include pnpm db:push:prod");
  });

  it("rejects a build command that can skip dev dependencies in production", () => {
    const invalid = validBlueprint.replace(" --prod=false", "");
    expect(() => validateRenderBlueprint(invalid)).toThrow("buildCommand must include --prod=false");
  });

  it("rejects a paid Render web service plan", () => {
    const invalid = validBlueprint.replace("plan: free\n    numInstances: 1", "plan: starter\n    numInstances: 1");
    expect(() => validateRenderBlueprint(invalid)).toThrow("web service plan must be free");
  });

  it("rejects a paid Render Postgres plan", () => {
    const invalid = validBlueprint.replace("plan: free\nservices:", "plan: basic-256mb\nservices:");
    expect(() => validateRenderBlueprint(invalid)).toThrow("database plan must be free");
  });

  it("requires closed-beta registration mode to be explicit", () => {
    const invalid = validBlueprint.replace(
      "      - key: REGISTRATION_MODE\n        value: invite_only\n",
      "",
    );
    expect(() => validateRenderBlueprint(invalid)).toThrow(
      "REGISTRATION_MODE must be invite_only",
    );
  });

  it("binds Next.js to Render's external service interface", () => {
    expect(packageJson.scripts.start).toContain("-H 0.0.0.0");
    expect(packageJson.scripts.start).toContain("-p ${PORT:-3000}");
  });
});
