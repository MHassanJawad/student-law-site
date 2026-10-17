// Verify password before permanently deleting the caller's account.
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/lib/auth";
import { apiError, hasTrustedOrigin } from "@/lib/http";
import { createPublicClient } from "@/lib/supabase";

const DELETE_SCHEMA = z.object({ confirmation: z.literal("DELETE"), password: z.string().min(1).max(200) }).strict();

/** Deletes the verified caller after a fresh password check. */
export async function DELETE(request: Request): Promise<NextResponse> {
  if (!hasTrustedOrigin(request)) return apiError(403, "ORIGIN_DENIED", "Request origin is not allowed.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) return apiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send JSON.");
  const user = await verifyUser(request);
  if (!user) return apiError(401, "AUTH_REQUIRED", "Sign in to delete your account.");
  const parsed = DELETE_SCHEMA.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_INPUT", "Enter DELETE and your current password.");
  const auth = createPublicClient();
  const { data: identity, error: identityError } = await user.client.auth.getUser(user.token);
  if (!auth || identityError || !identity.user.email) return apiError(503, "ACCOUNT_UNAVAILABLE", "Could not verify your account.");
  const { data: login, error: loginError } = await auth.auth.signInWithPassword({ email: identity.user.email, password: parsed.data.password });
  if (loginError || login.user?.id !== user.id) return apiError(403, "PASSWORD_INVALID", "Current password is incorrect.");
  const { error } = await user.client.rpc("delete_my_account", { p_password: parsed.data.password });
  if (error) return apiError(503, "DELETE_UNAVAILABLE", "Could not delete your account.");
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
