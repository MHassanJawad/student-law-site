// Server-only: shapes retrieval output into numbered, budgeted sources. Primary passages only, never AI summaries.
export type RetrievedPassage = {
  source_type: "judgment" | "editorial"; document_id: string | null; entry_id: string | null; title: string;
  case_number: string | null; decision_date: string | null; paragraph_label: string | null; ordinal: number | null;
  body: string; path: string; official_url: string | null; rank: number;
};
export type RetrieveResult = { passages: RetrievedPassage[]; related: { document_id: string; title: string; kind: string; path: string }[] };
export type Source = { id: string; kind: "judgment" | "editorial"; title: string; label: string | null; body: string; path: string; officialUrl: string | null };

const MIN_SOURCE_CHARS = 200;

export function packSources(passages: RetrievedPassage[], maxChars = 12000, maxSources = 8): Source[] {
  const out: Source[] = [];
  const seen = new Set<string>();
  let used = 0;
  for (const p of passages) {
    if (out.length >= maxSources) break;
    let body = p.body.trim();
    if (!body || seen.has(body)) continue;
    const room = maxChars - used;
    if (body.length > room) {
      if (room < MIN_SOURCE_CHARS) break;
      const cut = body.slice(0, room - 1);
      body = cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).trimEnd() + "…";
    }
    seen.add(p.body.trim());
    used += body.length;
    const label = p.source_type === "editorial" ? null : p.paragraph_label ? `para ${p.paragraph_label}` : `passage ${p.ordinal ?? out.length + 1}`;
    out.push({ id: `S${out.length + 1}`, kind: p.source_type, title: p.title, label, body, path: p.path, officialUrl: p.official_url });
    if (used >= maxChars) break;
  }
  return out;
}
