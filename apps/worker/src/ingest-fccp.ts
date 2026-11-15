// Manually triggered FCCP listing import. Nothing is published automatically.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { checkFccpRobots } from "./fccp-fetch.js";
import { enumerateFccp } from "./fccp-enumerate.js";
import { FCCP_LISTING_URL, FCCP_PARSER_VERSION, parseFccpPage, type FccpCandidate } from "./fccp-listing.js";

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
      proposed_metadata: item, last_seen_at: now, quarantined_at: now,
    }).eq("id", previous.id);
    if (error) throw error;
    return "quarantined";
  }
  const { error } = await client.from("ingestion_candidates")
    .update({ download_url: item.downloadUrl, last_seen_at: now }).eq("id", previous.id);
  if (error) throw error;
  return "unchanged";
}

async function quarantineMissing(client: SupabaseClient, source: string, seen: Set<string>): Promise<number> {
  const { data, error } = await client.from("ingestion_candidates")
    .select("id,identity_hash,review_status").eq("source_id", source).limit(1000);
  if (error) throw error;
  if ((data ?? []).length === 1000) throw new Error("Candidate reconciliation exceeded its safety cap.");
  let missing = 0;
  for (const candidate of data ?? []) {
    if (seen.has(candidate.identity_hash) || ["quarantined", "rejected"].includes(candidate.review_status)) continue;
    const now = new Date().toISOString();
    const { error: documentError } = await client.from("legal_documents")
      .update({ publication_status: "quarantined", updated_at: now })
      .eq("source_id", source).eq("source_item_id", candidate.identity_hash);
    if (documentError) throw documentError;
    const { error: candidateError } = await client.from("ingestion_candidates").update({
      review_status: "quarantined", review_note: "Absent from a complete FCCP listing snapshot; review before withdrawal.",
      quarantined_at: now,
    }).eq("id", candidate.id);
    if (candidateError) throw candidateError;
    missing += 1;
  }
  return missing;
}

async function main(): Promise<void> {
  const [mode, file] = process.argv.slice(2);
  if (mode !== "--all" && (mode !== "--file" || !file)) {
    throw new Error("Use --all for the complete listing, or --file PATH for an offline API-page fixture.");
  }
  const client = localClient();
  const source = await sourceId(client);
  const { data: run, error: runError } = await client.from("ingestion_runs")
    .insert({ source_id: source, listing_url: FCCP_LISTING_URL }).select("id").single();
  if (runError || !run) throw runError ?? new Error("Could not start ingestion run.");
  try {
    const snapshot = mode === "--all" ? (await checkFccpRobots(), await enumerateFccp()) : null;
    const fixture = snapshot ? null : await readFile(file, "utf8");
    const parsed = snapshot ?? { ...parseFccpPage(JSON.parse(fixture as string)), pageCount: 1, listingHashInput: fixture as string };
    const complete = Boolean(snapshot && snapshot.rejected.length === 0);
    const counts = { staged: 0, unchanged: 0, quarantined: 0 };
    const issues: { reason: string; row?: number; page?: number; title?: string; parser: string }[] =
      parsed.rejected.map((entry) => ({ ...entry, parser: FCCP_PARSER_VERSION }));
    for (const item of parsed.candidates) {
      const action = await stage(client, source, item);
      counts[action] += 1;
      if (action === "quarantined") issues.push({ reason: "Source metadata changed", title: item.title, parser: FCCP_PARSER_VERSION });
    }
    const missing = complete
      ? await quarantineMissing(client, source, new Set(parsed.candidates.map((item) => item.identityHash))) : 0;
    if (missing) issues.push({ reason: `${missing} previously seen records absent from the complete snapshot`, parser: FCCP_PARSER_VERSION });
    const observed = parsed.candidates.length + parsed.rejected.length;
    const { error } = await client.from("ingestion_runs").update({
      finished_at: new Date().toISOString(), status: issues.length ? "partial" : "completed",
      http_status: snapshot ? 200 : null, listing_hash: createHash("sha256").update(parsed.listingHashInput).digest("hex"),
      observed_count: observed, source_total: parsed.sourceTotal,
      staged_count: counts.staged, unchanged_count: counts.unchanged,
      quarantined_count: counts.quarantined, rejected_count: parsed.rejected.length, error_summary: issues,
      pages_fetched: parsed.pageCount, snapshot_complete: complete, missing_count: missing,
      missing_upload_date_count: 0, duplicate_count: 0,
    }).eq("id", run.id);
    if (error) throw error;
    const { error: sourceError } = await client.from("source_registry")
      .update({ last_checked_at: new Date().toISOString(), root_url: FCCP_LISTING_URL }).eq("id", source);
    if (sourceError) throw sourceError;
    process.stdout.write(JSON.stringify({ runId: run.id, observed, sourceTotal: parsed.sourceTotal,
      pagesFetched: parsed.pageCount, snapshotComplete: complete, missing, ...counts, rejected: parsed.rejected.length }) + "\n");
  } catch (error) {
    await client.from("ingestion_runs").update({
      finished_at: new Date().toISOString(), status: "failed",
      error_summary: [{ reason: (error as { message?: string } | null)?.message ?? "Unknown error" }],
    }).eq("id", run.id);
    throw error;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${(error as { message?: string } | null)?.message ?? "Ingestion failed"}\n`);
  process.exitCode = 1;
});
