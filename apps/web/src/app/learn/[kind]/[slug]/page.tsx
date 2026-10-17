// Public reading page for one reviewed learning entry.
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EDITORIAL_KIND, EDITORIAL_LABEL } from "@/lib/editorial";

type Entry = { title: string; summary: string; body: string; author: string; topic: string | null;
  source_url: string | null; provenance_note: string; published_at: string; reviewed_at: string };

/** Shows body and provenance for a published editorial entry. */
export default function EditorialEntryPage() {
  const { kind, slug } = useParams<{ kind: string; slug: string }>();
  const collection = EDITORIAL_KIND.safeParse(kind);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [message, setMessage] = useState("Loading entry…");

  useEffect(() => {
    if (!collection.success) return;
    const controller = new AbortController();
    fetch(`/api/v1/editorial/${kind}/${slug}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "This entry is not published." : "Entry unavailable.");
        return response.json() as Promise<Entry>;
      })
      .then((data) => { setEntry(data); setMessage(""); })
      .catch((error: unknown) => { if (!(error instanceof Error && error.name === "AbortError")) setMessage(error instanceof Error ? error.message : "Entry unavailable."); });
    return () => controller.abort();
  }, [kind, slug, collection.success]);

  if (!collection.success) return <div className="page-wrap"><h1>Collection not found</h1><Link href="/">Return home</Link></div>;
  return <div className="page-wrap narrow-page">
    <Link className="back-link" href={`/learn/${kind}`}>&larr; Back to {EDITORIAL_LABEL[collection.data]}</Link>
    <p role="status">{message}</p>
    {entry && <article>
      <p className="eyebrow">{entry.topic || EDITORIAL_LABEL[collection.data].toUpperCase()}</p>
      <h1>{entry.title}</h1><p className="intro">{entry.summary}</p>
      <p className="meta">By {entry.author} · Published {new Date(entry.published_at).toLocaleDateString("en-PK")}</p>
      <section className="text-panel"><p className="editorial-body">{entry.body}</p></section>
      <section className="text-panel"><h2>Source and review</h2>
        <p>{entry.provenance_note}</p>
        {entry.source_url && <p><a href={entry.source_url} target="_blank" rel="noopener noreferrer">Open cited source</a></p>}
        <p className="meta">Reviewed {new Date(entry.reviewed_at).toLocaleDateString("en-PK")}. Educational information only; verify primary legal sources.</p>
      </section>
    </article>}
  </div>;
}
