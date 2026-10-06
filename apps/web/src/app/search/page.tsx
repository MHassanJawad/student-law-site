// Client-side judgment search form and results for the first pilot slice.
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Hit = { id: string; title: string; citation: string | null; date: string | null; sourceUrl: string; checkedAt: string | null };
type SearchResponse = { items: Hit[]; total: number; page: number; error?: { message: string } };

/** Searches published FCCP records with visible loading and empty states. */
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/search/judgments?q=${encodeURIComponent(query.trim())}`);
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

  return (
    <div className="page-wrap narrow-page">
      <p className="eyebrow">CASE LAW / FCCP ONLY</p>
      <h1>Search judgments</h1>
      <p className="intro">This pilot searches a small source-linked FCCP sample by case identifier or title. Other courts are outside the case-law collection.</p>
      <form className="search-form" onSubmit={onSubmit}>
        <label htmlFor="judgment-query">Case identifier or keywords</label>
        <div className="search-row">
          <input id="judgment-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try C.P.L.A. No.1285-K" minLength={2} maxLength={200} required />
          <button type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
        </div>
      </form>
      <div aria-live="polite" className="status-line">{message || (result ? `${result.total} result${result.total === 1 ? "" : "s"} in the pilot corpus` : "")}</div>
      {result && result.items.length === 0 && <p className="empty-state">No match in this pilot corpus. This does not mean no such judgment exists at the official source.</p>}
      {result?.items.map((hit) => (
        <article className="result-card" key={hit.id}>
          <div><p className="eyebrow">FCCP JUDGMENT</p><h2><Link href={`/documents/${hit.id}`}>{hit.title}</Link></h2></div>
          <p>{hit.citation ?? "Citation not verified"}{hit.date ? ` · Decided ${hit.date}` : " · Decision date not verified"}</p>
          <p className="meta">Checked {hit.checkedAt ? new Date(hit.checkedAt).toLocaleDateString("en-PK") : "date unavailable"} · <a href={hit.sourceUrl} target="_blank" rel="noopener noreferrer">Official source</a></p>
        </article>
      ))}
    </div>
  );
}
