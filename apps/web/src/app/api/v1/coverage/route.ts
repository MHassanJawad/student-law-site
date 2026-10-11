// Return measured published corpus coverage to anonymous researchers.
import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { mapCoverage } from "@/lib/coverage";
import { createPublicClient } from "@/lib/supabase";

export async function GET(): Promise<NextResponse> {
  const client = createPublicClient();
  if (!client) return apiError(503, "NOT_CONFIGURED", "The research database is not configured.");
  const { data, error } = await client.rpc("corpus_coverage");
  if (error) return apiError(503, "COVERAGE_UNAVAILABLE", "Coverage is temporarily unavailable.");
  return NextResponse.json({
    sources: mapCoverage(data),
  }, { headers: { "Cache-Control": "no-store" } });
}
