// Authenticated list and deletion of owner-only saved citations.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPublicConfig } from "@/lib/config";
import { getBrowserClient } from "@/lib/supabase";

type Saved = { id: string; document_id: string; citation_snapshot: string; note: string | null; folder: string | null; created_at: string; updated_at: string };

/** Loads the signed-in user's saved items through the owner-scoped API. */
export default function SavedPage() {
  const [items, setItems] = useState<Saved[]>([]);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState(getPublicConfig() ? "Loading saved citations…" : "Account service is not configured.");
  const [token, setToken] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [draftFolder, setDraftFolder] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    const client = getBrowserClient();
    client?.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const accessToken = data.session?.access_token ?? null;
      setToken(accessToken);
      if (!accessToken) { setMessage("Sign in to view your saved citations."); return; }
      try {
        const response = await fetch("/api/v1/me/saved-citations", { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!response.ok) throw new Error("Failed to load");
        const body = (await response.json()) as { items: Saved[]; total: number };
        if (active) { setItems(body.items); setTotal(body.total); setMessage(body.items.length ? "" : "No saved citations yet."); }
      } catch { if (active) setMessage("Saved citations are unavailable. Please try again."); }
    });
    return () => { active = false; };
  }, []);

  const folders = useMemo(() => [...new Set(items.map((item) => item.folder).filter((value): value is string => Boolean(value)))].sort(), [items]);
  const visible = useMemo(() => items.filter((item) => {
    const search = query.trim().toLocaleLowerCase();
    return (!folderFilter || item.folder === folderFilter)
      && (!search || `${item.citation_snapshot} ${item.note ?? ""} ${item.folder ?? ""}`.toLocaleLowerCase().includes(search));
  }), [items, query, folderFilter]);

  function beginEdit(item: Saved) {
    setEditingId(item.id);
    setDraftNote(item.note ?? "");
    setDraftFolder(item.folder ?? "");
    setMessage("");
  }

  async function saveEdit(id: string) {
    if (!token) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/v1/me/saved-citations/${id}`, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ note: draftNote, folder: draftFolder }),
      });
      if (!response.ok) throw new Error("Update failed");
      const updated = (await response.json()) as Saved;
      setItems((current) => current.map((item) => item.id === id ? updated : item));
      setEditingId(null);
      setMessage("Citation updated.");
    } catch { setMessage("Could not update citation. Please try again."); }
    finally { setWorking(false); }
  }

  async function remove(item: Saved) {
    if (!token || !window.confirm(`Remove ${item.citation_snapshot} from your library?`)) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/v1/me/saved-citations/${item.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (response.status !== 204) throw new Error("Delete failed");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setTotal((current) => current - 1);
      setMessage("Citation removed.");
    } catch { setMessage("Could not remove citation. Please try again."); }
    finally { setWorking(false); }
  }

  async function exportLibrary() {
    if (!token) return;
    setWorking(true);
    try {
      const response = await fetch("/api/v1/me/export", { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "student-law-library.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Library exported.");
    } catch { setMessage("Could not export your library."); }
    finally { setWorking(false); }
  }

  async function signOut() {
    await getBrowserClient()?.auth.signOut();
    setToken(null);
    setItems([]);
    setMessage("Signed out.");
  }

  return <div className="page-wrap narrow-page">
    <p className="eyebrow">PERSONAL LIBRARY</p>
    <h1>Saved citations</h1>
    <p className="intro">Keep research notes and folders with your references. Your library follows your account across sessions.</p>
    <p aria-live="polite" className="status-line">{message}</p>
    {!token && <Link className="button" href="/sign-in">Sign in</Link>}
    {token && <>
      <div className="library-toolbar">
        <label className="field">Search your library<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Citation, note, or folder" /></label>
        <label className="field">Folder<select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}><option value="">All folders</option>{folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select></label>
      </div>
      <p className="meta">Showing {visible.length} of {total} saved citations{total > items.length ? " (newest 500 loaded; export includes all)" : ""}.</p>
      <div className="library-actions"><button className="text-button" onClick={exportLibrary} disabled={working}>Export library</button><Link href="/account">Account settings</Link><button className="text-button" onClick={signOut}>Sign out</button></div>
      {items.length > 0 && visible.length === 0 && <p className="empty-state">No citations match these filters.</p>}
      {visible.map((item) => <article className="result-card saved-row" key={item.id}>
        <div className="saved-content">
          <p className="eyebrow">{item.folder || "SAVED REFERENCE"}</p>
          <h2><Link href={`/documents/${item.document_id}`}>{item.citation_snapshot}</Link></h2>
          <p className="meta">Saved {new Date(item.created_at).toLocaleDateString("en-PK")}</p>
          {editingId === item.id ? <div className="saved-editor">
            <label className="field">Folder<input maxLength={80} value={draftFolder} onChange={(event) => setDraftFolder(event.target.value)} /></label>
            <label className="field">Research note<textarea maxLength={2000} rows={4} value={draftNote} onChange={(event) => setDraftNote(event.target.value)} /></label>
            <div className="library-actions"><button className="button" disabled={working} onClick={() => saveEdit(item.id)}>Save changes</button><button className="text-button" onClick={() => setEditingId(null)}>Cancel</button></div>
          </div> : item.note && <p className="saved-note">{item.note}</p>}
        </div>
        <div className="saved-controls"><button className="text-button" onClick={() => beginEdit(item)}>Edit</button><button className="remove-button" disabled={working} onClick={() => remove(item)} aria-label={`Remove ${item.citation_snapshot}`}>Remove</button></div>
      </article>)}
    </>}
  </div>;
}
