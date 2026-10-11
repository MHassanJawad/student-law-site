// Manually triggered, metadata-only FCCP pilot. Nothing is published automatically.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchFccpListing } from "./fccp-fetch.js";
import { FCCP_LISTING_URL, FCCP_PARSER_VERSION, parseFccpListing, type FccpCandidate } from "./fccp-listing.js";

function localClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.startsWith("replace-with-")) throw new Error("Set local worker credentials.");
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Pilot import requires local Supabase.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function sourceId(client: SupabaseClient): Promise<string> {
  const { data: existing, error: readError } = await client.from("source_registry").select("id")
    .eq("code", "FCCP_OFFICIAL").maybeSingle();
  if (readError) throw readError;
  if (existing) return existing.id;
  const { data, error } = await client.from("source_registry").insert({
    code: "FCCP_OFFICIAL", owner: "Federal Constitutional Court of Pakistan", root_url: FCCP_LISTING_URL,
    jurisdiction: "Federal", material_kind: "judgment", access_status: "disabled",
    attribution: "Federal Constitutional Court of Pakistan",
  }).select("id").single();
  if (error || !data) throw error ?? new Error("Could not register FCCP source.");
  return data.id;
}

async function stage(client: SupabaseClient, source: string, item: FccpCandidate): Promise<"staged" | "unchanged" | "quarantined"> {
  const { data: previous, error: lookupError } = await client.from("ingestion_candidates")
    .select("id,metadata_hash,review_status").eq("source_id", source).eq("identity_hash", item.identityHash).maybeSingle();
  if (lookupError) throw lookupError;
  const now = new Date().toISOString();
  if (!previous) {
    const { error } = await client.from("ingestion_candidates").insert({
      source_id: source, identity_hash: item.identityHash, metadata_hash: item.metadataHash,
      listing_url: FCCP_LISTING_URL, download_url: item.downloadUrl, title: item.title,
      author_judge: item.authorJudge, source_type: item.sourceType, upload_date: item.uploadDate,
    });
    if (error) throw error;
    return "staged";
  }
  if (previous.metadata_hash !== item.metadataHash) {
    const { error: withdrawError } = await client.from("legal_documents")
      .update({ publication_status: "quarantined", updated_at: now })
      .eq("source_id", source).eq("source_item_id", item.identityHash);
    if (withdrawError) throw withdrawError;
    const { error } = await client.from("ingestion_candidates").update({
      review_status: "quarantined", review_note: "Source metadata changed; compare before republication.",
      proposed_metadata: item, last_seen_at: now,
    }).eq("id", previous.id);
    if (error) throw error;
    return "quarantined";
  }
  const { error } = await client.from("ingestion_candidates")
    .update({ download_url: item.downloadUrl, last_seen_at: now }).eq("id", previous.id);
  if (error) throw error;
  if (previous.review_status === "approved") {
    const { error: linkError } = await client.from("legal_documents")
      .update({ canonical_url: item.downloadUrl, updated_at: now })
      .eq("source_id", source).eq("source_item_id", item.identityHash).eq("publication_status", "published");
    if (linkError) throw linkError;
  }
  return "unchanged";
}

async function main(): Promise<void> {
  const [mode, file] = process.argv.slice(2);
  if (mode !== "--live" && (mode !== "--file" || !file)) {
    throw new Error("Use --live for one official listing fetch or --file PATH for an offline HTML fixture.");
  }
  const client = localClient();
  const source = await sourceId(client);
  const { data: run, error: runError } = await client.from("ingestion_runs")
    .insert({ source_id: source, listing_url: FCCP_LISTING_URL }).select("id").single();
  if (runError || !run) throw runError ?? new Error("Could not start ingestion run.");
  try {
    const result = mode === "--live"
      ? await fetchFccpListing()
      : { html: await readFile(file, "utf8"), httpStatus: null };
    const parsed = parseFccpListing(result.html);
    const counts = { staged: 0, unchanged: 0, quarantined: 0 };
    const issues: { reason: string; row?: number; title?: string; parser: string }[] =
      parsed.rejected.map((entry) => ({ ...entry, parser: FCCP_PARSER_VERSION }));
    for (const item of parsed.candidates) {
      const action = await stage(client, source, item);
      counts[action] += 1;
      if (action === "quarantined") issues.push({ reason: "Source metadata changed", title: item.title, parser: FCCP_PARSER_VERSION });
    }
    if (parsed.sourceTotal === null) issues.push({ reason: "Source total missing from listing", parser: FCCP_PARSER_VERSION });
    const { error } = await client.from("ingestion_runs").update({
      finished_at: new Date().toISOString(), status: issues.length ? "partial" : "completed",
      http_status: result.httpStatus, listing_hash: createHash("sha256").update(result.html).digest("hex"),
      observed_count: parsed.candidates.length + parsed.rejected.length, source_total: parsed.sourceTotal,
      staged_count: counts.staged, unchanged_count: counts.unchanged,
      quarantined_count: counts.quarantined, rejected_count: parsed.rejected.length, error_summary: issues,
    }).eq("id", run.id);
    if (error) throw error;
    const { error: sourceError } = await client.from("source_registry")
      .update({ last_checked_at: new Date().toISOString() }).eq("id", source);
    if (sourceError) throw sourceError;
    process.stdout.write(JSON.stringify({ runId: run.id, observed: parsed.candidates.length + parsed.rejected.length,
      sourceTotal: parsed.sourceTotal, ...counts, rejected: parsed.rejected.length }) + "\n");
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
