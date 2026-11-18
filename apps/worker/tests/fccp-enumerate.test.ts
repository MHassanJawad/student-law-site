// Full FCCP enumeration must reject drift before any staging work.
import { describe, expect, it } from "vitest";
import { enumerateFccp } from "../src/fccp-enumerate.js";
import { item, page } from "./fccp-fixtures.js";

const first = page([item("C.P.L.A. No. 1 of 2025"), item("C.P.L.A. No. 2 of 2025")], 3, "cursor-2");
const second = page([item("C.P.L.A. No. 3 of 2025")], 3);

describe("FCCP full-listing enumeration", () => {
  it("follows cursors, pauses between requests, and rechecks page one", async () => {
    const requests: (string | null)[] = [];
    const waits: number[] = [];
    const result = await enumerateFccp(async (cursor) => {
      requests.push(cursor);
      return { json: cursor ? second : first, httpStatus: 200 };
    }, async (milliseconds) => { waits.push(milliseconds); });
    expect(requests).toEqual([null, "cursor-2", null]);
    expect(waits).toEqual([5000, 5000]);
    expect(result.candidates).toHaveLength(3);
    expect(result.pageCount).toBe(2);
  });

  it("rejects a shifting listing", async () => {
    let firstReads = 0;
    await expect(enumerateFccp(async (cursor) => {
      if (!cursor) firstReads += 1;
      const json = cursor ? second : firstReads === 1 ? first : page([item("C.P.L.A. No. 9 of 2025")], 3, "cursor-2");
      return { json, httpStatus: 200 };
    }, async () => undefined)).rejects.toThrow(/changed during enumeration/);
  });

  it("rejects a count that does not match the source total", async () => {
    await expect(enumerateFccp(async () => ({ json: page([item("C.P.L.A. No. 1 of 2025")], 2), httpStatus: 200 }),
      async () => undefined)).rejects.toThrow(/does not match/);
  });
});
