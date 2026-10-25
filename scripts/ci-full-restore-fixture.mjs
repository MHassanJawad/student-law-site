// Create and verify disposable account data for the CI backup/restore drill.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

assert.equal(process.env.GITHUB_ACTIONS, "true", "Restore fixture runs only in CI.");
const url = process.env.SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && publicKey && serviceKey && ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  "Restore fixture requires the disposable local Supabase stack.");
const [mode, fixturePath] = process.argv.slice(2);
assert.ok(["create", "verify"].includes(mode) && fixturePath, "Use create or verify and a temporary fixture path.");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const student = createClient(url, publicKey, { auth: { persistSession: false } });
if (mode === "create") {
  const marker = randomUUID();
  const email = `restore-${marker}@example.test`;
  const password = `Restore!${marker}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(error);
  assert.ok(data.user?.id);
  const { data: citation, error: citationError } = await admin.from("saved_citations").insert({
    owner_id: data.user.id,
    document_id: "22222222-2222-4222-8222-222222222222",
    citation_snapshot: "CI restore fixture",
    note: "Keep this research note",
    folder: "Restore drill",
  }).select("id").single();
  assert.ifError(citationError);
  await writeFile(fixturePath, JSON.stringify({ email, password, userId: data.user.id, citationId: citation.id }), { mode: 0o600 });
  process.stdout.write("Disposable account and saved citation created for restore drill.\n");
} else {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const { data: session, error } = await student.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
  assert.ifError(error);
  assert.equal(session.user?.id, fixture.userId, "Restored account should retain its ID and password.");
  const { data: citation, error: citationError } = await student.from("saved_citations")
    .select("id,owner_id,note,folder").eq("id", fixture.citationId).single();
  assert.ifError(citationError);
  assert.deepEqual(citation, { id: fixture.citationId, owner_id: fixture.userId,
    note: "Keep this research note", folder: "Restore drill" });
  process.stdout.write("Restored account sign-in and private saved citation passed.\n");
}
