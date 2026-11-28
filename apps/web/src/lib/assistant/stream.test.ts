import { describe, expect, it } from "vitest";
import { buildHistory, readEvents, safeOfficialUrl, safeSitePath, splitRefs } from "./stream";

const bodyOf = (chunks: string[]) => new ReadableStream<Uint8Array>({
  start(c) { const e = new TextEncoder(); chunks.forEach((x) => c.enqueue(e.encode(x))); c.close(); },
});

describe("readEvents", () => {
  it("buffers partial lines and parses an unterminated final line", async () => {
    const got: unknown[] = [];
    await readEvents(bodyOf(['{"type":"status","sta', 'ge":"planning"}\n{"type":"sta', 'tus","stage":"writing"}\nnot json\n{"type":"status","stage":"checking"}']), (e) => got.push(e));
    expect(got).toEqual([{ type: "status", stage: "planning" }, { type: "status", stage: "writing" }, { type: "status", stage: "checking" }]);
  });
});

describe("splitRefs", () => {
  it("splits adjacent markers and leaves other brackets alone", () => {
    expect(splitRefs("A [1][2] and [x] <b>")).toEqual([{ text: "A " }, { ref: 1 }, { ref: 2 }, { text: " and [x] <b>" }]);
  });
});

describe("link guards", () => {
  it("allows only http(s) official urls", () => {
    expect(safeOfficialUrl("javascript:alert(1)")).toBeNull();
    expect(safeOfficialUrl("data:text/html,<b>x</b>")).toBeNull();
    expect(safeOfficialUrl(null)).toBeNull();
    expect(safeOfficialUrl("https://fccp.gov.pk/x")).toBe("https://fccp.gov.pk/x");
  });
  it("allows only site-relative paths", () => {
    expect(safeSitePath("//evil.com")).toBeNull();
    expect(safeSitePath("javascript:alert(1)")).toBeNull();
    expect(safeSitePath("/documents/abc")).toBe("/documents/abc");
  });
});

describe("buildHistory", () => {
  const t = (q: string, outcome?: string, text = "") => ({ question: q, answer: outcome ? { outcome, text } : undefined });
  it("strips markers and skips non-answered turns", () => {
    expect(buildHistory([t("a", "answered", "Yes [1][2] it is [3]."), t("b", "not_found", "x"), t("c", "unverified", "y"), t("d")]))
      .toEqual([{ role: "user", content: "a" }, { role: "assistant", content: "Yes it is." }]);
  });
  it("keeps the most recent 8 messages", () => {
    const turns = Array.from({ length: 6 }, (_, i) => t(`q${i}`, "answered", `a${i}`));
    const h = buildHistory(turns);
    expect(h).toHaveLength(8);
    expect(h[0].content).toBe("q2");
    expect(h[7].content).toBe("a5");
  });
});
