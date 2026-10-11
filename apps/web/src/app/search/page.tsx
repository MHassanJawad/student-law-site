// FCCP pilot search with measured coverage and source-linked results.
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Hit = { id: string; title: string; caseNumber: string | null; citation: string | null; date: string | null; sourceUrl: string; checkedAt: string | null };
type SourceCoverage = { sourceCode: string; kind: string; jurisdiction: string; count: number; lastCheckedAt: string | null };
type SearchResponse = { items: Hit[]; total: number; page: number; limit: number; coverage: SourceCoverage[]; error?: { message: string } };

/** Searches only published FCCP judgments; unavailable fields are named honestly. */
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function runSearch(value: string, page: number) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/search/judgments?q=${encodeURIComponent(value)}&page=${page}`);
      const body = (await response.json()) as SearchResponse;
      if (!response.ok) {
        setResult(null);
        setMessage(body.error?.message ?? "Search is unavailable.");
      } else {
        setResult(body);
      }
    } catch {
      setResult(null);
      setMessage("Search is unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    setSubmittedQuery(value);
    void runSearch(value, 1);
  }

  const publishedCount = result?.coverage.filter((source) => source.kind === "judgment")
    .reduce((sum, source) => sum + source.count, 0);

  return (
    <div className="page-wrap narrow-page">
      <p className="eyebrow">CASE LAW / FCCP ONLY</p>
      <h1>Search judgments</h1>
      <p className="intro">Search reviewed FCCP pilot records by case identifier or title. Other courts are outside this collection, and this pilot is not a complete FCCP archive.</p>
      <form className="search-form" onSubmit={onSubmit}>
        <label htmlFor="judgment-query">Case identifier or keywords</label>
        <div className="search-row">
          <input id="judgment-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try C.P.L.A. No.1285-K" minLength={2} maxLength={200} required />
          <button type="submit" disabled={loading}>{loading ? "Searching..." : "Search"}</button>
        </div>
      </form>
      <div aria-live="polite" className="status-line">{message || (result ? `${result.total} matching result${result.total === 1 ? "" : "s"} in the pilot corpus` : "")}</div>
      {result && <p className="meta">{publishedCount} published FCCP judgment{publishedCount === 1 ? "" : "s"} currently indexed from reviewed sources.</p>}
      {result && result.items.length === 0 && <p className="empty-state">No match in this pilot corpus. This does not mean no such judgment exists at the official source.</p>}
      {result?.items.map((hit) => (
        <article className="result-card" key={hit.id}>
          <div><p className="eyebrow">FCCP JUDGMENT</p><h2><Link href={`/documents/${hit.id}`}>{hit.title}</Link></h2></div>
          <p>{hit.citation ? `Reporter citation: ${hit.citation}` : `Case identifier: ${hit.caseNumber ?? hit.title}`} | {hit.date ? `Decided ${hit.date}` : "Decision date not verified"}</p>
          <p className="meta">Checked {hit.checkedAt ? new Date(hit.checkedAt).toLocaleDateString("en-PK") : "date unavailable"} | <a href={hit.sourceUrl} target="_blank" rel="noopener noreferrer">Official source</a></p>
        </article>
      ))}
      {result && result.total > result.limit && <nav className="result-pages" aria-label="Results pages">
        <button type="button" disabled={loading || result.page <= 1} onClick={() => void runSearch(submittedQuery, result.page - 1)}>Previous</button>
        <span>Page {result.page}</span>
        <button type="button" disabled={loading || result.page * result.limit >= result.total} onClick={() => void runSearch(submittedQuery, result.page + 1)}>Next</button>
      </nav>}
    </div>
  );
}