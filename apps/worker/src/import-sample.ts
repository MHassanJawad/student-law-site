// Import a single FCCP listing fixture into a local Supabase database.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SAMPLE_RECORD, sampleHash, validateSampleRecord, versionAction } from "./sample-record.js";

/** Opens a privileged client only for a local development database. */
function localClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.startsWith("replace-with-")) throw new Error("Set local SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error("The sample importer is restricted to a local Supabase instance.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Ensures the fixture-only source exists without enabling live collection. */
async function ensureSource(client: SupabaseClient): Promise<void> {
  const { error } = await client.from("source_registry").upsert({
    id: SAMPLE_RECORD.sourceId, code: SAMPLE_RECORD.sourceCode,
    owner: "Federal Constitutional Court of Pakistan", root_url: SAMPLE_RECORD.sourceUrl,
    jurisdiction: "Federal", material_kind: "judgment", access_status: "fixture_only",
    attribution: "Federal Constitutional Court of Pakistan",
  }, { onConflict: "code" });
  if (error) throw new Error(`Source record failed: ${error.message}`);
}

/** Inserts the staged document only on the first run. */
async function ensureDocument(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.from("legal_documents").select("id")
    .eq("id", SAMPLE_RECORD.documentId).maybeSingle();
  if (error) throw new Error(`Document lookup failed: ${error.message}`);
  if (data) return;
  const { error: insertError } = await client.from("legal_documents").insert({
    id: SAMPLE_RECORD.documentId, source_id: SAMPLE_RECORD.sourceId,
    source_item_id: SAMPLE_RECORD.caseNumber, canonical_url: SAMPLE_RECORD.sourceUrl,
    kind: "judgment", title: SAMPLE_RECORD.caseNumber, publication_status: "staged",
  });
  if (insertError) throw new Error(`Document insert failed: ${insertError.message}`);
}

/** Adds the initial version once and rejects changed fixture content for review. */
async function ensureVersion(client: SupabaseClient): Promise<void> {
  const hash = sampleHash(SAMPLE_RECORD);
  const { data, error } = await client.from("document_versions").select("content_hash")
    .eq("document_id", SAMPLE_RECORD.documentId);
  if (error) throw new Error(`Version lookup failed: ${error.message}`);
  const action = versionAction((data ?? []).map((version) => version.content_hash), hash);
  if (action === "skip") return;
  if (action === "review") throw new Error("Sample metadata changed; review the source before publishing a new version.");
  const { error: insertError } = await client.from("document_versions").insert({
    id: SAMPLE_RECORD.versionId, document_id: SAMPLE_RECORD.documentId,
    content_hash: hash, checked_at: new Date().toISOString(),
    raw_metadata: { source_type: "Judgement", source_upload_date: SAMPLE_RECORD.uploadDate, fixture: "listing_metadata_only" },
    text_kind: "none", parser_version: "manual-fixture-v1", review_status: "approved",
  });
  if (insertError) throw new Error(`Version insert failed: ${insertError.message}`);
}

/** Publishes only the reviewed listing metadata and court identity. */
async function publishSample(client: SupabaseClient): Promise<void> {
  const { error: metadataError } = await client.from("judgment_metadata").upsert({
    document_id: SAMPLE_RECORD.documentId, issuing_court: "FCCP",
    case_number: SAMPLE_RECORD.caseNumber, author_judge: SAMPLE_RECORD.authorJudge,
  }, { onConflict: "document_id" });
  if (metadataError) throw new Error(`Judgment metadata failed: ${metadataError.message}`);
  const { error } = await client.from("legal_documents").update({
    current_version_id: SAMPLE_RECORD.versionId, publication_status: "published",
  }).eq("id", SAMPLE_RECORD.documentId);
  if (error) throw new Error(`Publication failed: ${error.message}`);
}

/** Validates and imports one offline fixture without fetching the source portal. */
export async function importSample(): Promise<void> {
  validateSampleRecord(SAMPLE_RECORD);
  const client = localClient();
  await ensureSource(client);
  await ensureDocument(client);
  await ensureVersion(client);
  await publishSample(client);
}

importSample().then(() => process.stdout.write("FCCP sample import complete.\n"))
  .catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Import failed"}\n`); process.exitCode = 1; });
