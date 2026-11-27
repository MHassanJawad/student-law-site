// Stream grounded research-assistant answers to signed-in users.
import { getAssistantConfig } from "@/lib/assistant/config";
import { handleAssistantRequest, type HandlerDeps } from "@/lib/assistant/handler";
import type { RetrieveResult } from "@/lib/assistant/sources";
import { verifyUser, type VerifiedUser } from "@/lib/auth";
import { createPublicClient } from "@/lib/supabase";

// supabase-js and AbortSignal.any need Node.js.
export const runtime = "nodejs";

// Built per request: the quota RPCs run on the client of the user verified for that request.
function defaultDeps(): HandlerDeps {
  let user: VerifiedUser | null = null;
  const client = () => {
    if (!user) throw new Error("Assistant quota called before user verification.");
    return user.client;
  };
  return {
    config: getAssistantConfig(),
    verifyUser: async (request) => (user = await verifyUser(request)),
    consumeQuota: async (userLimit, globalLimit) => {
      const { data, error } = await client().rpc("consume_assistant_quota", { p_user_limit: userLimit, p_global_limit: globalLimit });
      if (error || !data) throw new Error("Assistant quota unavailable.");
      return { allowed: data.allowed === true, reason: data.reason ?? null, remaining: Number(data.remaining) || 0, chargeId: data.charge_id ?? null };
    },
    refundQuota: async (chargeId) => {
      const { error } = await client().rpc("refund_assistant_quota", { p_charge_id: chargeId });
      if (error) throw new Error("Assistant quota refund failed.");
    },
    retrieve: async (queries) => {
      const db = createPublicClient();
      if (!db) throw new Error("Database unavailable.");
      const { data, error } = await db.rpc("assistant_retrieve", { p_queries: queries, p_limit: 8, p_per_document: 3 });
      if (error || !data) throw new Error("Assistant retrieval unavailable.");
      return { passages: data.passages ?? [], related: data.related ?? [] } as RetrieveResult;
    },
  };
}

export const POST = (request: Request) => handleAssistantRequest(request, defaultDeps());
