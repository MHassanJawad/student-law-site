# Product requirements

Phase 1 baseline, 2026-09-27. Source: project PDF, `plan.md`, [Phase 0 discovery](product/phase-0-discovery.md), and supplied interface screenshots. IDs are stable; update this document when scope changes. The pilot is a small English-first sample from FCCP and identified federal/provincial sources, with no completeness claim.

## Functional requirements

| ID | Priority | Input | Expected output and acceptance criteria |
| --- | --- | --- | --- |
| FR-001 | Must | Anonymous visit | Responsive Home links to Case Law, Courtwise, Citation, Advanced, Statutes, Maxims, Articles, Dictionary, and Saved Citations; corpus boundary and educational-use disclaimer are visible. |
| FR-002 | Must | Judgment query and optional available filters | Paginated results contain FCCP judgments only, with source link, title, available citation/date/bench/type, excerpt, and clear empty/error states. Filters never imply other courts are indexed. |
| FR-003 | Must | Citation text or structured reporter/year/page fields | Exact/partial matches return only verified FCCP citation values and aliases; ambiguous or unsupported forms are stated rather than guessed. Preserve raw source value. |
| FR-004 | Must | Legislation query and optional jurisdiction/type/year/status fields | Paginated federal/provincial results reflect only covered sources and verified metadata; missing or uncertain status is labeled unknown. |
| FR-005 | Must | Public document ID | Detail shows readable permitted text, document kind, raw and normalized metadata, source URL, last-checked date, version/quality status, and available section anchors. Missing fields are omitted or marked unknown. |
| FR-006 | Must | New or changed source item from approved adapter or controlled manual file | Import stages, validates, deduplicates, versions, and publishes only approved records; rerun creates no duplicate; malformed/uncertain changes are quarantined with reason. |
| FR-007 | Must | Sign-in/session and save/remove action | Saved citation persists server-side across sessions; unauthenticated requests fail; one user cannot read or mutate another user's data. |
| FR-008 | Must | Source/category navigation | Users see measured coverage by source, jurisdiction, kind, and checked date, without an unverified completeness or current-law claim. |
| FR-009 | Should | Editorial list/detail query | Published Maxims, Articles, and Dictionary entries can be browsed and searched with source/author metadata; drafts are invisible publicly. Empty collections have an honest empty state. |
| FR-010 | Should | Operator-triggered import and review decision | Authorized operator can inspect run counts/failures/quarantine and approve, reject, or retry a record; actions are logged. First pilot may use a private CLI rather than a web dashboard. |
| FR-011 | Should | Account data request | User can request export/deletion of saved citations and account data; method and retention are documented before public beta. |
| FR-012 | Nice | Note/folder on saved citation | Owner can organize citations without affecting the underlying legal record. |
| FR-013 | Nice | Verified legal relationship | Show related FCCP judgments on legislation detail only when a reviewed relationship exists. |

## User stories and traceability

| Story | Need | Requirements | Screen/API/verification |
| --- | --- | --- | --- |
| US-001 | As a student, I want to find FCCP judgments so I can research a question. | FR-001, FR-002 | Home/search; `/api/v1/search/judgments`; query/filter tests. |
| US-002 | As a student, I want to look up a citation so I can reach the right judgment. | FR-003 | Citation Search; `/api/v1/search/citations`; ambiguity tests. |
| US-003 | As a researcher, I want to search laws by jurisdiction so I can locate applicable legislation. | FR-004, FR-008 | Statutes Search; `/api/v1/search/legislation`; coverage tests. |
| US-004 | As a student, I want to inspect a document and its source so I can verify it. | FR-005 | Detail; `/api/v1/documents/{id}`; provenance checks. |
| US-005 | As a student, I want saved citations on another device so I can resume study. | FR-007, FR-012 | Sign-in/saved list; `/api/v1/me/saved-citations`; two-session and ownership tests. |
| US-006 | As an operator, I want safe repeatable imports so the corpus stays current. | FR-006, FR-010 | Worker/review CLI; run, rerun, quarantine tests. |
| US-007 | As a student, I want curated learning material so I can study terms and ideas. | FR-009 | Editorial pages/API; draft visibility tests. |
| US-008 | As a user, I want to understand coverage so I do not mistake gaps for absence of law. | FR-001, FR-008 | Home/results/detail coverage labels; content checks. |

## Requirement-to-design trace

| Requirement | Page or operator path | Main data/API | Acceptance test |
| --- | --- | --- | --- |
| FR-001 | Home and navigation | Published document/editorial lists | TC-017 |
| FR-002 | Case Law, Courtwise, Advanced | `judgment_metadata`; `/search/judgments` | TC-001/002/006 |
| FR-003 | Citation Search | `citation_aliases`; `/search/citations` | TC-003/004 |
| FR-004 | Statutes Search | `legislation_metadata`; `/search/legislation` | TC-005/006 |
| FR-005 | Document detail | `document_versions`, `document_sections`; `/documents/{id}` | TC-007/019 |
| FR-006 | Worker and quarantine | `source_registry`, `ingestion_runs`, `document_versions` | TC-008/009/010/011/012 |
| FR-007 | Account and Saved Citations | `saved_citations`; `/me/saved-citations` | TC-013/014/015 |
| FR-008 | Home, results, coverage page | `source_registry`; `/coverage` | TC-019 |
| FR-009 | Editorial lists and detail | `editorial_entries`; `/editorial/{kind}` | TC-016 |
| FR-010 | Private operator CLI | `ingestion_events`, run/review commands | TC-010/011 |
| FR-011 | Account lifecycle | `profiles`, `saved_citations`; provider account controls | Pre-beta lifecycle test |
| FR-012 | Saved Citations | `saved_citations.note/folder`; `/me/saved-citations/{id}` | TC-013/015 |
| FR-013 | Legislation detail | Reviewed `document_topics`/relationship; no first-slice API | Post-MVP relationship test |

## Non-functional requirements

| ID | Requirement and verification |
| --- | --- |
| NFR-001 Performance | Common search and indexed detail requests target p95 under 2 seconds on a documented representative pilot corpus; measure p50/p95 and query plans before expanding. |
| NFR-002 Scalability | Measure pilot data size and query load, then size for at least twice observed pilot concurrency; do not promise a numeric capacity before measurement. |
| NFR-003 Availability | Public launch target is 99.5% monthly availability, daily backups, RPO 24 h, RTO 8 h, subject to selected hosting and restore drill. Local/prototype environments have no uptime promise. |
| NFR-004 Security | TLS in deployment, validated inputs, bounded pagination, secure sessions, rate limits, request IDs, audited operator actions, least-privilege secrets, RLS plus server authorization for owner data. |
| NFR-005 Accessibility | Target WCAG 2.2 AA: keyboard operation, focus, semantics, labels, contrast, status announcements, and mobile usability; automated and manual checks. |
| NFR-006 Language | English-first pilot; preserve original language and Unicode in records. Do not promise Urdu/Sindhi search quality until evaluated with fixtures. |
| NFR-007 Compliance | Source provenance and rights record per source; privacy notice, account deletion/export, data retention, and qualified review before public launch. No payment/health processing planned. |
| NFR-008 Import reliability | Every run records source, timing, counts, errors, parser version, and content hash; reruns are idempotent, failures resumable, and low-confidence changes withheld. |

## Acceptance boundary

Phase 2 vertical slice proves FR-001/002/005/006/007 for one approved FCCP judgment and a local account. Later phases broaden the corpus, search modes, editorial content, and public operations. A public beta additionally needs privacy, source, accessibility, restore, and security gates from `plan.md`.
