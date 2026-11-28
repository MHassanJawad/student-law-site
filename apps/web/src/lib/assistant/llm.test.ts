import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion, LlmError } from "./llm";
import type { AssistantConfig } from "./config";

const config: AssistantConfig = { apiKey: "sk-secret", apiUrl: "https://llm.test/v1/chat", model: "some/model", userDailyLimit: 30, globalDailyLimit: 500, timeoutMs: 1000 };
const request = { messages: [{ role: "user" as const, content: "private question" }], temperature: 0.2, maxTokens: 300 };
const ok = (content: unknown = "hi", usage: object = { prompt_tokens: 11, completion_tokens: 5 }) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), { status: 200 });
const mockFetch = (res: Response | Error) => {
  const fn = vi.fn(async () => { if (res instanceof Error) throw res; return res; });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
};
const sentBody = (fn: ReturnType<typeof mockFetch>) => JSON.parse((fn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
const kindOf = async (p: Promise<unknown>) => p.then(() => null, (e: LlmError) => e);

afterEach(() => vi.restoreAllMocks());

describe("chatCompletion", () => {
  it("sends model, temperature, max_tokens and json mode", async () => {
    const fn = mockFetch(ok());
    await chatCompletion(config, { ...request, json: true }, new AbortController().signal);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(config.apiUrl);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-secret");
    expect(sentBody(fn)).toMatchObject({ model: "some/model", temperature: 0.2, max_tokens: 300, response_format: { type: "json_object" } });
    expect(sentBody(fn).reasoning_effort).toBeUndefined();
  });

  it("adds low reasoning effort for gpt-oss models", async () => {
    const fn = mockFetch(ok());
    await chatCompletion({ ...config, model: "openai/gpt-oss-120b" }, request, new AbortController().signal);
    expect(sentBody(fn).reasoning_effort).toBe("low");
    expect(sentBody(fn).response_format).toBeUndefined();
  });

  it("maps 429 with retry-after to rate_limited", async () => {
    mockFetch(new Response("{}", { status: 429, headers: { "retry-after": "7" } }));
    const e = await kindOf(chatCompletion(config, request, new AbortController().signal));
    expect(e).toBeInstanceOf(LlmError);
    expect(e).toMatchObject({ kind: "rate_limited", retryAfterSeconds: 7 });
  });

  it("falls back to x-ratelimit-reset-tokens for the retry delay", async () => {
    mockFetch(new Response("{}", { status: 429, headers: { "x-ratelimit-reset-tokens": "1m2.5s" } }));
    const e = await kindOf(chatCompletion(config, request, new AbortController().signal));
    expect(e).toMatchObject({ kind: "rate_limited", retryAfterSeconds: 63 });
  });

  it("maps aborts to timeout", async () => {
    mockFetch(new DOMException("aborted", "AbortError"));
    expect(await kindOf(chatCompletion(config, request, new AbortController().signal))).toMatchObject({ kind: "timeout" });
  });

  it("maps 503 and network errors to unavailable", async () => {
    mockFetch(new Response("{}", { status: 503 }));
    expect(await kindOf(chatCompletion(config, request, new AbortController().signal))).toMatchObject({ kind: "unavailable" });
    mockFetch(new TypeError("fetch failed"));
    expect(await kindOf(chatCompletion(config, request, new AbortController().signal))).toMatchObject({ kind: "unavailable" });
  });

  it("rejects empty content as bad_response without leaking secrets", async () => {
    mockFetch(ok("   "));
    const e = await kindOf(chatCompletion(config, request, new AbortController().signal));
    expect(e).toMatchObject({ kind: "bad_response" });
    expect(e!.message).not.toMatch(/sk-secret|private question/);
  });

  it("returns usage token counts", async () => {
    mockFetch(ok("answer"));
    expect(await chatCompletion(config, request, new AbortController().signal)).toEqual({ content: "answer", promptTokens: 11, completionTokens: 5 });
  });
});
