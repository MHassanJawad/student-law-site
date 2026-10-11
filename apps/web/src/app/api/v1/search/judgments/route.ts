// Search only published FCCP judgments through the restricted SQL function.
import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { parseSearchQuery } from "@/lib/search-query";
import { mapCoverage } from "@/lib/coverage";
import { createPublicClient } from "@/lib/supabase";

/** Returns one page of source-linked FCCP judgment matches. */
export async function GET(request: Request): Promise<NextResponse> {
  const query = parseSearchQuery(new URL(request.url).searchParams);
  if (!query) return apiError(400, "INVALID_QUERY", "Enter at least two characters and a valid page.");
  const client = createPublicClient();
  if (!client) return apiError(503, "NOT_CONFIGURED", "The research database is not configured.");
  const [matches, coverage] = await Promise.all([
    client.rpc("search_judgments", { p_query: query.q, p_limit: 20, p_offset: (query.page - 1) * 20 }),
    client.rpc("corpus_coverage"),
  ]);
  if (matches.error || coverage.error) return apiError(503, "SEARCH_UNAVAILABLE", "Search is temporarily unavailable.");
  const data = matches.data;
  const rows = Array.isArray(data) ? data : [];
  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      kind: "judgment",
      title: row.title,
      caseNumber: row.case_number,
      citation: row.citation,
      date: row.decision_date,
      sourceUrl: row.source_url,
      checkedAt: row.checked_at,
    })),
    page: query.page,
    limit: 20,
    total: Number(rows[0]?.total_count ?? 0),
    coverage: mapCoverage(coverage.data),
  });
}
