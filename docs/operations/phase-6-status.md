# Phase 6 verification and beta status

Date: 2026-10-23. This is the first verification pass on the local pilot, not a public launch decision. The searchable FCCP collection still contains only the reviewed pilot records described in [Phase 3](phase-3-status.md); the remaining listing candidates are private.

## Completed in this pass

- Updated `next` and `eslint-config-next` from 16.4.0 to 16.4.3 after the production dependency audit reported a critical advisory affecting Next.js through 16.4.0. The patched versions are pinned in the lockfile.
- `npm audit --omit=dev --audit-level=high` now reports zero vulnerabilities.
- `npm run lint`, `npm run typecheck`, `npm test` (24 unit tests), and `npm run build` pass on Windows with project caches and temporary files on D:.
- Reviewed the account deletion and saved-citation API boundaries: both use a verified bearer session; account deletion also checks origin and the current password. Existing local integration checks cover cross-user saved-citation denial, editorial draft visibility, and deletion, but were not rerun in this pass.

## Pending before a beta or public release

- Docker Desktop was unavailable in this session. The local Supabase integration checks, migration lint, backup/restore drill, and ingestion failure drill still need a running local database. Do not reset the existing local database; use the migration command in [setup](../SETUP.md).
- Perform desktop and narrow-screen keyboard and screen-reader checks on search, document, sign-in, saved citations, and editorial pages. Record defects and fixes.
- Measure representative search latency and compare a fresh sample of published records with the linked official documents. Current measurements and corpus sizes in [Phase 4](phase-4-status.md) are pilot-only.
- Arrange a small student beta and collect feedback. A qualified reviewer must check any substantive learning content before publication; those collections are currently empty.
- Verify recovery email delivery with the eventual email provider and complete a backup/restore drill before hosting real user data.

## Tasks requiring human action

- Open Docker Desktop when local database checks resume. Its WSL image is configured on D:, while the Windows application itself uses its installed location.
- Recruit beta users and a qualified reviewer for any legal learning content. No legal background or article writing is required from the project owner.
