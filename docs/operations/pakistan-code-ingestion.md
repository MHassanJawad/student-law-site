# Pakistan Code federal legislation runbook

Access review: 2026-10-30. Source: [Pakistan Code](https://pakistancode.gov.pk/english/index.php), Ministry of Law and Justice, "Laws in Alphabetical Order".

## Access and rights evidence

- [robots.txt](https://pakistancode.gov.pk/robots.txt), last modified 2026-03-04. It lists a sitemap and one group: `User-agent: googlebot`, `Disallow: /pdffiles/`. There is no wildcard rule. The worker never requests `/pdffiles/`. It stops if any rule appears that could cover other paths.
- The [disclaimer](https://pakistancode.gov.pk/english/Xki72HF.php) says all laws on the site are under review, are for general information, and should not be taken as authentic or error-free. It refers users to the relevant Gazette notification. No terms restricting automated access or reuse were found.
- Reuse basis: the owner relies on the [Copyright Ordinance, 1962, section 57(1)(q)](https://pakistancode.gov.pk/pdffiles/administrator5d255d1f44b50b65d6a3e87a2e0d3fee.pdf) for official Gazette matter. There is no formal portal permission.
- Consequences:
  - Only listing metadata is stored: title, category, number, promulgation date, the "Under Review" flag, and the detail page link. No law text or PDFs are stored.
  - Every published law has legal status `unknown`.
  - Document pages link to the official detail page.

## What the importer reads

Each letter page (`LGu0xAD.php?alp=<letter>&page=1&action=active`) holds every law for that letter on one page; for example, P had 259 rows in 328 KB on 2026-10-30. Only the **Federal Laws** tab is parsed. The Ordinance (temporary ordinances), Amendment, and Subordinate Legislation tabs are counted and excluded from this pilot. Requests are limited to the fixed official host, with:
- a robots check before each run;
- one page per run;
- no redirects;
- a 15-second timeout;
- a 2 MiB page limit.

Parsing rules:
- **Identity** is the title plus the official number. Detail links stayed identical across repeated visits, but they are refreshed on every run rather than used as identity.
- **Changed metadata** (title text, category, number, date, or flag) quarantines the candidate and any published record until reviewed.
- **Unreadable promulgation dates** are stored as unknown and counted in the run report; they are never guessed.
- **Instrument type and enactment year** come from the title. Repeal notes such as "(Repealed by Act XXXIV of 1997)" are ignored for these fields but kept in the title verbatim.
- **Duplicate rows** (same title and number) are rejected and reported.
- **Removals:** one-letter runs never infer them; a law missing from a later run is not quarantined automatically.

Observed on 2026-10-30:
- A: 53 Federal Laws rows; 3 without a readable date.
- C: 105 rows; 11 without a date.
- P: 195 rows, one of them a repeated row; 8 without a date.

## Operation

Same setup as the [FCCP runbook](fccp-ingestion.md): local Supabase and `apps/worker/.env`. On Windows, use `npm.cmd`.

1. `npm run ingest:pakistan-code -- --letter A` fetches robots.txt and one letter page, then stages candidates privately. The JSON report gives staged, unchanged, quarantined, rejected, excluded-tab, and missing-date counts. Wait between letters; there is no reason to fetch the whole alphabet at once.
2. `npm run review:legislation -- list pending 1` shows 25 candidates at a time with their official detail links. Open the link and compare the title, number, and date with the official page.
3. Once per source, run `npm run review:legislation -- activate-source --metadata-only`. This rechecks robots.txt and records the access review in `source_registry`.
4. Publish a checked law:

   ```
   npm run review:legislation -- approve <uuid> "<evidence, 10+ characters>"
   ```

   Publication is one atomic database operation. Use `reject` for a false or out-of-scope row. For a quarantined change, run `accept-change` after comparison, then `approve` again.
5. Run `npm run sync:corpus` (dry run), then `npm run sync:corpus -- --apply`, to copy reviewed records to the hosted database.

To withdraw a published law, set its document to withdrawn with the local service-role connection, for example in the Supabase Studio SQL editor:

```sql
update public.legal_documents set publication_status = 'withdrawn', updated_at = now() where id = '<id>';
```

Then run the sync. Once the official Contract Act record is published, withdraw the seed's `LOCAL SAMPLE` Contract Act the same way.

## Failure handling

The following stop the run and record a failed run without changing candidates:
- a robots change;
- a non-200 response or redirect;
- a wrong content type or an oversized page;
- missing tabs.

Do not raise the request rate or work around access controls to fix a failure. Provincial portals need their own access review and adapter.
