// End-to-end check of POST /api/v1/assistant against the stub model (scripts/ci-llm-stub.mjs) on CI's disposable stack.
// Stays within the route's 10 requests a minute: 9 requests in total.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const webUrl = process.env.LOCAL_WEB_URL;
assert.equal(process.env.GITHUB_ACTIONS, "true", "Assistant end-to-end check runs only in CI.");
assert.ok(url && serviceKey && publicKey && webUrl && ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  "The check requires a disposable local Supabase stack and web URL.");
assert.equal(process.env.ASSISTANT_USER_DAILY_LIMIT, "4", "The check expects a daily limit of 4.");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const student = createClient(url, publicKey, { auth: { persistSession: false } });
const VERSION = "33333333-3333-4333-8333-333333333333";
const DOCUMENT = "22222222-2222-4222-8222-222222222222";
const BODY = "The constabulary staff appealed a hazardous duty allowance.";
const email = `assistant-${crypto.randomUUID()}@example.test`;
const password = `Assist!${crypto.randomUUID()}`;
let userId;

const ok = async (promise) => assert.ifError((await promise).error);
const ask = (question, { token, origin } = {}) => fetch(`${webUrl}/api/v1/assistant`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(origin ? { Origin: origin } : {}),
  },
  body: JSON.stringify({ question }),
});
async function events(response) {
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.text()).split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

try {
  await ok(admin.from("document_versions").update({ extracted_text: BODY, text_kind: "extracted" }).eq("id", VERSION));
  await ok(admin.from("document_chunks").insert({
    version_id: VERSION, chunker_version: "chunks-v1", ordinal: 0, document_id: DOCUMENT,
    body: BODY, char_start: 0, char_end: BODY.length, paragraph_label: "1",
  }));
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  userId = created.data.user.id;
  const login = await student.auth.signInWithPassword({ email, password });
  assert.ifError(login.error);
  const token = login.data.session.access_token;

  assert.equal((await ask("What is a constabulary?")).status, 401, "rejects anonymous requests");
  assert.equal((await ask("What is a constabulary?", { token, origin: "https://evil.example" })).status, 403, "rejects another origin");
  assert.equal((await ask("   ", { token })).status, 400, "rejects an empty question");

  const answered = await events(await ask("What did the constabulary appeal?", { token }));
  const stages = answered.filter((e) => e.type === "status").map((e) => e.stage);
  assert.deepEqual(stages, ["planning", "searching", "writing", "checking"], JSON.stringify(answered));
  const last = answered.at(-1);
  assert.equal(last.type, "answer");
  assert.equal(last.outcome, "answered", JSON.stringify(last));
  assert.equal(last.citations[0]?.path, `/documents/${DOCUMENT}`, JSON.stringify(last));

  const fake = (await events(await ask("STUB_FAKE constabulary", { token }))).at(-1);
  assert.equal(fake.outcome, "unverified", JSON.stringify(fake));

  const limited = (await events(await ask("STUB_429 constabulary", { token }))).at(-1);
  assert.equal(limited.type, "error", JSON.stringify(limited));
  assert.equal(limited.code, "RATE_LIMITED");
  assert.equal(limited.retryAfterSeconds, 9);

  // The refund means two more questions fit in the limit of 4; the fifth counted one does not.
  assert.equal((await events(await ask("What did the constabulary appeal?", { token }))).at(-1).outcome, "answered");
  assert.equal((await events(await ask("What did the constabulary appeal?", { token }))).at(-1).outcome, "answered");
  const over = await ask("What did the constabulary appeal?", { token });
  assert.equal(over.status, 429);
  assert.equal((await over.json()).error.code, "QUOTA_EXCEEDED");
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
  await ok(admin.from("document_chunks").delete().eq("version_id", VERSION));
  await ok(admin.from("document_versions").update({ extracted_text: null, text_kind: "none" }).eq("id", VERSION));
}
process.stdout.write("Assistant end-to-end passed: auth gates, streamed cited answer, unverified fallback, 429 refund, daily quota.\n");
