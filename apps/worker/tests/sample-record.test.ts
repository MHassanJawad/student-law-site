// Verify source metadata distinctions and idempotent version decisions.
import { describe, expect, it } from "vitest";
import { SAMPLE_RECORD, sampleHash, validateSampleRecord, versionAction } from "../src/sample-record.js";

describe("FCCP sample record", () => {
  it("should retain upload date as source metadata without inventing a decision date", () => {
    const record = validateSampleRecord(SAMPLE_RECORD);
    expect(record.uploadDate).toBe("2026-09-25");
    expect(record).not.toHaveProperty("decisionDate");
  });

  it("should avoid a new version when the source metadata hash is unchanged", () => {
    const hash = sampleHash(SAMPLE_RECORD);
    expect(versionAction([hash], hash)).toBe("skip");
    expect(versionAction([], hash)).toBe("insert");
    expect(versionAction(["another-hash"], hash)).toBe("review");
  });

  it("should reject malformed listing dates before import", () => {
    expect(() => validateSampleRecord({ ...SAMPLE_RECORD, uploadDate: "yesterday" })).toThrow();
  });
});
