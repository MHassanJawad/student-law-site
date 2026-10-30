# Changelog

## Unreleased

- Added a bounded Pakistan Code importer for federal laws. It stages one letter page at a time privately, holds listing metadata only, publishes nothing until reviewed, and always shows legal status as unknown.
- Added `npm run sync:corpus`, an upsert-only copy of reviewed records and status changes from the review database to a hosted database.
- Fixed worker-only publication functions being callable with the public key under Supabase's default privileges.
- Added per-client API rate limits that return `429` with `Retry-After`, as the API contract specifies.
- Added Content-Security-Policy, HSTS, and Cross-Origin-Opener-Policy headers.
- Added a health check at `/api/v1/health` and an operator maintenance mode.
- Added About/terms and Privacy pages, linked from the footer.
- Added a production Dockerfile, with CI jobs for the container image, secret scanning, and security controls, plus Dependabot.
- Added security, data privacy, deployment, runbook, licence, contributing, and launch-readiness documentation.

- Added Phase 4 Case Law, Courtwise, Citation, Advanced, and Statutes research screens with validated filters, exact counts, sorting, and source-linked document detail.
- Added a local Pakistan Code legislation metadata sample, labeled with unknown legal status, and documented frontend testing steps.
- Extended the FCCP importer to validate and stage a bounded 12-page listing, track missing metadata, and quarantine records absent from complete snapshots.
- Added a private, reviewable one-PDF inspection path with source hash and extraction quality; no PDF text is made public.
- Updated vulnerable production dependencies so the CI production audit passes.
- Added a bounded FCCP listing importer, private candidate review queue, manual publication, and source run reports.
- Added measured corpus coverage, clearer judgment metadata labels, and paginated FCCP pilot search.
- Added Phase 0 source research and Phase 1 requirements, architecture, and test design.
- Added Phase 2 local web, database/auth schema, fixture importer, CI, and setup documentation.
