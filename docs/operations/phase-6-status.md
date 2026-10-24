# Phase 6 verification and beta status

Updated: 2026-10-25. This is a verification pass on the pilot, not a public launch decision. The searchable FCCP collection still contains only the reviewed pilot records described in [Phase 3](phase-3-status.md); the remaining listing candidates are private.

## Completed in this pass

- Updated `next` and `eslint-config-next` from 16.4.0 to 16.4.3 after the production dependency audit reported a critical advisory affecting Next.js through 16.4.0. The patched versions are pinned in the lockfile.
- `npm audit --omit=dev --audit-level=high` now reports zero vulnerabilities.
- `npm run lint`, `npm run typecheck`, `npm test` (24 unit tests), and `npm run build` pass on Windows with project caches and temporary files on D:.
- Reviewed the account deletion and saved-citation API boundaries: both use a verified bearer session; account deletion also checks origin and the current password. Existing local integration checks cover cross-user saved-citation denial, editorial draft visibility, and deletion, but were not rerun in this pass.
- Captured the home, case-law search, and sign-in pages in an isolated browser at a true 390px CSS viewport. Each had a 390px document scroll width. The five research modes initially required sideways scrolling; they now wrap into two visible rows on narrow screens. Screenshots and browser profile were kept in ignored `.tmp/browser-review` on D:. The initial Edge command-line screenshot used a wider CSS viewport and cropped it, so it was not used as evidence of a page overflow defect.
- The first five keyboard focus targets on home, search, and sign-in start with the skip link and follow the header links in DOM order. This is a limited keyboard check, not a full assistive-technology review.
- CI runs the existing search/account and saved-citation/editorial isolation checks against its disposable Supabase stack. A separate-database restore drill covers the source and judgment corpus tables; it does not cover Auth or other Supabase-managed schemas.

## Pending before a beta or public release

- Local Docker Desktop is excluded while C: is full. Its WSL image is on D:, but its Windows application and settings still use C:. CI migration lint and account/search acceptance checks passed on an isolated Linux runner. A full restore of real user data and an ingestion failure drill remain pending.
- Perform keyboard and screen-reader checks on search, document, sign-in, saved citations, and editorial pages. The computer-use browser helper exited twice during this pass, so interactive assistive-technology checks remain open.
- Measure representative search latency and compare a fresh sample of published records with the linked official documents. Current measurements and corpus sizes in [Phase 4](phase-4-status.md) are pilot-only.
- Arrange a small student beta and collect feedback. A qualified reviewer must check any substantive learning content before publication; those collections are currently empty.
- Verify recovery email delivery with the eventual email provider and complete a full backup/restore drill, including Auth, before hosting real user data.

## Tasks requiring human action

- Recruit beta users and a qualified reviewer for any legal learning content. No legal background or article writing is required from the project owner.
