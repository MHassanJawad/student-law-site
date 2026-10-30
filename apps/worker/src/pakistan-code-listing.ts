// Parse one Pakistan Code alphabetical page into unreviewed federal law metadata candidates.
import { createHash } from "node:crypto";
import { load } from "cheerio";
import { checkedGet } from "./fccp-fetch.js";

export const PAKISTAN_CODE_ORIGIN = "https://pakistancode.gov.pk";
export const PAKISTAN_CODE_PARSER_VERSION = "pakistan-code-listing-v1";
const ENGLISH_ROOT = `${PAKISTAN_CODE_ORIGIN}/english/`;
const MAX_ROWS = 1000;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december"];

export type LegislationCandidate = {
  identityHash: string;
  metadataHash: string;
  title: string;
  category: string | null;
  officialNumber: string | null;
  promulgationDate: string | null;
  enactmentYear: number | null;
  instrumentType: string | null;
  sourceReviewFlag: string | null;
  detailUrl: string;
};

export type ParsedLetter = {
  candidates: LegislationCandidate[];
  rejected: { row: number; reason: string; title?: string }[];
  excludedOtherTabs: number;
  missingDates: number;
};

const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const clean = (value: string): string => value.replace(/\s+/g, " ").trim();

/** Returns the alphabetical listing URL for one letter. */
export function letterUrl(letter: string): string {
  return `${ENGLISH_ROOT}LGu0xAD.php?alp=${letter}&page=1&action=active`;
}

/** Parses "February 17 1975." into an ISO date, or null when the source gives no valid date. */
function parseSourceDate(value: string): string | null {
  const match = /^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})\.?$/i.exec(value.trim());
  const month = match ? MONTHS.indexOf(match[1].toLowerCase()) : -1;
  if (!match || month < 0) return null;
  const iso = `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

function detailUrlFrom(href: string): string | null {
  try {
    const url = new URL(href, ENGLISH_ROOT);
    if (url.origin !== PAKISTAN_CODE_ORIGIN || url.username || url.password
      || !url.pathname.startsWith("/english/") || url.pathname === "/english/") return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Repeal notes such as "(Repealed by Act XXXIV of 1997)" name other laws, so derived fields ignore them.
const baseTitle = (title: string): string => title.replace(/\s*\(\s*repeal.*$/i, "").trim();

function yearOf(title: string, officialNumber: string | null): number | null {
  const found = /(\d{4})\)?\s*$/.exec(baseTitle(title))?.[1] ?? (officialNumber ? /\bof\s+(\d{4})\b/i.exec(officialNumber)?.[1] : undefined);
  const year = found ? Number(found) : NaN;
  return year >= 1800 && year <= 2200 ? year : null;
}

/**
 * Parses the Federal Laws tab of one letter page. Ordinance, amendment, and subordinate
 * tabs are counted but excluded from this pilot. Fails closed when the layout changes.
 *
 * @param html - The fetched alphabetical listing page.
 * @param letter - The requested letter, used to reject rows from another page.
 * @returns Candidates, rejected rows, and counts of excluded rows and missing dates.
 * @throws {Error} When the letter is invalid, the tabs are missing, or the row cap is exceeded.
 */
export function parsePakistanCodeLetter(html: string, letter: string): ParsedLetter {
  if (!/^[A-Z]$/.test(letter)) throw new Error("Use a single letter A-Z.");
  const $ = load(html);
  const primary = $(".tab-pane#primary-legislation").first();
  if (!primary.length || !$(".tab-pane#ordinance").length) throw new Error("Pakistan Code listing layout changed.");
  const sections = primary.find(".accordion-section");
  if (sections.length > MAX_ROWS) throw new Error("Pakistan Code letter page exceeded its row cap.");
  if (!sections.length && !/No Records Found/i.test(primary.text())) throw new Error("Pakistan Code listing layout changed.");
  const result: ParsedLetter = { candidates: [], rejected: [], excludedOtherTabs: 0, missingDates: 0 };
  $(".tab-pane").not(primary).each((_, pane) => { result.excludedOtherTabs += $(pane).find(".accordion-section").length; });
  const seen = new Set<string>();
  sections.each((index, section) => {
    const link = $(section).find(".accordion-section-title a[href]").first();
    const title = clean(link.text());
    const parts = clean($(section).find(".accordion-section-content").text()).split("|").map(clean);
    const officialNumber = parts[1] || null;
    const detailUrl = detailUrlFrom(link.attr("href") ?? "");
    const identityHash = hash(JSON.stringify([title.toLowerCase(), officialNumber]));
    let reason: string | undefined;
    if (!detailUrl) reason = "invalid official detail URL";
    else if (title.length < 5 || title.length > 500) reason = "invalid title";
    else if (!title.toUpperCase().startsWith(letter)) reason = "title outside requested letter";
    else if (seen.has(identityHash)) reason = "duplicate listing identity";
    if (reason || !detailUrl) {
      result.rejected.push({ row: index + 1, reason: reason ?? "invalid official detail URL", title });
      return;
    }
    seen.add(identityHash);
    const dateText = parts.find((part) => /^Promulgation Date:/i.test(part))?.replace(/^Promulgation Date:\s*/i, "") ?? "";
    const promulgationDate = parseSourceDate(dateText);
    if (!promulgationDate) result.missingDates += 1;
    const category = parts[0] || null;
    const sourceReviewFlag = /Under Review/i.test($(section).text()) ? "Under Review" : null;
    const instrumentType = [...baseTitle(title).matchAll(/\b(Act|Ordinance|Order|Regulations?|Code|Rules)\b/g)].pop()?.[1] ?? null;
    result.candidates.push({
      identityHash,
      metadataHash: hash(JSON.stringify([title, category, officialNumber, promulgationDate, sourceReviewFlag])),
      title, category, officialNumber, promulgationDate, enactmentYear: yearOf(title, officialNumber),
      instrumentType, sourceReviewFlag, detailUrl,
    });
  });
  return result;
}

/**
 * Allows collection only while no robots rule could cover listing pages. The observed
 * policy disallows `/pdffiles/` for Googlebot alone; this worker never requests that path.
 *
 * @param robots - The fetched robots.txt body.
 * @returns True when every Disallow rule is empty or under `/pdffiles/`.
 */
export function pakistanCodeRobotsAllows(robots: string): boolean {
  return robots.replace(/^﻿/, "").split(/\r?\n/)
    .map((line) => line.split("#", 1)[0].trim())
    .filter((line) => /^disallow:/i.test(line))
    .every((line) => /^disallow:\s*(\/pdffiles\/.*)?$/i.test(line));
}

/** Stops collection unless the current robots policy still permits listing pages. */
export async function checkPakistanCodeRobots(): Promise<void> {
  const robots = await checkedGet(`${PAKISTAN_CODE_ORIGIN}/robots.txt`, "text/plain", 32768);
  if (!pakistanCodeRobotsAllows(robots.text)) throw new Error("Pakistan Code robots policy requires review before fetching.");
}

/** Fetches one letter page from the fixed official host after a robots check. */
export async function fetchPakistanCodeLetter(letter: string): Promise<{ html: string; httpStatus: number }> {
  if (!/^[A-Z]$/.test(letter)) throw new Error("Use a single letter A-Z.");
  await checkPakistanCodeRobots();
  const page = await checkedGet(letterUrl(letter), "text/html", 2 * 1024 * 1024);
  return { html: page.text, httpStatus: page.status };
}
