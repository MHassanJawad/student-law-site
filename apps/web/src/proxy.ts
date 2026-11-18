// Apply maintenance mode and per-client API rate limits before requests reach routes.
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/http";
import { clientAddress, createRateLimiter, rateRuleFor } from "@/lib/rate-limit";

const checkRate = createRateLimiter();
const TRUSTED_PROXY_HOPS = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10) || 1;

/** Rejects requests during maintenance or after a client exceeds its API limit. */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (process.env.MAINTENANCE_MODE === "on" && pathname !== "/api/v1/health") return maintenanceResponse(pathname);
  const rule = rateRuleFor(pathname, request.method);
  if (!rule) return NextResponse.next();
  const decision = checkRate(clientAddress(request.headers, TRUSTED_PROXY_HOPS), rule);
  if (decision.allowed) return NextResponse.next();
  const response = apiError(429, "RATE_LIMITED", "Too many requests. Wait a moment and try again.");
  response.headers.set("Retry-After", String(decision.retryAfterSeconds));
  return response;
}

function maintenanceResponse(pathname: string): NextResponse {
  const response = pathname.startsWith("/api/")
    ? apiError(503, "MAINTENANCE", "The service is undergoing maintenance. Try again later.")
    : new NextResponse("Student Law Site is undergoing maintenance. Please try again later.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  response.headers.set("Retry-After", "600");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
