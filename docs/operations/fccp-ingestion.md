# FCCP ingestion, text, and summary runbook

Updated 2026-11-15. Source: the [Federal Constitutional Court of Pakistan judgments page](https://fccp.gov.pk/judgements). The owner confirmed on 2026-11-15 that FCCP judgments are public material the project may download, store, display in full, and summarise. The importer, text extraction, and summaries rely on that decision.

## How the source works

On 2026-11-13 FCCP moved to `https://fccp.gov.pk` and rebuilt the site as a JavaScript app. The judgment listing now comes from a public JSON API:

- **Listing:** `GET /api/public/site/publications/judgement?size=50`, with the response's `next` value passed back as `cursor` for the following page. Each item carries the case title, author judges, the issue time (`issuedAt`, UTC), and the SHA-256 of its PDF.
- **PDF:** `GET /api/public/site/files/<sha256>`. The link is permanent because it is named by the file's hash, and the worker checks the downloaded bytes against that hash.
- **Orders:** the judgment feed lists judgments only. The 27 orders staged from the old HTML table are not in it, so the first API run quarantined them. They were never published.
- **robots.txt:** the site has none. Its app shell answers that path instead. The worker treats that as no policy. If a real `robots.txt` appears, it must allow the wildcard agent, or the run stops.

Published records link "Open official source" to the court's search for the case title (migration 019), because a direct file link downloads instead of opening a page.

## Identity

A candidate's identity is a hash of its lower-cased title and type, and its metadata hash covers title, judges, type, and upload date. The API adapter (`fccp-api-v1`) computes both exactly as the retired HTML parser did. It derives the upload date from `issuedAt` in Pakistan time (UTC+5). The first API run therefore found all 83 earlier candidates unchanged. A test pins this, because a different hash would quarantine every published judgment.

## Commands

All commands run on the operator machine against local Supabase. They refuse a remote database.

1. **Import the listing.** `npm run ingest:fccp -- --all` follows every page with five seconds between requests (at most 20 pages), checks the reported total, and rechecks page one for drift. It stages new judgments, refreshes links on unchanged ones, and quarantines changed or missing ones. `--file PATH` imports a saved API page offline.
2. **Review and approve.** Use `npm run review:fccp -- list`, then `approve <candidate-uuid> "<note>"`, as before. `reject`, `withdraw`, `accept-change`, and `reopen` are unchanged.
3. **Extract text.** `npm run extract:fccp-text -- --limit 50` downloads the PDF of each approved, published judgment that has no text yet, five seconds apart. PDF.js extracts its text layer, and a private `pdf_inspections` row records the hash, page count, and quality.
   - **Extractable text:** published at once on the judgment's current version (`text_kind = extracted`).
   - **Scanned or sparse PDFs:** not published, because they need OCR. The command reports them and skips them on later runs.
4. **Draft summaries.** `npm run summarize:judgments -- --limit 10` sends each judgment's text to the configured model and stores a short draft privately in `summary_drafts`. It needs `SUMMARY_API_KEY` (see [environment variables](../ENVIRONMENT_VARIABLES.md)).
   - **Long judgments:** text over `SUMMARY_MAX_INPUT_CHARS` (default 12,000) is trimmed to its start and end, where the parties and the decision usually are.
   - **Model declines:** if the model says the text is insufficient, no draft is stored.
5. **Review summaries.**
   - `npm run review:summaries -- list` shows pending drafts.
   - `approve <draft-uuid> "<note>"` copies a draft onto the public version, and `reject <draft-uuid> "<note>"` discards it so the next run drafts again.
   - `unpublish <draft-uuid> "<note>"` removes an approved summary.
   - `approve-all "<note>"` approves every pending draft. Use it only after reading them.
6. **Publish.** Run `npm run sync:corpus`, then `npm run sync:corpus -- --apply`. Text and approved summaries travel with each document version. The hosted database needs migration 020 (`npx supabase db push`) before the first sync that carries summaries, and migration 021 before the web release that adds the PDF reader, because the document page reads `source_pdf_sha256`.

## What the public sees

- **Document page:** the AI summary under a "Summary" heading with an "AI-generated" label. The label names the model and the review date, and says to rely on the full text.
- **Official PDF:** below the summary, a PDF.js reader shows the court's own PDF with its original layout. The page loads it from `/api/v1/documents/<id>/pdf`, which fetches `https://fccp.gov.pk/api/public/site/files/<source_pdf_sha256>`, checks the bytes against that hash, and serves them with a one-day CDN cache. The extracted text sits under "Plain text version". If the PDF cannot be fetched, or is over 6 MB (Netlify's response limit), the page shows the extracted text instead.
- **Which PDF:** `document_versions.source_pdf_sha256` records the file the text came from. Text extraction sets it, and migration 021 backfilled earlier text from `pdf_inspections`. Older versions keep an expired download token in `raw_metadata.download_url`; the reader does not use it.
- **Search results:** the summary under each result, labelled "AI summary". A result without one shows the opening of the judgment text instead.
- **Drafts:** unreviewed drafts are never public. `summary_drafts` has row-level security on and no policies.

## Failure handling

The listing stops without staging anything when any of these happen:

- a non-200 response or a redirect;
- an unexpected content type or an oversized body;
- a change in the API's shape or total;
- a restrictive robots rule.

Invalid single items are rejected and reported, and a run with rejected items does not quarantine missing records. Text extraction and summary drafting continue past a failed item, report it, and exit non-zero. The summary command waits out HTTP 429 rate limits up to three times per item, and logs only the HTTP status of other API errors.

## Known limits

- **Scanned PDFs:** these need an OCR path, which does not exist yet.
- **Search scope:** search matches titles, case numbers, approved summaries, and extracted text (migration 022). Judgments without extracted text match on title and case number only.
- **Model trust:** summaries depend on the model's accuracy. Human review is the control, so read before approving.
