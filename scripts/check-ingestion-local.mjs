// Verify the private FCCP pilot and measured source counts on localhost only.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && serviceKey && anonKey, "Local Supabase credentials are required.");
assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Local verification requires localhost.");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

async function query(client, table, columns = "id") {
  const { data, error } = await client.from(table).select(columns);
  assert.ifError(error);
  return data;
}

const { data: latest, error: runError } = await admin.from("ingestion_runs")
  .select("status,observed_count,source_total,pages_fetched,snapshot_complete,missing_count,missing_upload_date_count,duplicate_count,staged_count,unchanged_count,quarantined_count,rejected_count")
  .order("started_at", { ascending: false }).limit(1).single();
assert.ifError(runError);
assert.equal(latest.observed_count, latest.source_total);
assert.equal(latest.snapshot_complete, true);
assert.equal(latest.pages_fetched, 12);
assert.equal(latest.observed_count, 111);
assert.equal(latest.duplicate_count, 1);
assert.equal(latest.missing_upload_date_count, 1);
assert.equal(latest.rejected_count, 0);
assert.equal(latest.missing_count, 0);
assert.equal(latest.staged_count + latest.unchanged_count + latest.quarantined_count + latest.duplicate_count, 111);

const candidates = await query(admin, "ingestion_candidates", "id,review_status");
assert.equal(candidates.length, 110);
assert.equal(candidates.filter((candidate) => candidate.review_status === "approved").length, 1);
const inspections = await query(admin, "pdf_inspections", "id,quality,review_status,page_count,text_chars");
assert.equal(inspections.length, 1);
assert.equal(inspections[0].quality, "extractable");
assert.equal(inspections[0].review_status, "reviewed");
assert.equal(inspections[0].page_count, 7);
assert.equal(inspections[0].text_chars, 12317);
for (const table of ["ingestion_runs", "ingestion_candidates", "pdf_inspections"]) {
  assert.deepEqual(await query(anon, table), [], `${table} must remain private under RLS`);
}
process.stdout.write("FCCP ingestion acceptance passed: 111 rows, 110 unique candidates, one verified duplicate, one reviewed private PDF, RLS isolation.\n");
