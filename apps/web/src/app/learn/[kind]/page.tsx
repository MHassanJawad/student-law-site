// Searchable public list of reviewed learning entries.
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { EDITORIAL_KIND, EDITORIAL_LABEL, type EditorialCollection } from "@/lib/editorial";

type Entry = { slug: string; title: string; summary: string; author: string; topic: string | null; published_at: string };

/** Renders one of the three published editorial collections. */
export default function EditorialCollectionPage() {
  const { kind } = useParams<{ kind: string }>();
  const collection = EDITORIAL_KIND.safeParse(kind);
  const validKind = collection.success ? collection.data : null;
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("Loading entries…");

  useEffect(() => {
    if (!validKind) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, page: String(page) });
    fetch(`/api/v1/editorial/${validKind}?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Collection unavailable. Please try again.");
        return response.json() as Promise<{ items: Entry[]; total: number }>;
      })
      .then((data) => { setItems(data.items); setTotal(data.total); setMessage(data.items.length ? "" : "No published entries match this search yet."); })
      .catch((error: unknown) => { if (!(error instanceof Error && error.name === "AbortError")) setMessage("Collection unavailable. Please try again."); });
    return () => controller.abort();
  }, [validKind, query, page]);

  if (!collection.success) return <div className="page-wrap"><h1>Collection not found</h1><Link href="/">Return home</Link></div>;
  const name = EDITORIAL_LABEL[collection.data as EditorialCollection];
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setQuery(input.trim()); setPage(1); setMessage("Loading entries…"); }

  return <div className="page-wrap narrow-page">
    <p className="eyebrow">LEARNING LIBRARY</p><h1>{name}</h1>
    <p className="intro">Reviewed educational entries with author and provenance. Check cited sources for legal authority.</p>
    <form className="search-form" onSubmit={search}><label htmlFor="editorial-search">Search {name.toLowerCase()}</label>
      <div className="search-row"><input id="editorial-search" value={input} maxLength={100} onChange={(event) => setInput(event.target.value)} /><button type="submit">Search</button></div></form>
    <p role="status" className="status-line">{message || `${total} published ${total === 1 ? "entry" : "entries"}`}</p>
    <div className="editorial-grid">{items.map((entry) => <article className="result-card" key={entry.slug}>
      <p className="eyebrow">{entry.topic || name.toUpperCase()}</p>
      <h2><Link href={`/learn/${kind}/${entry.slug}`}>{entry.title}</Link></h2>
      <p>{entry.summary}</p><p className="meta">By {entry.author} · Reviewed {new Date(entry.published_at).toLocaleDateString("en-PK")}</p>
    </article>)}</div>
    {total > 12 && <nav className="result-pages" aria-label="Collection pages">
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span>
      <button type="button" disabled={page * 12 >= total} onClick={() => setPage(page + 1)}>Next</button>
    </nav>}
  </div>;
}
