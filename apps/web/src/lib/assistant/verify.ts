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
const caseKey = (s: string) => s.toLowerCase().replace(/\b(?:no|of|and)\b/g, "").replace(/[^a-z0-9]/g, "");
// The year suffix extractCaseNumbers accepts: "of 2025", "/2025", "-2025".
const YEAR = /(?:\s+of\s+|\s*[/-]\s*)\d{4}$/i;
// Yearless numbers get a "#" so "CPLA 12345" can never equal "CPLA 1/2345".
const caseId = (c: string) => (YEAR.test(c) ? caseKey(c) : `${caseKey(c)}#`);
// A bracketed "S<digit>" left once valid groups are removed: "[s9]", "[S1-S3]", "【S1】", "(S2)".
const STRAY_CITATION = /[[【(（]\s*S\s*\d/i;

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
  if (order.some((id) => !byId.has(id)) || STRAY_CITATION.test(body.replace(CITATION, ""))) problems.add("unknown_citation");
  const cited = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);

  const pool = (ids.length ? cited : sources).map((s) => plain(s.body));
  const quotes = [...plain(body).matchAll(/"([^"]*)"/g)].map((m) => m[1].trim()).filter((q) => q.length >= MIN_QUOTE_CHARS);
  if (quotes.some((q) => !pool.some((b) => b.includes(q)))) problems.add("unmatched_quote");

  // Whole case numbers only: an answer number must equal one the sources contain; a yearless one may match a source number minus its year.
  const known = new Set(sources.flatMap((s) => extractCaseNumbers(`${s.title}\n${s.body}`)).flatMap((c) => [caseId(c), caseId(c.replace(YEAR, ""))]));
  if (extractCaseNumbers(body).some((c) => !known.has(caseId(c)))) problems.add("unsupported_case_reference");

  if (problems.size) return { ok: false, outcome, text: body, cited, problems: [...problems] };
  const n = new Map(order.map((id, i) => [id, i + 1]));
  const text = body.replace(CITATION, (g) => g.match(/S\d+/g)!.map((id) => `[${n.get(id)}]`).join(""));
  return { ok: true, outcome, text, cited, problems: [] };
}
