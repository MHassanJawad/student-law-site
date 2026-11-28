import { describe, expect, it } from "vitest";
import { packSources, type RetrievedPassage } from "./sources";

const p = (n: number, over: Partial<RetrievedPassage> = {}): RetrievedPassage => ({
  source_type: "judgment", document_id: `d${n}`, entry_id: null, title: `Case ${n}`, case_number: null, decision_date: null,
  paragraph_label: String(n), ordinal: n, body: `body ${n} `.repeat(30), path: `/j/${n}`, official_url: null, rank: n, ...over,
});

describe("packSources", () => {
  it("numbers sources S1 to Sn in rank order", () => {
    expect(packSources([p(1), p(2), p(3)]).map((s) => [s.id, s.title])).toEqual([["S1", "Case 1"], ["S2", "Case 2"], ["S3", "Case 3"]]);
  });
  it("respects the 12,000-character budget", () => {
    const out = packSources(Array.from({ length: 8 }, (_, i) => p(i + 1, { body: `w${i} `.repeat(2500) })));
    expect(out.reduce((n, s) => n + s.body.length, 0)).toBeLessThanOrEqual(12000);
    expect(out.at(-1)!.body.endsWith("…")).toBe(true);
  });
  it("drops duplicate passages", () => {
    expect(packSources([p(1), p(2, { body: p(1).body })])).toHaveLength(1);
  });
  it("labels paragraphs and passages", () => {
    const [a, b, c] = packSources([p(1, { paragraph_label: "12" }), p(2, { paragraph_label: null, ordinal: 3 }), p(3, { source_type: "editorial", paragraph_label: null })]);
    expect([a.label, b.label, c.label]).toEqual(["para 12", "passage 3", null]);
    expect(c.kind).toBe("editorial");
  });
  it("caps at eight sources", () => {
    expect(packSources(Array.from({ length: 12 }, (_, i) => p(i + 1)))).toHaveLength(8);
  });
  it("skips a last source that would get under 200 characters", () => {
    const out = packSources([p(1, { body: "a ".repeat(2995) }), p(2, { body: "b ".repeat(3000) })], 6100);
    expect(out).toHaveLength(1);
  });
});
