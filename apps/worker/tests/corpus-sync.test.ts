import { describe, expect, it } from "vitest";
import { assertSyncTarget, chunk, CORPUS_TABLES } from "../src/corpus-sync.js";

describe("corpus sync rules", () => {
  it("should accept only an HTTPS hosted target unless the CI local check is explicit", () => {
    expect(() => assertSyncTarget("https://abc.supabase.co", false)).not.toThrow();
    expect(() => assertSyncTarget("http://abc.supabase.co", false)).toThrow(/HTTPS/);
    expect(() => assertSyncTarget("http://127.0.0.1:54321", false)).toThrow(/local/);
    expect(() => assertSyncTarget("http://127.0.0.1:54321", true)).not.toThrow();
    expect(() => assertSyncTarget(undefined, false)).toThrow(/TARGET_SUPABASE_URL/);
  });

  it("should never copy user, editorial, or private review tables, or the generated search column", () => {
    for (const table of ["profiles", "saved_citations", "editorial_entries", "ingestion_candidates", "legislation_candidates", "pdf_inspections"]) {
      expect(CORPUS_TABLES).not.toHaveProperty(table);
    }
    expect(CORPUS_TABLES.legal_documents.columns).not.toContain("search_vector");
  });

  it("should split rows into bounded batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
