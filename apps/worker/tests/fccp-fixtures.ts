// Shared FCCP API fixtures for the adapter tests.
import { createHash } from "node:crypto";

export const sha = (seed: string) => createHash("sha256").update(seed).digest("hex");
export const item = (title: string, issuedAt = "2026-10-01T19:00:00Z", file = sha(title)) => ({
  kind: "judgement", key: `ddc-${file.slice(0, 8)}`,
  body: { file, title, authors: ["Mr. Justice Example"], issuedAt, fileName: `${title}.pdf` },
  files: [{ sha256: file, contentType: "application/pdf", sizeBytes: 1000 }],
});
export const page = (items: unknown[], total = items.length, next: string | null = null) => ({ items, total, start: 1, size: 50, next, previous: null });
