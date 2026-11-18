import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isOfficialPdf, MAX_PDF_BYTES } from "./official-pdf";

const pdf = new TextEncoder().encode("%PDF-1.7 minimal body");
const hashOf = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("isOfficialPdf", () => {
  it("accepts PDF bytes matching their hash", () => {
    expect(isOfficialPdf(pdf, hashOf(pdf))).toBe(true);
  });

  it("rejects bytes that do not match the hash", () => {
    expect(isOfficialPdf(pdf, hashOf(new TextEncoder().encode("%PDF-other")))).toBe(false);
  });

  it("rejects non-PDF bytes even when the hash matches", () => {
    const html = new TextEncoder().encode("<html>not found</html>");
    expect(isOfficialPdf(html, hashOf(html))).toBe(false);
  });

  it("rejects files over the response cap", () => {
    const big = new Uint8Array(MAX_PDF_BYTES + 1);
    big.set(pdf);
    expect(isOfficialPdf(big, hashOf(big))).toBe(false);
  });
});
