// Server-only orchestrator: plan, retrieve, answer, verify. Emits exactly one answer or error. Never logs question or answer text.
import { generateAnswer } from "./answer";
import type { AssistantConfig } from "./config";
import { LlmError, type ChatMessage } from "./llm";
import { planQuestion } from "./planner";
import { packSources, type RetrieveResult, type Source } from "./sources";
import { verifyAnswer, type Outcome } from "./verify";

export type Citation = { n: number; title: string; label: string | null; path: string; officialUrl: string | null; excerpt: string };
export type RelatedRecord = { title: string; path: string };
export type AssistantEvent =
  | { type: "status"; stage: "planning" | "searching" | "writing" | "checking" }
  | { type: "answer"; outcome: Outcome | "unverified"; text: string; citations: Citation[]; related: RelatedRecord[] }
  | { type: "error"; code: "RATE_LIMITED" | "TIMEOUT" | "UNAVAILABLE"; message: string; retryAfterSeconds?: number };

const GREETING = "Hello! I can help you research Pakistani law using this site's published judgments and study notes, with citations to the passages I rely on. This is not legal advice.";
const DECLINED = "I can only help with research questions answered by this site's published judgments and study notes. This is not legal advice.";
const NOT_FOUND = "I couldn't find anything in the site's published sources that answers this. This site holds Federal Constitutional Court of Pakistan judgments only; legislation has no text yet.";
const UNVERIFIED = "I couldn't produce an answer I could verify against the sources. Here are the most relevant passages I found.";
const MAX_CLARIFY_CHARS = 300;
const EXCERPT_CHARS = 280;
const ERROR_MESSAGES = {
  RATE_LIMITED: "The assistant is busy right now. Try again shortly.",
  TIMEOUT: "The assistant took too long to answer. Try again.",
  UNAVAILABLE: "The assistant is temporarily unavailable. Try again later.",
} as const;

const citations = (sources: Source[]): Citation[] =>
  sources.map((s, i) => ({ n: i + 1, title: s.title, label: s.label, path: s.path, officialUrl: s.officialUrl, excerpt: s.body.slice(0, EXCERPT_CHARS) }));

export async function answerQuestion(
  input: { question: string; history: ChatMessage[] },
  deps: { config: AssistantConfig; retrieve: (queries: string[]) => Promise<RetrieveResult>; plan?: typeof planQuestion; answer?: typeof generateAnswer },
  emit: (e: AssistantEvent) => void,
  signal: AbortSignal,
): Promise<{ outcome: string; promptTokens: number; completionTokens: number }> {
  const { config, retrieve, plan = planQuestion, answer = generateAnswer } = deps;
  const { question, history } = input;
  // shortcut: planQuestion/generateAnswer do not expose token usage, so counts are 0; thread usage through them to log real counts.
  const done = (outcome: string) => ({ outcome, promptTokens: 0, completionTokens: 0 });
  const reply = (outcome: Outcome | "unverified", text: string, cited: Source[] = [], related: RelatedRecord[] = []) => {
    emit({ type: "answer", outcome, text, citations: citations(cited), related });
    return done(outcome);
  };
  const check = () => { if (signal.aborted) throw signal.reason; };

  try {
    emit({ type: "status", stage: "planning" });
    const p = await plan(config, question, history, signal);
    check();
    if (p.intent === "greeting") return reply("answered", GREETING);
    // Never search for out-of-scope requests, even when the plan carries appended case numbers.
    if (p.intent === "out_of_scope") return reply("declined", DECLINED);
    if (p.clarification) return reply("clarify", p.clarification.slice(0, MAX_CLARIFY_CHARS));

    emit({ type: "status", stage: "searching" });
    const found = await retrieve(p.searchQueries);
    check();
    const related = found.related.map((r) => ({ title: r.title, path: r.path }));
    const sources = packSources(found.passages);
    if (!sources.length) return reply("not_found", NOT_FOUND, [], related);

    emit({ type: "status", stage: "writing" });
    const raw = await answer(config, question, history, sources, signal);
    check();
    emit({ type: "status", stage: "checking" });
    const v = verifyAnswer(raw, sources);
    // NOT_FOUND and DECLINE carry no citations, so their bodies are unverifiable: show fixed copy only.
    if (v.outcome === "not_found") return reply("not_found", NOT_FOUND, [], related);
    if (v.outcome === "declined" && !v.problems.includes("missing_marker")) return reply("declined", DECLINED);
    if (v.ok && v.outcome === "clarify") return reply("clarify", v.text.slice(0, MAX_CLARIFY_CHARS));
    if (v.ok) return reply("answered", v.text, v.cited);
    return reply("unverified", UNVERIFIED, sources.slice(0, 3));
  } catch (error) {
    const timedOut = (signal.reason as { name?: string } | undefined)?.name === "TimeoutError";
    // Client went away: nobody is listening, so end silently.
    if (signal.aborted && !timedOut) return done("aborted");
    const kind = error instanceof LlmError ? error.kind : null;
    const code = timedOut || kind === "timeout" ? "TIMEOUT" : kind === "rate_limited" ? "RATE_LIMITED" : "UNAVAILABLE";
    const retryAfterSeconds = code === "RATE_LIMITED" ? (error as LlmError).retryAfterSeconds : undefined;
    emit({ type: "error", code, message: ERROR_MESSAGES[code], ...(retryAfterSeconds ? { retryAfterSeconds } : {}) });
    return done("error");
  }
}
