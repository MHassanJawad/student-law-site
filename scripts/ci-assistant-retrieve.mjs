// Check on CI's disposable stack that the assistant retrieves citable passages, and only public ones.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(process.env.GITHUB_ACTIONS, "true", "Assistant retrieval check runs only in CI.");
assert.ok(url && key && anonKey && ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  "The check requires a disposable local Supabase URL and keys.");
const admin = createClient(url, key, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

// The seeded sample judgment (supabase/seed.sql) has no text; give it text and passages for this check.
const VERSION = "33333333-3333-4333-8333-333333333333";
const DOCUMENT = "22222222-2222-4222-8222-222222222222";
const TEXT = "The constabulary staff appealed. The pension commutation was withheld.";
const chunk = (ordinal, chunkerVersion, body) => ({
  version_id: VERSION, chunker_version: chunkerVersion, ordinal, document_id: DOCUMENT,
  body, char_start: ordinal * 32, char_end: ordinal * 32 + body.length, paragraph_label: String(ordinal + 1),
});
async function ok(promise) {
  const { error } = await promise;
  assert.ifError(error);
}
async function retrieve(queries, perDocument) {
  const { data, error } = await anon.rpc("assistant_retrieve",
    perDocument === undefined ? { p_queries: queries } : { p_queries: queries, p_per_document: perDocument });
  assert.ifError(error);
  return data;
}

try {
  await ok(admin.from("document_versions").update({ extracted_text: TEXT, text_kind: "extracted" }).eq("id", VERSION));
  await ok(admin.from("document_chunks").insert([
    chunk(0, "chunks-v1", "The constabulary staff appealed."),
    chunk(1, "chunks-v1", "The pension commutation was withheld."),
    chunk(0, "chunks-v0", "This obsolete passage belongs to an old chunker."),
  ]));

  // finds a passage by a word in its body
  let result = await retrieve(["constabulary"]);
  assert.equal(result.passages[0]?.ordinal, 0, JSON.stringify(result));
  assert.equal(result.passages[0].path, `/documents/${DOCUMENT}`);
  assert.equal(result.passages[0].source_type, "judgment");
  // ranks across several queries
  result = await retrieve(["zygomorphic", "commutation"]);
  assert.equal(result.passages[0]?.ordinal, 1, JSON.stringify(result));
  // caps passages per document
  result = await retrieve(["constabulary", "commutation"], 1);
  assert.equal(result.passages.length, 1, JSON.stringify(result));
  // ignores other chunker versions
  result = await retrieve(["obsolete"]);
  assert.equal(result.passages.length, 0, JSON.stringify(result));
  // returns textless title matches as related only
  result = await retrieve(["Contract Act"]);
  assert.equal(result.passages.length, 0, JSON.stringify(result));
  assert.match(result.related[0]?.title ?? "", /Contract/, JSON.stringify(result));
  // hides unpublished text
  await ok(admin.from("legal_documents").update({ publication_status: "withdrawn" }).eq("id", DOCUMENT));
  result = await retrieve(["constabulary"]);
  assert.equal(result.passages.length, 0, JSON.stringify(result));
} finally {
  await ok(admin.from("legal_documents").update({ publication_status: "published" }).eq("id", DOCUMENT));
  await ok(admin.from("document_chunks").delete().eq("version_id", VERSION));
  await ok(admin.from("document_versions").update({ extracted_text: null, text_kind: "none" }).eq("id", VERSION));
}
process.stdout.write("Assistant retrieval passed: body match, multi-query rank, per-document cap, chunker version, related, publication.\n");
