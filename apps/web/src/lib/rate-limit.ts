// Bound repeated API requests from one client within a single web process.
export type RateRule = { bucket: string; limit: number; windowMs: number };
export type RateDecision = { allowed: boolean; remaining: number; retryAfterSeconds: number };

const MINUTE = 60_000;
const MAX_TRACKED_KEYS = 10_000;

/**
 * Returns the request limit for an API path, or null when the path is exempt.
 *
 * @param pathname - Request path, such as `/api/v1/search/research`.
 * @param method - HTTP method; account deletion has a stricter rule.
 * @returns The bucket and limit to apply, or null for non-API and health paths.
 */
export function rateRuleFor(pathname: string, method: string): RateRule | null {
  if (!pathname.startsWith("/api/") || pathname === "/api/v1/health") return null;
  if (pathname === "/api/v1/me/account" && method === "DELETE") {
    return { bucket: "account-delete", limit: 5, windowMs: 15 * MINUTE };
  }
  if (pathname.startsWith("/api/v1/me/")) return { bucket: "account", limit: 60, windowMs: MINUTE };
  if (pathname.startsWith("/api/v1/search/")) return { bucket: "search", limit: 120, windowMs: MINUTE };
  return { bucket: "read", limit: 240, windowMs: MINUTE };
}

/**
 * Creates an in-memory fixed-window limiter. State is per process, so a deployment
 * with several instances allows up to that many times the limit per client.
 *
 * @param maxKeys - Upper bound on tracked clients before expired windows are pruned.
 * @returns A function that records one request and decides whether it may proceed.
 */
export function createRateLimiter(maxKeys = MAX_TRACKED_KEYS) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return (key: string, rule: RateRule, now = Date.now()): RateDecision => {
    const id = `${rule.bucket}:${key}`;
    let current = windows.get(id);
    if (!current || current.resetAt <= now) {
      if (!current && windows.size >= maxKeys) prune(windows, now, maxKeys);
      current = { count: 0, resetAt: now + rule.windowMs };
      windows.set(id, current);
    }
    current.count += 1;
    if (current.count > rule.limit) {
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1_000) };
    }
    return { allowed: true, remaining: rule.limit - current.count, retryAfterSeconds: 0 };
  };
}

// Prefer forgetting old counts over unbounded memory growth during a flood of new addresses.
function prune(windows: Map<string, { resetAt: number }>, now: number, maxKeys: number): void {
  for (const [id, window] of windows) if (window.resetAt <= now) windows.delete(id);
  if (windows.size >= maxKeys) {
    const oldest = windows.keys().next().value;
    if (oldest !== undefined) windows.delete(oldest);
  }
}

/**
 * Returns the client address added by the trusted hosting proxy. Proxies append the
 * address they saw to `X-Forwarded-For`, so entries further left are client-supplied
 * and are skipped; counting from the right resists spoofing.
 *
 * @param headers - Incoming request headers.
 * @param trustedHops - Number of trusted proxies in front of the app (default 1).
 * @returns A bounded address string, or `unknown` when none is usable.
 */
export function clientAddress(headers: Headers, trustedHops = 1): string {
  const chain = (headers.get("x-forwarded-for") ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  const forwarded = chain.length ? chain[Math.max(0, chain.length - Math.max(1, trustedHops))] : "";
  const address = forwarded || headers.get("x-real-ip")?.trim() || "";
  return address && address.length <= 64 ? address : "unknown";
}
