# Research search semantics

Phase 4 public search covers published records whose current document version is approved and whose source is approved or labeled as a local fixture. Every response includes the measured published count by source and kind. No collection claims to be exhaustive.

| Mode | What matches | Available filters |
| --- | --- | --- |
| Case Law | Judgment title, case identifier, approved summary, or extracted text | Relevance, title, decision date sort |
| Courtwise | Same judgment corpus, explicitly FCCP only | Search term, sort |
| Citation | Verified reporter citation fields only; punctuation and spaces are normalized for matching | Free-text citation or reporter, year, page/code |
| Advanced | Same as Case Law | Author judge, verified decision date range, sort |
| Statutes | Legislation title, official citation, or extracted text | Jurisdiction, enactment year, instrument type, recorded legal status, sort |

An empty query browses the current collection except in Citation mode.

**How words match (migration 022).** Words are matched in English word-stem form, so `allowance` also finds `allowances`. All words must appear. `"exact phrase"` matches a phrase, `or` matches either word, and `-word` excludes it. Each version indexes its approved summary and up to 300,000 characters of extracted text. **Relevance** ranks title matches first, then summary matches, then body-text matches, and damps very long texts so length alone does not win. A query that appears inside the title or case number is always boosted to the top. The other sorts order the same set of matches by decision date or title. Each page contains at most 20 records. The total count is computed before pagination, including when a requested page has no items. Text excerpts appear only when the current approved version contains public text. The current FCCP and legislation samples have no public text, so they have no excerpts or legal section anchors. When an approved version receives reviewed sections, the document page shows ordered section navigation.

Case identifiers are not reporter citations. Source upload dates are not decision dates. A date filter excludes records whose decision date is unknown. A legislation status of `unknown` is shown as such, never inferred from a source's existence. Results link to the official source and show the version checked date and reference. The local seed's Contract Act, 1872 metadata comes from the [Ministry of Law and Justice Pakistan Code page](https://www.pakistancode.gov.pk/english/UY2FqaJw2-apaUY2Fqa-a50%3D-sg-jjjjjjjjjjjjj-con-51), whose disclaimer says the site content is under review. It is marked `LOCAL SAMPLE` and has no copied statutory text or assertion of current legal effect.

The application does not save search strings to its database or send them to an analytics service. Query strings remain in the browser URL for sharing and navigation and may appear in local development or infrastructure access logs. The search API returns `Cache-Control: no-store`.

Performance target: p95 under two seconds for public search and document detail on the pilot dataset. This is a local development baseline, not a production-load guarantee. The title and version full-text indexes and the citation trigram index support the current modes; substring and filter plans should be reviewed again as the corpus grows.
