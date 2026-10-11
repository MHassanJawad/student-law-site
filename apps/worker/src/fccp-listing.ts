// Parse the public FCCP listing into unreviewed metadata candidates.
import { createHash } from "node:crypto";
import { load } from "cheerio";

export const FCCP_LISTING_URL = "https://www.fccp.gov.pk/judgements";
export const FCCP_PARSER_VERSION = "fccp-listing-v1";

export type FccpCandidate = {
  identityHash: string;
  metadataHash: string;
  title: string;
  authorJudge: string;
  sourceType: "Judgement" | "Order";
  uploadDate: string | null;
  downloadUrl: string;
};

export type ParsedListing = {
  candidates: FccpCandidate[];
  rejected: { row: number; reason: string }[];
  sourceTotal: number | null;
};

export type PagePosition = { start: number; end: number; total: number; nextPage: number | null };

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const clean = (value: string): string => value.replace(/\s+/g, " ").trim();

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Fail closed on page drift, invalid fields, duplicate identities, or foreign download links. */
export function parseFccpListing(html: string): ParsedListing {
  const $ = load(html);
  const rows = $("tbody tr").filter((_, row) => $(row).find('td[data-label="Case Title"]').length > 0);
  if (rows.length === 0 || rows.length > 20) throw new Error("FCCP listing layout changed or page size exceeded 20 rows.");
  const candidates: FccpCandidate[] = [];
  const rejected: ParsedListing["rejected"] = [];
  const seen = new Set<string>();
  rows.each((index, row) => {
    const field = (label: string) => clean($(row).find(`td[data-label="${label}"]`).text());
    const title = field("Case Title");
    const authorJudge = field("Author Judge");
    const sourceType = field("Type");
    const uploadDate = field("Upload Date") || null;
    const href = $(row).find('td[data-label="Download"] a[href]').attr("href") ?? "";
    let reason: string | undefined;
    let downloadUrl = "";
    try {
      const url = new URL(href, FCCP_LISTING_URL);
      if (url.origin !== "https://www.fccp.gov.pk" || url.username || url.password
        || !url.pathname.startsWith("/download/") || url.pathname === "/download/") {
        throw new Error("unexpected download host or path");
      }
      downloadUrl = url.toString();
    } catch {
      reason = "invalid official download URL";
    }
    if (!reason && (title.length < 5 || title.length > 500)) reason = "invalid case title";
    if (!reason && (authorJudge.length < 5 || authorJudge.length > 300)) reason = "invalid author judge";
    if (!reason && sourceType !== "Judgement" && sourceType !== "Order") reason = "unrecognised document type";
    if (!reason && uploadDate !== null && !validDate(uploadDate)) reason = "invalid upload date";
    const identityHash = hash(JSON.stringify([title.toLowerCase(), sourceType]));
    if (!reason && seen.has(identityHash)) reason = "duplicate listing identity";
    if (reason) {
      rejected.push({ row: index + 1, reason });
      return;
    }
    seen.add(identityHash);
    candidates.push({
      identityHash,
      metadataHash: hash(JSON.stringify([title, authorJudge, sourceType, uploadDate])),
      title, authorJudge, sourceType: sourceType as FccpCandidate["sourceType"], uploadDate, downloadUrl,
    });
  });
  const summary = clean($(".pagination-summary").text());
  const match = /\bof\s+([\d,]+)\b/i.exec(summary);
  return { candidates, rejected, sourceTotal: match ? Number(match[1].replace(/,/g, "")) : null };
}

/** Verify the source's own range and next link before a multi-page import. */
export function validateFccpPage(html: string, page: number, observedRows: number): PagePosition {
  const $ = load(html);
  const summary = clean($(".pagination-summary").text());
  const match = /^Showing\s+([\d,]+)\s*[–—-]\s*([\d,]+)\s+of\s+([\d,]+)$/i.exec(summary);
  if (!match) throw new Error(`Page ${page} has no valid pagination range.`);
  const [start, end, total] = match.slice(1).map((value) => Number(value.replace(/,/g, "")));
  if (page < 1 || start !== (page - 1) * 10 + 1 || end < start || end > total
    || end - start + 1 !== observedRows || observedRows > 10) {
    throw new Error(`Page ${page} has an inconsistent pagination range.`);
  }
  const expectedNext = end < total ? page + 1 : null;
  const href = $(".pagination a[rel='next']").attr("href");
  if (expectedNext === null && href) throw new Error(`Page ${page} unexpectedly has a next link.`);
  if (expectedNext !== null) {
    if (!href) throw new Error(`Page ${page} is missing its next link.`);
    const url = new URL(href, FCCP_LISTING_URL);
    if (url.origin !== "https://www.fccp.gov.pk" || url.pathname !== "/judgements"
      || url.searchParams.size !== 1 || url.searchParams.get("page") !== String(expectedNext)) {
      throw new Error(`Page ${page} has an unexpected next link.`);
    }
  }
  return { start, end, total, nextPage: expectedNext };
}
