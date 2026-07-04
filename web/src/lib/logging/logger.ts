const sensitiveKeyPattern =
  /password|passwordhash|authorization|apikey|api_key|deepseek_api_key|session_secret|cookie|token|access_token|refresh_token/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[REDACTED]" : redact(item),
    ]),
  );
}

function write(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    ...(meta ? { meta: redact(meta) } : {}),
  };
  console[level](JSON.stringify(payload));
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    write("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    write("warn", message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    write("error", message, meta);
  },
};
