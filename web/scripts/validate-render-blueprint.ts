import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

type EnvVar = {
  key?: string;
  value?: string;
  sync?: boolean;
  fromDatabase?: {
    name?: string;
    property?: string;
  };
};

type RenderService = {
  type?: string;
  name?: string;
  runtime?: string;
  rootDir?: string;
  buildCommand?: string;
  startCommand?: string;
  numInstances?: number;
  envVars?: EnvVar[];
};

type RenderDatabase = {
  name?: string;
};

type RenderBlueprint = {
  services?: RenderService[];
  databases?: RenderDatabase[];
};

function requireCommand(command: string | undefined, expected: string, field: string) {
  if (!command?.includes(expected)) {
    throw new Error(`${field} must include ${expected}`);
  }
}

function envVarMap(envVars: EnvVar[] | undefined) {
  return new Map((envVars ?? []).filter((item) => item.key).map((item) => [item.key as string, item]));
}

function requireEnvValue(envVars: Map<string, EnvVar>, key: string, value: string) {
  const item = envVars.get(key);
  if (item?.value !== value) {
    throw new Error(`${key} must be ${value}`);
  }
}

function requireSecretPrompt(envVars: Map<string, EnvVar>, key: string) {
  const item = envVars.get(key);
  if (item?.sync !== false) {
    throw new Error(`${key} must use sync: false`);
  }
}

export function validateRenderBlueprint(source: string) {
  const blueprint = parse(source) as RenderBlueprint;
  const webServices = (blueprint.services ?? []).filter((service) => service.type === "web");
  if (webServices.length !== 1) throw new Error("render.yaml must define exactly one web service");

  const databases = blueprint.databases ?? [];
  if (databases.length !== 1) throw new Error("render.yaml must define exactly one Postgres database");
  const database = databases[0];
  if (database.name !== "resumeai-staging-db") {
    throw new Error("database must be named resumeai-staging-db");
  }

  const service = webServices[0];
  if (service.name !== "resumeai-staging") throw new Error("web service must be named resumeai-staging");
  if (service.runtime !== "node") throw new Error("web service runtime must be node");
  if (service.rootDir !== "web") throw new Error("web service rootDir must be web");
  if (service.numInstances !== 1) throw new Error("web service numInstances must be 1");
  requireCommand(service.buildCommand, "pnpm install --frozen-lockfile", "buildCommand");
  requireCommand(service.buildCommand, "--prod=false", "buildCommand");
  requireCommand(service.buildCommand, "pnpm db:generate:prod", "buildCommand");
  requireCommand(service.buildCommand, "pnpm build", "buildCommand");
  requireCommand(service.startCommand, "pnpm db:migrate:prod", "startCommand");
  requireCommand(service.startCommand, "pnpm db:seed", "startCommand");
  requireCommand(service.startCommand, "pnpm start", "startCommand");

  const envVars = envVarMap(service.envVars);
  requireEnvValue(envVars, "NODE_ENV", "production");
  requireEnvValue(envVars, "APP_ENV", "staging");
  requireEnvValue(envVars, "LLM_PROVIDER", "deepseek");
  requireSecretPrompt(envVars, "SESSION_SECRET");
  requireSecretPrompt(envVars, "DEEPSEEK_API_KEY");
  requireSecretPrompt(envVars, "ADMIN_PASSWORD");

  const databaseUrl = envVars.get("DATABASE_URL");
  if (
    databaseUrl?.fromDatabase?.name !== "resumeai-staging-db" ||
    databaseUrl.fromDatabase.property !== "connectionString"
  ) {
    throw new Error("DATABASE_URL must reference resumeai-staging-db connectionString");
  }

  return ["one web service ok", "one postgres database ok", "web service config ok", "render env wiring ok"];
}

export function validateRenderBlueprintFile(filePath = path.resolve(process.cwd(), "..", "render.yaml")) {
  return validateRenderBlueprint(readFileSync(filePath, "utf8"));
}

const isMain = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isMain) {
  const results = validateRenderBlueprintFile();
  for (const result of results) console.log(result);
}
