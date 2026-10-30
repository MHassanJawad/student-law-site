// Exercise the Pakistan Code importer offline, reviewed publication, and the corpus sync on CI's disposable stack.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webUrl = process.env.LOCAL_WEB_URL;
assert.equal(process.env.GITHUB_ACTIONS, "true", "Legislation and sync drill runs only in CI.");
assert.ok(url && key && webUrl && ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  "The drill requires disposable local Supabase and web URLs.");
const admin = createClient(url, key, { auth: { persistSession: false } });

function worker(script, args, env = process.env) {
  const result = spawnSync(process.execPath, ["--import", "tsx", `apps/worker/src/${script}`, ...args],
    { cwd: process.cwd(), env, encoding: "utf8", timeout: 60_000 });
  assert.ifError(result.error);
  return result;
}
function json(result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout.trim().split("\n")[0]);
}
async function statutes(q) {
  const response = await fetch(new URL(`/api/v1/search/research?mode=statutes&q=${encodeURIComponent(q)}`, webUrl));
  assert.equal(response.status, 200);
  return response.json();
}
async function count(table) {
  const { count: total, error } = await admin.from(table).select("*", { count: "exact", head: true });
  assert.ifError(error);
  return total;
}

const fixture = ["--file", "apps/worker/tests/fixtures/pakistan-code-letter-a.html", "--letter", "A"];
const first = json(worker("ingest-pakistan-code.ts", fixture));
assert.equal(first.staged, 2, "Two Federal Laws rows should be staged.");
assert.equal(first.excludedOtherTabs, 1, "The ordinance tab stays out of the pilot.");
const rerun = json(worker("ingest-pakistan-code.ts", fixture));
assert.deepEqual([rerun.staged, rerun.unchanged, rerun.quarantined], [0, 2, 0], "A rerun must not duplicate candidates.");
assert.equal((await statutes("Whipping")).total, 0, "Staged candidates must not be searchable.");

const { data: candidate, error: candidateError } = await admin.from("legislation_candidates")
  .select("id,source_id").eq("title", "Abolition of the Punishment of Whipping Act, 1996").single();
assert.ifError(candidateError);
const blocked = await admin.rpc("approve_legislation_candidate", { p_candidate_id: candidate.id, p_review_note: "CI review before source approval" });
assert.match(blocked.error?.message ?? "", /not approved/, "Approval must wait for the source access review.");
// The live activate-source command rechecks robots.txt; CI stays offline and records the approval directly.
const { error: sourceError } = await admin.from("source_registry")
  .update({ access_status: "approved", reviewed_at: new Date().toISOString(), access_review_note: "CI offline fixture approval" })
  .eq("id", candidate.source_id);
assert.ifError(sourceError);
const approved = await admin.rpc("approve_legislation_candidate", { p_candidate_id: candidate.id, p_review_note: "CI compared fixture fields with the listing" });
assert.ifError(approved.error);

const found = await statutes("Whipping");
assert.equal(found.total, 1);
assert.deepEqual(
  [found.items[0].jurisdiction, found.items[0].enactmentYear, found.items[0].citation, found.items[0].legalStatus],
  ["Federal", 1996, "VII of 1996", "unknown"],
  "Published legislation keeps source metadata and never asserts current legal status.");

const tables = ["source_registry", "legal_documents", "document_versions", "judgment_metadata", "legislation_metadata"];
const before = await Promise.all(tables.map(count));
const syncEnv = { ...process.env, TARGET_SUPABASE_URL: url, TARGET_SUPABASE_SERVICE_ROLE_KEY: key };
const refused = worker("sync-corpus.ts", [], syncEnv);
assert.equal(refused.status, 1);
assert.match(refused.stderr, /local/, "The sync must refuse a local target without the explicit CI flag.");
const dryRun = json(worker("sync-corpus.ts", ["--allow-local-target"], syncEnv));
assert.equal(dryRun.mode, "dry-run");
assert.ok(dryRun.upserts.legal_documents >= 3 && dryRun.upserts.legislation_metadata >= 2);
assert.deepEqual(await Promise.all(tables.map(count)), before, "A dry run must not write.");
for (let pass = 0; pass < 2; pass += 1) {
  assert.equal(json(worker("sync-corpus.ts", ["--apply", "--allow-local-target"], syncEnv)).mode, "applied");
}
assert.deepEqual(await Promise.all(tables.map(count)), before, "Syncing an identical corpus must not add rows.");
assert.equal((await statutes("Whipping")).total, 1, "Records stay published after sync.");
process.stdout.write("Pakistan Code fixture import, reviewed publication, and idempotent corpus sync passed.\n");
