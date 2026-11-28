import { describe, expect, it } from "vitest";
import { readEvents, splitRefs } from "./stream";

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
