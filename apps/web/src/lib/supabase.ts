// Create browser or request-scoped Supabase clients without privileged keys.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicConfig } from "./config";

/** Creates an anonymous server client for published data and auth verification. */
export function createPublicClient(): SupabaseClient | null {
  const config = getPublicConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Creates a client whose database requests carry the verified user's bearer token. */
export function createUserClient(token: string): SupabaseClient | null {
  const config = getPublicConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let browserClient: SupabaseClient | null = null;

/** Returns one browser auth client, preserving the session across page navigation. */
export function getBrowserClient(): SupabaseClient | null {
  const config = getPublicConfig();
  if (!config) return null;
  browserClient ??= createClient(config.url, config.key);
  return browserClient;
}
