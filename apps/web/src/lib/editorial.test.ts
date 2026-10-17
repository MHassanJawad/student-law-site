// Check editorial collection and search input boundaries.
import { describe, expect, it } from "vitest";
import { EDITORIAL_KIND, parseEditorialQuery } from "./editorial";

describe("editorial queries", () => {
  it("accepts known collections and a bounded search", () => {
    expect(EDITORIAL_KIND.safeParse("maxims").success).toBe(true);
    expect(EDITORIAL_KIND.safeParse("judgments").success).toBe(false);
    expect(parseEditorialQuery(new URLSearchParams("q=  equity  &page=2"))).toEqual({ q: "equity", page: 2 });
  });

  it("rejects oversized searches and invalid pages", () => {
    expect(parseEditorialQuery(new URLSearchParams(`q=${"a".repeat(101)}`))).toBeNull();
    expect(parseEditorialQuery(new URLSearchParams("page=0"))).toBeNull();
  });
});
