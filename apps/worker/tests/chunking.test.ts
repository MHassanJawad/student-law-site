import { describe, expect, it } from "vitest";
import { chunkText } from "../src/chunking.js";

const para = (label: string, n: number) => `${label} ${"x".repeat(n - label.length - 1)}`;

describe("chunkText", () => {
  it("returns no chunks for empty or whitespace text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("  \n ")).toEqual([]);
  });

  it("keeps a short judgment as one chunk", () => {
    const chunks = chunkText("a".repeat(300));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ ordinal: 0, charStart: 0 });
  });

  it("packs paragraphs up to the target size", () => {
    const text = Array.from({ length: 12 }, () => "y".repeat(400)).join("\n\n");
    const chunks = chunkText(text);
    expect(chunks.every((c) => c.body.length <= 2400)).toBe(true);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.length).toBeLessThanOrEqual(4);
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
  });

  it("labels chunks by their first numbered paragraph", () => {
    const text = ["Intro.", para("2.", 1000), para("3.", 1000)].join("\n\n");
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.paragraphLabel).toBe("2");
    expect(chunks[1]!.paragraphLabel).toBe("3");
  });

  it("splits an oversized paragraph at sentence ends", () => {
    const text = Array.from({ length: 200 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.body.length <= 2400)).toBe(true);
    expect(chunks.slice(0, -1).every((c) => c.body.endsWith("."))).toBe(true);
  });

  it("maps offsets back to the source text", () => {
    const text = ["Intro.", para("1.", 900), para("2.", 900), "z ".repeat(2000), para("3.", 500)].join("\n\n");
    for (const c of chunkText(text)) expect(text.slice(c.charStart, c.charEnd).trim()).toBe(c.body);
  });
});
