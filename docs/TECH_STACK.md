# Technology decisions

Phase 1 baseline, 2026-09-27. The goal is a portable pilot with no required hosting spend and a later recurring ceiling below PKR 10,000/month. Exact package versions will be pinned with lockfiles during Phase 2.

| Layer | Chosen starting point | Why versus main alternative | Limit/risk |
| --- | --- | --- | --- |
| Web/API | Next.js App Router, React, strict TypeScript, server route handlers | One typed web/API codebase is smaller than a separate SPA plus API for this scope. | Long imports must run outside request handlers; deployment host must support chosen runtime. |
| UI | Project-owned CSS/design tokens and accessible primitives | Avoids tying research layouts to a large component system. | More component work; verify accessibility manually. |
| Data/search | PostgreSQL, built-in full-text search and `pg_trgm` | Transactional metadata, accounts, and early search in one store; postpone Elasticsearch/OpenSearch. | Relevance and language handling require measurement; add search service only after evidence. |
| Identity | Supabase Auth backed by Postgres; local Supabase stack for development | Proven account recovery/session flows and direct integration with Postgres RLS versus custom authentication. | Hosted free tier pauses and has storage limits; production provider/region and email limits must be checked. |
| Ingestion | Separate TypeScript worker and source-specific adapters | Shared validation/types with web app versus a Python-only worker; no web request time limit. | PDF/OCR may later justify a Python helper; avoid OCR in first slice. |
| Files | Official canonical links first; private object storage only for source files when justified | Lower cost and clear provenance versus storing PDFs in database rows. | Source links may change; hash/version metadata still required. |
| Cache/queue | PostgreSQL job/run tables initially; no Redis | Fewer services for a small pilot. | Add a queue/cache only when measured worker contention or latency requires it. |
| Deployment | Local Docker Compose first; choose hosted topology after pilot measurements | Reproducible and zero required monthly spend versus committing early to a vendor. | Local pilot is not a public production deployment. |
| Observability | Structured logs, request IDs, ingestion run records, health check | Sufficient evidence for first slice without paid telemetry. | External alerting and backup monitoring required before public launch. |

Key interface boundary: the web process has read/search and user-scoped write credentials; only the private worker has import privileges. Database migrations and exports stay standard PostgreSQL so hosting can change. Hosted plan pricing and terms must be rechecked before purchase or deployment.
