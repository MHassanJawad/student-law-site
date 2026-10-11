// Published document reading view with source, version, and section navigation.
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase";

type Section = { key: string; heading: string; body: string; order: number };
type Document = {
  id: string; kind: "judgment" | "legislation"; title: string; citation: string | null;
  date: string | null; sourceUrl: string; checkedAt: string; versionId: string;
  text: string | null; textKind: "source" | "extracted" | "ocr" | "none";
  source: { code: string; name: string; attribution: string | null; jurisdiction: string };
  metadata: { authorJudge?: string; caseNumber?: string; bench?: string; jurisdiction?: string;
    instrumentType?: string; enactmentYear?: number; legalStatus?: string;
    sourceFields?: { source_upload_date?: string } };
  sections: Section[];
};

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" }) : "Not verified";
}

/** Show a reviewed public record and allow a signed-in student to save it. */
export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [status, setStatus] = useState("Loading document…");
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/documents/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "This document is not published." : "Document unavailable.");
        return response.json() as Promise<Document>;
      })
      .then((item) => { setDocument(item); setStatus(""); })
      .catch((error: unknown) => { if (!(error instanceof Error && error.name === "AbortError")) setStatus(error instanceof Error ? error.message : "Document unavailable."); });
    return () => controller.abort();
  }, [id]);

  async function saveCitation() {
    const client = getBrowserClient();
    const session = await client?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) { setSaveStatus("Sign in first to save this citation."); return; }
    setSaveStatus("Saving…");
    try {
      const response = await fetch("/api/v1/me/saved-citations", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ documentId: id }),
      });
      setSaveStatus(response.status === 201 ? "Citation saved." : response.status === 409 ? "Already in your saved citations." : "Could not save citation.");
    } catch { setSaveStatus("Could not save citation."); }
  }

  const judgment = document?.kind === "judgment";
  return <div className="page-wrap document-page">
    <Link className="back-link" href={`/search?mode=${judgment ? "case-law" : "statutes"}`}>&larr; Back to research</Link>
    {status && <p role="status">{status}</p>}
    {document && <article className="document-article">
      <div className="document-kicker"><span>{judgment ? "JUDGMENT" : "LEGISLATION"}</span><span>{document.source?.name ?? "Reviewed source"}</span>
        {document.source?.code?.endsWith("_SAMPLE") && <span>LOCAL SAMPLE</span>}</div>
      <h1 id="overview">{document.title}</h1>
      <p className="intro">{judgment ? "Reviewed judgment record" : "Reviewed legislation record"} · Source checked {formatDate(document.checkedAt)}</p>
      <div className="document-layout">
        <div>
          <dl className="document-meta">
            {judgment ? <>
              <div><dt>Case identifier</dt><dd>{document.metadata.caseNumber ?? "Not recorded"}</dd></div>
              <div><dt>Reporter citation</dt><dd>{document.citation ?? "Not verified"}</dd></div>
              <div><dt>Decision date</dt><dd>{formatDate(document.date)}</dd></div>
              <div><dt>Author judge</dt><dd>{document.metadata.authorJudge ?? "Not recorded"}</dd></div>
              <div><dt>Bench</dt><dd>{document.metadata.bench ?? "Not recorded"}</dd></div>
              <div><dt>Source upload date</dt><dd>{formatDate(document.metadata.sourceFields?.source_upload_date)}</dd></div>
            </> : <>
              <div><dt>Official citation</dt><dd>{document.citation ?? "Not recorded"}</dd></div>
              <div><dt>Jurisdiction</dt><dd>{document.metadata.jurisdiction ?? "Not recorded"}</dd></div>
              <div><dt>Instrument type</dt><dd>{document.metadata.instrumentType ?? "Not recorded"}</dd></div>
              <div><dt>Enactment year</dt><dd>{document.metadata.enactmentYear ?? "Not recorded"}</dd></div>
              <div><dt>Legal status</dt><dd>{document.metadata.legalStatus?.replaceAll("_", " ") ?? "Unknown"}</dd></div>
            </>}
          </dl>
          <div className="document-actions" id="source">
            <a className="button" href={document.sourceUrl} target="_blank" rel="noopener noreferrer">Open official source ?</a>
            <button className="button button-secondary" type="button" onClick={saveCitation}>Save citation</button>
          </div>
          <p className="status-line" aria-live="polite">{saveStatus}</p>
          <section className="text-panel document-section" id="document-text">
            <p className="eyebrow">CURRENT REVIEWED VERSION</p><h2>Document text</h2>
            {document.sections.length > 0 ? <p>Navigate the reviewed sections using the contents list.</p>
              : document.text ? <p className="document-text">{document.text}</p>
                : <p>This record currently contains reviewed metadata. Open the official source to read the document while its text is being prepared.</p>}
          </section>
          {document.sections.map((section) => <section className="text-panel document-section" key={section.key} id={`section-${section.key}`}>
            <h2>{section.heading}</h2><p className="document-text">{section.body}</p>
          </section>)}
        </div>
        <aside className="document-aside" aria-label="Document contents and provenance">
          <strong>On this page</strong><a href="#overview">Overview</a><a href="#source">Official source</a>
          <a href="#document-text">Document text</a>
          {document.sections.map((section) => <a key={section.key} href={`#section-${section.key}`}>{section.heading}</a>)}
          <hr />
          <p><strong>Source</strong><br />{document.source?.attribution ?? document.source?.name ?? "Source not recorded"}</p>
          <p><strong>Checked</strong><br />{formatDate(document.checkedAt)}</p>
          <p><strong>Version reference</strong><br /><code>{document.versionId.slice(0, 8)}</code></p>
          {document.source?.code?.endsWith("_SAMPLE") && <p>This metadata sample is for local testing. Source text and current legal status have not been verified for publication.</p>}
          <p>Verify legal status and wording at the official source.</p>
        </aside>
      </div>
    </article>}
  </div>;
}
