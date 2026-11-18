import { describe, expect, it } from "vitest";
import { pakistanCodeRobotsAllows, parsePakistanCodeLetter } from "../src/pakistan-code-listing.js";

const row = (title: string, details: string, href = "UY2FqaJw1-apaUY2Fqa-bpuUY2Fp-sg-jjjjjjjjjjjjj") => `
  <div class="accordion-section">
    <div class='accordion-section-title' data-tab='#a'><a href="${href}">${title}</a></div>
    <div class='accordion-section-content' id='a'>${details}
      <font size='2' color='#006600'>Under Review</font></div>
  </div>`;
const page = (primary: string, ordinance = "") => `<div class="tab-content" id="pills-tabContent">
  <div class="tab-pane fade show active" id="primary-legislation">${primary}</div>
  <div class="tab-pane fade" id="ordinance">${ordinance}</div>
  <div class="tab-pane fade" id="amendment"></div></div>`;
const ACT = row("Abandoned Properties (Management) Act, 1975",
  `Civil Laws | <font size="3">XX of 1975</font> | <font size="3">Promulgation Date: February 17 1975. | Archive 0 | </font>`);

describe("Pakistan Code listing adapter", () => {
  it("should parse a federal law row into unreviewed metadata without asserting legal status", () => {
    const result = parsePakistanCodeLetter(page(ACT), "A");
    expect(result.rejected).toEqual([]);
    expect(result.candidates).toMatchObject([{
      title: "Abandoned Properties (Management) Act, 1975", category: "Civil Laws", officialNumber: "XX of 1975",
      promulgationDate: "1975-02-17", enactmentYear: 1975, instrumentType: "Act", sourceReviewFlag: "Under Review",
      detailUrl: "https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-bpuUY2Fp-sg-jjjjjjjjjjjjj",
    }]);
  });

  it("should read only the Federal Laws tab and leave ordinances out of the pilot", () => {
    const ordinance = row("Auqaf (Federal Control) (Repeal) Ordinance, 1979", "General Laws | Ordinance No.XXII of 1979 |");
    const result = parsePakistanCodeLetter(page(ACT, ordinance), "A");
    expect(result.candidates).toHaveLength(1);
    expect(result.excludedOtherTabs).toBe(1);
  });

  it("should keep identity when a date changes and record an unreadable date as unknown", () => {
    const first = parsePakistanCodeLetter(page(ACT), "A").candidates[0];
    const changed = parsePakistanCodeLetter(page(row("Abandoned Properties (Management) Act, 1975",
      "Civil Laws | XX of 1975 | Promulgation Date: . |")), "A").candidates[0];
    expect(changed.identityHash).toBe(first.identityHash);
    expect(changed.metadataHash).not.toBe(first.metadataHash);
    expect(changed.promulgationDate).toBeNull();
  });

  it("should ignore repeal notes when deriving type and year, keeping the source title verbatim", () => {
    const title = "Pakistan Environmental Protection Ordinance 1983 (Repealed by Act XXXIV of 1997,s.34)";
    const [candidate] = parsePakistanCodeLetter(page(row(title, "General Laws | XXXVII of 1983 |")), "P").candidates;
    expect(candidate).toMatchObject({ title, instrumentType: "Ordinance", enactmentYear: 1983 });
  });

  it("should reject foreign links, PDF paths, other letters, and duplicate rows", () => {
    const rows = [
      row("Arbitration Act, 1940", "Civil Laws | X of 1940 |", "https://example.com/law"),
      row("Arms Act, 1878", "Criminal Laws | XI of 1878 |", "/pdffiles/arms.pdf"),
      row("Boilers Act, 1923", "General Laws | V of 1923 |"),
      ACT, ACT,
    ].join("");
    const result = parsePakistanCodeLetter(page(rows), "A");
    expect(result.candidates).toHaveLength(1);
    expect(result.rejected.map((item) => item.reason)).toEqual([
      "invalid official detail URL", "invalid official detail URL", "title outside requested letter", "duplicate listing identity",
    ]);
  });

  it("should fail closed when the layout changes, and accept a letter with no records", () => {
    expect(() => parsePakistanCodeLetter("<html><body>New design</body></html>", "A")).toThrow(/layout changed/);
    expect(parsePakistanCodeLetter(page("No Records Found."), "X").candidates).toEqual([]);
    expect(() => parsePakistanCodeLetter(page(ACT), "AB")).toThrow(/single letter/);
  });
});

describe("Pakistan Code robots policy", () => {
  it("should allow the observed policy, which restricts only Googlebot from PDF files", () => {
    expect(pakistanCodeRobotsAllows("https://pakistancode.gov.pk/sitemap.xml\n\nUser-agent: googlebot\nDisallow: /pdffiles/\n")).toBe(true);
    expect(pakistanCodeRobotsAllows("User-agent: *\nDisallow:\n")).toBe(true);
  });

  it("should stop on any rule that could cover listing pages", () => {
    expect(pakistanCodeRobotsAllows("User-agent: *\nDisallow: /english/\n")).toBe(false);
    expect(pakistanCodeRobotsAllows("User-agent: *\nDisallow: /\n")).toBe(false);
    expect(pakistanCodeRobotsAllows("User-agent: googlebot\nDisallow: /\n")).toBe(false);
  });
});
