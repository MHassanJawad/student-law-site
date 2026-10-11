# FCCP metadata pilot runbook

Snapshot: 2026-10-06. Source: [Federal Constitutional Court of Pakistan judgments listing](https://www.fccp.gov.pk/judgements). The official [robots.txt](https://www.fccp.gov.pk/robots.txt) returned `User-agent: *` with an empty `Disallow` rule. The owner has **no formal portal permission** and relies on the judgment exception in [Pakistan's Copyright Ordinance, 1962, section 57(1)(q)(ii)](https://pakistancode.gov.pk/pdffiles/administrator5d255d1f44b50b65d6a3e87a2e0d3fee.pdf), subject to any prohibition by the issuing court or authority. This copyright provision does not specify a website request rate or access method. No separate FCCP terms governing automated collection were found in this review. This is a **metadata-only, manually triggered pilot**, not approval for bulk PDF storage, full-text republication, or an unattended crawl.

## Scope and behavior

- A live run checks robots.txt and downloads only page 1 of the judgment listing. Both requests use a fixed official host, a 15-second timeout, no redirects, and byte limits of 32 KiB and 1 MiB respectively.
- The parser reads case title, author judge, source type, upload date, and the official download link. Upload date is never treated as decision date. It does not fetch PDFs or extract text.
- Records enter a private review queue. The source generates different download URLs across visits, so title and type form the pilot identity fingerprint. A collision or changed metadata, including upload date, needs review; it is not silently published. Published source links refresh on unchanged runs.
- One listing page showed 10 rows out of 111 on 2026-10-06. This is **10/111 observed listing rows**, not complete corpus coverage. Orders are staged but the approval function accepts judgments only.

## Local operation

1. Start local Supabase and run `npx supabase db reset --local` on a disposable database. Set `apps/worker/.env` from the local service-role key. Do not put it in the web app.
2. Run `npm run ingest:fccp -- --live`. A run report contains observed, staged, unchanged, quarantined, rejected, and source-total counts.
3. Run `npm run review:fccp -- report` and `npm run review:fccp -- list`. Compare candidate fields and the linked official item with the source page.
4. After the source-specific review, run `npm run review:fccp -- activate-source --metadata-only`. This rechecks robots.txt and records the limited approval in `source_registry`.
5. Approve a verified judgment with `npm run review:fccp -- approve <candidate-uuid> "<review evidence of at least 10 characters>"`. Approval is an atomic database operation. Use `reject` for a false record. For a quarantined source change, use `accept-change` after comparison, then `approve` as a separate action.

The worker rejects non-local Supabase URLs. On Windows PowerShell with script execution disabled, use `npm.cmd` and `npx.cmd`.

## Failure and correction handling

- A non-200 response, redirect, unexpected content type, oversized body, restrictive robots rule, or changed table layout stops the run. Check the private run report before retrying. Do not bypass access controls or increase request volume to resolve a failure.
- Bad individual rows are excluded and reported. A metadata change quarantines the candidate and any already published document until reviewed. An unchanged rerun makes no duplicate candidates or versions.
- Page 1 absence is **not** proof of removal, because older items move to later pages. Reconciliation/removal requires a complete authorized enumeration method, which is not implemented yet.
- Local rollback: set a published `legal_documents.publication_status` to `withdrawn` through a service-role operator process; record the reason before a hosted release. The review queue remains private under RLS.

## Next gate

Before full coverage or PDF/text ingestion: establish a documented, respectful request rate and check whether FCCP publishes access conditions or a prohibition affecting judgment reuse; implement bounded pagination and stable item reconciliation; inspect representative PDFs; and measure parser accuracy against a reviewed sample. OCR and legislation adapters follow only where source files require them. The owner intends to publish original summaries rather than copied source text, so any summary workflow needs source traceability and editorial review.
