// Manually triggered, metadata-only Pakistan Code pilot: one letter per run. Nothing is published automatically.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  PAKISTAN_CODE_ORIGIN, PAKISTAN_CODE_PARSER_VERSION, fetchPakistanCodeLetter, letterUrl, parsePakistanCodeLetter,
  type LegislationCandidate,
} from "./pakistan-code-listing.js";

function localClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.startsWith("replace-with-")) throw new Error("Set local worker credentials.");
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Pilot import requires local Supabase.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function sourceId(client: SupabaseClient): Promise<string> {
  const { data: existing, error: readError } = await client.from("source_registry").select("id")
    .eq("code", "PAKISTAN_CODE_OFFICIAL").maybeSingle();
  if (readError) throw readError;
  if (existing) return existing.id;
  const { data, error } = await client.from("source_registry").insert({
    code: "PAKISTAN_CODE_OFFICIAL", owner: "Ministry of Law and Justice, Pakistan", root_url: `${PAKISTAN_CODE_ORIGIN}/english/`,
    jurisdiction: "Federal", material_kind: "legislation", access_status: "disabled",
    attribution: "Pakistan Code, Ministry of Law and Justice",
  }).select("id").single();
  if (error || !data) throw error ?? new Error("Could not register the Pakistan Code source.");
  return data.id;
}

function row(source: string, listingUrl: string, item: LegislationCandidate) {
  return {
    source_id: source, identity_hash: item.identityHash, metadata_hash: item.metadataHash, listing_url: listingUrl,
    detail_url: item.detailUrl, title: item.title, category: item.category, official_number: item.officialNumber,
    promulgation_date: item.promulgationDate, enactment_year: item.enactmentYear, instrument_type: item.instrumentType,
    source_review_flag: item.sourceReviewFlag,
  };
}

async function stage(client: SupabaseClient, source: string, listingUrl: string, item: LegislationCandidate):
  Promise<"staged" | "unchanged" | "quarantined"> {
  const { data: previous, error: lookupError } = await client.from("legislation_candidates")
    .select("id,metadata_hash,review_status").eq("source_id", source).eq("identity_hash", item.identityHash).maybeSingle();
  if (lookupError) throw lookupError;
  const now = new Date().toISOString();
  if (!previous) {
    const { error } = await client.from("legislation_candidates").insert(row(source, listingUrl, item));
    if (error) throw error;
    return "staged";
  }
  if (previous.metadata_hash !== item.metadataHash && previous.review_status !== "rejected") {
    const { error: documentError } = await client.from("legal_documents")
      .update({ publication_status: "quarantined", updated_at: now })
      .eq("source_id", source).eq("source_item_id", item.identityHash).eq("publication_status", "published");
    if (documentError) throw documentError;
    const { error } = await client.from("legislation_candidates").update({
      review_status: "quarantined", review_note: "Source metadata changed; compare before republication.",
      proposed_metadata: row(source, listingUrl, item), last_seen_at: now,
    }).eq("id", previous.id);
    if (error) throw error;
    return "quarantined";
  }
  const { error } = await client.from("legislation_candidates")
    .update({ detail_url: item.detailUrl, last_seen_at: now }).eq("id", previous.id);
  if (error) throw error;
  return "unchanged";
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const letter = args[args.indexOf("--letter") + 1]?.toUpperCase() ?? "";
  const file = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
  if (!args.includes("--letter") || !/^[A-Z]$/.test(letter) || (args.includes("--file") && !file)) {
    throw new Error("Use --letter A for one live page, or --file PATH --letter A for an offline fixture.");
  }
  const client = localClient();
  const source = await sourceId(client);
  const listingUrl = letterUrl(letter);
  const { data: run, error: runError } = await client.from("ingestion_runs")
    .insert({ source_id: source, listing_url: listingUrl }).select("id").single();
  if (runError || !run) throw runError ?? new Error("Could not start ingestion run.");
  try {
    const page = file ? { html: await readFile(file, "utf8"), httpStatus: null } : await fetchPakistanCodeLetter(letter);
    const parsed = parsePakistanCodeLetter(page.html, letter);
    const counts = { staged: 0, unchanged: 0, quarantined: 0 };
    for (const item of parsed.candidates) counts[await stage(client, source, listingUrl, item)] += 1;
    const issues = parsed.rejected.map((entry) => ({ ...entry, parser: PAKISTAN_CODE_PARSER_VERSION }));
    if (parsed.missingDates) issues.push({ row: 0, reason: `${parsed.missingDates} rows have no readable promulgation date`, parser: PAKISTAN_CODE_PARSER_VERSION });
    // shortcut: one-letter runs never infer removals; add reconciliation before an unattended A-Z schedule.
    const { error } = await client.from("ingestion_runs").update({
      finished_at: new Date().toISOString(), status: issues.length ? "partial" : "completed", http_status: page.httpStatus,
      listing_hash: createHash("sha256").update(page.html).digest("hex"),
      observed_count: parsed.candidates.length + parsed.rejected.length, staged_count: counts.staged,
      unchanged_count: counts.unchanged, quarantined_count: counts.quarantined, rejected_count: parsed.rejected.length,
      error_summary: issues, pages_fetched: file ? 0 : 1, missing_upload_date_count: parsed.missingDates,
    }).eq("id", run.id);
    if (error) throw error;
    const { error: sourceError } = await client.from("source_registry")
      .update({ last_checked_at: new Date().toISOString() }).eq("id", source);
    if (sourceError) throw sourceError;
    process.stdout.write(JSON.stringify({ runId: run.id, letter, observed: parsed.candidates.length + parsed.rejected.length,
      ...counts, rejected: parsed.rejected.length, excludedOtherTabs: parsed.excludedOtherTabs, missingDates: parsed.missingDates }) + "\n");
  } catch (error) {
    await client.from("ingestion_runs").update({
      finished_at: new Date().toISOString(), status: "failed",
      error_summary: [{ reason: error instanceof Error ? error.message : "Unknown error" }],
    }).eq("id", run.id);
    throw error;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Ingestion failed"}\n`);
  process.exitCode = 1;
});
