// Shared editorial collection names and search validation.
import { z } from "zod";

export const EDITORIAL_KIND = z.enum(["maxims", "articles", "dictionary"]);
export type EditorialCollection = z.infer<typeof EDITORIAL_KIND>;

export const EDITORIAL_DB_KIND: Record<EditorialCollection, string> = {
  maxims: "maxim", articles: "article", dictionary: "dictionary",
};

export const EDITORIAL_LABEL: Record<EditorialCollection, string> = {
  maxims: "Maxims", articles: "Articles", dictionary: "Dictionary",
};

/** Parses bounded public editorial search and pagination. */
export function parseEditorialQuery(params: URLSearchParams) {
  const q = (params.get("q") ?? "").trim();
  const pageText = params.get("page") ?? "1";
  if (q.length > 100 || !/^[1-9]\d{0,4}$/.test(pageText)) return null;
  return { q, page: Number(pageText) };
}
