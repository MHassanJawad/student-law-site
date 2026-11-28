import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssistantConfig } from "./config";
import type { AssistantEvent } from "./assistant";
import { handleAssistantRequest, type HandlerDeps } from "./handler";

const config: AssistantConfig = { apiKey: "k", apiUrl: "https://llm.test", model: "m", userDailyLimit: 30, globalDailyLimit: 500, timeoutMs: 1000 };
const answer: AssistantEvent = { type: "answer", outcome: "answered", text: "ok [1]", citations: [], related: [] };

function deps(over: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    config,
    verifyUser: vi.fn(async () => ({ id: "u1" })),
    consumeQuota: vi.fn(async () => ({ allowed: true, reason: null, remaining: 29, chargeId: "charge-123" })),
    refundQuota: vi.fn(async () => {}),
    retrieve: vi.fn(async () => ({ passages: [], related: [] })),
    run: vi.fn(async (_i, _d, emit) => { emit(answer); return { outcome: "answered", promptTokens: 0, completionTokens: 0 }; }),
    ...over,
  };
}
const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/v1/assistant", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const lines = async (r: Response) => (await r.text()).trim().split("\n").map((l) => JSON.parse(l));

afterEach(() => vi.restoreAllMocks());

describe("handleAssistantRequest", () => {
  it("returns 503 when the assistant is disabled", async () => {
    const r = await handleAssistantRequest(req({ question: "q" }), deps({ config: null }));
    expect(r.status).toBe(503);
    expect((await r.json()).error.code).toBe("ASSISTANT_DISABLED");
  });

  it("returns 403 for another origin", async () => {
    expect((await handleAssistantRequest(req({ question: "q" }, { origin: "https://evil.test" }), deps())).status).toBe(403);
  });

  it("returns 401 without a verified user", async () => {
    expect((await handleAssistantRequest(req({ question: "q" }), deps({ verifyUser: async () => null }))).status).toBe(401);
  });

  it("returns 400 for an empty or over-long question", async () => {
    for (const question of ["   ", "q".repeat(1001)]) {
      const r = await handleAssistantRequest(req({ question }), deps());
      expect(r.status).toBe(400);
      expect((await r.json()).error.code).toBe("INVALID_QUESTION");
    }
  });

  it("truncates over-long history items instead of rejecting them", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const d = deps();
    const r = await handleAssistantRequest(req({ question: "follow-up", history: [{ role: "assistant", content: "a".repeat(6000) }] }), d);
    expect(r.status).toBe(200);
    expect(d.run).toHaveBeenCalledWith({ question: "follow-up", history: [{ role: "assistant", content: "a".repeat(4000) }] }, expect.anything(), expect.any(Function), expect.any(AbortSignal));
  });

  it("rejects a body over 64 KB by content-length or by the text read", async () => {
    const big = { question: "q", history: [{ role: "user", content: "x".repeat(70_000) }] };
    const noLength = new Request("http://localhost/api/v1/assistant", {
      method: "POST", headers: { "content-type": "application/json" },
      body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify(big))); c.close(); } }),
      duplex: "half",
    } as RequestInit);
    expect(noLength.headers.get("content-length")).toBeNull();
    for (const r of [req({ question: "q" }, { "content-length": "70000" }), noLength]) {
      const d = deps();
      const res = await handleAssistantRequest(r, d);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("INVALID_QUESTION");
      expect(d.consumeQuota).not.toHaveBeenCalled();
    }
  });

  it("returns 429 with the quota reason", async () => {
    const r = await handleAssistantRequest(req({ question: "q" }), deps({ consumeQuota: async () => ({ allowed: false, reason: "global", remaining: 0, chargeId: null }) }));
    expect(r.status).toBe(429);
    const body = await r.json();
    expect(body.error).toMatchObject({ code: "QUOTA_EXCEEDED", reason: "global" });
  });

  it("refunds quota and emits one error on provider 429", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const d = deps({
      run: vi.fn(async (_i, _d, emit) => {
        emit({ type: "status", stage: "planning" });
        emit({ type: "error", code: "RATE_LIMITED", message: "busy", retryAfterSeconds: 12 });
        return { outcome: "error", promptTokens: 0, completionTokens: 0 };
      }),
    });
    const r = await handleAssistantRequest(req({ question: "q" }), d);
    expect(r.headers.get("content-type")).toMatch(/^application\/x-ndjson/);
    const errors = (await lines(r)).filter((e) => e.type === "error");
    expect(errors).toEqual([expect.objectContaining({ code: "RATE_LIMITED", retryAfterSeconds: 12 })]);
    expect(d.refundQuota).toHaveBeenCalledTimes(1);
    expect(d.refundQuota).toHaveBeenCalledWith("charge-123");
  });

  it("refunds and emits UNAVAILABLE when the run throws", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const d = deps({ run: vi.fn(async () => { throw new Error("boom"); }) });
    const body = await (await handleAssistantRequest(req({ question: "q" }), d)).text();
    expect(body.trim().split("\n").map((l) => JSON.parse(l))).toEqual([expect.objectContaining({ type: "error", code: "UNAVAILABLE" })]);
    expect(d.refundQuota).toHaveBeenCalledTimes(1);
  });

  it("does not refund a successful answer and logs no text or ids", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const d = deps();
    const r = await handleAssistantRequest(req({ question: "SECRET_QUESTION", history: [{ role: "user", content: "earlier" }] }), d);
    const out = await r.text();
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(out).not.toContain("charge-123");
    expect(d.refundQuota).not.toHaveBeenCalled();
    expect(d.run).toHaveBeenCalledWith({ question: "SECRET_QUESTION", history: [{ role: "user", content: "earlier" }] }, expect.anything(), expect.any(Function), expect.any(AbortSignal));
    expect(info).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(info.mock.calls[0]);
    for (const secret of ["SECRET_QUESTION", "ok [1]", "u1", "charge-123"]) expect(logged).not.toContain(secret);
    expect(JSON.parse(info.mock.calls[0][0] as string)).toMatchObject({ outcome: "answered", promptTokens: 0, completionTokens: 0 });
  });
});
