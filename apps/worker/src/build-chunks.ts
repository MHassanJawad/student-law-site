// Split the extracted text of each published judgment into citable passages. Local database only; a rerun completes partly built versions and otherwise adds nothing.
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
  let versions = 0;
  let chunks = 0;
  for (const doc of documents ?? []) {
    const version = doc.document_versions.find((item) => item.id === doc.current_version_id);
    if (version?.text_kind !== "extracted" || !version.extracted_text) continue;
    const rows = chunkText(version.extracted_text).map((part) => ({
      version_id: version.id, chunker_version: CHUNKER_VERSION, ordinal: part.ordinal, document_id: doc.id,
      body: part.body, char_start: part.charStart, char_end: part.charEnd, paragraph_label: part.paragraphLabel,
    }));
    // A count mismatch means an earlier run died mid-version; upsert completes it without touching other chunker versions.
    const { count, error: countError } = await client.from("document_chunks")
      .select("ordinal", { count: "exact", head: true }).eq("version_id", version.id).eq("chunker_version", CHUNKER_VERSION);
    if (countError) throw countError;
    if (count === rows.length) continue;
    // Drop stale tail rows left by an earlier, longer chunking of this version.
    const { error: trimError } = await client.from("document_chunks").delete()
      .eq("version_id", version.id).eq("chunker_version", CHUNKER_VERSION).gte("ordinal", rows.length);
    if (trimError) throw trimError;
    for (let start = 0; start < rows.length; start += 200) {
      const { error: insertError } = await client.from("document_chunks")
        .upsert(rows.slice(start, start + 200), { onConflict: "version_id,chunker_version,ordinal" });
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
