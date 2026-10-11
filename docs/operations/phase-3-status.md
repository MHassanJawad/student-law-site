# Phase 3 FCCP ingestion pilot verification

Date: 2026-10-11. Scope: manually triggered FCCP judgment listing enumeration and one private PDF quality inspection on disposable local Supabase. The importer did not publish the whole listing, store PDF bytes, or publish extracted judgment text.

## Steps performed

1. Inspected the [FCCP listing](https://www.fccp.gov.pk/judgements) and [robots.txt](https://www.fccp.gov.pk/robots.txt). Page 2 used `?page=2` and reported its row range. The worker checks robots, uses a fixed HTTPS host, rejects redirects, caps a full run at 15 pages, and waits five seconds between listing requests.
2. Added validation for each page's range, total, next link, and duplicate identities. The worker rechecks page 1 after enumeration and stages nothing if the listing moved. The source showed 111 rows over 12 pages.
3. Investigated the final blank-date row. Its title and type repeated an earlier row. Both official downloads were 186,352 bytes with SHA-256 `237db69ce2fdbb7204f50268df5206f6a9e0251f9c0f713c2a5748b58cd6b6a9`. The worker now verifies both PDF hashes before counting that narrow pattern as one source duplicate. A different hash is flagged for review.
4. Applied migrations 005-008 for complete-run counts, withdrawal, private PDF inspections, nullable source upload dates, and verified duplicate counts. The final `--all` run reported 111 observed rows, 110 unique candidates, one verified duplicate, one missing upload date, zero rejected rows, and zero missing candidates. A rerun left all 110 candidates unchanged.
5. Approved one previously compared judgment metadata record, `F.C.P.L.A. No. 1275 of 2026`. Fetched only that selected official PDF for a private quality inspection. It was 190,466 bytes, seven pages, SHA-256 `9e5e40500f19885354ab76eedede523ceb1d3df183a250acecda6285b95dfbaf`, and yielded 12,317 extracted characters. Rendered pages 1 and 7 and checked the court, case number, and both party names against the official PDF and an independent `pdftotext` extraction. Marked that inspection reviewed. A second inspection reused the same hash and row.
6. Ran `npm run test:ingestion-local`: it checked source counts, the reviewed PDF, and anonymous RLS denial for ingestion runs, candidates, and extracted text. Exercised the withdrawal SQL function in a transaction, verified it hid the published record, rolled back, and verified the record was still published.
7. Diagnosed PR #1's failed CI step as `npm audit --omit=dev --audit-level=high`. Updated Next.js to 16.4.0 and compatible production transitive packages. The same production audit then reported zero vulnerabilities.

## Exit gate and limits

- Listing enumeration: **111/111 source rows accounted for; 110 distinct candidate records**. The repeated row is not a second judgment. This is an observed snapshot, not a completeness guarantee for the court's entire archive.
- Publication: **one reviewed judgment metadata record**. The remaining candidates stay private pending case-by-case review. One PDF extraction is private and reviewed; no PDF bytes, extracted text, or generated summary are public.
- Changes and removals: changed metadata and records absent from a complete validated snapshot are quarantined. A human must approve a correction or withdraw a record with a reason. The withdrawal path passed a rollback drill.
- Source access: the owner has no formal FCCP portal permission. The [Copyright Ordinance, 1962, section 57(1)(q)(ii)](https://pakistancode.gov.pk/pdffiles/administrator5d255d1f44b50b65d6a3e87a2e0d3fee.pdf) is the stated judgment-reuse basis, subject to an issuing-authority prohibition. It does not specify an automated request rate. This pilot used a conservative manually triggered interval and remains subject to updated source access conditions.
- Next phases: broad PDF processing, OCR where required, original summaries with editorial review, legislation source adapters, and the complete research experience remain separate work.
