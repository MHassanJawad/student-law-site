import { describe, expect, it } from "vitest";
import { parseFccpPage, pakistanDate } from "../src/fccp-listing.js";
import { robotsAllowsListing } from "../src/fccp-fetch.js";
import { item, page, sha } from "./fccp-fixtures.js";

describe("FCCP API adapter", () => {
  it("keeps the identity and metadata hashes of the retired HTML parser", () => {
    // Values staged by fccp-listing-v1 for this row; a change here would quarantine every published judgment.
    const [candidate] = parseFccpPage(page([item("C.P.L.A. No. 1285-K of 2023")])).candidates;
    expect(candidate.identityHash).toBe(sha(JSON.stringify(["c.p.l.a. no. 1285-k of 2023", "Judgement"])));
    expect(candidate.metadataHash).toBe(sha(JSON.stringify(["C.P.L.A. No. 1285-K of 2023", "Mr. Justice Example", "Judgement", "2026-10-02"])));
    expect(candidate.downloadUrl).toBe(`https://fccp.gov.pk/api/public/site/files/${sha("C.P.L.A. No. 1285-K of 2023")}`);
  });

  it("dates items in Pakistan time", () => {
    expect(pakistanDate("2026-10-01T19:00:00Z")).toBe("2026-10-02");
    expect(pakistanDate("2026-11-13T11:30:00Z")).toBe("2026-11-13");
  });

  it("rejects bad rows individually and duplicate identities", () => {
    const badFile = { ...item("Missing file case"), files: [] };
    const result = parseFccpPage(page([item("Valid case"), badFile, item("Valid case"), { kind: "news" }]));
    expect(result.candidates).toHaveLength(1);
    expect(result.rejected.map((entry) => entry.reason)).toEqual([
      "missing or oversized official PDF", "duplicate listing identity", "invalid or unrecognised listing item",
    ]);
  });

  it("stops on a changed API shape or restrictive robots rule", () => {
    expect(() => parseFccpPage({ results: [] })).toThrow(/shape changed/);
    expect(robotsAllowsListing("User-agent: *\nDisallow:\n")).toBe(true);
    expect(robotsAllowsListing("User-agent: *\nDisallow: /api\n")).toBe(false);
  });
});
