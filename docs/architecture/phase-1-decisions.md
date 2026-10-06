# Phase 1 decisions and threat review

## ADR-001: modular web application plus private worker

**Decision:** Next.js serves public pages and versioned read/user APIs; a separate TypeScript worker handles source acquisition. PostgreSQL holds canonical metadata, text search, run history, and owner data. **Reason:** one manageable deployment boundary for a small pilot while source jobs remain independent of request limits. **Revisit when:** measured search load, OCR needs, or source volume exceed this model.

## ADR-002: source collection through adapters

**Decision:** Each official portal gets an isolated adapter that enumerates public listing pages/feed/API, fetches at an approved rate, and hands bytes/metadata to a shared validation pipeline. A controlled manual file/link adapter is the fallback, not the default. **Reason:** source HTML and PDF structures differ, while publication and deduplication rules should remain consistent. **Gate:** no adapter enabled until access policy, allowed hosts, rates, and item prohibitions are checked and recorded.

## ADR-003: PostgreSQL search before a search cluster

**Decision:** use full-text indexes and `pg_trgm` for the first corpus. **Reason:** minimizes services and cost while allowing measured relevance. **Revisit when:** representative p95 exceeds 2 seconds or citation/title relevance tests fail after query/index tuning.

## ADR-004: owner data and identity

**Decision:** Supabase Auth plus PostgreSQL RLS for saved citations, with server-side checks as a second boundary. **Reason:** avoid bespoke password/session code; account data is limited to what saved references need. **Gate:** verify hosted region, email, backups, and privacy terms before public deployment.

## Threat review for Phase 2

| Threat | Asset/path | Planned control and proof |
| --- | --- | --- |
| SSRF or redirect into private network | Source URL to worker fetch | Fixed approved host list, DNS/IP validation after redirect, no arbitrary user URL, time/size limits; TC-012. |
| Malicious/huge PDF | Official-looking file to parser | Content-type and byte caps, isolated parser process, no executable content, quarantine; TC-010/012. |
| Cross-user access | Bearer token to saved citations | Verified auth, owner-filtered queries, RLS, non-enumerating errors; TC-015/SEC-005. |
| Source content XSS | Extracted text to browser | Escape output, sanitize editorial formatting, strict CSP; SEC-002. |
| Misleading current law/citation | Parsed source to public detail | Preserve raw fields, versions, status evidence, review and checked date; TC-004/019. |
| Worker key leakage | Import credentials to build/browser/logs | Server-only environment, least privilege, secrets scan, redacted logs; SEC-007. |

Open issues for design review: exact source item URL/ID and robots/access policy per portal; representative PDF quality; hosted backup capability; and the first verified FCCP reporter citation examples. These are implementation inputs to collect before the relevant adapter or public feature, not reasons for manual database entry.
