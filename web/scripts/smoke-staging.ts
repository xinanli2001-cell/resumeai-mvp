import path from "node:path";
import { fileURLToPath } from "node:url";

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function requireHeader(response: Response, key: string) {
  const value = response.headers.get(key);
  if (!value) throw new Error(`Missing security header: ${key}`);
}

export async function checkStagingSmoke(baseUrl: string, fetcher: Fetcher = fetch) {
  const base = normalizeBaseUrl(baseUrl);
  const health = await fetcher(`${base}/api/health`);
  if (!health.ok) throw new Error(`Health check failed with HTTP ${health.status}`);
  const healthBody = (await health.json()) as { status?: string };
  if (healthBody.status !== "ok") throw new Error("Health check failed: status was not ok");
  requireHeader(health, "x-frame-options");
  requireHeader(health, "x-content-type-options");
  requireHeader(health, "content-security-policy");

  const login = await fetcher(`${base}/login`);
  if (!login.ok) throw new Error(`Login page failed with HTTP ${login.status}`);

  const library = await fetcher(`${base}/library`, { redirect: "manual" });
  if (library.status !== 302 && library.status !== 307 && library.status !== 308) {
    throw new Error(`Expected unauthenticated /library redirect, got HTTP ${library.status}`);
  }

  return ["health ok", "security headers ok", "login reachable", "auth redirect ok"];
}

const isMain = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isMain) {
  const baseUrl = process.env.STAGING_BASE_URL;
  if (!baseUrl) throw new Error("STAGING_BASE_URL is required");
  checkStagingSmoke(baseUrl)
    .then((results) => {
      for (const result of results) console.log(result);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
