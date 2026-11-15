// Fetch one official FCCP PDF and extract its text.
import { createHash } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { FCCP_ORIGIN } from "./fccp-listing.js";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_PDF_PAGES = 100;
const MAX_TEXT_CHARS = 2_000_000;
export const PDF_PARSER_VERSION = "pdfjs-6.4.299-v2";

export type PdfInspection = {
  pdfSha256: string;
  pdfBytes: number;
  pageCount: number;
  extractedText: string | null;
  textChars: number;
  quality: "extractable" | "low_text" | "scanned_or_empty";
};

/** Download one official PDF by its content-addressed link, with time, size, type, and hash bounds. */
export async function fetchFccpPdf(sourceUrl: string): Promise<Uint8Array> {
  const url = new URL(sourceUrl);
  const expectedHash = /^\/api\/public\/site\/files\/([\da-f]{64})$/.exec(url.pathname)?.[1];
  if (url.origin !== FCCP_ORIGIN || url.username || url.password || url.search || !expectedHash) {
    throw new Error("PDF URL is not an official FCCP file link.");
  }
  const response = await fetch(url, {
    headers: { Accept: "application/pdf", "User-Agent": "StudentLawSite/0.2 (judgment text extraction; contact: repository maintainer)" },
    redirect: "manual", signal: AbortSignal.timeout(30000),
  });
  if (response.status !== 200 || !response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) {
    throw new Error(`Official PDF returned HTTP ${response.status} or an unexpected content type.`);
  }
  if (Number(response.headers.get("content-length") ?? 0) > MAX_PDF_BYTES || !response.body) {
    throw new Error("Official PDF exceeds the size cap or has no body.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PDF_BYTES) throw new Error("Official PDF exceeded the size cap.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Download is not a PDF file.");
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error("PDF bytes do not match the official file hash.");
  return new Uint8Array(bytes);
}

/** Extract text and report quality; scanned pages need OCR and are not published. */
export async function inspectFccpPdf(bytes: Uint8Array): Promise<PdfInspection> {
  if (bytes.length === 0 || bytes.length > MAX_PDF_BYTES || Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
    throw new Error("PDF bytes fail size or signature validation.");
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  const loadingTask = getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const document = await loadingTask.promise;
    if (document.numPages < 1 || document.numPages > MAX_PDF_PAGES) throw new Error("PDF exceeds the page cap.");
    const pages: string[] = [];
    let length = 0;
    for (let page = 1; page <= document.numPages; page += 1) {
      const pdfPage = await document.getPage(page);
      const content = await pdfPage.getTextContent();
      // Keep the PDF's line breaks so the published text stays readable.
      const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "")
        .join("").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      length += text.length;
      if (length > MAX_TEXT_CHARS) throw new Error("Extracted PDF text exceeds the private storage cap.");
      pages.push(text);
      pdfPage.cleanup();
    }
    const extractedText = pages.join("\n\n").trim();
    const quality = length === 0 ? "scanned_or_empty"
      : length < Math.max(200, document.numPages * 50) ? "low_text" : "extractable";
    return { pdfSha256: hash, pdfBytes: bytes.length, pageCount: document.numPages,
      extractedText: extractedText || null, textChars: length, quality };
  } finally {
    await loadingTask.destroy();
  }
}
