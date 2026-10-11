// Enumerate a small FCCP listing snapshot with validation before staging.
import { createHash } from "node:crypto";
import { fetchFccpPage } from "./fccp-fetch.js";
import { parseFccpListing, validateFccpPage, type FccpCandidate } from "./fccp-listing.js";
import { fetchFccpPdf } from "./fccp-pdf.js";

const MAX_PAGES = 15;
const REQUEST_INTERVAL_MS = 5000;

type PageResponse = { html: string; httpStatus: number };
type PageFetcher = (page: number) => Promise<PageResponse>;
type Waiter = (milliseconds: number) => Promise<void>;
type PdfFetcher = (url: string) => Promise<Uint8Array>;

const wait: Waiter = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const signature = (items: FccpCandidate[]) => items.map((item) => `${item.identityHash}:${item.metadataHash}`).join("|");

export type FccpSnapshot = {
  candidates: FccpCandidate[];
  rejected: { page: number; row: number; reason: string }[];
  duplicates: { page: number; row: number; pdfSha256: string }[];
  missingUploadDates: number;
  sourceTotal: number;
  pageCount: number;
  listingHashInput: string;
};

/** Fetch each page once, then recheck page one to detect a shifting listing. */
export async function enumerateFccp(
  fetchPage: PageFetcher = fetchFccpPage,
  pause: Waiter = wait,
  fetchPdf: PdfFetcher = fetchFccpPdf,
): Promise<FccpSnapshot> {
  const first = await fetchPage(1);
  const firstParsed = parseFccpListing(first.html);
  const firstRange = validateFccpPage(first.html, 1, firstParsed.candidates.length + firstParsed.rejected.length);
  const pageCount = Math.ceil(firstRange.total / 10);
  if (pageCount > MAX_PAGES) throw new Error("FCCP listing exceeds the page cap.");
  const candidates = [...firstParsed.candidates];
  const rejected = firstParsed.rejected.map((item) => ({ ...item, page: 1 }));
  const duplicatePairs: { original: FccpCandidate; duplicate: FccpCandidate; page: number; row: number }[] = [];
  let missingUploadDates = firstParsed.candidates.filter((item) => item.uploadDate === null).length;
  const pageHashes = [first.html];
  const seen = new Map(candidates.map((item) => [item.identityHash, item]));
  for (let page = 2; page <= pageCount; page += 1) {
    await pause(REQUEST_INTERVAL_MS);
    const response = await fetchPage(page);
    const parsed = parseFccpListing(response.html);
    const range = validateFccpPage(response.html, page, parsed.candidates.length + parsed.rejected.length);
    if (range.total !== firstRange.total) throw new Error(`FCCP page ${page} changed the total.`);
    rejected.push(...parsed.rejected.map((item) => ({ ...item, page })));
    for (const [index, candidate] of parsed.candidates.entries()) {
      missingUploadDates += Number(candidate.uploadDate === null);
      const original = seen.get(candidate.identityHash);
      if (original) {
        duplicatePairs.push({ original, duplicate: candidate, page, row: index + 1 });
        continue;
      }
      seen.set(candidate.identityHash, candidate);
      candidates.push(candidate);
    }
    pageHashes.push(response.html);
  }
  if (candidates.length + rejected.length + duplicatePairs.length !== firstRange.total) {
    throw new Error("FCCP listing count does not match the source total.");
  }
  await pause(REQUEST_INTERVAL_MS);
  const check = await fetchPage(1);
  const checkParsed = parseFccpListing(check.html);
  const checkRange = validateFccpPage(check.html, 1, checkParsed.candidates.length + checkParsed.rejected.length);
  if (checkRange.total !== firstRange.total || signature(checkParsed.candidates) !== signature(firstParsed.candidates)
    || JSON.stringify(checkParsed.rejected) !== JSON.stringify(firstParsed.rejected)) {
    throw new Error("FCCP listing changed during enumeration; retry later.");
  }
  const duplicates: FccpSnapshot["duplicates"] = [];
  for (const pair of duplicatePairs) {
    if (pair.duplicate.uploadDate !== null || pair.original.uploadDate === null
      || pair.duplicate.authorJudge !== pair.original.authorJudge) {
      rejected.push({ page: pair.page, row: pair.row, reason: "ambiguous duplicate listing identity" });
      continue;
    }
    await pause(REQUEST_INTERVAL_MS);
    const originalPdf = await fetchPdf(pair.original.downloadUrl);
    await pause(REQUEST_INTERVAL_MS);
    const duplicatePdf = await fetchPdf(pair.duplicate.downloadUrl);
    const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
    const originalHash = digest(originalPdf);
    if (originalHash !== digest(duplicatePdf)) {
      rejected.push({ page: pair.page, row: pair.row, reason: "same title but different PDF bytes" });
      continue;
    }
    duplicates.push({ page: pair.page, row: pair.row, pdfSha256: originalHash });
  }
  return { candidates, rejected, duplicates, missingUploadDates, sourceTotal: firstRange.total, pageCount,
    listingHashInput: pageHashes.join("\n<!-- page -->\n") };
}
