// Exercise the worker's failure path against CI's disposable Supabase database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && key && ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  "Failure drill requires disposable local Supabase credentials.");
assert.equal(process.env.GITHUB_ACTIONS, "true", "Failure drill runs only in CI.");

const admin = createClient(url, key, { auth: { persistSession: false } });
async function count(table) {
  const { count: total, error } = await admin.from(table).select("id", { count: "exact", head: true });
  assert.ifError(error);
  return total;
}

const before = await Promise.all([count("ingestion_candidates"), count("legal_documents")]);
const missingFile = `__ci_missing_fccp_${randomUUID()}.html`;
const result = spawnSync(process.execPath,
  ["--import", "tsx", "apps/worker/src/ingest-fccp.ts", "--file", missingFile],
  { cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 30_000 });
assert.ifError(result.error);
assert.equal(result.status, 1, `Import should fail: ${result.stdout}\n${result.stderr}`);
assert.match(result.stderr, /ENOENT/);

const { data: run, error } = await admin.from("ingestion_runs")
  .select("status,finished_at,error_summary")
  .order("started_at", { ascending: false }).limit(1).single();
assert.ifError(error);
assert.equal(run.status, "failed");
assert.ok(run.finished_at);
assert.match(JSON.stringify(run.error_summary), /ENOENT/);
assert.deepEqual(await Promise.all([count("ingestion_candidates"), count("legal_documents")]), before,
  "A failed import must not change staged candidates or documents.");
process.stdout.write("Offline ingestion failure drill passed.\n");
