// Validate public research input, especially structured citations and dates.
import { describe, expect, it } from "vitest";
import { parseResearchQuery } from "./research-query";

describe("research search filters", () => {
  it("accepts browsing without a query and defaults to case law", () => {
    expect(parseResearchQuery(new URLSearchParams())?.mode).toBe("case-law");
    expect(parseResearchQuery(new URLSearchParams())?.page).toBe(1);
  });

  it("accepts complete reporter citation parts", () => {
    expect(parseResearchQuery(new URLSearchParams("mode=citation&reporter=PLD&citationYear=2024&citationPage=123")))
      .toMatchObject({ reporter: "PLD", citationYear: 2024, citationPage: "123" });
  });

  it("rejects incomplete or punctuation-only citations", () => {
    expect(parseResearchQuery(new URLSearchParams("mode=citation&reporter=PLD"))).toBeNull();
    expect(parseResearchQuery(new URLSearchParams("mode=citation&q=..."))).toBeNull();
  });

  it("rejects invalid calendar dates and reversed ranges", () => {
    expect(parseResearchQuery(new URLSearchParams("mode=advanced&from=2026-02-30"))).toBeNull();
    expect(parseResearchQuery(new URLSearchParams("mode=advanced&from=2026-10-01&to=2026-09-01"))).toBeNull();
  });

  it("rejects unsupported filters and pagination", () => {
    expect(parseResearchQuery(new URLSearchParams("mode=statutes&legalStatus=assumed"))).toBeNull();
    expect(parseResearchQuery(new URLSearchParams("page=-2"))).toBeNull();
  });
});
