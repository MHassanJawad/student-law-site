// Streamed research assistant. The thread lives in React state only; nothing is persisted in the browser.
"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { AssistantEvent, Citation, RelatedRecord } from "@/lib/assistant/assistant";
import { buildHistory, readEvents, safeOfficialUrl, safeSitePath, splitRefs } from "@/lib/assistant/stream";
import { getBrowserClient } from "@/lib/supabase";
import { Loader } from "../loader";

const MAX = 1000;
const STAGES = { planning: "Planning…", searching: "Searching the judgments…", writing: "Writing…", checking: "Checking every reference…" } as const;
type Answer = Extract<AssistantEvent, { type: "answer" }>;
type Turn = { id: number; question: string; answer?: Answer; error?: string; retry?: boolean };

function Text({ text, turn }: { text: string; turn: number }) {
  return <>{text.split(/\n{2,}/).map((para, i) => <p key={i}>{splitRefs(para).map((part, j) =>
    "ref" in part ? <a key={j} href={`#ref-${turn}-${part.ref}`} aria-label={`Reference ${part.ref}`}>[{part.ref}]</a> : <Fragment key={j}>{part.text}</Fragment>)}</p>)}</>;
}

function References({ turn, citations }: { turn: number; citations: Citation[] }) {
  if (!citations.length) return null;
  return <ol className="assistant-refs" aria-label="References">{citations.map((c) => { const sitePath = safeSitePath(c.path); const official = safeOfficialUrl(c.officialUrl); return <li key={c.n} id={`ref-${turn}-${c.n}`}>
    <strong>{c.title}</strong>{c.label && <span className="meta"> · {c.label}</span>}
    <p className="meta">{c.excerpt}</p>
    {sitePath ? <Link href={sitePath}>Open in this site</Link> : null}{official && <>{sitePath ? " · " : ""}<a href={official} rel="noopener noreferrer" target="_blank">Official source</a></>}
  </li>; })}</ol>;
}

function Related({ items }: { items: RelatedRecord[] }) {
  if (!items.length) return null;
  return <><p className="meta">Related records on this site:</p><ul>{items.map((r) => { const path = safeSitePath(r.path); return <li key={r.path}>{path ? <Link href={path}>{r.title}</Link> : r.title}</li>; })}</ul></>;
}

/** The assistant thread, input and streamed progress. */
export function AssistantClient() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<keyof typeof STAGES | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const focusId = useRef<number | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    let active = true;
    getBrowserClient()?.auth.getSession().then(({ data }) => { if (active && !data.session) setSignedOut(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (focusId.current === null) return;
    document.getElementById(`answer-${focusId.current}`)?.focus();
    focusId.current = null;
  }, [turns]);

  const patch = (id: number, p: Partial<Turn>) => setTurns((t) => t.map((x) => x.id === id ? { ...x, ...p } : x));

  async function ask(question: string, id: number, prior: Turn[]) {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true); setStage("planning");
    const history = buildHistory(prior);
    // Restore the question only if the user has not typed something new meanwhile.
    const needSignIn = () => { setSignedOut(true); setTurns((t) => t.filter((x) => x.id !== id)); setInput((cur) => cur || question); };
    let ended = false;
    try {
      const session = await getBrowserClient()?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (controller.signal.aborted) return;
      if (!token) { needSignIn(); return; }
      setSignedOut(false);
      const response = await fetch("/api/v1/assistant", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, history }),
      });
      if (!response.ok || !response.body) {
        if (response.status === 401) { needSignIn(); return; }
        const err = (await response.json().catch(() => null)) as { error?: { code?: string; reason?: string } } | null;
        const code = err?.error?.code;
        patch(id, {
          error: code === "ASSISTANT_DISABLED" ? "The assistant is switched off."
            : response.status === 429 && code !== "QUOTA_EXCEEDED" ? "Too many requests. Wait a moment, then try again."
            : response.status === 429 ? (err?.error?.reason === "global" ? "The assistant has reached today's limit for everyone. Try again tomorrow." : "You've reached today's limit of questions. Try again tomorrow.")
            : response.status === 400 ? "Ask a question of 1 to 1,000 characters." : "The assistant is temporarily unavailable.",
          retry: code === "ASSISTANT_UNAVAILABLE",
        });
        return;
      }
      await readEvents(response.body, (e) => {
        if (e.type === "status") setStage(e.stage);
        else if (e.type === "answer") { ended = true; focusId.current = id; patch(id, { answer: e }); }
        else {
          ended = true;
          patch(id, e.code === "RATE_LIMITED"
            ? { error: `The assistant is busy; try again${e.retryAfterSeconds ? ` in ${e.retryAfterSeconds} seconds` : " shortly"}.` }
            : { error: e.message, retry: true });
        }
      });
      if (!ended) patch(id, { error: "The connection ended before an answer arrived.", retry: true });
    } catch (e) {
      if ((e as Error).name !== "AbortError") patch(id, { error: "Could not reach the assistant.", retry: true });
    } finally {
      if (abortRef.current === controller) { setBusy(false); setStage(null); }
    }
  }

  function submit() {
    const question = input.trim();
    if (!question || busy || question.length > MAX) return;
    const id = nextId.current++;
    setInput("");
    setTurns((t) => [...t, { id, question }]);
    void ask(question, id, turns);
  }

  function retry(turn: Turn) {
    if (busy) return;
    patch(turn.id, { error: undefined, retry: false });
    void ask(turn.question, turn.id, turns.slice(0, turns.findIndex((t) => t.id === turn.id)));
  }

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    setTurns([]); setInput(""); setBusy(false); setStage(null);
  }

  return <div className="page-wrap narrow-page">
    <p className="eyebrow">RESEARCH ASSISTANT</p>
    <h1>Ask AI</h1>
    <p className="intro">Ask a research question. Answers cite the judgments and study notes published on this site.</p>
    {turns.length > 0 && <button className="text-button" type="button" onClick={reset}>New conversation</button>}
    <div aria-live="polite">
      {turns.map((turn) => <section className="assistant-turn" key={turn.id} aria-label={`Question ${turn.id}`}>
        <p className="assistant-question"><span className="eyebrow">YOU ASKED</span><br />{turn.question}</p>
        {turn.answer && <article className="result-card">
          <h2 id={`answer-${turn.id}`} tabIndex={-1}>Answer</h2>
          {turn.answer.outcome === "unverified" && <p className="field-note">This answer could not be verified against its sources. Check the passages below yourself.</p>}
          <Text text={turn.answer.text} turn={turn.id} />
          {turn.answer.outcome === "not_found" && <p className="meta">Coverage note: this site holds Federal Constitutional Court of Pakistan judgments only; legislation has no text yet.</p>}
          <References turn={turn.id} citations={turn.answer.citations} />
          {turn.answer.outcome === "not_found" && <Related items={turn.answer.related} />}
        </article>}
        {turn.error && <p className="field-error" role="alert">{turn.error} {turn.retry && <button className="text-button" type="button" onClick={() => retry(turn)} disabled={busy}>Try again</button>}</p>}
      </section>)}
      {busy && stage && <Loader label={STAGES[stage]} />}
    </div>
    {signedOut && <p className="status-line" role="alert">Sign in to use the assistant. <Link className="button" href="/sign-in">Sign in</Link></p>}
    <form className="assistant-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="field">
        <label htmlFor="assistant-question">Your question</label>
        <textarea id="assistant-question" rows={3} maxLength={MAX} value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
      </div>
      <p className="meta">{input.length} / {MAX}</p>
      <button className="button" type="submit" disabled={busy || !input.trim()}>Ask</button>
    </form>
    <p className="meta">Answers come only from this site&apos;s published sources and can be incomplete. This is educational research, not legal advice.</p>
  </div>;
}
