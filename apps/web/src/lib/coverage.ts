// Normalize measured SQL coverage rows for public API responses.
type CoverageRow = {
  source_code: string;
  kind: string;
  jurisdiction: string;
  document_count: number;
  last_checked_at: string | null;
};

export function mapCoverage(rows: CoverageRow[] | null | undefined) {
  return (rows ?? []).map((row) => ({
    sourceCode: row.source_code, kind: row.kind, jurisdiction: row.jurisdiction,
    count: Number(row.document_count), lastCheckedAt: row.last_checked_at,
  }));
}
