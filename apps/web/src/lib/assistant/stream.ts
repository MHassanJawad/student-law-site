// Client-safe pure helpers: NDJSON line parsing and [n] reference splitting. Types only from the server module.
import type { AssistantEvent } from "./assistant";

/** Reads an NDJSON body, buffering partial lines and handling a final line with no newline. Malformed lines are skipped. */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (e: AssistantEvent) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flush = (line: string) => {
    if (!line.trim()) return;
    try { onEvent(JSON.parse(line) as AssistantEvent); } catch { /* skip malformed line */ }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(flush);
  }
  flush(buffer + decoder.decode());
}

export type Part = { text: string } | { ref: number };

/** Splits text into plain strings and `[n]` reference markers; no HTML is ever produced. */
export function splitRefs(text: string): Part[] {
  return text.split(/(\[\d{1,3}\])/).filter(Boolean).map((s) => {
    const m = /^\[(\d{1,3})\]$/.exec(s);
    return m ? { ref: Number(m[1]) } : { text: s };
  });
}

/** Returns the URL only when it is plain http(s); anything else (javascript:, data:) is dropped. */
export const safeOfficialUrl = (url: string | null): string | null => (url && /^https?:\/\//i.test(url) ? url : null);

/** Returns the path only when it is site-relative and not protocol-relative ("//x" or "/\x", which browsers treat alike). */
export const safeSitePath = (path: string): string | null => (path.startsWith("/") && path[1] !== "/" && path[1] !== "\\" ? path : null);

// The server's per-item history limit.
const MAX_HISTORY_CHARS = 4000;

/** Last 8 messages: only answered turns, with [n] markers stripped (they point at citations the planner never sees), each cut to 4,000 characters. */
export function buildHistory(turns: { question: string; answer?: { outcome: string; text: string } }[]): { role: "user" | "assistant"; content: string }[] {
  return turns
    .filter((t) => t.answer?.outcome === "answered")
    .flatMap((t) => [{ role: "user" as const, content: t.question }, { role: "assistant" as const, content: t.answer!.text.replace(/\s*\[\d{1,3}\]/g, "") }])
    .map((m) => ({ ...m, content: m.content.slice(0, MAX_HISTORY_CHARS) }))
    .slice(-8);
}
