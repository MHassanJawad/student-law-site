# Phase 2 foundation status

Updated 2026-10-06. The local vertical slice and its database-backed acceptance checks pass. Hosted staging remains a later provider and account decision.

## Implemented

- Next.js web app with Home, FCCP search, source-linked detail, email account flow, and owner-scoped saved citations.
- Supabase migration for source/document/version metadata, FCCP search, Auth profiles, saved citations, and RLS; one listing-metadata-only FCCP seed fixture.
- Separate local-only fixture importer that skips unchanged versions and holds changed metadata for review. Live portal adapters remain Phase 3 work.
- Pinned dependencies, CI, environment templates, local setup and testing guides, error responses, input bounds, basic security headers, and no browser-exposed service-role key.
- Repeatable `npm run test:local` acceptance check using two disposable accounts.

## Verified

- `supabase start`, `supabase db reset --local`, and `supabase db lint --local` passed with no schema errors.
- The sample importer ran twice; one document and one version remained.
- Search returned the seeded FCCP result; detail returned its source link and identified the absence of judgment body text.
- Sign-up and sign-in worked in separate sessions. Account A saved and removed a citation. Account B could neither list nor delete A's citation through the web API or direct RLS-protected database calls.
- `npm run typecheck`, `npm run lint`, `npm test` (5 unit tests), `npm run test:local`, and `npm run build` passed.
- The production build also passed the local acceptance check; `/search`, `/sign-in`, and `/saved` returned HTTP 200.
- `npm audit --omit=dev --audit-level=high` previously reported zero vulnerabilities after upgrading Next.js to 16.3.6.

## Remaining before hosted staging

- Choose a staging provider, account, region, and operating budget. Configure hosted environment variables and a disposable staging database, then repeat the acceptance journey there.
- Phase 3 will add live source adapters and validation; the current fixture contains listing metadata only. No automated collection from Pakistan Law Site is included in this phase.
