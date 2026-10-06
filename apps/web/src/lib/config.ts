// Read and validate the public Supabase connection settings.
export type PublicConfig = { url: string; key: string };

/** Returns the public Supabase settings or null while local setup is incomplete. */
export function getPublicConfig(): PublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || key.startsWith("replace-with-")) return null;
  return { url, key };
}
