// Fetch one approved FCCP HTML listing page with conservative network bounds.
import { FCCP_LISTING_URL } from "./fccp-listing.js";

const ORIGIN = "https://www.fccp.gov.pk";
const USER_AGENT = "StudentLawSitePilot/0.1 (metadata-only; contact: repository maintainer)";

async function boundedText(response: Response, limit: number): Promise<string> {
  if (!response.body) throw new Error("Source response has no body.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Source response exceeded byte limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}

async function checkedGet(url: string, contentType: string, limit: number): Promise<{ text: string; status: number }> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: contentType },
    redirect: "manual", signal: AbortSignal.timeout(15000),
  });
  if (response.status !== 200) throw new Error(`Source returned HTTP ${response.status}.`);
  if (!response.headers.get("content-type")?.toLowerCase().includes(contentType)) {
    throw new Error("Unexpected source content type.");
  }
  return { text: await boundedText(response, limit), status: response.status };
}

/** Allow only the current explicit wildcard robots rule; any changed policy stops collection. */
export function robotsAllowsListing(robots: string): boolean {
  const lines = robots.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.split("#", 1)[0].trim());
  const active = lines.findIndex((line) => /^user-agent:\s*\*$/i.test(line));
  if (active < 0) return false;
  const rules = lines.slice(active + 1).filter(Boolean);
  const nextAgent = rules.findIndex((line) => /^user-agent:/i.test(line));
  const relevant = nextAgent < 0 ? rules : rules.slice(0, nextAgent);
  return relevant.some((line) => /^disallow:\s*$/i.test(line))
    && relevant.every((line) => /^disallow:\s*$|^allow:/i.test(line));
}

/** Make at most two fixed-host requests: robots.txt, then one listing page. */
export async function fetchFccpListing(): Promise<{ html: string; httpStatus: number }> {
  await checkFccpRobots();
  const listing = await checkedGet(FCCP_LISTING_URL, "text/html", 1024 * 1024);
  return { html: listing.text, httpStatus: listing.status };
}

export async function checkFccpRobots(): Promise<void> {
  const robots = await checkedGet(`${ORIGIN}/robots.txt`, "text/plain", 32768);
  if (!robotsAllowsListing(robots.text)) throw new Error("FCCP robots policy requires review before fetching.");
}
