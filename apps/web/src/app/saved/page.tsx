// Authenticated list and deletion of owner-only saved citations.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPublicConfig } from "@/lib/config";
import { getBrowserClient } from "@/lib/supabase";

type Saved = { id: string; document_id: string; citation_snapshot: string; created_at: string };

/** Loads the signed-in user's saved items through the owner-scoped API. */
export default function SavedPage() {
  const [items, setItems] = useState<Saved[]>([]);
  const [message, setMessage] = useState(getPublicConfig() ? "Loading saved citations…" : "Account service is not configured.");
  const [token, setToken] = useState<string | null>(null);

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
        const body = (await response.json()) as { items: Saved[] };
        if (active) { setItems(body.items); setMessage(body.items.length ? "" : "No saved citations yet."); }
      } catch { if (active) setMessage("Saved citations are unavailable. Please try again."); }
    });
    return () => { active = false; };
  }, []);

  async function remove(id: string) {
    if (!token) return;
    const response = await fetch(`/api/v1/me/saved-citations/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 204) { setItems((current) => current.filter((item) => item.id !== id)); setMessage("Citation removed."); }
    else setMessage("Could not remove citation.");
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
    <p className="intro">Your references belong to your account and remain available in another browser session.</p>
    <p aria-live="polite" className="status-line">{message}</p>
    {!token && <Link className="button" href="/sign-in">Sign in</Link>}
    {token && <button className="text-button" onClick={signOut}>Sign out</button>}
    {items.map((item) => <article className="result-card saved-row" key={item.id}>
      <div><p className="eyebrow">SAVED REFERENCE</p><h2><Link href={`/documents/${item.document_id}`}>{item.citation_snapshot}</Link></h2><p className="meta">Saved {new Date(item.created_at).toLocaleDateString("en-PK")}</p></div>
      <button className="remove-button" onClick={() => remove(item.id)} aria-label={`Remove ${item.citation_snapshot}`}>Remove</button>
    </article>)}
  </div>;
}
