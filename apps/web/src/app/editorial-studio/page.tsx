// Operator-only draft, review, and publication workspace for learning entries.
"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { getBrowserClient } from "@/lib/supabase";

type Entry = { id: string; kind: string; slug: string; title: string; summary: string; body: string;
  author: string; source_url: string | null; provenance_note: string; topic: string | null; status: string };
type Draft = Omit<Entry, "id" | "status">;
const EMPTY_DRAFT: Draft = { kind: "maxim", slug: "", title: "", summary: "", body: "", author: "",
  source_url: null, provenance_note: "", topic: null };

/** Gives a verified content operator a controlled editorial form. */
export default function EditorialStudioPage() {
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [message, setMessage] = useState("Checking editor access…");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const client = getBrowserClient();
      const { data: identity } = await client?.auth.getUser() ?? { data: { user: null } };
      if (!client || !identity.user) { if (active) setMessage("Sign in with an operator account to edit learning content."); return; }
      const { data: profile } = await client.from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
      if (profile?.role !== "operator") { if (active) setMessage("Your account does not have editorial access."); return; }
      if (!active) return;
      setOperatorId(identity.user.id);
      const { data, error } = await client.from("editorial_entries")
        .select("id,kind,slug,title,summary,body,author,source_url,provenance_note,topic,status")
        .order("updated_at", { ascending: false }).limit(100);
      if (active) { setEntries((data ?? []) as Entry[]); setMessage(error ? "Could not load editorial entries." : ""); }
    }
    void load();
    return () => { active = false; };
  }, []);

  function select(entry: Entry | null) {
    setSelectedId(entry?.id ?? null);
    setDraft(entry ? { kind: entry.kind, slug: entry.slug, title: entry.title, summary: entry.summary,
      body: entry.body, author: entry.author, source_url: entry.source_url,
      provenance_note: entry.provenance_note, topic: entry.topic } : EMPTY_DRAFT);
    setMessage("");
  }

  function change(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value || (key === "source_url" || key === "topic" ? null : "") }));
  }

  async function save(status: "draft" | "published" | "archived") {
    if (!operatorId) return;
    if (status === "published" && !window.confirm("Confirm that you reviewed the wording, attribution, source, and publication rights for this entry?")) return;
    const client = getBrowserClient();
    if (!client) return;
    setWorking(true);
    const payload = { ...draft, status, editor_id: operatorId };
    const query = selectedId
      ? client.from("editorial_entries").update(payload).eq("id", selectedId)
      : client.from("editorial_entries").insert(payload);
    const { data, error } = await query.select("id,kind,slug,title,summary,body,author,source_url,provenance_note,topic,status").single();
    setWorking(false);
    if (error || !data) { setMessage("Could not save this entry. Check the required fields, unique slug, and operator role."); return; }
    const saved = data as Entry;
    setEntries((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)]);
    setSelectedId(saved.id);
    setMessage(status === "published" ? "Entry reviewed and published." : status === "archived" ? "Entry archived." : "Draft saved.");
  }

  return <div className="page-wrap narrow-page">
    <p className="eyebrow">EDITORIAL WORKSPACE</p><h1>Learning content</h1>
    <p className="intro">Write original explanations, record provenance, and review each entry before publication.</p>
    <p role="status" className="status-line">{message}</p>
    {!operatorId ? <Link href="/sign-in">Sign in</Link> : <>
      <div className="library-actions"><button className="button button-secondary" type="button" onClick={() => select(null)}>New entry</button></div>
      {entries.length > 0 && <label className="field">Edit an entry
        <select value={selectedId ?? ""} onChange={(event) => select(entries.find((entry) => entry.id === event.target.value) ?? null)}>
          <option value="">New entry</option>{entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.kind}: {entry.title} ({entry.status})</option>)}
        </select></label>}
      <form className="editorial-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void save("draft"); }}>
        <label className="field">Collection<select value={draft.kind} onChange={(event) => change("kind", event.target.value)}><option value="maxim">Maxims</option><option value="article">Articles</option><option value="dictionary">Dictionary</option></select></label>
        <label className="field">URL slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.slug} onChange={(event) => change("slug", event.target.value)} /></label>
        <label className="field">Title<input required minLength={2} maxLength={180} value={draft.title} onChange={(event) => change("title", event.target.value)} /></label>
        <label className="field">Summary<input required minLength={10} maxLength={500} value={draft.summary} onChange={(event) => change("summary", event.target.value)} /></label>
        <label className="field">Body<textarea required minLength={20} maxLength={20000} rows={12} value={draft.body} onChange={(event) => change("body", event.target.value)} /></label>
        <label className="field">Author or editor<input required minLength={2} maxLength={120} value={draft.author} onChange={(event) => change("author", event.target.value)} /></label>
        <label className="field">Topic<input value={draft.topic ?? ""} onChange={(event) => change("topic", event.target.value)} /></label>
        <label className="field">Source URL, if applicable<input type="url" value={draft.source_url ?? ""} onChange={(event) => change("source_url", event.target.value)} /></label>
        <label className="field">Provenance and rights note<textarea required minLength={10} maxLength={500} rows={3} value={draft.provenance_note} onChange={(event) => change("provenance_note", event.target.value)} /></label>
        <div className="library-actions"><button type="submit" disabled={working}>Save draft</button>
          <button type="button" className="button" disabled={working} onClick={(event) => {
            const form = event.currentTarget.closest("form");
            if (form?.reportValidity()) void save("published");
          }}>Review and publish</button>
          {selectedId && <button type="button" className="text-button" disabled={working} onClick={(event) => {
            const form = event.currentTarget.closest("form");
            if (form?.reportValidity()) void save("archived");
          }}>Archive</button>}
        </div>
      </form>
    </>}
  </div>;
}
