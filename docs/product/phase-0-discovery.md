# Phase 0: discovery and feasibility

Status: **pilot scope approved; source-specific access checks remain before retrieval**. Reviewed on 2026-09-27 against the project description, `plan.md`, the user-supplied screenshots, and the official source pages linked in [the source register](source-register.md). This is a discovery record, not a legal opinion or a claim of complete coverage.

## Product goal and first release

Help Pakistani law students and researchers find FCCP judgments and federal/provincial legislation, inspect provenance and versions, and save citations across devices. Anonymous search and reading remain available. A content operator reviews uncertain imports and source changes.

The first release excludes judgments from other courts, paid access, public uploads, and automated legal advice. Maxims, Articles, and Dictionary are curated editorial collections, separate from official legal documents. Reference screenshots establish navigation and search journeys, not branding or layout.

## Working assumptions to confirm

| ID | Assumption | Consequence if changed |
| --- | --- | --- |
| A-01 | The pilot uses English source material first; Urdu/Sindhi source records remain identifiable but full multilingual search waits for a measured need. | Changes parsing, search analyzers, and UI. |
| A-02 | The pilot uses a small sample from FCCP and each identified federal/provincial portal, without a date-based completeness claim. Approved by owner on 2026-09-27. | Changes ingestion volume and coverage messaging. |
| A-03 | The owner considers reproduction of official judgments and legislation permissible under Pakistani copyright law. Before retrieving or displaying an item, verify its official status and any issuing-authority prohibition; portal access rules are a separate check. | Changes document pages and search depth. |
| A-04 | The proposed Next.js/TypeScript, PostgreSQL, and separate worker stack is provisional until design and hosting constraints are agreed. | Changes setup and operations work. |
| A-05 | Students are the primary users; researchers/faculty and content operators are secondary users. | Changes priorities and usability checks. |

## Discovery findings

- The [FCCP judgment listing](https://www.fccp.gov.pk/judgements) exposes title, author judge, type, upload date, search fields, and downloadable records. The listing is for judgments/orders, so the importer must classify entries rather than assume every row is a judgment. A case number or upload date must not be presented as a verified decision date or reporter citation.
- The [Pakistan Code](https://pakistancode.gov.pk/english/index.php) provides federal laws and points users to Gazette notifications. Its own disclaimer says content is informational and under review; version and authority labels therefore require care.
- Official provincial candidates exist for [Punjab](https://pitb.gov.pk/law_portal), [Sindh](https://www.sindhlaws.gov.pk/SindhIndex.aspx), [Khyber Pakhtunkhwa](https://kpcode.kp.gov.pk/homepage/list_all_law), and [Balochistan](https://balochistancode.gob.pk/Aboutus.aspx). Their visible catalogues differ in format, metadata, languages, and apparent coverage. No combined completeness baseline has been established.
- Public viewing/downloadability does not establish permission for bulk automated access, republishing text or PDFs, or commercial use. Sindh's [terms page](https://sindhlaws.gov.pk/TermsCondition.aspx) expressly discusses the *app*; its applicability to the website's legal content needs clarification, not inference.
- No user interviews, citation examples supplied by students, source-owner responses, or operator workflow review are available yet. Those remain discovery evidence gaps.
- The supplied screenshots establish citation-search inputs: reporter abbreviation (examples include CLC, PLD, SCMR, YLR), year, court, code/page, judge, lawyer, and party names, plus a result list. They contain judgments from courts outside this project's corpus, so their result set is not a data source or coverage model. The UI can be specified from them; real FCCP citation fixtures must come from official FCCP records.
- [Copyright Ordinance, 1962, section 57(1)(q)](https://pakistancode.gov.pk/pdffiles/administrator5d255d1f44b50b65d6a3e87a2e0d3fee.pdf) addresses reproduction or publication of official Gazette matter and court judgments/orders unless the government or issuing court prohibits it. This supports the owner's position for qualifying material; it does not itself verify every portal item, authorize automated access, or cover third-party editorial additions. The owner approved a small pilot on this basis.
- The owner prefers no spend initially and permits a monthly ceiling below PKR 10,000 if essential. Current [Supabase pricing](https://supabase.com/pricing) offers a free prototype tier with a 500 MB database and pausing after inactivity; paid hosting and backup choices need measured pilot size and reliability requirements. [Vercel Hobby terms](https://vercel.com/docs/plans/hobby) restrict that tier to personal/non-commercial use, so it is not assumed suitable for a public service.

## MVP success measures and gates

| Measure | Initial acceptance rule |
| --- | --- |
| Search | Common queries on a documented representative pilot corpus have p95 latency below 2 seconds. |
| Provenance | Every published legal record has a canonical source link and checked/imported timestamp. |
| Import safety | Re-running a sample import does not duplicate records; changed or uncertain records are versioned or quarantined. |
| Coverage | Report counts and date ranges per source, jurisdiction, and document type; make no completeness claim without evidence. |
| Saved citations | A user saves, reopens in a separate session, and removes a citation; another user cannot access it. |
| Accessibility | Search, detail, auth, and saved citation journeys target WCAG 2.2 AA, including keyboard and screen-reader checks. |

Phase 0 discovery is sufficient to start product and technical design with the approved small pilot and under-PKR-10,000 monthly ceiling. Before automated sample retrieval, check each portal's access rules, robots policy, and any item-level prohibition. Bulk collection and public republication require a recorded source-by-source decision and measured coverage; neither is approved by this pilot decision.

## Risk register

| ID | Risk | Response |
| --- | --- | --- |
| R-01 | Unclear reuse or automated-access rights | Record terms and seek source-owner or legal clarification; use links and metadata pending a decision. |
| R-02 | Legislation omitted or stale across jurisdictions | Establish per-source/date coverage and refresh checks; display gaps and checked dates. |
| R-03 | Court listing mixes judgments, orders, and notes | Classify by source type and review ambiguous records before publication. |
| R-04 | PDF/OCR errors corrupt citations or sections | Preserve raw values, measure extraction quality, quarantine low-confidence records. |
| R-05 | A law is represented as current without evidence | Version documents and avoid an unverified current-status label. |
| R-06 | Saved references leak between accounts | Use server authorization and PostgreSQL row-level security with cross-user tests. |
| R-07 | Free-tier quotas or backups prove insufficient | Measure sample data size and confirm provider limits before committing to hosting. |

## Prioritized discovery-to-build backlog

1. Check source access and any publication prohibition, then record evidence in the source register.
2. Obtain a small permitted FCCP judgment and one law from each approved jurisdiction; record source IDs, URLs, metadata, file type, and text quality in the [sample manifest](sample-source-manifest.md).
3. Use the screenshot fields for the first citation-search design, derive test citations from FCCP records, and validate them with students/researchers before a public beta.
4. Draft traceable requirements, page flows, data dictionary, API contract, schema, and search semantics.
5. Build a minimal end-to-end slice with one approved judgment, anonymous search/detail, account sign-in, and owner-only saved citation.

## Human action and decisions

- **Resolved H-01 — Pilot scope:** Owner accepted the recommended small sample across FCCP and the identified federal/provincial portals, with no completeness claim.
- **Resolved H-02 in part — Copyright position:** Owner stated reproduction is permitted under Pakistani law. Section 57(1)(q) supports qualifying Gazette matter and judgments/orders subject to prohibitions. Source access and item checks remain technical tasks; seek qualified legal or source-owner input if a specific prohibition or conflicting term appears before that source is published.
- **Working default H-03 — Content operator:** This means the person who checks uncertain imports and approves original Maxims, Articles, and Dictionary entries. The owner is the initial approver; editorial pages may remain empty until reviewed content exists. The owner can delegate later.
- **Resolved H-04 for initial design — Screenshots:** They supply search fields and navigation. FCCP-specific citation examples will be derived from official pilot material. Student validation is a later beta task.
- **Resolved H-05 — Budget:** Prefer zero-cost local/prototype work; keep any necessary recurring hosting and backup cost below PKR 10,000/month. Public deployment is not assumed during the pilot. Vendor accounts, credentials, domain, DNS, and policy review are later human tasks.
