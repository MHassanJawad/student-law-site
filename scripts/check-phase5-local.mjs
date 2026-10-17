// Exercise local saved-citation ownership, editorial review, and account deletion.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webUrl = process.env.PHASE5_WEB_URL;
if (!url || !publicKey || !serviceKey || !new URL(url).hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
  throw new Error("Local Supabase URL, publishable key, and service key are required.");
}
if (webUrl && !new URL(webUrl).hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
  throw new Error("The optional web URL must be local.");
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anonymous = createClient(url, publicKey, { auth: { persistSession: false } });
const operator = createClient(url, publicKey, { auth: { persistSession: false } });
const student = createClient(url, publicKey, { auth: { persistSession: false } });
const marker = crypto.randomUUID();
const password = `Phase5!${marker}`;
const ids = [];
let entryId;

async function makeUser(client, prefix) {
  const email = `${prefix}-${marker}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Could not create test user");
  ids.push(data.user.id);
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  return data.user.id;
}

try {
  const operatorId = await makeUser(operator, "operator");
  await makeUser(student, "student");
  const recovery = await student.auth.resetPasswordForEmail(`student-${marker}@example.test`, {
    redirectTo: "http://localhost:3000/reset-password",
  });
  if (recovery.error?.message === "Error sending recovery email") {
    console.log("Recovery email click-through skipped: local SMTP service is not running.");
  } else {
    assert.equal(recovery.error, null, "local recovery request should be accepted");
  }
  const promoted = await admin.from("profiles").update({ role: "operator" }).eq("id", operatorId);
  if (promoted.error) throw promoted.error;
  const roleCheck = await operator.rpc("is_content_operator");
  assert.equal(roleCheck.error, null);
  assert.equal(roleCheck.data, true, "promoted user should have operator role");

  const saved = await operator.from("saved_citations").insert({
    owner_id: operatorId, document_id: "22222222-2222-4222-8222-222222222222", citation_snapshot: "Local ownership test",
  }).select("id").single();
  if (saved.error) throw saved.error;
  const hidden = await student.from("saved_citations").select("id").eq("id", saved.data.id);
  assert.equal(hidden.error, null);
  assert.equal(hidden.data?.length, 0, "another student must not see a saved citation");
  const edited = await operator.from("saved_citations").update({ note: "My private note", folder: "Study" })
    .eq("id", saved.data.id).select("note,folder").single();
  assert.equal(edited.error, null);
  assert.equal(edited.data.note, "My private note");
  const accessToken = (await operator.auth.getSession()).data.session?.access_token;
  assert.ok(accessToken);
  if (webUrl) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const list = await fetch(`${webUrl}/api/v1/me/saved-citations`, { headers });
    assert.equal(list.status, 200);
    assert.ok((await list.json()).items.some((item) => item.id === saved.data.id));
    const changed = await fetch(`${webUrl}/api/v1/me/saved-citations/${saved.data.id}`, {
      method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Updated through API", folder: "Study" }),
    });
    assert.equal(changed.status, 200);
    const exported = await fetch(`${webUrl}/api/v1/me/export`, { headers });
    assert.equal(exported.status, 200);
    assert.ok((await exported.json()).items.some((item) => item.note === "Updated through API"));
  }

  const draft = await operator.from("editorial_entries").insert({
    kind: "dictionary", slug: `phase5-${marker}`, title: "Local test term",
    summary: "A temporary editorial review test entry.",
    body: "This original test explanation is removed after the local check completes.",
    author: "Local test editor", provenance_note: "Original local test content; no external source copied.",
    editor_id: operatorId,
  }).select("id").single();
  if (draft.error) throw draft.error;
  entryId = draft.data.id;
  const hiddenDraft = await anonymous.from("editorial_entries").select("id").eq("id", entryId);
  assert.equal(hiddenDraft.error, null);
  assert.equal(hiddenDraft.data?.length, 0, "draft must not be public");
  const studentPublish = await student.from("editorial_entries").update({ status: "published" }).eq("id", entryId).select("id");
  assert.equal(studentPublish.data?.length, 0, "student must not update an editorial draft");
  const studentInsert = await student.from("editorial_entries").insert({
    kind: "dictionary", slug: `student-${marker}`, title: "Student test",
    summary: "A student must not publish learning entries.",
    body: "This content must be rejected by operator-only row policies.",
    author: "Student", provenance_note: "Original rejected test content.",
  });
  assert.ok(studentInsert.error, "student must not create editorial entries");
  const publish = await operator.from("editorial_entries").update({ status: "published" }).eq("id", entryId).select("reviewed_at").single();
  if (publish.error) throw publish.error;
  assert.ok(publish.data.reviewed_at);
  const publicEntry = await anonymous.from("editorial_entries").select("id").eq("id", entryId);
  assert.equal(publicEntry.data?.length, 1, "reviewed entry should be public");

  if (webUrl) {
    const wrongPassword = await fetch(`${webUrl}/api/v1/me/account`, {
      method: "DELETE", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password: "incorrect-password", confirmation: "DELETE" }),
    });
    assert.equal(wrongPassword.status, 403, "account API must reject the wrong password");
    const deleted = await fetch(`${webUrl}/api/v1/me/account`, {
      method: "DELETE", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password, confirmation: "DELETE" }),
    });
    assert.equal(deleted.status, 204, "account API should delete after password verification");
  } else {
    const wrongPassword = await operator.rpc("delete_my_account", { p_password: "incorrect-password" });
    assert.ok(wrongPassword.error, "direct RPC must reject an incorrect password");
    const deleted = await operator.rpc("delete_my_account", { p_password: password });
    if (deleted.error) throw deleted.error;
  }
  const afterDeletion = await admin.from("saved_citations").select("id").eq("id", saved.data.id);
  assert.equal(afterDeletion.data?.length, 0, "account deletion should cascade to saved citations");
  const retainedEntry = await anonymous.from("editorial_entries").select("id").eq("id", entryId);
  assert.equal(retainedEntry.data?.length, 1, "published content should survive editor deletion");
  console.log("Phase 5 local RLS, editorial review, and account deletion checks passed.");
} finally {
  if (entryId) await admin.from("editorial_entries").delete().eq("id", entryId);
  for (const id of ids) await admin.auth.admin.deleteUser(id);
}
