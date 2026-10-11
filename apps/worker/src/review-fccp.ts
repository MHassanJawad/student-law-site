// Private local operator actions for FCCP metadata candidates.
import { createClient } from "@supabase/supabase-js";
import { checkFccpRobots } from "./fccp-fetch.js";

const [action, candidateId, ...noteParts] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Review commands require local worker credentials.");
}
const client = createClient(url, key, { auth: { persistSession: false } });
const note = noteParts.join(" ").trim();

async function main(): Promise<void> {
  if (action === "list") {
    const status = candidateId ?? "pending";
    const page = Number(noteParts[0] ?? "1");
    if (!["pending", "approved", "quarantined", "rejected", "all"].includes(status)
      || !Number.isInteger(page) || page < 1 || page > 100) {
      throw new Error("Use list [pending|approved|quarantined|rejected|all] [page 1-100].");
    }
    const from = (page - 1) * 25;
    let query = client.from("ingestion_candidates")
      .select("id,title,source_type,upload_date,review_status,review_note")
      .order("first_seen_at", { ascending: false }).range(from, from + 24);
    if (status !== "all") query = query.eq("review_status", status);
    const { data, error } = await query;
    if (error) throw error;
    process.stdout.write(JSON.stringify(data ?? [], null, 2) + "\n");
    return;
  }
  if (action === "report") {
    const { data, error } = await client.from("ingestion_runs")
      .select("id,status,started_at,observed_count,source_total,pages_fetched,snapshot_complete,missing_count,missing_upload_date_count,duplicate_count,staged_count,unchanged_count,quarantined_count,rejected_count,error_summary")
      .order("started_at", { ascending: false }).limit(10);
    if (error) throw error;
    process.stdout.write(JSON.stringify(data ?? [], null, 2) + "\n");
    return;
  }
  if (action === "pdf-list") {
    const { data, error } = await client.from("pdf_inspections")
      .select("id,candidate_id,pdf_sha256,page_count,text_chars,quality,review_status,checked_at")
      .order("checked_at", { ascending: false }).limit(25);
    if (error) throw error;
    process.stdout.write(JSON.stringify(data ?? [], null, 2) + "\n");
    return;
  }
  if (action === "activate-source") {
    if (candidateId !== "--metadata-only") throw new Error("Explicit --metadata-only scope is required.");
    await checkFccpRobots();
    const { data, error } = await client.from("source_registry").update({
      access_status: "approved", reviewed_at: new Date().toISOString(),
      access_review_note: "Metadata-only FCCP pilot; no formal portal permission; owner relies on Copyright Ordinance 1962 section 57(1)(q)(ii), subject to any issuing-authority prohibition. Robots wildcard has empty Disallow. No PDF storage or automatic publication.",
    }).eq("code", "FCCP_OFFICIAL").select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("Ingest a FCCP listing before activating the source.");
    process.stdout.write("FCCP source activated for reviewed metadata-only publication.\n");
    return;
  }
  if (!candidateId || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(candidateId)) {
    throw new Error("Specify a candidate UUID from the list command.");
  }
  if (!note || note.length < 10) throw new Error("Provide a review note of at least 10 characters.");
  if (action === "pdf-review" || action === "pdf-reject") {
    let query = client.from("pdf_inspections").update({
      review_status: action === "pdf-review" ? "reviewed" : "rejected", review_note: note,
    }).eq("id", candidateId).eq("review_status", "pending");
    if (action === "pdf-review") query = query.eq("quality", "extractable");
    const { data, error } = await query.select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("Only pending, extractable PDFs can be reviewed; reject a poor extraction.");
    process.stdout.write(`${action === "pdf-review" ? "Reviewed" : "Rejected"} PDF inspection ${candidateId}.\n`);
    return;
  }
  if (action === "approve") {
    const { data, error } = await client.rpc("approve_fccp_candidate", {
      p_candidate_id: candidateId, p_review_note: note,
    });
    if (error) throw error;
    process.stdout.write(`Published reviewed metadata document ${data}.\n`);
    return;
  }
  if (action === "withdraw") {
    const { data, error } = await client.rpc("withdraw_fccp_candidate", {
      p_candidate_id: candidateId, p_review_note: note,
    });
    if (error) throw error;
    process.stdout.write(`Withdrew FCCP document ${data}.\n`);
    return;
  }
  if (action === "reject") {
    const { data, error } = await client.from("ingestion_candidates")
      .update({ review_status: "rejected", review_note: note, reviewed_at: new Date().toISOString() })
      .eq("id", candidateId).eq("review_status", "pending").select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("Only pending candidates may be rejected.");
    process.stdout.write(`Rejected candidate ${candidateId}.\n`);
    return;
  }
  if (action === "accept-change") {
    const { data: candidate, error: readError } = await client.from("ingestion_candidates")
      .select("proposed_metadata").eq("id", candidateId).eq("review_status", "quarantined").maybeSingle();
    if (readError || !candidate?.proposed_metadata) throw readError ?? new Error("No quarantined change found.");
    const proposed = candidate.proposed_metadata as Record<string, string | null>;
    const { error } = await client.from("ingestion_candidates").update({
      metadata_hash: proposed.metadataHash, title: proposed.title, author_judge: proposed.authorJudge,
      source_type: proposed.sourceType, upload_date: proposed.uploadDate, download_url: proposed.downloadUrl,
      review_status: "pending", review_note: note, proposed_metadata: null, quarantined_at: null,
    }).eq("id", candidateId);
    if (error) throw error;
    process.stdout.write(`Accepted changed metadata for review: ${candidateId}. Approval is still required.\n`);
    return;
  }
  if (action === "reopen") {
    const { data: candidate, error: readError } = await client.from("ingestion_candidates")
      .select("last_seen_at,quarantined_at,proposed_metadata")
      .eq("id", candidateId).eq("review_status", "quarantined").maybeSingle();
    if (readError || !candidate || candidate.proposed_metadata || !candidate.quarantined_at
      || new Date(candidate.last_seen_at) <= new Date(candidate.quarantined_at)) {
      throw readError ?? new Error("Candidate has not reappeared after its missing-record quarantine.");
    }
    const { data, error } = await client.from("ingestion_candidates")
      .update({ review_status: "pending", review_note: note, quarantined_at: null })
      .eq("id", candidateId).eq("review_status", "quarantined").is("proposed_metadata", null)
      .eq("last_seen_at", candidate.last_seen_at).select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("No missing candidate is ready to reopen.");
    process.stdout.write(`Reopened candidate ${candidateId} for separate approval.\n`);
    return;
  }
  throw new Error("Use list [status] [page], report, pdf-list, activate-source --metadata-only, approve ID NOTE, reject ID NOTE, withdraw ID NOTE, accept-change ID NOTE, reopen ID NOTE, pdf-review ID NOTE, or pdf-reject ID NOTE.");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Review failed"}\n`);
  process.exitCode = 1;
});
