// Rules for copying the reviewed corpus from the local review database to a hosted database.

/** Corpus tables in foreign-key order, with explicit columns (generated columns excluded) and upsert keys. */
export const CORPUS_TABLES = {
  source_registry: { key: "id", columns: "id,code,owner,root_url,jurisdiction,material_kind,access_status,attribution,reviewed_at,last_checked_at,created_at,access_review_note" },
  legal_documents: { key: "id", columns: "id,source_id,source_item_id,canonical_url,kind,title,language,publication_status,current_version_id,created_at,updated_at" },
  document_versions: { key: "id", columns: "id,document_id,content_hash,checked_at,raw_metadata,extracted_text,text_kind,parser_version,review_status,created_at" },
  judgment_metadata: { key: "document_id", columns: "document_id,issuing_court,case_number,decision_date,author_judge,bench,raw_citation,normalized_citation" },
  legislation_metadata: { key: "document_id", columns: "document_id,jurisdiction,instrument_type,enactment_year,legal_status,official_citation" },
  document_sections: { key: "id", columns: "id,version_id,section_key,heading,body,display_order,review_status" },
} as const;

/** Statuses that have been public at some point; staged records never leave the review database. */
export const SYNCED_STATUSES = ["published", "withdrawn", "quarantined"] as const;

/**
 * Rejects a sync target that could be the review database itself or an unencrypted host.
 *
 * @param target - Hosted Supabase API URL.
 * @param allowLocal - Permits a localhost target for the CI idempotence check only.
 * @throws {Error} When the URL is invalid, not HTTPS, or local without permission.
 */
export function assertSyncTarget(target: string | undefined, allowLocal: boolean): void {
  let url: URL;
  try {
    url = new URL(target ?? "");
  } catch {
    throw new Error("Set TARGET_SUPABASE_URL to the hosted Supabase API URL.");
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (local && !allowLocal) throw new Error("The sync target is local; pass --allow-local-target only for the CI check.");
  if (!local && url.protocol !== "https:") throw new Error("The hosted sync target must use HTTPS.");
}

/** Splits rows into bounded request batches. */
export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += size) batches.push(items.slice(start, start + size));
  return batches;
}
