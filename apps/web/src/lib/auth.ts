// Verify account identity before every saved-citation operation.
import { bearerToken } from "./http";
import { createPublicClient, createUserClient } from "./supabase";

export type VerifiedUser = { id: string; token: string; client: NonNullable<ReturnType<typeof createUserClient>> };

/** Verifies a Supabase access token and creates an RLS-scoped data client. */
export async function verifyUser(request: Request): Promise<VerifiedUser | null> {
  const token = bearerToken(request);
  const authClient = createPublicClient();
  if (!token || !authClient) return null;
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  const client = createUserClient(token);
  return client ? { id: data.user.id, token, client } : null;
}
