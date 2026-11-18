// Enumerate the full FCCP judgment listing with validation before staging.
import { fetchFccpPage } from "./fccp-fetch.js";
import { parseFccpPage, type FccpCandidate } from "./fccp-listing.js";

const MAX_PAGES = 20;
const REQUEST_INTERVAL_MS = 5000;

type PageFetcher = (cursor: string | null) => Promise<{ json: unknown; httpStatus: number }>;
type Waiter = (milliseconds: number) => Promise<void>;

const wait: Waiter = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const signature = (items: FccpCandidate[]) => items.map((item) => `${item.identityHash}:${item.metadataHash}`).join("|");

export type FccpSnapshot = {
  candidates: FccpCandidate[];
  rejected: { page: number; row: number; reason: string }[];
  sourceTotal: number;
  pageCount: number;
  listingHashInput: string;
};

/** Follow the source's cursors to the end, then recheck page one to detect a shifting listing. */
export async function enumerateFccp(fetchPage: PageFetcher = fetchFccpPage, pause: Waiter = wait): Promise<FccpSnapshot> {
  const candidates: FccpCandidate[] = [];
  const rejected: FccpSnapshot["rejected"] = [];
  const seen = new Set<string>();
  const bodies: string[] = [];
  let firstSignature = "";
  let total = -1;
  let cursor: string | null = null;
  let page = 0;
  do {
    if (page > 0) await pause(REQUEST_INTERVAL_MS);
    page += 1;
    if (page > MAX_PAGES) throw new Error("FCCP listing exceeds the page cap.");
    const response = await fetchPage(cursor);
    const parsed = parseFccpPage(response.json);
    if (page === 1) {
      total = parsed.sourceTotal;
      firstSignature = signature(parsed.candidates);
    } else if (parsed.sourceTotal !== total) {
      throw new Error(`FCCP page ${page} changed the total.`);
    }
    rejected.push(...parsed.rejected.map((item) => ({ ...item, page })));
    for (const [index, candidate] of parsed.candidates.entries()) {
      if (seen.has(candidate.identityHash)) {
        rejected.push({ page, row: index + 1, reason: "duplicate listing identity across pages" });
        continue;
      }
      seen.add(candidate.identityHash);
      candidates.push(candidate);
    }
    bodies.push(JSON.stringify(response.json));
    cursor = parsed.next;
  } while (cursor);
  if (candidates.length + rejected.length !== total) {
    throw new Error("FCCP listing count does not match the source total.");
  }
  await pause(REQUEST_INTERVAL_MS);
  const check = parseFccpPage((await fetchPage(null)).json);
  if (check.sourceTotal !== total || signature(check.candidates) !== firstSignature) {
    throw new Error("FCCP listing changed during enumeration; retry later.");
  }
  return { candidates, rejected, sourceTotal: total, pageCount: page, listingHashInput: bodies.join("\n") };
}
