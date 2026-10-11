// Search controls and source-linked results for the public research journey.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SearchMode } from "@/lib/research-query";

type Hit = {
  id: string; kind: "judgment" | "legislation"; title: string; sourceUrl: string;
  sourceName: string; sourceCode: string; checkedAt: string; versionId: string;
  court: string | null; caseNumber: string | null; date: string | null;
  authorJudge: string | null; citation: string | null; jurisdiction: string | null;
  instrumentType: string | null; enactmentYear: number | null; legalStatus: string | null; excerpt: string | null;
};
type Coverage = { sourceCode: string; kind: string; count: number };
type SearchResponse = { items: Hit[]; total: number; page: number; limit: number; coverage: Coverage[]; error?: { message: string } };

const MODES: { id: SearchMode; label: string; description: string }[] = [
  { id: "case-law", label: "Case Law", description: "Search case titles and identifiers." },
  { id: "courtwise", label: "Courtwise", description: "Browse the currently covered court." },
  { id: "citation", label: "Citation", description: "Match verified reporter citations." },
  { id: "advanced", label: "Advanced", description: "Combine title, judge, and decision date." },
  { id: "statutes", label: "Statutes", description: "Search reviewed legislation." },
];

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "Not recorded";
}

/** Render mode-specific filters and paginated reviewed records. */
export function ResearchClient({ initialMode, initialSearch }: { initialMode: SearchMode; initialSearch: string }) {
  const initial = new URLSearchParams(initialSearch);
  const [query, setQuery] = useState(initial.get("q") ?? "");
  const [author, setAuthor] = useState(initial.get("author") ?? "");
  const [reporter, setReporter] = useState(initial.get("reporter") ?? "");
  const [citationYear, setCitationYear] = useState(initial.get("citationYear") ?? "");
  const [citationPage, setCitationPage] = useState(initial.get("citationPage") ?? "");
  const [from, setFrom] = useState(initial.get("from") ?? "");
  const [to, setTo] = useState(initial.get("to") ?? "");
  const [jurisdiction, setJurisdiction] = useState(initial.get("jurisdiction") ?? "");
  const [year, setYear] = useState(initial.get("year") ?? "");
  const [instrumentType, setInstrumentType] = useState(initial.get("instrumentType") ?? "");
  const [legalStatus, setLegalStatus] = useState(initial.get("legalStatus") ?? "");
  const [sort, setSort] = useState(initial.get("sort") ?? "relevance");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const activeParams = useRef(new URLSearchParams());
  const controller = useRef<AbortController | null>(null);
  const selected = MODES.find((item) => item.id === initialMode)!;

  const search = useCallback(async (params: URLSearchParams) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    activeParams.current = params;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/search/research?${params}`, { signal: request.signal });
      const body = await response.json() as SearchResponse;
      if (!response.ok) throw new Error(body.error?.message ?? "Search is unavailable.");
      setResult(body);
    } catch (error) {
      if (request.signal.aborted) return;
      setResult(null);
      setMessage(error instanceof Error ? error.message : "Search is unavailable. Please try again.");
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(initialSearch);
    let active = true;
    if (initialMode !== "citation" || params.get("q") || params.get("reporter")) {
      queueMicrotask(() => { if (active) void search(params); });
    }
    return () => { active = false; controller.current?.abort(); };
  }, [initialMode, initialSearch, search]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (initialMode === "citation" && !query.trim() && !(reporter && citationYear && citationPage)) {
      setMessage("Enter a reporter citation or complete all three citation fields.");
      return;
    }
    const params = new URLSearchParams({ mode: initialMode, sort, page: "1" });
    if (query.trim()) params.set("q", query.trim());
    if (initialMode === "citation" && reporter && citationYear && citationPage) {
      params.set("reporter", reporter.trim());
      params.set("citationYear", citationYear);
      params.set("citationPage", citationPage.trim());
    }
    if (initialMode === "advanced") {
      if (author.trim()) params.set("author", author.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    if (initialMode === "statutes") {
      if (jurisdiction) params.set("jurisdiction", jurisdiction);
      if (year) params.set("year", year);
      if (instrumentType.trim()) params.set("instrumentType", instrumentType.trim());
      if (legalStatus) params.set("legalStatus", legalStatus);
    }
    window.history.replaceState(null, "", `/search?${params}`);
    void search(params);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(activeParams.current);
    params.set("page", String(page));
    window.history.replaceState(null, "", `/search?${params}`);
    void search(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const covered = result?.coverage.filter((source) => source.kind === (initialMode === "statutes" ? "legislation" : "judgment"))
    .reduce((sum, source) => sum + source.count, 0);

  return <div className="page-wrap research-page">
    <div className="research-heading"><p className="eyebrow">PUBLIC RESEARCH / REVIEWED SOURCES</p>
      <h1>Research the record.</h1>
      <p className="intro">Find published records and verify each result at its official source. Coverage is measured from this pilot collection.</p>
    </div>
    <div className="research-layout">
      <nav className="research-nav" aria-label="Search collections">
        <p className="eyebrow">COLLECTIONS</p>
        {MODES.map((mode) => <Link key={mode.id} href={`/search?mode=${mode.id}`} aria-current={mode.id === initialMode ? "page" : undefined}>
          <strong>{mode.label}</strong><span>{mode.description}</span>
        </Link>)}
      </nav>
      <div className="research-main">
        <section className="research-panel" aria-labelledby="search-heading">
          <div className="research-panel-heading"><div><p className="eyebrow">{initialMode === "statutes" ? "LEGISLATION" : "JUDGMENTS"}</p>
            <h2 id="search-heading">{selected.label} search</h2></div>
            <span className="scope-pill">{initialMode === "statutes" ? "Reviewed sources only" : "FCCP pilot"}</span></div>
          {initialMode === "courtwise" && <p className="field-note">Covered court: Federal Constitutional Court of Pakistan. Other courts have not been indexed.</p>}
          {initialMode === "citation" && <p className="field-note">Reporter citations are returned only when a reviewer has verified the citation field. Use Case Law for case identifiers.</p>}
          {initialMode === "advanced" && <p className="field-note">Decision date filters include only records with a verified decision date. A source upload date is different.</p>}
          <form className="research-form" onSubmit={onSubmit}>
            <div className="field"><label htmlFor="research-query">{initialMode === "citation" ? "Reporter citation" : initialMode === "statutes" ? "Law title or official citation" : "Case title or identifier"}</label>
              <input id="research-query" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={200}
                minLength={initialMode === "citation" ? 2 : undefined}
                placeholder={initialMode === "citation" ? "Enter a verified reporter citation" : initialMode === "statutes" ? "Search reviewed laws" : "e.g. C.P.L.A. No. 1275 of 2026"} /></div>
            {initialMode === "citation" && <><p className="field-note">Or enter the citation parts:</p><div className="filter-grid">
              <div className="field"><label htmlFor="reporter">Reporter</label><input id="reporter" value={reporter} onChange={(event) => setReporter(event.target.value)} maxLength={30} placeholder="PLD" /></div>
              <div className="field"><label htmlFor="citation-year">Year</label><input id="citation-year" type="number" min={1800} max={2200} value={citationYear} onChange={(event) => setCitationYear(event.target.value)} /></div>
              <div className="field"><label htmlFor="citation-page">Page or code</label><input id="citation-page" value={citationPage} onChange={(event) => setCitationPage(event.target.value)} maxLength={30} /></div>
            </div></>}
            {initialMode === "advanced" && <div className="filter-grid">
              <div className="field"><label htmlFor="author">Author judge</label><input id="author" value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={100} /></div>
              <div className="field"><label htmlFor="from">Decided from</label><input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
              <div className="field"><label htmlFor="to">Decided to</label><input id="to" type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} /></div>
            </div>}
            {initialMode === "statutes" && <div className="filter-grid">
              <div className="field"><label htmlFor="jurisdiction">Jurisdiction</label><select id="jurisdiction" value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)}>
                <option value="">All covered jurisdictions</option>{["Federal", "Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad Capital Territory"].map((item) => <option key={item}>{item}</option>)}</select></div>
              <div className="field"><label htmlFor="year">Enactment year</label><input id="year" type="number" min={1800} max={2200} value={year} onChange={(event) => setYear(event.target.value)} /></div>
              <div className="field"><label htmlFor="instrument-type">Instrument type</label><input id="instrument-type" value={instrumentType} onChange={(event) => setInstrumentType(event.target.value)} maxLength={80} placeholder="e.g. Act" /></div>
              <div className="field"><label htmlFor="legal-status">Verified status</label><select id="legal-status" value={legalStatus} onChange={(event) => setLegalStatus(event.target.value)}>
                <option value="">Any recorded status</option><option value="in_force">In force</option><option value="partly_in_force">Partly in force</option><option value="repealed">Repealed</option><option value="unknown">Unknown</option>
              </select></div>
            </div>}
            <div className="research-form-footer"><div className="field"><label htmlFor="sort">Sort by</label><select id="sort" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="relevance">Relevance</option><option value="title">Title</option>
              {initialMode !== "statutes" && <><option value="decision-newest">Decision date: newest</option><option value="decision-oldest">Decision date: oldest</option></>}
            </select></div><button type="submit" disabled={loading}>{loading ? "Searching…" : "Search collection"}</button></div>
          </form>
        </section>
        <section className="research-results" aria-label="Search results">
          <div className="results-heading"><div><p className="eyebrow">RESULTS</p>
            <h2>{result ? `${result.total} matching ${result.total === 1 ? "record" : "records"}` : "Search results"}</h2></div>
            {covered !== undefined && <p className="meta">{covered} published in this collection</p>}</div>
          <p className="meta" aria-live="polite">{message || (loading ? "Searching reviewed records…" : initialMode === "citation" && !result ? "Enter a citation to begin." : "")}</p>
          {result?.items.map((hit) => <article className="research-hit" key={hit.id}>
            <div className="hit-label"><span>{hit.kind === "judgment" ? "JUDGMENT" : "LEGISLATION"}</span><span>{hit.court ?? hit.jurisdiction ?? hit.sourceCode}</span>
              {hit.sourceCode.endsWith("_SAMPLE") && <span>LOCAL SAMPLE</span>}</div>
            <h3><Link href={`/documents/${hit.id}`}>{hit.title}</Link></h3>
            <p>{hit.kind === "judgment"
              ? `${hit.citation ? `Reporter citation: ${hit.citation}` : `Case identifier: ${hit.caseNumber ?? "Not recorded"}`}${hit.authorJudge ? ` · ${hit.authorJudge}` : ""}${hit.date ? ` · Decided ${displayDate(hit.date)}` : ""}`
              : `${hit.citation ? `Official citation: ${hit.citation}` : hit.instrumentType ?? "Instrument type unknown"}${hit.enactmentYear ? ` · ${hit.enactmentYear}` : ""} · Status: ${hit.legalStatus?.replaceAll("_", " ") ?? "unknown"}`}</p>
            {hit.excerpt && <p className="hit-excerpt">{hit.excerpt}</p>}
            <div className="hit-footer"><span>Source checked {displayDate(hit.checkedAt)}</span><a href={hit.sourceUrl} target="_blank" rel="noopener noreferrer">Official source ↗</a></div>
          </article>)}
          {result && result.items.length === 0 && <div className="empty-state"><strong>No record in this collection.</strong><p>{initialMode === "statutes" && covered === 0
            ? "No reviewed legislation has been published yet. Federal and provincial sources are still being prepared."
            : initialMode === "citation" ? "No verified reporter citation matches. Try the case identifier in Case Law."
              : "Try a broader query. An empty result does not mean the document does not exist at the official source."}</p></div>}
          {result && result.total > result.limit && <nav className="result-pages" aria-label="Result pages">
            <button type="button" disabled={loading || result.page <= 1} onClick={() => goToPage(result.page - 1)}>Previous</button>
            <span>Page {result.page} of {Math.ceil(result.total / result.limit)}</span>
            <button type="button" disabled={loading || result.page * result.limit >= result.total} onClick={() => goToPage(result.page + 1)}>Next</button>
          </nav>}
        </section>
      </div>
    </div>
  </div>;
}
