import { describe, expect, it } from "vitest";
import { passwordError } from "./password-policy";

describe("password policy", () => {
  it("accepts matching passwords that satisfy every rule", () => {
    expect(passwordError("Research!26", "Research!26")).toBe("");
  });
  it.each([
    ["Aa1!", "at least 8"],
    ["research!26", "uppercase"],
    ["RESEARCH!26", "lowercase"],
    ["Research!!", "number"],
    ["Research26", "symbol"],
    ["Research26 ", "symbol"],
  ])("explains the missing rule for %s", (value, expected) => {
    expect(passwordError(value, value)).toContain(expected);
  });
  it("rejects empty and mismatched confirmation without trimming passwords", () => {
    expect(passwordError("Research!26", "")).toContain("do not match");
    expect(passwordError("Research!26", "Research!26 ")).toContain("do not match");
    expect(passwordError("", "")).toContain("at least 8");
  });
});
