// Fetch an official FCCP PDF by its content hash and confirm the bytes are that file.
import { createHash } from "node:crypto";

export const FCCP_FILES = "https://fccp.gov.pk/api/public/site/files/";
// Netlify caps a function response at 6 MB; larger PDFs fall back to the extracted text.
export const MAX_PDF_BYTES = 6 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;

/** Returns true when the bytes are a PDF whose SHA-256 equals the expected hash. */
export function isOfficialPdf(bytes: Uint8Array, sha256: string): boolean {
  return bytes.length > 0 && bytes.length <= MAX_PDF_BYTES
    && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-"
    && createHash("sha256").update(bytes).digest("hex") === sha256;
}

/**
 * Downloads one official PDF; FCCP names files by hash, so the address never expires.
 *
 * @throws {Error} When the hash is malformed, the response is not a PDF, it is too large, or the bytes do not match.
 */
export async function fetchOfficialPdf(sha256: string): Promise<Uint8Array> {
  if (!SHA256.test(sha256)) throw new Error("Invalid PDF hash.");
  const response = await fetch(FCCP_FILES + sha256, {
    headers: { Accept: "application/pdf", "User-Agent": "StudentLawSite/0.2 (judgment reader)" },
    redirect: "manual", signal: AbortSignal.timeout(20000),
  });
  if (response.status !== 200 || !response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) {
    throw new Error(`Official PDF returned HTTP ${response.status}.`);
  }
  if (Number(response.headers.get("content-length") ?? 0) > MAX_PDF_BYTES) throw new Error("Official PDF is too large.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!isOfficialPdf(bytes, sha256)) throw new Error("PDF bytes do not match the official file.");
  return bytes;
}
