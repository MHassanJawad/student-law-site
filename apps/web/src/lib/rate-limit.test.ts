// Ensure API request limits are bounded, scoped, and reset after their window.
import { describe, expect, it } from "vitest";
import { clientAddress, createRateLimiter, rateRuleFor } from "./rate-limit";

describe("API rate limit rules", () => {
  it("should exempt the health check and non-API paths", () => {
    expect(rateRuleFor("/api/v1/health", "GET")).toBeNull();
    expect(rateRuleFor("/search", "GET")).toBeNull();
  });

  it("should apply the strictest rule to account deletion", () => {
    expect(rateRuleFor("/api/v1/me/account", "DELETE")).toMatchObject({ bucket: "account-delete", limit: 5 });
    expect(rateRuleFor("/api/v1/me/saved-citations", "POST")).toMatchObject({ bucket: "account", limit: 60 });
    expect(rateRuleFor("/api/v1/search/research", "GET")).toMatchObject({ bucket: "search", limit: 120 });
    expect(rateRuleFor("/api/v1/documents/abc", "GET")).toMatchObject({ bucket: "read", limit: 240 });
  });
});

describe("fixed-window rate limiter", () => {
  const rule = { bucket: "test", limit: 2, windowMs: 1_000 };

  it("should reject a request over the limit and report when to retry", () => {
    const check = createRateLimiter();
    expect(check("a", rule, 0).allowed).toBe(true);
    expect(check("a", rule, 10).remaining).toBe(0);
    expect(check("a", rule, 400)).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
  });

  it("should count each client separately and reset after the window", () => {
    const check = createRateLimiter();
    check("a", rule, 0);
    check("a", rule, 0);
    expect(check("b", rule, 0).allowed).toBe(true);
    expect(check("a", rule, 1_000).allowed).toBe(true);
  });

  it("should stay within its key bound when many clients appear", () => {
    const check = createRateLimiter(2);
    check("a", rule, 0);
    check("b", rule, 0);
    expect(check("c", rule, 0).allowed).toBe(true);
    expect(check("a", rule, 0).remaining).toBe(1);
  });
});

describe("client address", () => {
  it("should use the address appended by the trusted proxy, not a client-supplied one", () => {
    const spoofed = new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" });
    expect(clientAddress(spoofed)).toBe("203.0.113.9");
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("should skip the configured number of trusted proxy hops", () => {
    const chain = new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9, 10.0.0.2" });
    expect(clientAddress(chain, 2)).toBe("203.0.113.9");
    expect(clientAddress(chain, 9)).toBe("1.1.1.1");
  });

  it("should group requests without an address and ignore oversized values", () => {
    expect(clientAddress(new Headers())).toBe("unknown");
    expect(clientAddress(new Headers({ "x-forwarded-for": "x".repeat(100) }))).toBe("unknown");
  });
});
