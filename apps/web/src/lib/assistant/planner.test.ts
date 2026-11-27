import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantConfig } from "./config";

vi.mock("./llm", async () => ({ ...(await vi.importActual<typeof import("./llm")>("./llm")), chatCompletion: vi.fn() }));
import { chatCompletion, LlmError } from "./llm";
import { extractCaseNumbers, fallbackPlan, planQuestion, PLANNER_PROMPT_VERSION } from "./planner";

const config: AssistantConfig = { apiKey: "k", apiUrl: "https://llm.test", model: "m", userDailyLimit: 30, globalDailyLimit: 500, timeoutMs: 1000 };
const mock = vi.mocked(chatCompletion);
const reply = (content: string) => mock.mockResolvedValueOnce({ content, promptTokens: 1, completionTokens: 1 });
const plan = (search_queries: unknown, extra: object = {}) => JSON.stringify({ intent: "legal_question", search_queries, clarification: null, ...extra });
const run = (q: string, history: { role: "user" | "assistant"; content: string }[] = []) => planQuestion(config, q, history, new AbortController().signal);

beforeEach(() => mock.mockReset());

describe("planQuestion", () => {
  it("parses a valid plan and caps queries at four", async () => {
    reply(plan(["a", "b", "c", "d", "e", "f"]));
    const p = await run("question");
    expect(p).toEqual({ intent: "legal_question", searchQueries: ["a", "b", "c", "d"], clarification: null });
    expect(PLANNER_PROMPT_VERSION).toBe("planner-v1");
    expect(mock.mock.calls[0][1]).toMatchObject({ temperature: 0, maxTokens: 400, json: true });
  });

  it("resolves follow-up using history", async () => {
    reply(plan(["544-P risk allowance decision"]));
    const p = await run("what did the court decide in it?", [
      { role: "user", content: "Tell me about C.P.L.A. No. 544-P of 2025" },
      { role: "assistant", content: "It concerns a risk allowance." },
    ]);
    const sent = mock.mock.calls[0][1].messages;
    expect(sent[0].role).toBe("system");
    expect(sent.map((m) => m.content).join("\n")).toContain("C.P.L.A. No. 544-P of 2025");
    expect(sent.at(-1)!.content).toContain("what did the court decide in it?");
    expect(p.searchQueries).toEqual(["544-P risk allowance decision"]);
  });

  it("falls back to the raw question on invalid JSON or schema failure", async () => {
    reply("not json");
    expect(await run("what is bail?")).toEqual(fallbackPlan("what is bail?"));
    reply(JSON.stringify({ intent: "bogus", search_queries: [] }));
    expect((await run("what is bail?")).searchQueries).toEqual(["what is bail?"]);
    mock.mockRejectedValueOnce(new LlmError("bad_response"));
    expect((await run("what is bail?")).intent).toBe("legal_question");
  });

  it("adds case numbers found in the question without duplicating, within four queries", async () => {
    reply(plan(["a", "b", "c", "d", "CPLA 3119/2023"]));
    const p = await run("see CPLA 3119/2023 and C.A. 112-K of 2024");
    expect(p.searchQueries.length).toBeLessThanOrEqual(4);
    expect(p.searchQueries).toContain("CPLA 3119/2023");
    expect(p.searchQueries).toContain("C.A. 112-K of 2024");
    expect(p.searchQueries.filter((q) => q === "CPLA 3119/2023")).toHaveLength(1);
  });

  it("drops blank and over-long queries", async () => {
    reply(plan(["  ", "ok", "x".repeat(201), "y".repeat(200)]));
    expect((await run("q")).searchQueries).toEqual(["ok", "y".repeat(200)]);
  });

  it("propagates rate limiting and other non-bad_response errors", async () => {
    mock.mockRejectedValueOnce(new LlmError("rate_limited", 5));
    await expect(run("q")).rejects.toMatchObject({ kind: "rate_limited" });
    mock.mockRejectedValueOnce(new LlmError("timeout"));
    await expect(run("q")).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("fallbackPlan", () => {
  it("uses the truncated question plus case numbers", () => {
    expect(fallbackPlan("x".repeat(300)).searchQueries[0]).toHaveLength(200);
    expect(fallbackPlan("see CPLA 3119/2023").searchQueries).toEqual(["see CPLA 3119/2023"]);
  });
});

describe("extractCaseNumbers", () => {
  it.each([
    "C.P.L.A. No. 544-P of 2025", "C.P.L.A No.5327 of 2024", "CPLA 3119 & 3905", "CPLA 3119/2023", "C.P.L.A.5215/2024",
    "F.C.P.L.A. No. 536 of 2025", "F.C.P.L.A No. 14 of 2025", "C.A. 112-K of 2024", "C.A.192-P of 2010", "Civil Appeal-1243-2020",
    "C.R.P. No. 825/2024", "F.C.R.P. No. 12 of 2023", "C.M.A.37 of 2026", "C.P. No. 9 of 2021", "SMC No. 3 of 2022", "Constitution Petition.64/2018",
  ])("finds %s as written", (form) => {
    expect(extractCaseNumbers(`In ${form}, the court held`)).toEqual([form]);
  });

  it("deduplicates and finds several", () => {
    expect(extractCaseNumbers("see CPLA 3119/2023 and C.A. 112-K of 2024; again CPLA 3119/2023")).toEqual(["CPLA 3119/2023", "C.A. 112-K of 2024"]);
  });

  it("ignores ordinary text", () => {
    expect(extractCaseNumbers("Article 25 of the Constitution, section 3 of 2017 Act, decided on 10.04.2025, USCA 12 of 2020, CA is a state")).toEqual([]);
  });
});
