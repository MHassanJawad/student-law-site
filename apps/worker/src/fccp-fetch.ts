// Fetch bounded FCCP listing pages with conservative network limits.
import { FCCP_LISTING_URL, FCCP_ORIGIN } from "./fccp-listing.js";

const USER_AGENT = "StudentLawSite/0.2 (judgment research; contact: repository maintainer)";
export const FCCP_PAGE_SIZE = 50;

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

/** GET one official URL with no redirects, a timeout, a content-type check, and a byte limit. */
export async function checkedGet(url: string, contentType: string, limit: number): Promise<{ text: string; status: number }> {
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

/** Allow only the explicit wildcard robots rule; any changed policy stops collection. */
export function robotsAllowsListing(robots: string): boolean {
  const lines = robots.replace(/^﻿/, "").split(/\r?\n/).map((line) => line.split("#", 1)[0].trim());
  const active = lines.findIndex((line) => /^user-agent:\s*\*$/i.test(line));
  if (active < 0) return false;
  const rules = lines.slice(active + 1).filter(Boolean);
  const nextAgent = rules.findIndex((line) => /^user-agent:/i.test(line));
  const relevant = nextAgent < 0 ? rules : rules.slice(0, nextAgent);
  return relevant.some((line) => /^disallow:\s*$/i.test(line))
    && relevant.every((line) => /^disallow:\s*$|^allow:/i.test(line));
}

/** Fetch one API page; `cursor` is the source's own opaque `next` value. */
export async function fetchFccpPage(cursor: string | null): Promise<{ json: unknown; httpStatus: number }> {
  const url = new URL(FCCP_LISTING_URL);
  url.searchParams.set("size", String(FCCP_PAGE_SIZE));
  if (cursor) url.searchParams.set("cursor", cursor);
  const listing = await checkedGet(url.toString(), "application/json", 2 * 1024 * 1024);
  return { json: JSON.parse(listing.text), httpStatus: listing.status };
}

/** The redesigned site has no robots.txt (its app shell answers instead); a real file must allow us. */
export async function checkFccpRobots(): Promise<void> {
  const response = await fetch(`${FCCP_ORIGIN}/robots.txt`, {
    headers: { "User-Agent": USER_AGENT }, redirect: "manual", signal: AbortSignal.timeout(15000),
  });
  const isRobotsFile = response.status === 200 && response.headers.get("content-type")?.toLowerCase().includes("text/plain");
  if (!isRobotsFile) {
    await response.body?.cancel();
    if (response.status === 200 || response.status === 404) return;
    throw new Error(`FCCP robots.txt returned HTTP ${response.status}.`);
  }
  if (!robotsAllowsListing(await boundedText(response, 32768))) {
    throw new Error("FCCP robots policy requires review before fetching.");
  }
}
