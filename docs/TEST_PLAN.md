# Test plan and acceptance matrix

Phase 1 design, 2026-09-27. Tests are implemented alongside code in later phases. The initial vertical slice runs on an isolated local/test database with approved or synthetic fixtures; never use production data. `npm test` will run unit/integration tests, and CI will enforce typecheck, lint, coverage, security audit, build, and selected E2E checks.

| ID | Module | Scenario/input | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-001 | Judgment search | Term matching a pilot FCCP judgment | Correct result with source URL, verified metadata, and excerpt | Integration |
| TC-002 | Judgment search | Court filter naming a non-FCCP court | No unrelated court results or misleading facet | Integration |
| TC-003 | Citation lookup | Exact verified FCCP citation | Matching document ranked first | Unit/integration |
| TC-004 | Citation lookup | Partial or ambiguous reporter citation | Candidate list and `ambiguous: true`; no invented resolution | Unit/integration |
| TC-005 | Legislation search | Jurisdiction/type/year filters | Only matching published, covered laws | Integration |
| TC-006 | Search input | Empty query without filters, invalid date range, page over limit | Consistent 400 validation error with request ID | API |
| TC-007 | Document detail | Published, withdrawn, unknown IDs | Published detail includes provenance; withdrawn/unknown return 404 | API |
| TC-008 | Ingestion | Repeat same source ID and hash | No duplicate document/version | Integration |
| TC-009 | Ingestion | Same source ID, changed hash | New staged version; old published version retained until review | Integration |
| TC-010 | Ingestion | Conflicting source IDs, poor PDF extraction, missing provenance | Quarantine with reason; not searchable | Integration |
| TC-011 | Ingestion | HTTP 429/5xx, timeout, interrupted cursor | Bounded retry/backoff, resumable run, recorded failure | Unit/integration |
| TC-012 | Ingestion | Redirect to unapproved host, oversized or wrong-type file | Fetch rejected without reading untrusted destination/content | Security |
| TC-013 | Saved citations | Save, list in new session, remove | Server persistence and expected feedback | E2E |
| TC-014 | Saved citations | Duplicate save | 409 response, one owner/document row | API/integration |
| TC-015 | Saved citations | User B reads/changes user A's item | 404 or denied by route and RLS, no data disclosure | Security/integration |
| TC-016 | Editorial | Draft vs published record | Draft invisible to anonymous/student; published visible | Integration |
| TC-017 | Accessibility | Keyboard-only search, detail, sign-in, saved flow | Logical focus, labeled controls, announced statuses, no keyboard trap | E2E/manual |
| TC-018 | Performance | Representative pilot corpus and common queries | Search/detail p95 below 2 seconds; query plans recorded | Load |
| TC-019 | Corpus quality | Sampled records against official page/file | Title, date, citation, sections, URL, and version match source or are marked unknown | Manual/data |
| TC-020 | Research modes | Case Law, Courtwise, Advanced, Statutes on local pilot | Published records only; expected 1275, Najafi, and Contract Act matches | API/manual |
| TC-021 | Structured citation | Reporter/year/page complete vs partial; no verified citation in seed | Complete input accepted; partial rejected; no fabricated match | Unit/API |
| TC-022 | Section visibility | Staged vs approved section on current version | Only approved current-version sections visible | Database/manual |
| TC-023 | Legislation status | Filter local Contract Act metadata by unknown status | One labeled local sample; no current-law assertion | API/manual |
| SEC-001 | SQL injection | Quote/control payload in search input | Parameterized query; no SQL execution or DB error exposure | Security |
| SEC-002 | XSS | Script markup in source/editorial text | Rendered as text or sanitized; no execution | Security |
| SEC-003 | CSRF | Forged state-changing browser request | Rejected by session/origin/CSRF controls as applicable | Security |
| SEC-004 | Auth bypass | No/invalid bearer session on `/me` | 401, no saved data | Security |
| SEC-005 | IDOR | Other owner's saved ID | 404/denied at route and RLS | Security |
| SEC-006 | Rate limit | Repeated search/auth attempts | 429 with Retry-After from the app (CI: `ci-security-checks.mjs`), or provider lockout for Supabase Auth sign-in | Security |
| SEC-009 | Security headers | Any page from the production build or container | CSP, HSTS, nosniff, frame denial present; no CSP violation in the browser check | Security |
| OPS-001 | Health | Database reachable / unreachable / maintenance | 200 `ok` / 503 `failed` / 503 `maintenance`; never rate limited | API/CI |
| SEC-007 | Sensitive logs | Import/auth errors | No tokens, passwords, raw sensitive account data | Security |
| SEC-008 | Traversal | File path or URL escape in manual import | Rejected; no local/private file read | Security |

Unit tests cover normalization, citation parsing, date handling, validation, adapter mapping, permissions, and deduplication. Integration tests cover migrations, search queries, RLS, version transactions, and import reruns. E2E covers anonymous search/detail and signed-in save/reopen/remove. Accessibility combines axe checks with manual keyboard/screen-reader review. Coverage thresholds: business logic 90%, API routes 85%, utilities 95%, UI units 70%, database queries 80%; report meaningful branches rather than adding tests that merely mirror implementation.

Phase 2 exit: a clean setup, test database, one approved judgment flow, two-session saved citation flow, and cross-user denial all pass. Phase 6 adds representative corpus checks, restore drill, load test, and student beta before public launch.
