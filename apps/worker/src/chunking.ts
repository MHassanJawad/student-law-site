// Splits extracted judgment text into citable passages with source offsets and paragraph labels.

export const CHUNKER_VERSION = "chunks-v1";
export const CHUNK_TARGET_CHARS = 1600;
export const CHUNK_MAX_CHARS = 2400;

export type TextChunk = {
  ordinal: number;
  body: string;
  charStart: number;
  charEnd: number;
  /** Number of the first numbered paragraph in the chunk, e.g. "12". */
  paragraphLabel: string | null;
};

type Span = { start: number; end: number; label: string | null };

const NUMBERED = /^\s*(\d{1,3})\.\s/;

/** Cut [start, end) into pieces of at most CHUNK_MAX_CHARS, preferring sentence ends, then whitespace. */
function splitLong(text: string, start: number, end: number): Array<[number, number]> {
  const pieces: Array<[number, number]> = [];
  while (end - start > CHUNK_MAX_CHARS) {
    const window = text.slice(start, start + CHUNK_MAX_CHARS);
    let cut = -1;
    for (const m of window.matchAll(/\.(?=\s+[A-Z])/g)) cut = m.index + 1;
    if (cut <= 0) cut = window.search(/\s\S*$/); // last whitespace
    if (cut <= 0) cut = CHUNK_MAX_CHARS; // no whitespace at all: hard cut
    pieces.push([start, start + cut]);
    start += cut;
    while (start < end && /\s/.test(text[start]!)) start++;
  }
  pieces.push([start, end]);
  return pieces;
}

/** Paragraph spans: a blank line or a line starting with a paragraph number begins a new one. */
function paragraphs(text: string): Span[] {
  const spans: Span[] = [];
  let cur = null as { start: number; end: number } | null;
  const flush = () => {
    if (!cur) return;
    const label = NUMBERED.exec(text.slice(cur.start, cur.end))?.[1] ?? null;
    splitLong(text, cur.start, cur.end).forEach(([s, e], i) => spans.push({ start: s, end: e, label: i === 0 ? label : null }));
    cur = null;
  };
  let pos = 0;
  for (const line of text.split("\n")) {
    const lineEnd = pos + line.length;
    if (line.trim() === "") flush();
    else {
      if (cur && NUMBERED.test(line)) flush();
      const start = pos + (line.length - line.trimStart().length);
      cur = { start: cur?.start ?? start, end: pos + line.trimEnd().length };
    }
    pos = lineEnd + 1;
  }
  flush();
  return spans;
}

/**
 * Pack consecutive paragraphs into chunks of about CHUNK_TARGET_CHARS.
 *
 * @param text - Full extracted judgment text.
 * @returns Chunks in order; `text.slice(charStart, charEnd).trim() === body`.
 */
export function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let group: Span[] = [];
  const flush = () => {
    if (group.length === 0) return;
    const charStart = group[0]!.start;
    const charEnd = group[group.length - 1]!.end;
    chunks.push({
      ordinal: chunks.length,
      body: text.slice(charStart, charEnd).trim(),
      charStart,
      charEnd,
      paragraphLabel: group.find((p) => p.label)?.label ?? null,
    });
    group = [];
  };
  for (const p of paragraphs(text)) {
    if (group.length > 0 && p.end - group[0]!.start > CHUNK_TARGET_CHARS) flush();
    group.push(p);
  }
  flush();
  return chunks;
}
