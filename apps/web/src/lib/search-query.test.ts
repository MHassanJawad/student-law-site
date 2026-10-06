// Verify public search validation at the API boundary.
import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "./search-query";

describe("search query", () => {
  it("should accept a case identifier and default to the first page", () => {
    expect(parseSearchQuery(new URLSearchParams("q=C.P.L.A.%20No.1285-K"))).toEqual({ q: "C.P.L.A. No.1285-K", page: 1 });
  });

  it("should reject empty queries and invalid pagination", () => {
    expect(parseSearchQuery(new URLSearchParams("q=%20"))).toBeNull();
    expect(parseSearchQuery(new URLSearchParams("q=case&page=-1"))).toBeNull();
  });
});
