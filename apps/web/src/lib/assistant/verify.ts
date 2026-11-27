// Server-only: code, not the model, decides whether an answer may be shown. Fails closed. Never logs answer text.
import { extractCaseNumbers } from "./planner";
import type { Source } from "./sources";

export type Outcome = "answered" | "not_found" | "clarify" | "declined";
export type Problem = "missing_marker" | "no_citations" | "unknown_citation" | "unmatched_quote" | "unsupported_case_reference";
export type VerifiedAnswer = { ok: boolean; outcome: Outcome; text: string; cited: Source[]; problems: Problem[] };

const OUTCOMES: Record<string, Outcome> = { ANSWER: "answered", NOT_FOUND: "not_found", CLARIFY: "clarify", DECLINE: "declined" };
// Accepts "ANSWER:", "**ANSWER:**" and "**ANSWER**:" after leading whitespace.
const MARKER = /^\s*(?:\*\*)?(ANSWER|NOT_FOUND|CLARIFY|DECLINE)(?:\*\*)?:(?:\*\*)?/;
// One citation group: "[S1]" or "[S1, S3]".
const CITATION = /\[\s*S\d+(?:\s*,\s*S\d+)*\s*\]/g;
const MIN_QUOTE_CHARS = 20;

const plain = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
// "C.P.L.A. No. 544-P of 2025" and "CPLA No.544-P/2025" both become "cpla544p2025".
// shortcut: substring match on squashed text could accept a number glued from neighbouring text; tighten if false accepts show up.
const caseKey = (s: string) => s.toLowerCase().replace(/\b(?:no|of)\b/g, "").replace(/[^a-z0-9]/g, "");

export function verifyAnswer(raw: string, sources: Source[]): VerifiedAnswer {
  const problems = new Set<Problem>();
  const marker = MARKER.exec(raw);
  // A reply without a marker is treated as declined and never shown.
  const outcome: Outcome = marker ? OUTCOMES[marker[1]] : "declined";
  if (!marker) problems.add("missing_marker");
  const body = (marker ? raw.slice(marker[0].length) : raw).trim();

  const byId = new Map(sources.map((s) => [s.id, s]));
  const ids = [...body.matchAll(CITATION)].flatMap((m) => m[0].match(/S\d+/g)!);
  const order = [...new Set(ids)];
  if (outcome === "answered" && ids.length === 0) problems.add("no_citations");
  if (order.some((id) => !byId.has(id))) problems.add("unknown_citation");
  const cited = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);

  const pool = (ids.length ? cited : sources).map((s) => plain(s.body));
  const quotes = [...plain(body).matchAll(/"([^"]*)"/g)].map((m) => m[1].trim()).filter((q) => q.length >= MIN_QUOTE_CHARS);
  if (quotes.some((q) => !pool.some((b) => b.includes(q)))) problems.add("unmatched_quote");

  const haystacks = sources.flatMap((s) => [caseKey(s.title), caseKey(s.body)]);
  if (extractCaseNumbers(body).some((c) => !haystacks.some((h) => h.includes(caseKey(c))))) problems.add("unsupported_case_reference");

  if (problems.size) return { ok: false, outcome, text: body, cited, problems: [...problems] };
  const n = new Map(order.map((id, i) => [id, i + 1]));
  const text = body.replace(CITATION, (g) => g.match(/S\d+/g)!.map((id) => `[${n.get(id)}]`).join(""));
  return { ok: true, outcome, text, cited, problems: [] };
}
