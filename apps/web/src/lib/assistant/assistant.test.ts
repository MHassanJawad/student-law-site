import { describe, expect, it, vi } from "vitest";
import type { AssistantConfig } from "./config";
import { answerQuestion, type AssistantEvent } from "./assistant";
import { LlmError } from "./llm";
import type { QueryPlan } from "./planner";
import type { RetrievedPassage, RetrieveResult } from "./sources";

const config: AssistantConfig = { apiKey: "k", apiUrl: "https://llm.test", model: "m", userDailyLimit: 30, globalDailyLimit: 500, timeoutMs: 1000 };
const passage = (i: number): RetrievedPassage => ({
  source_type: "judgment", document_id: `d${i}`, entry_id: null, title: `Case ${i}`, case_number: null, decision_date: null,
  paragraph_label: String(i), ordinal: i, body: `Passage ${i} says the right to a fair trial is fundamental. `.repeat(10), path: `/j/${i}`, official_url: null, rank: 1,
});
const related = [{ document_id: "r1", title: "Related One", kind: "judgment", path: "/j/r1" }];
const found: RetrieveResult = { passages: [1, 2, 3, 4].map(passage), related };
const legal: QueryPlan = { intent: "legal_question", searchQueries: ["fair trial"], clarification: null };

function setup(over: { plan?: QueryPlan; answer?: string | (() => Promise<string>); retrieve?: RetrieveResult } = {}) {
  const events: AssistantEvent[] = [];
  const retrieve = vi.fn(async () => over.retrieve ?? found);
  const reply = over.answer ?? "ANSWER: A fair trial is fundamental [S1]. Not legal advice.";
  const answer = vi.fn(typeof reply === "function" ? reply : async () => reply);
  const deps = { config, retrieve, plan: vi.fn(async () => over.plan ?? legal), answer };
  return { events, retrieve, deps, emit: (e: AssistantEvent) => events.push(e) };
}
const answers = (events: AssistantEvent[]) => events.filter((e) => e.type === "answer");

describe("answerQuestion", () => {
  it("emits planning, searching, writing, checking then one answer", async () => {
    const t = setup();
    const r = await answerQuestion({ question: "fair trial?", history: [] }, t.deps, t.emit, new AbortController().signal);
    expect(t.events.map((e) => (e.type === "status" ? e.stage : e.type))).toEqual(["planning", "searching", "writing", "checking", "answer"]);
    const a = t.events.at(-1)!;
    expect(a).toMatchObject({ type: "answer", outcome: "answered", text: "A fair trial is fundamental [1]. Not legal advice." });
    if (a.type !== "answer") throw new Error();
    expect(a.citations).toEqual([{ n: 1, title: "Case 1", label: "para 1", path: "/j/1", officialUrl: null, excerpt: passage(1).body.trim().slice(0, 280) }]);
    expect(r).toEqual({ outcome: "answered", promptTokens: 0, completionTokens: 0 });
  });

  it("declines out-of-scope questions without retrieving", async () => {
    const t = setup({ plan: { intent: "out_of_scope", searchQueries: ["CPLA 1 of 2025"], clarification: null } });
    await answerQuestion({ question: "write my essay", history: [] }, t.deps, t.emit, new AbortController().signal);
    expect(t.retrieve).not.toHaveBeenCalled();
    expect(answers(t.events)).toEqual([expect.objectContaining({ outcome: "declined", citations: [] })]);
  });

  it("greets with fixed copy without retrieving", async () => {
    const t = setup({ plan: { intent: "greeting", searchQueries: [], clarification: null } });
    await answerQuestion({ question: "hi", history: [] }, t.deps, t.emit, new AbortController().signal);
    expect(t.retrieve).not.toHaveBeenCalled();
    expect(answers(t.events)).toEqual([expect.objectContaining({ outcome: "answered", citations: [] })]);
  });

  it("caps a planner clarification at 300 characters", async () => {
    const t = setup({ plan: { intent: "legal_question", searchQueries: ["x"], clarification: "q".repeat(500) } });
    await answerQuestion({ question: "?", history: [] }, t.deps, t.emit, new AbortController().signal);
    const [a] = answers(t.events);
    expect(a).toMatchObject({ outcome: "clarify", citations: [] });
    expect(a.type === "answer" && a.text.length).toBe(300);
    expect(t.retrieve).not.toHaveBeenCalled();
  });

  it("returns not_found with related records when nothing matches", async () => {
    const t = setup({ retrieve: { passages: [], related } });
    await answerQuestion({ question: "q", history: [] }, t.deps, t.emit, new AbortController().signal);
    const [a] = answers(t.events);
    expect(a).toMatchObject({ outcome: "not_found", citations: [], related: [{ title: "Related One", path: "/j/r1" }] });
    expect(a.type === "answer" && a.text).toContain("Federal Constitutional Court of Pakistan judgments only");
  });

  it("replaces a model NOT_FOUND body with fixed copy", async () => {
    const t = setup({ answer: "NOT_FOUND: click http://evil.test" });
    await answerQuestion({ question: "q", history: [] }, t.deps, t.emit, new AbortController().signal);
    const [a] = answers(t.events);
    expect(a).toMatchObject({ outcome: "not_found", citations: [] });
    expect(a.type === "answer" && a.text).not.toContain("evil");
  });

  it("falls back to unverified with top passages when verification fails", async () => {
    const t = setup({ answer: "ANSWER: MODEL_TEXT with no citations" });
    await answerQuestion({ question: "q", history: [] }, t.deps, t.emit, new AbortController().signal);
    const [a] = answers(t.events);
    if (a.type !== "answer") throw new Error();
    expect(a.outcome).toBe("unverified");
    expect(a.citations.map((c) => c.n)).toEqual([1, 2, 3]);
    expect(a.text).not.toContain("MODEL_TEXT");
  });

  it("maps a provider 429 to one RATE_LIMITED error", async () => {
    const t = setup({ answer: async () => { throw new LlmError("rate_limited", 12); } });
    const r = await answerQuestion({ question: "q", history: [] }, t.deps, t.emit, new AbortController().signal);
    expect(t.events.filter((e) => e.type === "error" || e.type === "answer")).toEqual([expect.objectContaining({ type: "error", code: "RATE_LIMITED", retryAfterSeconds: 12 })]);
    expect(r.outcome).toBe("error");
  });

  it("reports TIMEOUT when the deadline passes", async () => {
    const t = setup({ answer: async () => { throw new LlmError("timeout"); } });
    const signal = AbortSignal.abort(new DOMException("t", "TimeoutError"));
    await answerQuestion({ question: "q", history: [] }, t.deps, t.emit, signal);
    expect(t.events.at(-1)).toMatchObject({ type: "error", code: "TIMEOUT" });
  });

  it("stops cleanly when the client disconnects", async () => {
    const ac = new AbortController();
    const t = setup({ answer: async () => { ac.abort(); return "ANSWER: A fair trial is fundamental [S1]."; } });
    const r = await answerQuestion({ question: "q", history: [] }, t.deps, t.emit, ac.signal);
    expect(t.events.filter((e) => e.type !== "status")).toEqual([]);
    expect(r.outcome).toBe("aborted");
  });
});
