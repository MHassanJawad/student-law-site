// Ensure responses carry a restrictive content policy and transport headers.
import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

function header(headers: { key: string; value: string }[], key: string): string | undefined {
  return headers.find((item) => item.key === key)?.value;
}

describe("security headers", () => {
  it("should allow browser requests only to the app and Supabase origin", () => {
    const policy = header(securityHeaders("https://abc.supabase.co/rest/v1", false), "Content-Security-Policy");
    expect(policy).toContain("connect-src 'self' https://abc.supabase.co;");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("should fall back to same-origin requests when the Supabase URL is missing or invalid", () => {
    expect(header(securityHeaders(undefined, false), "Content-Security-Policy")).toContain("connect-src 'self';");
    expect(header(securityHeaders("not a url", false), "Content-Security-Policy")).toContain("connect-src 'self';");
  });

  it("should permit evaluation only for the development server", () => {
    expect(header(securityHeaders(undefined, true), "Content-Security-Policy")).toContain("'unsafe-eval'");
  });

  it("should send HSTS and framing protection", () => {
    const headers = securityHeaders(undefined, false);
    expect(header(headers, "Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
    expect(header(headers, "X-Frame-Options")).toBe("DENY");
  });
});
