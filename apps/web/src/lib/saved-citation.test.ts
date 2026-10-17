// Ensure personal notes and folders accept bounded text only.
import { describe, expect, it } from "vitest";
import { normalizeSavedUpdate, SAVED_UPDATE_SCHEMA } from "./saved-citation";

describe("saved citation editing", () => {
  it("accepts a note and folder and clears whitespace-only fields", () => {
    const parsed = SAVED_UPDATE_SCHEMA.parse({ note: "  Research later  ", folder: "  Contracts  " });
    expect(normalizeSavedUpdate(parsed)).toEqual({ note: "Research later", folder: "Contracts" });
    expect(normalizeSavedUpdate(SAVED_UPDATE_SCHEMA.parse({ note: "   " }))).toEqual({ note: null });
  });

  it("rejects empty updates, unexpected fields, and oversized content", () => {
    expect(SAVED_UPDATE_SCHEMA.safeParse({}).success).toBe(false);
    expect(SAVED_UPDATE_SCHEMA.safeParse({ owner_id: "other" }).success).toBe(false);
    expect(SAVED_UPDATE_SCHEMA.safeParse({ folder: "x".repeat(81) }).success).toBe(false);
    expect(SAVED_UPDATE_SCHEMA.safeParse({ note: "x".repeat(2001) }).success).toBe(false);
  });
});
