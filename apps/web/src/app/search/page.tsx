// Entry point for the public research collections.
import { ResearchClient } from "./research-client";
import { SEARCH_MODES, type SearchMode } from "@/lib/research-query";

/** Select the requested research collection for the interactive search page. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const mode = values.mode;
  const initialMode: SearchMode = SEARCH_MODES.includes(mode as SearchMode) ? mode as SearchMode : "case-law";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") params.set(key, value);
  }
  params.set("mode", initialMode);
  return <ResearchClient key={initialMode} initialMode={initialMode} initialSearch={params.toString()} />;
}
