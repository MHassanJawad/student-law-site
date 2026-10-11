# FCCP ingestion and review runbook

Initial snapshot: 2026-10-06. Source: [Federal Constitutional Court of Pakistan judgments listing](https://www.fccp.gov.pk/judgements). The official [robots.txt](https://www.fccp.gov.pk/robots.txt) returned `User-agent: *` with an empty `Disallow` rule. The owner has **no formal portal permission** and relies on the judgment exception in [Pakistan's Copyright Ordinance, 1962, section 57(1)(q)(ii)](https://pakistancode.gov.pk/pdffiles/administrator5d255d1f44b50b65d6a3e87a2e0d3fee.pdf), subject to any prohibition by the issuing court or authority. This copyright provision does not specify a website request rate or access method. No separate FCCP terms governing automated collection were found in this review. Collection remains manually triggered and bounded. No source text or PDF bytes are published by this workflow.

## Scope and behavior

- `--live` checks robots.txt and downloads only page 1. `--all` checks robots.txt once, fetches at most 15 listing pages with five seconds between requests, validates each reported range and total, then rechecks page 1 for drift. A mismatched snapshot fails before staging. Requests use a fixed official host, a 15-second timeout, no redirects, and byte limits of 32 KiB for robots.txt and 1 MiB per listing page. If two pages show the same title and type and the later row lacks an upload date, the worker fetches both PDFs five seconds apart. It counts the second row as a duplicate only if the PDF hashes match; otherwise it flags an ambiguous row and disables removal reconciliation.
- The listing parser reads case title, author judge, source type, upload date when present, and the official download link. A blank upload date remains `null` and is counted as a source quality issue; it is never invented or treated as decision date.
- Records enter a private review queue. The source generates different download URLs across visits, so title and type form the pilot identity fingerprint. A collision or changed metadata, including upload date, needs review; it is not silently published. Published source links refresh on unchanged runs.
- One listing page showed 10 rows out of 111 on 2026-10-06. On 2026-10-11, all 12 pages showed 111 rows. The last row had a blank upload date and repeated an earlier title/type; both links returned identical 186,352-byte PDFs with SHA-256 `237db69ce2fdbb7204f50268df5206f6a9e0251f9c0f713c2a5748b58cd6b6a9`. A complete listing run records observed rows, unique candidates, verified duplicates, page count, and missing-date count. **Observed listing coverage is distinct from reviewed, published judgment coverage.** Orders are staged but the approval function accepts judgments only.
- A complete, validated snapshot quarantines previously seen candidates absent from the listing; an operator decides whether to withdraw the associated published record. One-page runs never infer removal.
- `inspect:fccp-pdf` fetches one approved judgment PDF selected by UUID, with a 15 MiB limit and no redirects. Mozilla PDF.js extracts text into a private, versioned inspection row with byte hash, page count, and quality status. Scanned or sparse PDFs require a different extraction path. Inspection never makes source text public or creates a summary.

## Local operation

1. Start local Supabase and run `npx supabase db reset --local` on a disposable database. Set `apps/worker/.env` from the local service-role key. Do not put it in the web app.
2. Run `npm run ingest:fccp -- --live` for a one-page check or `npm run ingest:fccp -- --all` for the bounded full listing. A run report contains observed, staged, unchanged, quarantined, missing, verified duplicate, rejected, page, and source-total counts.
3. Run `npm run review:fccp -- report` and `npm run review:fccp -- list pending 1`. The list command accepts a status and page number, 25 candidates at a time. Compare candidate fields and the linked official item with the source page.
4. After the source-specific review, run `npm run review:fccp -- activate-source --metadata-only`. This rechecks robots.txt and records the limited approval in `source_registry`.
5. Approve a verified judgment with `npm run review:fccp -- approve <candidate-uuid> "<review evidence of at least 10 characters>"`. Approval is an atomic database operation. Use `reject` for a false pending record. For a quarantined source change, use `accept-change` after comparison, then `approve` as a separate action. Use `withdraw` with a documented reason for a confirmed removal. If a missing item reappears in a later run, use `reopen` and separately approve it.
6. To inspect one approved PDF, first refresh its source link with a listing run, then run `npm run inspect:fccp-pdf -- <candidate-uuid>`. Run `npm run review:fccp -- pdf-list` to see extraction quality. Compare the extracted text against the official PDF before `pdf-review <inspection-uuid> "<evidence>"`; use `pdf-reject` for poor extraction. Extracted text remains private after review.

The worker rejects non-local Supabase URLs. On Windows PowerShell with script execution disabled, use `npm.cmd` and `npx.cmd`.

## Failure and correction handling

- A non-200 response, redirect, unexpected content type, oversized body, restrictive robots rule, or changed table layout stops the run. Check the private run report before retrying. Do not bypass access controls or increase request volume to resolve a failure.
- Invalid individual rows are excluded and reported; a blank date is preserved as unknown instead. A metadata change quarantines the candidate and any already published document until reviewed. An unchanged rerun makes no duplicate candidates or versions.
- Page 1 absence is **not** proof of removal, because older items move to later pages. Only a complete validated snapshot can quarantine a missing candidate; withdrawal requires a separate human decision.
- To withdraw a confirmed removal, use `npm run review:fccp -- withdraw <candidate-uuid> "<reason of at least 10 characters>"`. The database function updates the document and review record together. The review queue remains private under RLS.

## Next gate

Before unattended collection, broad PDF/text ingestion, or public summaries: confirm whether FCCP publishes access conditions or a prohibition affecting judgment reuse, review the chosen five-second interval with the source operator if one is available, measure parser accuracy across the observed listing, handle scanned PDFs with a separately tested OCR path, and define an editorial summary review process. The owner intends to publish original summaries rather than copied source text, so summaries require source traceability, factual checks, and editorial review. Federal and provincial legislation need separate source checks and adapters.
