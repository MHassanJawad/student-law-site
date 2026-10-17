// Public listing of reviewed and published editorial entries.
import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase";
import { apiError } from "@/lib/http";
import { EDITORIAL_DB_KIND, EDITORIAL_KIND, parseEditorialQuery } from "@/lib/editorial";

type Context = { params: Promise<{ kind: string }> };

/** Returns published entries for a collection with bounded pagination. */
export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const { kind } = await context.params;
  const collection = EDITORIAL_KIND.safeParse(kind);
  if (!collection.success) return apiError(404, "RESOURCE_NOT_FOUND", "Collection not found.");
  const parsed = parseEditorialQuery(new URL(request.url).searchParams);
  if (!parsed) return apiError(400, "INVALID_INPUT", "Check search and page values.");
  const client = createPublicClient();
  if (!client) return apiError(503, "EDITORIAL_UNAVAILABLE", "Collection is temporarily unavailable.");
  const start = (parsed.page - 1) * 12;
  let query = client.from("editorial_entries")
    .select("slug,title,summary,author,topic,source_url,published_at", { count: "exact" })
    .eq("kind", EDITORIAL_DB_KIND[collection.data]).eq("status", "published");
  if (parsed.q) query = query.ilike("title", `%${parsed.q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  const { data, count, error } = await query.order("published_at", { ascending: false }).range(start, start + 11);
  if (error) return apiError(503, "EDITORIAL_UNAVAILABLE", "Collection is temporarily unavailable.");
  return NextResponse.json({ items: data ?? [], page: parsed.page, total: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
