// Document detail shows provenance and the current approved text status.
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase";

type Document = { id: string; title: string; citation: string | null; date: string | null; sourceUrl: string; checkedAt: string; text: string | null; textKind: string; metadata: { authorJudge?: string; caseNumber?: string; sourceFields?: { source_upload_date?: string } } };

/** Displays one document and lets a signed-in student save its citation. */
export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [status, setStatus] = useState("Loading document...");
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/v1/documents/${encodeURIComponent(id)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Document unavailable");
        return response.json() as Promise<Document>;
      })
      .then((item) => { if (active) { setDocument(item); setStatus(""); } })
      .catch(() => { if (active) setStatus("Document unavailable. Please try again later."); });
    return () => { active = false; };
  }, [id]);

  async function saveCitation() {
    const client = getBrowserClient();
    const session = await client?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) { setSaveStatus("Sign in first to save this citation."); return; }
    setSaveStatus("Saving...");
    try {
      const response = await fetch("/api/v1/me/saved-citations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ documentId: id }),
      });
      setSaveStatus(response.status === 201 ? "Citation saved." : response.status === 409 ? "Already in your saved citations." : "Could not save citation.");
    } catch { setSaveStatus("Could not save citation."); }
  }

  return (
    <div className="page-wrap narrow-page">
      <Link className="back-link" href="/search">&larr; Back to search</Link>
      {status && <p role="status">{status}</p>}
      {document && <article className="document-article">
        <p className="eyebrow">FEDERAL CONSTITUTIONAL COURT OF PAKISTAN</p>
        <h1>{document.title}</h1>
        <div className="document-meta">
          <p><strong>Case identifier:</strong> {document.metadata.caseNumber ?? "Unavailable"}</p>
          <p><strong>Reporter citation:</strong> {document.citation === document.metadata.caseNumber ? "Not verified" : document.citation ?? "Not verified"}</p>
          <p><strong>Decision date:</strong> {document.date ?? "Not verified"}</p>
          <p><strong>Author judge:</strong> {document.metadata.authorJudge ?? "Not recorded"}</p>
          <p><strong>Source upload date:</strong> {document.metadata.sourceFields?.source_upload_date ?? "Not recorded"}</p>
          <p><strong>Last checked:</strong> {new Date(document.checkedAt).toLocaleDateString("en-PK")}</p>
        </div>
        <div className="document-actions">
          <a className="button" href={document.sourceUrl} target="_blank" rel="noopener noreferrer">{new URL(document.sourceUrl).pathname.startsWith("/download/") ? "Open official PDF" : "View official listing"}</a>
          <button className="button button-secondary" onClick={saveCitation}>Save citation</button>
        </div>
        <p className="status-line" aria-live="polite">{saveStatus}</p>
        <section className="text-panel"><h2>Document text</h2>
          {document.text ? <p className="document-text">{document.text}</p> : <p>The pilot record contains official listing metadata only. Read the judgment at the official source while text extraction is being validated.</p>}
        </section>
      </article>}
    </div>
  );
}
