import { describe, expect, it } from "vitest";
import { checkStagingSmoke } from "../../scripts/smoke-staging";

function response(status: number, headers: Record<string, string>, body = "{}") {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    text: async () => body,
    json: async () => JSON.parse(body),
  } as Response;
}

describe("checkStagingSmoke", () => {
  it("passes when health, headers, login, and auth redirect are healthy", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      if (url.endsWith("/api/health")) {
        return response(
          200,
          {
            "x-frame-options": "DENY",
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'self'",
          },
          JSON.stringify({ status: "ok", appEnv: "staging" }),
        );
      }
      if (url.endsWith("/login")) return response(200, {}, "<html>login</html>");
      if (url.endsWith("/library")) return response(302, { location: "/login" });
      throw new Error(`unexpected URL ${url}`);
    };

    await expect(checkStagingSmoke("https://example.com", fetcher)).resolves.toEqual([
      "health ok",
      "security headers ok",
      "login reachable",
      "auth redirect ok",
    ]);
    expect(calls).toHaveLength(3);
  });

  it("fails when health is not ok", async () => {
    const fetcher = async () => response(503, {}, JSON.stringify({ status: "error" }));
    await expect(checkStagingSmoke("https://example.com", fetcher)).rejects.toThrow("Health check failed");
  });
});
