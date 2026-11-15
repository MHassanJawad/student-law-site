// Operator review of AI summary drafts; only approved drafts reach the public document version.
import { createClient } from "@supabase/supabase-js";

const [action, draftId, ...noteParts] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Review commands require local worker credentials.");
}
const client = createClient(url, key, { auth: { persistSession: false } });
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Copy one pending draft onto its version, then mark the draft approved. */
async function approve(id: string, note: string): Promise<void> {
  const { data: draft, error } = await client.from("summary_drafts")
    .select("version_id,model,summary").eq("id", id).eq("review_status", "pending").maybeSingle();
  if (error || !draft) throw error ?? new Error(`No pending summary draft ${id}.`);
  const now = new Date().toISOString();
  const { error: versionError } = await client.from("document_versions")
    .update({ summary: draft.summary, summary_model: draft.model, summary_reviewed_at: now }).eq("id", draft.version_id);
  if (versionError) throw versionError;
  const { error: draftError } = await client.from("summary_drafts")
    .update({ review_status: "approved", review_note: note, reviewed_at: now }).eq("id", id);
  if (draftError) throw draftError;
}

async function main(): Promise<void> {
  if (action === "list") {
    const { data, error } = await client.from("summary_drafts")
      .select("id,model,summary,created_at,document_versions(legal_documents!document_versions_document_id_fkey(title))")
      .eq("review_status", "pending").order("created_at").limit(50);
    if (error) throw error;
    for (const row of data ?? []) {
      const version = Array.isArray(row.document_versions) ? row.document_versions[0] : row.document_versions;
      const doc = Array.isArray(version?.legal_documents) ? version.legal_documents[0] : version?.legal_documents;
      process.stdout.write(`\n${row.id}  ${doc?.title ?? "(unknown)"}  [${row.model}]\n${row.summary}\n`);
    }
    process.stdout.write(`\n${data?.length ?? 0} pending (showing up to 50).\n`);
    return;
  }
  const note = (action === "approve-all" ? [draftId, ...noteParts] : noteParts).join(" ").trim();
  if (note.length < 10) throw new Error("Provide a review note of at least 10 characters.");
  if (action === "approve-all") {
    const { data, error } = await client.from("summary_drafts").select("id").eq("review_status", "pending").limit(1000);
    if (error) throw error;
    for (const row of data ?? []) await approve(row.id, note);
    process.stdout.write(`Approved ${data?.length ?? 0} summaries.\n`);
    return;
  }
  if (!draftId || !UUID.test(draftId)) throw new Error("Specify a draft UUID from the list command.");
  if (action === "approve") {
    await approve(draftId, note);
    process.stdout.write(`Approved summary ${draftId}.\n`);
    return;
  }
  if (action === "reject") {
    const { data, error } = await client.from("summary_drafts")
      .update({ review_status: "rejected", review_note: note, reviewed_at: new Date().toISOString() })
      .eq("id", draftId).eq("review_status", "pending").select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("Only pending drafts may be rejected.");
    process.stdout.write(`Rejected summary ${draftId}; the next summarize run drafts a new one.\n`);
    return;
  }
  if (action === "unpublish") {
    const { data: draft, error } = await client.from("summary_drafts")
      .select("version_id").eq("id", draftId).eq("review_status", "approved").maybeSingle();
    if (error || !draft) throw error ?? new Error("Only approved summaries may be unpublished.");
    const { error: versionError } = await client.from("document_versions")
      .update({ summary: null, summary_model: null, summary_reviewed_at: null }).eq("id", draft.version_id);
    if (versionError) throw versionError;
    const { error: draftError } = await client.from("summary_drafts")
      .update({ review_status: "rejected", review_note: note, reviewed_at: new Date().toISOString() }).eq("id", draftId);
    if (draftError) throw draftError;
    process.stdout.write(`Removed summary ${draftId} from the site; sync to apply it to the hosted copy.\n`);
    return;
  }
  throw new Error("Use list, approve ID NOTE, reject ID NOTE, unpublish ID NOTE, or approve-all NOTE.");
}

main().catch((error: unknown) => {
  process.stderr.write(`${(error as { message?: string } | null)?.message ?? "Review failed"}\n`);
  process.exitCode = 1;
});
