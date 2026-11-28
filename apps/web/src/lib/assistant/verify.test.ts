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
  it("compares whole case numbers, not fragments", () => {
    const s = [src(1, "Decided in C.P.L.A. No. 1234 of 2020 last year.")];
    for (const c of ["CPLA 12", "C.P.L.A. No. 1", "CPLA No. 123", "CPLA 1234 of 2021"]) {
      expect(verifyAnswer(`ANSWER: See ${c} [S1].`, s).problems).toEqual(["unsupported_case_reference"]);
    }
    expect(verifyAnswer("ANSWER: See CPLA 1234/2020 [S1].", s).ok).toBe(true);
  });
  it("does not find a case number across word boundaries", () => {
    const s = [src(1, "The trip ended in Jamaica 7 of 2018 records.")];
    expect(verifyAnswer("ANSWER: See CA 7 of 2018 [S1].", s).problems).toEqual(["unsupported_case_reference"]);
  });
  it("accepts a yearless case number that matches a source number", () => {
    const s = [src(1, "This order decides CPLA No.544-P/2025 on its merits.")];
    expect(verifyAnswer("ANSWER: In CPLA 544-P the court ruled [S1].", s).ok).toBe(true);
    expect(verifyAnswer("ANSWER: In CPLA 54 the court ruled [S1].", s).ok).toBe(false);
  });
  it("does not let a split number and year pose as a yearless number", () => {
    const s = [src(1, "Listed as CPLA 12345 only.")];
    expect(verifyAnswer("ANSWER: In CPLA 1/2345 [S1].", s).ok).toBe(false);
    expect(verifyAnswer("ANSWER: In CPLA 12345 [S1].", s).ok).toBe(true);
  });
  it("rejects law-report citations absent from the sources (final review probe)", () => {
    const s = [src(1, "We hold that the limitation rule doesn't apply to minors in any case.")];
    expect(verifyAnswer("ANSWER: Held in PLD 2019 SC 123 and 2021 SCMR 456 that limitation applies [S1].", s).problems).toEqual(["unsupported_case_reference"]);
    expect(verifyAnswer("ANSWER: Held in PLD 2019 SC 123 [S1].", s).problems).toEqual(["unsupported_case_reference"]);
    expect(verifyAnswer("ANSWER: Held in 2021 SCMR 456 [S1].", s).problems).toEqual(["unsupported_case_reference"]);
  });
  it("accepts a law-report citation present in a source, across spacing and dot variants", () => {
    const s = [src(1, "Reliance was placed on PLD 2019 SC 123, 2021 SCMR 456, 2018 P.Cr.L.J 789 and 2020 PLC (C.S.) 45.")];
    for (const c of ["PLD 2019 SC 123", "P.L.D. 2019 SC 123", "2021 SCMR 456", "2018 PCrLJ 789", "2018 PCr.LJ 789", "2020 PLC (C.S.) 45"]) {
      expect(verifyAnswer(`ANSWER: See ${c} [S1].`, s).ok).toBe(true);
    }
    for (const c of ["PLD 2019 SC 12", "PLD 2019 SC 1234", "PLD 2019 Lah 123", "2021 SCMR 4567", "2022 SCMR 456", "2018 YLR 789", "2020 PLC 45"]) {
      expect(verifyAnswer(`ANSWER: See ${c} [S1].`, s).problems).toEqual(["unsupported_case_reference"]);
    }
  });
  it("does not read ordinary text with years as a law-report citation", () => {
    expect(verifyAnswer("ANSWER: In 2019 the court decided 123 appeals, and by 2021 some 456 more [S1].", two).ok).toBe(true);
  });
  it("rejects citation forms it cannot parse", () => {
    for (const bad of ["[s9]", "[S1-S3]", "[S1–S9]", "【S1】"]) {
      expect(verifyAnswer(`ANSWER: Risk allowance is limited ${bad} [S2].`, two)).toMatchObject({ ok: false, problems: ["unknown_citation"] });
    }
  });
  it("leaves parenthesised statutory references alone", () => {
    for (const ref of ["(s 12)", "(S2)", "(s. 5)", "（S3）"]) {
      expect(verifyAnswer(`ANSWER: Risk allowance under the Act ${ref} is limited [S2].`, two).ok).toBe(true);
    }
    expect(verifyAnswer("ANSWER: Limited ［S1］ [S2].", two).problems).toEqual(["unknown_citation"]);
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

describe("verifyAnswer elided quotes", () => {
  const body = "The equivalence certificate carries legal significance within its sphere. It does not create an absolute or vested right to admission. The University may prescribe minimum credit hours for its programme.";
  const one = [src(1, body)];
  it("accepts an elided quote whose segments appear in order in one cited source", () => {
    expect(verifyAnswer(`ANSWER: It held "the equivalence certificate carries legal significance … does not create an absolute or vested right" [S1].`, one).ok).toBe(true);
    expect(verifyAnswer(`ANSWER: It held "does not create an absolute or vested right... may prescribe minimum credit hours" [S1].`, one).ok).toBe(true);
  });
  it("rejects segments out of order", () => {
    expect(verifyAnswer(`ANSWER: It held "may prescribe minimum credit hours … the equivalence certificate carries" [S1].`, one).problems).toEqual(["unmatched_quote"]);
  });
  it("rejects segments split across two different sources", () => {
    const split = [src(1, "The equivalence certificate carries legal significance."), src(2, "It does not create an absolute or vested right.")];
    expect(verifyAnswer(`ANSWER: It held "the equivalence certificate carries legal significance … does not create an absolute or vested right" [S1, S2].`, split).problems).toEqual(["unmatched_quote"]);
  });
  it("rejects a segment shorter than 12 characters", () => {
    expect(verifyAnswer(`ANSWER: It held "the equivalence certificate carries … admission" [S1].`, one).problems).toEqual(["unmatched_quote"]);
  });
  it("rejects a made-up segment", () => {
    expect(verifyAnswer(`ANSWER: It held "the equivalence certificate carries legal significance … and binds every university forever" [S1].`, one).problems).toEqual(["unmatched_quote"]);
  });
  it("checks an uncited reply's elided quote against one supplied source", () => {
    expect(verifyAnswer(`NOT_FOUND: Only "create an absolute or vested right … may prescribe minimum credit hours" appears.`, one).ok).toBe(true);
  });
  it("rejects an elision that stitches the holding onto a party's argument (review probe)", () => {
    const s = [src(1, "Learned counsel for the petitioner argued that the petitioner, having served for twenty years, was entitled to full relief. We have considered the submissions. The court held that the petitioner had not exhausted the departmental remedy and the petition is dismissed.")];
    expect(verifyAnswer(`ANSWER: It ruled "the court held that the petitioner … was entitled to full relief" [S1].`, s).problems).toEqual(["unmatched_quote"]);
    // The same stitch inside one sentence still fails when the skipped text holds a negation.
    const t = [src(1, "The court held that the petitioner was not shown to have been entitled to full relief.")];
    expect(verifyAnswer(`ANSWER: It ruled "the court held that the petitioner … entitled to full relief" [S1].`, t).problems).toEqual(["unmatched_quote"]);
  });
  it("rejects an elision that drops a negation (review probe)", () => {
    const s = [src(1, "On the evidence, the accused person is not guilty of the offence charged.")];
    expect(verifyAnswer(`ANSWER: It found "the accused person is … guilty" [S1].`, s).problems).toEqual(["unmatched_quote"]);
    expect(verifyAnswer(`ANSWER: It found "the accused person is … guilty of the offence charged" [S1].`, s).problems).toEqual(["unmatched_quote"]);
  });
  it("rejects every negation form in the skipped text", () => {
    for (const neg of ["not", "No", "never", "neither", "nor", "without", "cannot", "wasn't", "didn’t"]) {
      const s = [src(1, `The first segment here is long ${neg} and the second segment here is long.`)];
      expect(verifyAnswer(`ANSWER: "the first segment here is long … the second segment here is long" [S1].`, s).problems).toEqual(["unmatched_quote"]);
    }
  });
  it("rejects an elision that cuts a contraction to flip a negation (final review probe)", () => {
    const s = [src(1, "We hold that the limitation rule doesn't apply to minors in any case.")];
    expect(verifyAnswer(`ANSWER: The court said "the limitation rule does … apply to minors in any case" [S1].`, s).problems).toEqual(["unmatched_quote"]);
    expect(verifyAnswer(`ANSWER: The court said "the limitation rule doesn … apply to minors in any case" [S1].`, s).problems).toEqual(["unmatched_quote"]);
  });
  it("rejects a segment that ends mid-word to drop a negation (review probe)", () => {
    const s = [src(1, "On the evidence, the accused person is not guilty of the offence charged.")];
    expect(verifyAnswer(`ANSWER: It found "the accused person is no … guilty of the offence charged" [S1].`, s).problems).toEqual(["unmatched_quote"]);
    expect(verifyAnswer(`ANSWER: It found "the accused person is no" [S1].`, s).problems).toEqual(["unmatched_quote"]);
  });
  it("requires each segment to start and end on a word boundary", () => {
    const s = [src(1, "The Commission, acting under its statute, may determine the equivalence of academic qualifications.")];
    expect(verifyAnswer(`ANSWER: It says "he Commission, acting … may determine the equivalence" [S1].`, s).problems).toEqual(["unmatched_quote"]);
    expect(verifyAnswer(`ANSWER: It says "the Commission, acting … may determine the equivalen" [S1].`, s).problems).toEqual(["unmatched_quote"]);
    expect(verifyAnswer(`ANSWER: It says "the Commission, acting … may determine the equivalence" [S1].`, s).ok).toBe(true);
  });
  it("rejects a quote with three segments", () => {
    expect(verifyAnswer(`ANSWER: "the equivalence certificate carries … an absolute or vested right … minimum credit hours for" [S1].`, one).problems).toEqual(["unmatched_quote"]);
  });
  it("rejects a gap longer than 150 characters", () => {
    const s = [src(1, `The first segment here is long, ${"and so on ".repeat(16)}and the second segment here is long.`)];
    expect(verifyAnswer(`ANSWER: "the first segment here is long … the second segment here is long" [S1].`, s).problems).toEqual(["unmatched_quote"]);
  });
  it("accepts a legitimate elision with a short, negation-free gap", () => {
    const s = [src(1, "The Commission, acting under its statute, may determine the equivalence of academic qualifications.")];
    expect(verifyAnswer(`ANSWER: It says "the Commission … may determine the equivalence of academic qualifications" [S1].`, s).ok).toBe(true);
    expect(verifyAnswer(`ANSWER: It says "the commission, acting … may determine the equivalence of academic qualifications" [S1].`, s).ok).toBe(true);
  });
  it("accepts a real gpt-oss elided quote (eval run 4, topic-hec-equivalence-admission)", () => {
    // Model output recorded verbatim during the Task 12 eval; it failed with unmatched_quote before elision support.
    const raw = "ANSWER: An HEC equivalence certificate does not obligate a university to admit a student to its M.Phil programme if the university’s own credit‑hour criteria are not met. The Higher Education Commission may determine equivalence of qualifications, but that recognition “does not, by itself, confer an automatic, indefeasible or unconditional right on the holder … to seek or secure admission to any particular academic programme offered by the University” and the university retains autonomy to prescribe additional eligibility requirements such as minimum credit hours [S1]. Accordingly, even with an equivalence certificate, the university was legally competent to decline admission on the ground that the qualifying degree did not satisfy the university’s prescribed credit‑hour requirement [S2]. This is educational research, not legal advice.";
    // Excerpts of the real C.P.L.A. No. 1836-L of 2019 passages supplied as S1 and S2.
    const real = [
      src(1, "However, according to learned counsel, such\nequivalence does not, by itself, confer an automatic, indefeasible or\nunconditional right on the holder of the qualification to seek or secure\nadmission to any particular academic programme offered by the\nUniversity.", "C.P.L.A. No. 1836-L of 2019"),
      src(2, "The petitioner has failed to demonstrate that the\nUniversity’s requirement relating to credit hours was unlawful,\ndiscriminatory, arbitrary or otherwise inconsistent with the university’s\nstatutory framework.", "C.P.L.A. No. 1836-L of 2019"),
    ];
    expect(verifyAnswer(raw, real)).toMatchObject({ ok: true, outcome: "answered", problems: [] });
    expect(verifyAnswer(raw.replace("to seek or secure admission", "to demand admission"), real).problems).toEqual(["unmatched_quote"]);
  });
});
