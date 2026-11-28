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
