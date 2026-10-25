// Report web and database availability for uptime monitoring without exposing data.
import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Check = "ok" | "missing" | "failed" | "skipped";

/** Returns 200 when the app can query published data, otherwise 503. */
export async function GET(): Promise<NextResponse> {
  if (process.env.MAINTENANCE_MODE === "on") return health("maintenance", "ok", "skipped", null);
  const client = createPublicClient();
  if (!client) return health("unavailable", "missing", "skipped", null);
  const started = performance.now();
  const { error } = await client.rpc("corpus_coverage");
  const latencyMs = Math.round(performance.now() - started);
  return error ? health("unavailable", "ok", "failed", latencyMs) : health("ok", "ok", "ok", latencyMs);
}

function health(status: string, configuration: Check, database: Check, latencyMs: number | null): NextResponse {
  return NextResponse.json({
    status,
    checks: { configuration, database },
    databaseLatencyMs: latencyMs,
    version: process.env.APP_VERSION ?? null,
    checkedAt: new Date().toISOString(),
  }, { status: status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
