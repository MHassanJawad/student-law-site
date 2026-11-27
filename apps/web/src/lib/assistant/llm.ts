// Server-only OpenAI-compatible chat client. Errors never carry the key or message text.
import type { AssistantConfig } from "./config";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type LlmErrorKind = "rate_limited" | "timeout" | "unavailable" | "bad_response";

export class LlmError extends Error {
  constructor(public kind: LlmErrorKind, public retryAfterSeconds?: number) {
    super(`Assistant model call failed: ${kind}`);
    this.name = "LlmError";
  }
}

/** Parse a "1m2.5s" / "16.7s" / "250ms" duration from rate-limit headers into milliseconds. */
function durationMs(value: string | null): number {
  let total = 0;
  for (const [, amount, unit] of (value ?? "").matchAll(/([\d.]+)(ms|m|s)/g)) {
    total += Number(amount) * (unit === "ms" ? 1 : unit === "s" ? 1000 : 60000);
  }
  return total;
}

function retryAfter(headers: Headers): number | undefined {
  const explicit = Number(headers.get("retry-after"));
  if (explicit > 0) return Math.ceil(explicit);
  const ms = durationMs(headers.get("x-ratelimit-reset-tokens"));
  return ms > 0 ? Math.ceil(ms / 1000) : undefined;
}

export async function chatCompletion(
  config: AssistantConfig,
  request: { messages: ChatMessage[]; temperature: number; maxTokens: number; json?: boolean },
  signal: AbortSignal,
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  let response: Response;
  try {
    response = await fetch(config.apiUrl, {
      method: "POST", signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model, messages: request.messages, temperature: request.temperature, max_tokens: request.maxTokens,
        ...(config.model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        ...(request.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (error) {
    const name = (error as { name?: string })?.name;
    throw new LlmError(name === "AbortError" || name === "TimeoutError" ? "timeout" : "unavailable");
  }
  if (response.status === 429) {
    await response.body?.cancel();
    throw new LlmError("rate_limited", retryAfter(response.headers));
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new LlmError(response.status >= 500 ? "unavailable" : "bad_response");
  }
  let body: { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  try {
    body = await response.json();
  } catch (error) {
    const name = (error as { name?: string })?.name;
    throw new LlmError(name === "AbortError" || name === "TimeoutError" ? "timeout" : "bad_response");
  }
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new LlmError("bad_response");
  return { content, promptTokens: body.usage?.prompt_tokens ?? 0, completionTokens: body.usage?.completion_tokens ?? 0 };
}
