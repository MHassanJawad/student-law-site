// Public detail for one reviewed editorial entry.
import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase";
import { apiError } from "@/lib/http";
import { EDITORIAL_DB_KIND, EDITORIAL_KIND } from "@/lib/editorial";

type Context = { params: Promise<{ kind: string; slug: string }> };

/** Returns one published maxim, article, or dictionary entry. */
export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const { kind, slug } = await context.params;
  const collection = EDITORIAL_KIND.safeParse(kind);
  if (!collection.success || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    return apiError(404, "RESOURCE_NOT_FOUND", "Entry not found.");
  const client = createPublicClient();
  if (!client) return apiError(503, "EDITORIAL_UNAVAILABLE", "Entry is temporarily unavailable.");
  const { data, error } = await client.from("editorial_entries")
    .select("kind,slug,title,summary,body,author,source_url,provenance_note,topic,published_at,reviewed_at")
    .eq("kind", EDITORIAL_DB_KIND[collection.data]).eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) return apiError(503, "EDITORIAL_UNAVAILABLE", "Entry is temporarily unavailable.");
  if (!data) return apiError(404, "RESOURCE_NOT_FOUND", "Entry not found.");
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
