// Exercise the Phase 2 journey against disposable localhost services only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webUrl = process.env.LOCAL_WEB_URL ?? "http://localhost:3000";
const fixtureDocumentId = "22222222-2222-4222-8222-222222222222";
for (const [name, value] of Object.entries({ SUPABASE_URL: supabaseUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey })) {
  assert.ok(value, `${name} is required`);
}
for (const value of [supabaseUrl, webUrl]) {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(value).hostname), "Local checks require localhost services");
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const temporaryUsers = [];

async function api(path, options = {}, expected = 200) {
  const response = await fetch(new URL(path, webUrl), options);
  const body = response.status === 204 ? null : await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(body)}`);
  return body;
}

async function count(table, column, value) {
  let query = admin.from(table).select("id", { count: "exact", head: true });
  if (column) query = query.eq(column, value);
  const { count: total, error } = await query;
  assert.ifError(error);
  return total;
}

async function account(label) {
  const email = `phase2-${label}-${randomUUID()}@example.test`;
  const password = `Local!${randomUUID()}9a`;
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: signedUp, error: signupError } = await client.auth.signUp({ email, password });
  assert.ifError(signupError);
  assert.ok(signedUp.user?.id);
  temporaryUsers.push(signedUp.user.id);
  const secondSession = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: signedIn, error: signinError } = await secondSession.auth.signInWithPassword({ email, password });
  assert.ifError(signinError);
  assert.ok(signedIn.session?.access_token);
  return {
    token: signedIn.session.access_token,
    db: createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${signedIn.session.access_token}` } },
      auth: { persistSession: false },
    }),
  };
}

try {
  assert.equal(await count("legal_documents", "id", fixtureDocumentId), 1);
  assert.equal(await count("document_versions", "document_id", fixtureDocumentId), 1);
  assert.equal((await fetch(new URL("/", webUrl))).status, 200);
  const coverage = await api("/api/v1/coverage");
  assert.equal(coverage.sources.reduce((total, source) => total + source.count, 0),
    await count("legal_documents", "publication_status", "published"));
  const search = await api("/api/v1/search/judgments?q=C.P.L.A.%20No.1285-K");
  assert.equal(search.total, 1);
  assert.equal(search.items.length, 1);
  assert.equal(search.items[0].citation, null);
  assert.ok(search.items[0].caseNumber);
  const documentId = search.items[0].id;
  const detail = await api(`/api/v1/documents/${documentId}`);
  assert.equal(detail.id, documentId);
  assert.equal(detail.textKind, "none");
  assert.ok(detail.sourceUrl.startsWith("https://"));

  const a = await account("a");
  const b = await account("b");
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const saved = await api("/api/v1/me/saved-citations", {
    method: "POST", headers: { ...auth(a.token), "Content-Type": "application/json" },
    body: JSON.stringify({ documentId }),
  }, 201);
  assert.equal(saved.document_id, documentId);
  assert.equal((await api("/api/v1/me/saved-citations", { headers: auth(a.token) })).items.length, 1);
  assert.deepEqual((await api("/api/v1/me/saved-citations", { headers: auth(b.token) })).items, []);

  const { data: bRead, error: bReadError } = await b.db.from("saved_citations").select("id").eq("id", saved.id);
  assert.ifError(bReadError);
  assert.deepEqual(bRead, []);
  const { data: bDelete, error: bDeleteError } = await b.db.from("saved_citations").delete().eq("id", saved.id).select("id");
  assert.ifError(bDeleteError);
  assert.deepEqual(bDelete, []);
  await api(`/api/v1/me/saved-citations/${saved.id}`, { method: "DELETE", headers: auth(b.token) }, 404);
  await api(`/api/v1/me/saved-citations/${saved.id}`, { method: "DELETE", headers: auth(a.token) }, 204);
  assert.deepEqual((await api("/api/v1/me/saved-citations", { headers: auth(a.token) })).items, []);
  assert.equal(await count("document_versions", "document_id", fixtureDocumentId), 1);
  process.stdout.write("Local acceptance passed: search, detail, two accounts, save, RLS isolation, removal, one version.\n");
} finally {
  for (const id of temporaryUsers) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) process.stderr.write(`Temporary account cleanup failed: ${error.message}\n`);
  }
}
