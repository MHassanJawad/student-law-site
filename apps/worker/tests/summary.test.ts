import { describe, expect, it } from "vitest";
import { cleanSummary, summaryInput } from "../src/summary.js";

describe("AI summary helpers", () => {
  it("keeps short text and trims long text to its start and end", () => {
    expect(summaryInput("  short judgment  ", 2000)).toBe("short judgment");
    const long = `START${"x".repeat(10000)}END`;
    const input = summaryInput(long, 2000);
    expect(input.startsWith("START")).toBe(true);
    expect(input.endsWith("END")).toBe(true);
    expect(input).toContain("omitted");
    expect(input.length).toBeLessThan(2100);
  });

  it("drops refusals, preambles, and unusable lengths", () => {
    expect(cleanSummary("INSUFFICIENT")).toBeNull();
    expect(cleanSummary("Too short.")).toBeNull();
    expect(cleanSummary("x".repeat(2001))).toBeNull();
    const text = "The petitioner challenged a tax assessment. The court dismissed the petition.";
    expect(cleanSummary(`Summary:\n${text}`)).toBe(text);
  });
});
