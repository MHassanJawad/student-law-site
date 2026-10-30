// Private local operator actions for Pakistan Code legislation metadata candidates.
import { createClient } from "@supabase/supabase-js";
import { checkPakistanCodeRobots } from "./pakistan-code-listing.js";

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
    let query = client.from("legislation_candidates")
      .select("id,title,official_number,promulgation_date,category,instrument_type,source_review_flag,detail_url,review_status,review_note,proposed_metadata")
      .order("title").range(from, from + 24);
    if (status !== "all") query = query.eq("review_status", status);
    const { data, error } = await query;
    if (error) throw error;
    process.stdout.write(JSON.stringify(data ?? [], null, 2) + "\n");
    return;
  }
  if (action === "activate-source") {
    if (candidateId !== "--metadata-only") throw new Error("Explicit --metadata-only scope is required.");
    await checkPakistanCodeRobots();
    const { data, error } = await client.from("source_registry").update({
      access_status: "approved", reviewed_at: new Date().toISOString(),
      access_review_note: "Metadata-only Pakistan Code pilot (Federal Laws tab, one letter per manual run); no formal portal permission; owner relies on Copyright Ordinance 1962 section 57(1)(q) for Gazette matter. Robots.txt has no wildcard rule and disallows /pdffiles/ only for Googlebot; the worker never requests /pdffiles/. The portal states all laws are under review, so legal status is published as unknown. No text or PDF storage; no automatic publication.",
    }).eq("code", "PAKISTAN_CODE_OFFICIAL").select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("Ingest a Pakistan Code letter before activating the source.");
    process.stdout.write("Pakistan Code source activated for reviewed metadata-only publication.\n");
    return;
  }
  if (!candidateId || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(candidateId)) {
    throw new Error("Specify a candidate UUID from the list command.");
  }
  if (!note || note.length < 10) throw new Error("Provide a review note of at least 10 characters.");
  if (action === "approve") {
    const { data, error } = await client.rpc("approve_legislation_candidate", { p_candidate_id: candidateId, p_review_note: note });
    if (error) throw error;
    process.stdout.write(`Published reviewed legislation metadata document ${data}.\n`);
    return;
  }
  if (action === "reject") {
    const { data, error } = await client.from("legislation_candidates")
      .update({ review_status: "rejected", review_note: note, reviewed_at: new Date().toISOString() })
      .eq("id", candidateId).eq("review_status", "pending").select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("Only pending candidates may be rejected.");
    process.stdout.write(`Rejected candidate ${candidateId}.\n`);
    return;
  }
  if (action === "accept-change") {
    const { data: candidate, error: readError } = await client.from("legislation_candidates")
      .select("proposed_metadata").eq("id", candidateId).eq("review_status", "quarantined").maybeSingle();
    if (readError || !candidate?.proposed_metadata) throw readError ?? new Error("No quarantined change found.");
    const { source_id: _source, identity_hash: _identity, ...proposed } = candidate.proposed_metadata as Record<string, unknown>;
    const { error } = await client.from("legislation_candidates").update({
      ...proposed, review_status: "pending", review_note: note, proposed_metadata: null,
    }).eq("id", candidateId);
    if (error) throw error;
    process.stdout.write(`Accepted changed metadata for review: ${candidateId}. Approval is still required.\n`);
    return;
  }
  throw new Error("Use list [status] [page], activate-source --metadata-only, approve ID NOTE, reject ID NOTE, or accept-change ID NOTE.");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Review failed"}\n`);
  process.exitCode = 1;
});
