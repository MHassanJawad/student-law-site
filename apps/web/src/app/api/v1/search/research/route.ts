// Search the reviewed public corpus using one bounded database operation.
import { NextResponse } from "next/server";
import { mapCoverage } from "@/lib/coverage";
import { apiError } from "@/lib/http";
import { parseResearchQuery } from "@/lib/research-query";
import { createPublicClient } from "@/lib/supabase";

type DatabaseHit = {
  id: string; kind: "judgment" | "legislation"; title: string; source_url: string;
  source_code: string; source_name: string; checked_at: string; version_id: string;
  issuing_court: string | null; case_number: string | null; decision_date: string | null;
  author_judge: string | null; raw_citation: string | null; jurisdiction: string | null;
  instrument_type: string | null; enactment_year: number | null; legal_status: string | null;
  official_citation: string | null; excerpt: string | null;
};

/** Return search hits, an exact count, and measured published coverage. */
export async function GET(request: Request): Promise<NextResponse> {
  const query = parseResearchQuery(new URL(request.url).searchParams);
  if (!query) return apiError(400, "INVALID_QUERY", "Check the search fields and try again.");
  const client = createPublicClient();
  if (!client) return apiError(503, "NOT_CONFIGURED", "The research database is not configured.");
  const [matches, coverage] = await Promise.all([
    client.rpc("search_research", {
      p_mode: query.mode,
      p_query: query.mode === "citation" && query.reporter
        ? `${query.reporter} ${query.citationYear} ${query.citationPage}` : query.q,
      p_author: query.mode === "advanced" ? query.author : "",
      p_from: query.mode === "advanced" ? query.from ?? null : null,
      p_to: query.mode === "advanced" ? query.to ?? null : null,
      p_jurisdiction: query.mode === "statutes" ? query.jurisdiction ?? "" : "",
      p_year: query.mode === "statutes" ? query.year ?? null : null,
      p_instrument_type: query.mode === "statutes" ? query.instrumentType : "",
      p_legal_status: query.mode === "statutes" ? query.legalStatus ?? "" : "",
      p_sort: query.sort, p_limit: 20, p_offset: (query.page - 1) * 20,
    }),
    client.rpc("corpus_coverage"),
  ]);
  if (matches.error || coverage.error) return apiError(503, "SEARCH_UNAVAILABLE", "Search is temporarily unavailable.");
  const payload = matches.data as { items?: DatabaseHit[]; total?: number } | null;
  return NextResponse.json({
    items: (payload?.items ?? []).map((row) => ({
      id: row.id, kind: row.kind, title: row.title, sourceUrl: row.source_url,
      sourceCode: row.source_code, sourceName: row.source_name, checkedAt: row.checked_at,
      versionId: row.version_id, court: row.issuing_court, caseNumber: row.case_number,
      date: row.decision_date, authorJudge: row.author_judge, citation: row.raw_citation ?? row.official_citation,
      jurisdiction: row.jurisdiction, instrumentType: row.instrument_type,
      enactmentYear: row.enactment_year, legalStatus: row.legal_status, excerpt: row.excerpt,
    })),
    total: Number(payload?.total ?? 0), page: query.page, limit: 20,
    coverage: mapCoverage(coverage.data),
  }, { headers: { "Cache-Control": "no-store" } });
}
