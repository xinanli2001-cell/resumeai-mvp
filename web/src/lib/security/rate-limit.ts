// Single-instance in-memory limiter. For horizontal scaling, replace this store
// with shared state such as Redis so all app instances enforce the same window.
const WINDOW_MS = 60_000;

const hits = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limitPerMinute: number,
  now: () => number = () => Date.now(),
) {
  const current = now();
  const windowStart = current - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

  if (recent.length >= limitPerMinute) {
    const retryAfterMs = Math.max(0, WINDOW_MS - (current - recent[0]));
    hits.set(key, recent);
    return { allowed: false, retryAfterMs };
  }

  recent.push(current);
  hits.set(key, recent);
  return { allowed: true, retryAfterMs: 0 };
}

export function resetRateLimitsForTests() {
  hits.clear();
}
