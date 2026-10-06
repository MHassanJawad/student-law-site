// Produce consistent public API errors without leaking database details.
import { NextResponse } from "next/server";

/** Returns a stable API error shape and request identifier. */
export function apiError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json(
    { error: { code, message, requestId: crypto.randomUUID() } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Rejects JSON writes from another origin when an Origin header is present. */
export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

/** Returns the bearer token from an Authorization header, if well formed. */
export function bearerToken(request: Request): string | null {
  const match = /^Bearer ([A-Za-z0-9._~+/-]+)$/.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}
