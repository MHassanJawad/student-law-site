import { describe, expect, it } from "vitest";
import { parseFccpListing } from "../src/fccp-listing.js";
import { robotsAllowsListing } from "../src/fccp-fetch.js";

const row = (title: string, date = "2026-10-02", link = "https://www.fccp.gov.pk/download/test") => `
  <tr><td class="file-table__title" data-label="Case Title">${title}</td>
  <td data-label="Author Judge">Mr. Justice Example</td><td data-label="Type">Judgement</td>
  <td data-label="Upload Date">${date}</td><td data-label="Download"><a href="${link}">DOWNLOAD</a></td></tr>`;
const page = (rows: string) => `<table><tbody>${rows}</tbody></table><p class="pagination-summary">Showing 1&ndash;10 of 111</p>`;

describe("FCCP metadata adapter", () => {
  it("parses an official-style row and keeps upload date separate from a decision date", () => {
    const result = parseFccpListing(page(row("C.P.L.A. No. 1285-K of 2023")));
    expect(result.candidates).toMatchObject([{ title: "C.P.L.A. No. 1285-K of 2023", uploadDate: "2026-10-02" }]);
    expect(result.sourceTotal).toBe(111);
    expect(result.rejected).toEqual([]);
  });

  it("keeps an item's identity when the source changes its upload date", () => {
    const first = parseFccpListing(page(row("C.P.L.A. No. 1285-K of 2023", "2026-10-02"))).candidates[0];
    const revised = parseFccpListing(page(row("C.P.L.A. No. 1285-K of 2023", "2026-10-03"))).candidates[0];
    expect(revised.identityHash).toBe(first.identityHash);
    expect(revised.metadataHash).not.toBe(first.metadataHash);
  });

  it("quarantines foreign links, impossible dates, and duplicate identities", () => {
    const result = parseFccpListing(page(
      row("Valid case") + row("Foreign case", "2026-10-02", "https://evil.example/download/file")
      + row("Bad date case", "2026-02-30") + row("Valid case"),
    ));
    expect(result.candidates).toHaveLength(1);
    expect(result.rejected.map((item) => item.reason)).toEqual([
      "invalid official download URL", "invalid upload date", "duplicate listing identity",
    ]);
  });

  it("stops on a changed page layout or restrictive robots rule", () => {
    expect(() => parseFccpListing("<html><body>No listing table</body></html>")).toThrow(/layout changed/);
    expect(robotsAllowsListing("User-agent: *\nDisallow:\n")).toBe(true);
    expect(robotsAllowsListing("User-agent: *\nDisallow: /judgements\n")).toBe(false);
    expect(robotsAllowsListing("User-agent: *\nDisallow: /\n")).toBe(false);
  });
});
