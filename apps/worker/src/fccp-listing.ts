// Parse the public FCCP publications API into unreviewed judgment candidates.
import { createHash } from "node:crypto";
import { z } from "zod";

export const FCCP_ORIGIN = "https://fccp.gov.pk";
export const FCCP_LISTING_URL = `${FCCP_ORIGIN}/api/public/site/publications/judgement`;
export const FCCP_PARSER_VERSION = "fccp-api-v1";
const MAX_PDF_BYTES = 15 * 1024 * 1024;

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
  sourceTotal: number;
  next: string | null;
};

const PAGE = z.object({
  items: z.array(z.unknown()).max(200),
  total: z.number().int().min(0),
  start: z.number().int().min(1),
  next: z.string().min(1).max(2000).nullable(),
});

const ITEM = z.object({
  kind: z.literal("judgement"),
  body: z.object({
    file: z.string().regex(/^[\da-f]{64}$/),
    title: z.string().trim().min(5).max(500),
    authors: z.array(z.string().trim().min(5).max(300)).min(1).max(10),
    issuedAt: z.iso.datetime(),
  }),
  files: z.array(z.object({ sha256: z.string(), contentType: z.string(), sizeBytes: z.number() })),
});

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const clean = (value: string): string => value.replace(/\s+/g, " ").trim();

/** The court's own calendar date: issuedAt is UTC, and Pakistan has no daylight saving (UTC+5). */
export function pakistanDate(isoInstant: string): string {
  return new Date(Date.parse(isoInstant) + 5 * 3600_000).toISOString().slice(0, 10);
}

/** Stable, content-addressed PDF link on the official host. */
export function fccpFileUrl(sha256: string): string {
  return `${FCCP_ORIGIN}/api/public/site/files/${sha256}`;
}

/**
 * Validate one API page; fail closed on shape drift, reject bad rows individually.
 * Hash inputs match the retired HTML parser, so existing candidates keep their identity.
 */
export function parseFccpPage(json: unknown): ParsedListing {
  const page = PAGE.safeParse(json);
  if (!page.success) throw new Error("FCCP listing API shape changed.");
  const candidates: FccpCandidate[] = [];
  const rejected: ParsedListing["rejected"] = [];
  const seen = new Set<string>();
  page.data.items.forEach((raw, index) => {
    const item = ITEM.safeParse(raw);
    if (!item.success) {
      rejected.push({ row: index + 1, reason: "invalid or unrecognised listing item" });
      return;
    }
    const { file, title: rawTitle, authors, issuedAt } = item.data.body;
    const pdf = item.data.files.find((entry) => entry.sha256 === file);
    if (!pdf || pdf.contentType !== "application/pdf" || pdf.sizeBytes <= 0 || pdf.sizeBytes > MAX_PDF_BYTES) {
      rejected.push({ row: index + 1, reason: "missing or oversized official PDF" });
      return;
    }
    const title = clean(rawTitle);
    const authorJudge = authors.map(clean).join(", ");
    const sourceType = "Judgement" as const;
    const uploadDate = pakistanDate(issuedAt);
    const identityHash = hash(JSON.stringify([title.toLowerCase(), sourceType]));
    if (seen.has(identityHash)) {
      rejected.push({ row: index + 1, reason: "duplicate listing identity" });
      return;
    }
    seen.add(identityHash);
    candidates.push({
      identityHash, metadataHash: hash(JSON.stringify([title, authorJudge, sourceType, uploadDate])),
      title, authorJudge, sourceType, uploadDate, downloadUrl: fccpFileUrl(file),
    });
  });
  return { candidates, rejected, sourceTotal: page.data.total, next: page.data.next };
}
