import { describe, expect, it } from "vitest";
import type { Source } from "./sources";
import { verifyAnswer } from "./verify";

const src = (n: number, body: string, title = `Case ${n}`): Source => ({
  id: `S${n}`, kind: "judgment", title, label: `para ${n}`, body, path: `/j/${n}`, officialUrl: null,
});
const two = [src(1, "Staff of other departments differ in their duties."), src(2, "Risk allowance is limited by the notification.")];
const three = [...two, src(3, "A third passage.")];

describe("verifyAnswer", () => {
  it("accepts a cited answer and renumbers by first use", () => {
    const r = verifyAnswer("ANSWER: Risk allowance is limited [S2]. Staff differ [S1][S2].", two);
    expect(r).toMatchObject({ ok: true, outcome: "answered", text: "Risk allowance is limited [1]. Staff differ [2][1].", problems: [] });
    expect(r.cited.map((s) => s.id)).toEqual(["S2", "S1"]);
  });
  it("rejects an answer with no citations", () => {
    expect(verifyAnswer("ANSWER: Risk allowance is limited.", two)).toMatchObject({ ok: false, problems: ["no_citations"] });
  });
  it("rejects citations to sources that were not supplied", () => {
    expect(verifyAnswer("ANSWER: Risk allowance is limited [S9].", two)).toMatchObject({ ok: false, problems: ["unknown_citation"] });
    expect(verifyAnswer("ANSWER: Limited [S0].", two).problems).toContain("unknown_citation");
  });
  it("expands grouped citations", () => {
    const r = verifyAnswer("ANSWER: Both say so [S1, S3]. Again [S3,S1].", three);
    expect(r).toMatchObject({ ok: true, text: "Both say so [1][2]. Again [2][1]." });
    expect(r.cited.map((s) => s.id)).toEqual(["S1", "S3"]);
    expect(verifyAnswer("ANSWER: Both [S1, S9].", two).problems).toEqual(["unknown_citation"]);
  });
  it("rejects a quote not found in its sources", () => {
    expect(verifyAnswer(`ANSWER: The court said "risk allowance is unlimited for everyone" [S2].`, two).problems).toEqual(["unmatched_quote"]);
  });
  it("checks a quote only against the cited sources", () => {
    expect(verifyAnswer(`ANSWER: It said "risk allowance is limited by the notification" [S1].`, two).problems).toEqual(["unmatched_quote"]);
  });
  it("accepts a quote that differs only in spacing and quote style", () => {
    const s = [src(1, 'He held:  “Risk   allowance is\nlimited by the notification.” Then ‘more’.')];
    expect(verifyAnswer(`ANSWER: It held “risk allowance is limited  by the NOTIFICATION.” [S1].`, s).ok).toBe(true);
    expect(verifyAnswer(`ANSWER: It held "Risk allowance is limited by the notification." [S1].`, s).ok).toBe(true);
  });
  it("ignores short quotes and single-quoted text", () => {
    expect(verifyAnswer(`ANSWER: The "short phrase" and 'a single-quoted invented sentence' [S1].`, two).ok).toBe(true);
  });
  it("rejects a case number absent from the sources", () => {
    expect(verifyAnswer("ANSWER: See C.P.L.A. No. 999-P of 2024 [S1].", two).problems).toEqual(["unsupported_case_reference"]);
  });
  it("accepts a case number that appears inside a source body", () => {
    const s = [src(1, "This order decides CPLA No.544-P/2025 on its merits.")];
    expect(verifyAnswer("ANSWER: In C.P.L.A. No. 544-P of 2025 the court ruled [S1].", s).ok).toBe(true);
  });
  it("accepts a case number that appears in a source title", () => {
    const s = [src(1, "The court ruled.", "Ali v State (C.A. 12 of 2023)")];
    expect(verifyAnswer("ANSWER: In CA No. 12/2023 the court ruled [S1].", s).ok).toBe(true);
  });
  it("allows NOT_FOUND without citations", () => {
    expect(verifyAnswer("NOT_FOUND: The sources do not cover this.", two)).toMatchObject({ ok: true, outcome: "not_found", text: "The sources do not cover this.", cited: [] });
  });
  it("maps CLARIFY and DECLINE and still checks their citations", () => {
    expect(verifyAnswer("CLARIFY: Which case?", two)).toMatchObject({ ok: true, outcome: "clarify" });
    expect(verifyAnswer("DECLINE: Out of scope.", two)).toMatchObject({ ok: true, outcome: "declined" });
    expect(verifyAnswer("NOT_FOUND: Only [S7] mentions it.", two)).toMatchObject({ ok: false, problems: ["unknown_citation"] });
  });
  it("checks quotes in an uncited reply against all sources", () => {
    expect(verifyAnswer(`NOT_FOUND: Only "risk allowance is limited by the notification" appears.`, two).ok).toBe(true);
    expect(verifyAnswer(`NOT_FOUND: Only "an invented sentence that is long enough" appears.`, two).problems).toEqual(["unmatched_quote"]);
  });
  it("rejects output with no outcome marker", () => {
    expect(verifyAnswer("Risk allowance is limited [S2].", two)).toMatchObject({ ok: false, problems: ["missing_marker"] });
    expect(verifyAnswer("The answer: ANSWER: limited [S2].", two).problems).toContain("missing_marker");
  });
  it("accepts leading whitespace and a markdown-bold marker", () => {
    expect(verifyAnswer("\n  **ANSWER:** Limited [S2].", two)).toMatchObject({ ok: true, outcome: "answered", text: "Limited [1]." });
    expect(verifyAnswer("**NOT_FOUND**: Nothing.", two)).toMatchObject({ ok: true, outcome: "not_found", text: "Nothing." });
  });
  it("lists every problem once", () => {
    const r = verifyAnswer(`ANSWER: "an invented sentence that is long enough" and "another invented sentence, also long" in CA 77 of 2020 [S9] [S8].`, two);
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual(["unknown_citation", "unmatched_quote", "unsupported_case_reference"]);
  });
  it("verifies a Roman Urdu answer that quotes English source text", () => {
    const s = [src(1, "We hold that the allowance is limited to personnel performing active, hazardous police duties, and no others.")];
    const raw = `ANSWER: Adalat ne kaha ke "the allowance is limited to personnel performing active, hazardous police duties" [S1].`;
    expect(verifyAnswer(raw, s)).toMatchObject({ ok: true, outcome: "answered" });
  });
});
