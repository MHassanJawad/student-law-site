// Check on CI's disposable stack that search finds words inside a judgment's text and summary, under every sort.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webUrl = process.env.LOCAL_WEB_URL;
assert.equal(process.env.GITHUB_ACTIONS, "true", "Full-text search check runs only in CI.");
assert.ok(url && key && webUrl && ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  "The check requires disposable local Supabase and web URLs.");
const admin = createClient(url, key, { auth: { persistSession: false } });

// The seeded sample judgment (supabase/seed.sql) has no text; give it some for the duration of this check.
const VERSION = "33333333-3333-4333-8333-333333333333";
const DOCUMENT = "22222222-2222-4222-8222-222222222222";
async function setText(fields) {
  const { error } = await admin.from("document_versions").update(fields).eq("id", VERSION);
  assert.ifError(error);
}
async function search(q, sort = "relevance") {
  const response = await fetch(new URL(`/api/v1/search/research?mode=case-law&sort=${sort}&q=${encodeURIComponent(q)}`, webUrl));
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}
const ids = (body) => body.items.map((item) => item.id);

await setText({
  extracted_text: "The appellants challenged the denial of a hazardous duty allowance to ministerial staff of the constabulary.",
  text_kind: "extracted",
  summary: "The case concerns whether a pension commutation was lawfully withheld from a retired employee.",
  summary_model: "ci-fixture", summary_reviewed_at: new Date().toISOString(),
});
try {
  assert.deepEqual(ids(await search("constabulary")), [DOCUMENT], "A word only in the judgment text must find it.");
  assert.deepEqual(ids(await search("commutation")), [DOCUMENT], "A word only in the summary must find it.");
  assert.deepEqual(ids(await search("allowances")), [DOCUMENT], "Searches match word stems, not just exact spellings.");
  assert.deepEqual(ids(await search('"hazardous duty"')), [DOCUMENT], "Quoted phrases must match.");
  assert.equal((await search("constabulary -ministerial")).total, 0, "A minus sign must exclude the word.");
  assert.equal((await search("zygomorphic")).total, 0, "Absent words must not match.");
  for (const sort of ["relevance", "decision-newest", "decision-oldest", "title"]) {
    assert.deepEqual(ids(await search("constabulary", sort)), [DOCUMENT], `Sort ${sort} must keep body-text matches.`);
  }
  assert.deepEqual(ids(await search("1285-K")), [DOCUMENT], "Case-number search must still work.");
} finally {
  await setText({ extracted_text: null, text_kind: "none", summary: null, summary_model: null, summary_reviewed_at: null });
}
process.stdout.write("Full-text search passed: body text, summary, stems, phrases, exclusion, every sort.\n");
