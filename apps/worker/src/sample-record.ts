// Validate the source-linked FCCP listing fixture before database writes.
import { createHash } from "node:crypto";
import { z } from "zod";

export const SAMPLE_RECORD = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  documentId: "22222222-2222-4222-8222-222222222222",
  versionId: "33333333-3333-4333-8333-333333333333",
  sourceCode: "FCCP_SAMPLE",
  sourceUrl: "https://www.fccp.gov.pk/judgements",
  caseNumber: "C.P.L.A. No.1285-K of 2023",
  authorJudge: "Mr. Justice Muhammad Karim Khan Agha",
  uploadDate: "2026-09-25",
} as const;

const RECORD_SCHEMA = z.object({
  sourceUrl: z.string().url(),
  caseNumber: z.string().min(3),
  authorJudge: z.string().min(3),
  uploadDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Validates official listing metadata without treating upload date as decision date. */
export function validateSampleRecord(record: unknown) {
  return RECORD_SCHEMA.parse(record);
}

/** Computes a stable hash for changes to the listing metadata fixture. */
export function sampleHash(record: typeof SAMPLE_RECORD): string {
  return createHash("sha256").update(`FCCP listing:${record.caseNumber}:${record.uploadDate}`).digest("hex");
}

/** Chooses a safe action for unchanged, first-seen, or changed source metadata. */
export function versionAction(existingHashes: string[], incomingHash: string): "skip" | "insert" | "review" {
  if (existingHashes.includes(incomingHash)) return "skip";
  return existingHashes.length ? "review" : "insert";
}
