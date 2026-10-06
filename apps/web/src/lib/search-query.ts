// Validate the first FCCP search slice before it reaches SQL.
import { z } from "zod";

const SEARCH_SCHEMA = z.object({
  q: z.string().trim().min(2).max(200),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export type SearchQuery = z.infer<typeof SEARCH_SCHEMA>;

/** Parses and bounds the public search query, returning null for invalid input. */
export function parseSearchQuery(params: URLSearchParams): SearchQuery | null {
  const result = SEARCH_SCHEMA.safeParse({ q: params.get("q") ?? "", page: params.get("page") ?? 1 });
  return result.success ? result.data : null;
}
