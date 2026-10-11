// Inspect one approved FCCP PDF privately after a human selects its candidate.
import { createClient } from "@supabase/supabase-js";
import { checkFccpRobots } from "./fccp-fetch.js";
import { fetchFccpPdf, inspectFccpPdf, PDF_PARSER_VERSION } from "./fccp-pdf.js";

const candidateId = process.argv[2];
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!candidateId || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(candidateId)) {
  throw new Error("Provide one approved candidate UUID.");
}
if (!url || !key || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("PDF inspection requires local worker credentials.");
}
const client = createClient(url, key, { auth: { persistSession: false } });

async function main(): Promise<void> {
  const { data: candidate, error: candidateError } = await client.from("ingestion_candidates")
    .select("source_id,identity_hash,download_url,review_status,source_type")
    .eq("id", candidateId).maybeSingle();
  if (candidateError || !candidate || candidate.review_status !== "approved" || candidate.source_type !== "Judgement") {
    throw candidateError ?? new Error("Select an approved FCCP judgment candidate.");
  }
  const { data: source, error: sourceError } = await client.from("source_registry")
    .select("code,access_status").eq("id", candidate.source_id).single();
  if (sourceError || source?.code !== "FCCP_OFFICIAL" || source.access_status !== "approved") {
    throw sourceError ?? new Error("FCCP source is not active.");
  }
  const { data: document, error: documentError } = await client.from("legal_documents")
    .select("id").eq("source_id", candidate.source_id).eq("source_item_id", candidate.identity_hash)
    .eq("publication_status", "published").single();
  if (documentError || !document) throw documentError ?? new Error("Published document is unavailable.");
  await checkFccpRobots();
  const bytes = await fetchFccpPdf(candidate.download_url);
  const inspection = await inspectFccpPdf(bytes);
  const record = {
    candidate_id: candidateId, document_id: document.id, source_url: candidate.download_url,
    pdf_sha256: inspection.pdfSha256, pdf_bytes: inspection.pdfBytes,
    page_count: inspection.pageCount, extracted_text: inspection.extractedText,
    text_chars: inspection.textChars, quality: inspection.quality, parser_version: PDF_PARSER_VERSION,
  };
  const { data: existing, error: lookupError } = await client.from("pdf_inspections")
    .select("id").eq("candidate_id", candidateId).eq("pdf_sha256", inspection.pdfSha256).maybeSingle();
  if (lookupError) throw lookupError;
  const { error } = existing
    ? await client.from("pdf_inspections").update({ source_url: record.source_url, checked_at: new Date().toISOString() }).eq("id", existing.id)
    : await client.from("pdf_inspections").insert(record);
  if (error) throw error;
  process.stdout.write(JSON.stringify({ candidateId, documentId: document.id,
    pdfSha256: inspection.pdfSha256, pdfBytes: inspection.pdfBytes,
    pageCount: inspection.pageCount, textChars: inspection.textChars,
    quality: inspection.quality, reviewStatus: existing ? "existing" : "pending" }) + "\n");
}

main().catch((error: unknown) => {
  const message = error && typeof error === "object" && "message" in error
    ? String(error.message) : "PDF inspection failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
