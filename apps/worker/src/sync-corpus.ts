// Copy reviewed corpus records from the local review database to a hosted database. Upsert only; never deletes.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSyncTarget, chunk, CORPUS_TABLES, SYNCED_STATUSES } from "./corpus-sync.js";

type Table = keyof typeof CORPUS_TABLES;
type Row = Record<string, unknown>;
const PAGE = 1000;

function client(url: string | undefined, key: string | undefined, label: string): SupabaseClient {
  if (!url || !key || key.startsWith("replace-with-")) throw new Error(`Set ${label} Supabase URL and service-role key.`);
  return createClient(url, key, { auth: { persistSession: false } });
}

async function readAll(db: SupabaseClient, table: Table, filter: (query: any) => any = (query) => query): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await filter(db.from(table).select(CORPUS_TABLES[table].columns as string))
      .order(CORPUS_TABLES[table].key).range(from, from + PAGE - 1);
    if (error) throw new Error(`Reading ${table}: ${error.message}`);
    rows.push(...(data as Row[]));
    if ((data as Row[]).length < PAGE) return rows;
  }
}

async function readFor(db: SupabaseClient, table: Table, column: string, ids: unknown[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (const batch of chunk(ids, 100)) rows.push(...await readAll(db, table, (query) => query.in(column, batch)));
  return rows;
}

async function upsert(db: SupabaseClient, table: Table, rows: Row[]): Promise<void> {
  for (const batch of chunk(rows, 500)) {
    const { error } = await db.from(table).upsert(batch, { onConflict: CORPUS_TABLES[table].key });
    if (error) throw new Error(`Writing ${table}: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const allowLocal = args.includes("--allow-local-target");
  const sourceUrl = process.env.SUPABASE_URL;
  if (!sourceUrl || !["localhost", "127.0.0.1"].includes(new URL(sourceUrl).hostname)) {
    throw new Error("The review database must be the local Supabase stack.");
  }
  assertSyncTarget(process.env.TARGET_SUPABASE_URL, allowLocal);
  const local = client(sourceUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, "local");
  const target = client(process.env.TARGET_SUPABASE_URL, process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY, "target");

  const sources = await readAll(local, "source_registry");
  const documents = await readAll(local, "legal_documents", (query) => query.in("publication_status", [...SYNCED_STATUSES]));
  const documentIds = documents.map((row) => row.id);
  const versions = await readFor(local, "document_versions", "document_id", documentIds);
  const judgments = await readFor(local, "judgment_metadata", "document_id", documentIds);
  const laws = await readFor(local, "legislation_metadata", "document_id", documentIds);
  const sections = await readFor(local, "document_sections", "version_id", versions.map((row) => row.id));
  const plan = { source_registry: sources.length, legal_documents: documents.length, document_versions: versions.length,
    judgment_metadata: judgments.length, legislation_metadata: laws.length, document_sections: sections.length };
  if (!apply) {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", upserts: plan })}\nRe-run with --apply to write to ${process.env.TARGET_SUPABASE_URL}.\n`);
    return;
  }
  // Documents first without their version pointer, which references versions not yet written.
  await upsert(target, "source_registry", sources);
  await upsert(target, "legal_documents", documents.map(({ current_version_id: _pointer, ...row }) => row));
  await upsert(target, "document_versions", versions);
  await upsert(target, "legal_documents", documents);
  await upsert(target, "judgment_metadata", judgments);
  await upsert(target, "legislation_metadata", laws);
  await upsert(target, "document_sections", sections);
  process.stdout.write(`${JSON.stringify({ mode: "applied", upserts: plan })}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Corpus sync failed"}\n`);
  process.exitCode = 1;
});
