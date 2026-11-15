// Draft short AI summaries for published judgments that have text; drafts stay private until reviewed.
import { createClient } from "@supabase/supabase-js";
import { cleanSummary, DEFAULT_MAX_INPUT_CHARS, DEFAULT_SUMMARY_API_URL, DEFAULT_SUMMARY_MODEL,
  SUMMARY_PROMPT_VERSION, SYSTEM_PROMPT, summaryInput } from "./summary.js";

const limitArg = process.argv.indexOf("--limit");
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : 10;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.SUMMARY_API_KEY?.trim();
const apiUrl = process.env.SUMMARY_API_URL?.trim() || DEFAULT_SUMMARY_API_URL;
const model = process.env.SUMMARY_MODEL?.trim() || DEFAULT_SUMMARY_MODEL;
const maxInput = Number(process.env.SUMMARY_MAX_INPUT_CHARS?.trim() || DEFAULT_MAX_INPUT_CHARS);
const pauseMs = Number(process.env.SUMMARY_PAUSE_MS?.trim() || 15000);
if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Use --limit 1-200.");
if (!url || !key || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("Summaries require local worker credentials.");
}
if (!apiKey || apiKey.startsWith("replace-with-")) throw new Error("Set SUMMARY_API_KEY in apps/worker/.env.");
if (new URL(apiUrl).protocol !== "https:") throw new Error("SUMMARY_API_URL must use HTTPS.");
if (!Number.isInteger(maxInput) || maxInput < 2000) throw new Error("SUMMARY_MAX_INPUT_CHARS must be at least 2000.");
const client = createClient(url, key, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One OpenAI-compatible chat completion, waiting out rate limits up to three times. */
async function complete(text: string): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(apiUrl, {
      method: "POST", signal: AbortSignal.timeout(90000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: 300, messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `<judgment>\n${text}\n</judgment>` },
      ] }),
    });
    if (response.status === 429 && attempt <= 3) {
      const wait = Math.min(Number(response.headers.get("retry-after")) || 30, 120);
      process.stdout.write(`Rate limited; waiting ${wait}s.\n`);
      await response.body?.cancel();
      await sleep(wait * 1000);
      continue;
    }
    // Only the status goes to logs: an error body could echo the request.
    if (!response.ok) throw new Error(`Summary API returned HTTP ${response.status}.`);
    const body = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Summary API returned no text.");
    return content;
  }
}

async function main(): Promise<void> {
  const [versions, drafts] = await Promise.all([
    client.from("document_versions")
      .select("id,legal_documents!document_versions_document_id_fkey!inner(kind,publication_status,current_version_id)")
      .eq("text_kind", "extracted").is("summary", null)
      .eq("legal_documents.kind", "judgment").eq("legal_documents.publication_status", "published").limit(5000),
    client.from("summary_drafts").select("version_id").in("review_status", ["pending", "approved"]).limit(5000),
  ]);
  if (versions.error ?? drafts.error) throw versions.error ?? drafts.error;
  const drafted = new Set((drafts.data ?? []).map((row) => row.version_id));
  const todo = (versions.data ?? []).filter((row) => {
    const doc = Array.isArray(row.legal_documents) ? row.legal_documents[0] : row.legal_documents;
    return doc?.current_version_id === row.id && !drafted.has(row.id);
  }).map((row) => row.id).slice(0, limit);
  const counts = { drafted: 0, declined: 0, failed: 0 };
  for (const [index, versionId] of todo.entries()) {
    if (index > 0) await sleep(pauseMs);
    try {
      const { data: version, error: readError } = await client.from("document_versions")
        .select("extracted_text").eq("id", versionId).single();
      if (readError || !version?.extracted_text) throw readError ?? new Error("Text disappeared.");
      const input = summaryInput(version.extracted_text, maxInput);
      const summary = cleanSummary(await complete(input));
      if (!summary) {
        counts.declined += 1;
        process.stdout.write(`Model declined ${versionId}: text too incomplete.\n`);
        continue;
      }
      const { error: insertError } = await client.from("summary_drafts").insert({
        version_id: versionId, model, prompt_version: SUMMARY_PROMPT_VERSION, input_chars: input.length, summary,
      });
      if (insertError) throw insertError;
      counts.drafted += 1;
    } catch (failure) {
      counts.failed += 1;
      process.stderr.write(`Failed ${versionId}: ${(failure as { message?: string } | null)?.message ?? "unknown error"}\n`);
    }
  }
  process.stdout.write(JSON.stringify({ model, selected: todo.length, ...counts }) + "\n");
  if (counts.failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${(error as { message?: string } | null)?.message ?? "Summary drafting failed"}\n`);
  process.exitCode = 1;
});
