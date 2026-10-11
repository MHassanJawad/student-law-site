// Parse and bound public research filters before the database call.
import { z } from "zod";

export const SEARCH_MODES = ["case-law", "courtwise", "citation", "advanced", "statutes"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isCalendarDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const schema = z.object({
  mode: z.enum(SEARCH_MODES).default("case-law"),
  q: z.string().trim().max(200).default(""),
  author: z.string().trim().max(100).default(""),
  reporter: z.string().trim().max(30).default(""),
  citationYear: z.coerce.number().int().min(1800).max(2200).optional(),
  citationPage: z.string().trim().max(30).default(""),
  from: z.string().regex(DATE).optional(),
  to: z.string().regex(DATE).optional(),
  jurisdiction: z.enum(["Federal", "Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad Capital Territory"]).optional(),
  year: z.coerce.number().int().min(1800).max(2200).optional(),
  instrumentType: z.string().trim().max(80).default(""),
  legalStatus: z.enum(["in_force", "repealed", "partly_in_force", "unknown"]).optional(),
  sort: z.enum(["relevance", "decision-newest", "decision-oldest", "title"]).default("relevance"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export type ResearchQuery = z.infer<typeof schema>;

/** Parse supported search filters; malformed dates or pagination return null. */
export function parseResearchQuery(params: URLSearchParams): ResearchQuery | null {
  const value = (name: string) => params.get(name) || undefined;
  const result = schema.safeParse({
    mode: value("mode"), q: value("q"), author: value("author"),
    reporter: value("reporter"), citationYear: value("citationYear"), citationPage: value("citationPage"),
    from: value("from"), to: value("to"), jurisdiction: value("jurisdiction"),
    year: value("year"), instrumentType: value("instrumentType"), legalStatus: value("legalStatus"),
    sort: value("sort"), page: value("page"),
  });
  if (!result.success) return null;
  const query = result.data;
  const hasStructuredCitation = Boolean(query.reporter || query.citationYear || query.citationPage);
  if (query.mode === "citation" && hasStructuredCitation && !(query.reporter && query.citationYear && query.citationPage)) return null;
  if (query.mode === "citation" && hasStructuredCitation
    && `${query.reporter}${query.citationYear}${query.citationPage}`.replace(/[^a-z0-9]/gi, "").length < 2) return null;
  if (query.mode === "citation" && !hasStructuredCitation && query.q.replace(/[^a-z0-9]/gi, "").length < 2) return null;
  if (query.from && !isCalendarDate(query.from)) return null;
  if (query.to && !isCalendarDate(query.to)) return null;
  if (query.from && query.to && query.from > query.to) return null;
  return query;
}
