// Server-only: gates, quota and NDJSON streaming for the assistant API. Never logs question or answer text, user ids or charge ids.
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, hasTrustedOrigin } from "../http";
import { answerQuestion, type AssistantEvent } from "./assistant";
import type { AssistantConfig } from "./config";
import type { RetrieveResult } from "./sources";

export type HandlerDeps = {
  config: AssistantConfig | null;
  verifyUser: (r: Request) => Promise<{ id: string } | null>;
  consumeQuota: (userLimit: number, globalLimit: number) => Promise<{ allowed: boolean; reason: "user" | "global" | null; remaining: number; chargeId: string | null }>;
  refundQuota: (chargeId: string) => Promise<void>;
  retrieve: (queries: string[]) => Promise<RetrieveResult>;
  run?: typeof answerQuestion;
};

const BODY_SCHEMA = z.object({
  question: z.string().trim().min(1).max(1000),
  // Over-long history items are cut, not rejected: a follow-up must not fail because an earlier answer was long.
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().transform((s) => s.slice(0, 4000)) })).max(8).default([]),
});
const MAX_BODY_BYTES = 64 * 1024;

// Reads the JSON body, or null when it is malformed or larger than 64 KB (by header, or by the text read).
async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null;
  const text = await request.text().catch(() => "");
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function handleAssistantRequest(request: Request, deps: HandlerDeps): Promise<Response> {
  const { config } = deps;
  if (!config) return apiError(503, "ASSISTANT_DISABLED", "The research assistant is not available.");
  if (!hasTrustedOrigin(request)) return apiError(403, "ORIGIN_DENIED", "Request origin is not allowed.");
  if (!(await deps.verifyUser(request))) return apiError(401, "AUTH_REQUIRED", "Sign in to use the research assistant.");
  const body = BODY_SCHEMA.safeParse(await readBody(request));
  if (!body.success) return apiError(400, "INVALID_QUESTION", "Ask a question of 1 to 1,000 characters.");

  let quota: Awaited<ReturnType<HandlerDeps["consumeQuota"]>>;
  try {
    quota = await deps.consumeQuota(config.userDailyLimit, config.globalDailyLimit);
  } catch {
    return apiError(503, "ASSISTANT_UNAVAILABLE", "The research assistant is temporarily unavailable.");
  }
  if (!quota.allowed) {
    const message = quota.reason === "global"
      ? "The assistant has reached today's limit for everyone. Try again tomorrow."
      : "You have reached today's assistant limit. Try again tomorrow.";
    return NextResponse.json(
      { error: { code: "QUOTA_EXCEEDED", message, reason: quota.reason, requestId: crypto.randomUUID() } },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { chargeId } = quota;
  const run = deps.run ?? answerQuestion;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(config.timeoutMs)]);
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let failed = false;
      let ended = false;
      const emit = (e: AssistantEvent) => {
        if (e.type === "error") failed = true;
        if (e.type !== "status") ended = true;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          // The client cancelled the stream; keep running so quota and logging still settle.
        }
      };
      let result = { outcome: "error", promptTokens: 0, completionTokens: 0 };
      try {
        result = await run({ question: body.data.question, history: body.data.history }, { config, retrieve: deps.retrieve }, emit, signal);
      } catch {
        failed = true;
        if (!ended && !request.signal.aborted) emit({ type: "error", code: "UNAVAILABLE", message: "The assistant is temporarily unavailable. Try again later." });
      }
      if (failed && chargeId) await deps.refundQuota(chargeId).catch(() => {});
      console.info(JSON.stringify({ requestId, outcome: result.outcome, ms: Date.now() - started, promptTokens: result.promptTokens, completionTokens: result.completionTokens }));
      try {
        controller.close();
      } catch {
        // Already cancelled by the client.
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
