// Extract and publish the text of approved FCCP judgments that do not have text yet.
import { createClient } from "@supabase/supabase-js";
import { checkFccpRobots } from "./fccp-fetch.js";
import { fetchFccpPdf, inspectFccpPdf, PDF_PARSER_VERSION } from "./fccp-pdf.js";

const REQUEST_INTERVAL_MS = 5000;
const limitArg = process.argv.indexOf("--limit");
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : 20;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Use --limit 1-200.");
if (!url || !key || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Text extraction requires local worker credentials.");
}
const client = createClient(url, key, { auth: { persistSession: false } });

async function main(): Promise<void> {
  const { data: source, error: sourceError } = await client.from("source_registry")
    .select("id,access_status").eq("code", "FCCP_OFFICIAL").single();
  if (sourceError || source?.access_status !== "approved") throw sourceError ?? new Error("FCCP source is not active.");
  const [candidates, documents, inspections] = await Promise.all([
    client.from("ingestion_candidates").select("id,identity_hash,download_url")
      .eq("source_id", source.id).eq("review_status", "approved").eq("source_type", "Judgement").limit(1000),
    client.from("legal_documents").select("id,source_item_id,current_version_id,document_versions!document_versions_document_id_fkey(id,text_kind)")
      .eq("source_id", source.id).eq("publication_status", "published").limit(1000),
    client.from("pdf_inspections").select("candidate_id").eq("parser_version", PDF_PARSER_VERSION).limit(5000),
  ]);
  const failed = candidates.error ?? documents.error ?? inspections.error;
  if (failed) throw failed;
  const done = new Set((inspections.data ?? []).map((row) => row.candidate_id));
  const byItem = new Map((documents.data ?? []).map((doc) => [doc.source_item_id, doc]));
  const todo = (candidates.data ?? []).flatMap((candidate) => {
    const doc = byItem.get(candidate.identity_hash);
    const version = doc?.document_versions.find((item) => item.id === doc.current_version_id);
    return doc && version?.text_kind === "none" && !done.has(candidate.id) ? [{ candidate, doc, versionId: version.id }] : [];
  }).slice(0, limit);
  if (todo.length) await checkFccpRobots();
  const counts = { published: 0, lowText: 0, failed: 0 };
  for (const [index, { candidate, doc, versionId }] of todo.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS));
    try {
      const inspection = await inspectFccpPdf(await fetchFccpPdf(candidate.download_url));
      const extractable = inspection.quality === "extractable";
      const { error: inspectionError } = await client.from("pdf_inspections").upsert({
        candidate_id: candidate.id, document_id: doc.id, source_url: candidate.download_url,
        pdf_sha256: inspection.pdfSha256, pdf_bytes: inspection.pdfBytes, page_count: inspection.pageCount,
        extracted_text: inspection.extractedText, text_chars: inspection.textChars, quality: inspection.quality,
        parser_version: PDF_PARSER_VERSION, review_status: extractable ? "reviewed" : "pending",
        review_note: extractable ? "Published automatically: official PDF text layer." : null,
        checked_at: new Date().toISOString(),
      }, { onConflict: "candidate_id,pdf_sha256" });
      if (inspectionError) throw inspectionError;
      if (!extractable) {
        counts.lowText += 1;
        process.stdout.write(`Skipped ${candidate.id}: ${inspection.quality} (needs OCR).\n`);
        continue;
      }
      const { error } = await client.from("document_versions")
        .update({ extracted_text: inspection.extractedText, text_kind: "extracted" }).eq("id", versionId);
      if (error) throw error;
      counts.published += 1;
    } catch (error) {
      counts.failed += 1;
      process.stderr.write(`Failed ${candidate.id}: ${(error as { message?: string } | null)?.message ?? "unknown error"}\n`);
    }
  }
  process.stdout.write(JSON.stringify({ selected: todo.length, ...counts }) + "\n");
  if (counts.failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${(error as { message?: string } | null)?.message ?? "Text extraction failed"}\n`);
  process.exitCode = 1;
});
