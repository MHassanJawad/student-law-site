// Split the extracted text of each published judgment into citable passages. Local database only; reruns add nothing.
import { createClient } from "@supabase/supabase-js";
import { CHUNKER_VERSION, chunkText } from "./chunking.js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Building chunks requires local worker credentials.");
}
const client = createClient(url, key, { auth: { persistSession: false } });

async function main(): Promise<void> {
  const { data: documents, error } = await client.from("legal_documents")
    .select("id,current_version_id,document_versions!document_versions_document_id_fkey(id,text_kind,extracted_text)")
    .eq("publication_status", "published").limit(5000);
  if (error) throw error;
  const { data: done, error: doneError } = await client.from("document_chunks")
    .select("version_id").eq("chunker_version", CHUNKER_VERSION).eq("ordinal", 0).limit(5000);
  if (doneError) throw doneError;
  const built = new Set((done ?? []).map((row) => row.version_id));
  let versions = 0;
  let chunks = 0;
  for (const doc of documents ?? []) {
    const version = doc.document_versions.find((item) => item.id === doc.current_version_id);
    if (version?.text_kind !== "extracted" || !version.extracted_text || built.has(version.id)) continue;
    const rows = chunkText(version.extracted_text).map((part) => ({
      version_id: version.id, chunker_version: CHUNKER_VERSION, ordinal: part.ordinal, document_id: doc.id,
      body: part.body, char_start: part.charStart, char_end: part.charEnd, paragraph_label: part.paragraphLabel,
    }));
    for (let start = 0; start < rows.length; start += 200) {
      const { error: insertError } = await client.from("document_chunks").insert(rows.slice(start, start + 200));
      if (insertError) throw insertError;
    }
    versions += 1;
    chunks += rows.length;
  }
  process.stdout.write(JSON.stringify({ versions, chunks }) + "\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${(error as { message?: string } | null)?.message ?? "Chunk build failed"}\n`);
  process.exitCode = 1;
});
