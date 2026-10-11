// Bounded FCCP enumeration must reject drift before any staging work.
import { describe, expect, it } from "vitest";
import { enumerateFccp } from "../src/fccp-enumerate.js";

function row(number: number): string {
  return `<tr><td data-label="Case Title">C.P.L.A. No. ${number} of 2025</td>
    <td data-label="Author Judge">Justice Example</td><td data-label="Type">Judgement</td>
    <td data-label="Upload Date">2026-10-02</td>
    <td data-label="Download"><a href="https://www.fccp.gov.pk/download/${number}">Download</a></td></tr>`;
}

function page(first: number, last: number, total: number): string {
  const rows = Array.from({ length: last - first + 1 }, (_, index) => row(first + index)).join("");
  const next = last < total
    ? `<a rel="next" href="https://www.fccp.gov.pk/judgements?page=${Math.floor(last / 10) + 1}">Next</a>` : "";
  return `<table><tbody>${rows}</tbody></table><nav class="pagination">${next}</nav>
    <p class="pagination-summary">Showing ${first}&ndash;${last} of ${total}</p>`;
}

describe("FCCP full-listing enumeration", () => {
  it("collects every row, pauses between requests, and rechecks page one", async () => {
    const requests: number[] = [];
    const waits: number[] = [];
    const result = await enumerateFccp(async (number) => {
      requests.push(number);
      return { html: number === 1 ? page(1, 10, 11) : page(11, 11, 11), httpStatus: 200 };
    }, async (milliseconds) => { waits.push(milliseconds); });
    expect(requests).toEqual([1, 2, 1]);
    expect(waits).toEqual([5000, 5000]);
    expect(result.candidates).toHaveLength(11);
    expect(result.sourceTotal).toBe(11);
    expect(result.pageCount).toBe(2);
  });

  it("rejects a shifting listing before returning a snapshot", async () => {
    let firstPageReads = 0;
    await expect(enumerateFccp(async (number) => {
      if (number === 1) firstPageReads += 1;
      const html = number === 2 ? page(11, 11, 11)
        : firstPageReads === 1 ? page(1, 10, 11) : page(1, 10, 12);
      return { html, httpStatus: 200 };
    }, async () => undefined)).rejects.toThrow(/changed during enumeration/);
  });

  it("rejects an inconsistent page range", async () => {
    await expect(enumerateFccp(async (number) => ({
      html: number === 1 ? page(1, 10, 11) : page(12, 12, 11), httpStatus: 200,
    }), async () => undefined)).rejects.toThrow(/inconsistent pagination range/);
  });

  it("keeps a source row with a blank upload date in the complete snapshot", async () => {
    const badFinalPage = page(11, 11, 11).replace('data-label="Upload Date">2026-10-02', 'data-label="Upload Date">');
    const result = await enumerateFccp(async (number) => ({
      html: number === 1 ? page(1, 10, 11) : badFinalPage, httpStatus: 200,
    }), async () => undefined);
    expect(result.candidates).toHaveLength(11);
    expect(result.candidates.at(-1)?.uploadDate).toBeNull();
    expect(result.rejected).toEqual([]);
    expect(result.sourceTotal).toBe(11);
  });

  it("counts a repeated title as a duplicate only when official PDF bytes match", async () => {
    const repeated = page(11, 11, 11)
      .replace("C.P.L.A. No. 11 of 2025", "C.P.L.A. No. 1 of 2025")
      .replace('data-label="Upload Date">2026-10-02', 'data-label="Upload Date">');
    const listing = async (number: number) => ({
      html: number === 1 ? page(1, 10, 11) : repeated, httpStatus: 200,
    });
    const matched = await enumerateFccp(listing, async () => undefined,
      async () => new Uint8Array([37, 80, 68, 70, 45, 1]));
    expect(matched.candidates).toHaveLength(10);
    expect(matched.duplicates).toHaveLength(1);
    expect(matched.rejected).toEqual([]);
    expect(matched.missingUploadDates).toBe(1);

    const mismatched = await enumerateFccp(listing, async () => undefined,
      async (url) => new Uint8Array([37, 80, 68, 70, 45, Number(url.endsWith("/11"))]));
    expect(mismatched.duplicates).toEqual([]);
    expect(mismatched.rejected).toMatchObject([{ page: 2, row: 1, reason: "same title but different PDF bytes" }]);
  });
});
