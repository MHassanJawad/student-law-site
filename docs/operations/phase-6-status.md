# Phase 6 verification and beta status

Updated: 2026-10-25. This is a verification pass on the pilot, not a public launch decision. The searchable FCCP collection still contains only the reviewed pilot records described in [Phase 3](phase-3-status.md); the remaining listing candidates are private.

## Completed in this pass

- Updated `next` and `eslint-config-next` from 16.4.0 to 16.4.3 after the production dependency audit reported a critical advisory affecting Next.js through 16.4.0. Updated Zod to 4.6.7 and undici to 7.30.1 after newer advisories; updated Vitest to 5.0.5 and Vite to 7.3.7 to clear advisories in development dependencies.
- The full `npm audit --audit-level=high` now reports zero vulnerabilities.
- `npm run lint`, `npm run typecheck`, `npm test` (24 unit tests), and `npm run build` pass on Windows with project caches and temporary files on D:.
- Reviewed the account deletion and saved-citation API boundaries: both use a verified bearer session; account deletion also checks origin and the current password. Existing local integration checks cover cross-user saved-citation denial, editorial draft visibility, and deletion, but were not rerun in this pass.
- Captured the home, case-law search, and sign-in pages in an isolated browser at a true 390px CSS viewport. Each had a 390px document scroll width. The five research modes initially required sideways scrolling; they now wrap into two visible rows on narrow screens. Screenshots and browser profile were kept in ignored `.tmp/browser-review` on D:. The initial Edge command-line screenshot used a wider CSS viewport and cropped it, so it was not used as evidence of a page overflow defect.
- The first five keyboard focus targets on home, search, and sign-in start with the skip link and follow the header links in DOM order. This is a limited keyboard check, not a full assistive-technology review.
- [CI run 40126699271](https://github.com/MHassanJawad/student-law-site/actions/runs/40126699271) passed migration validation, search/account and saved-citation/editorial isolation, a deliberate offline ingestion failure, and a separate-database corpus restore. The import failure recorded a failed run without changing candidates or documents. The restore covers source and judgment corpus tables; it does not cover Auth or other Supabase-managed schemas.
- [CI run 40128794013](https://github.com/MHassanJawad/student-law-site/actions/runs/40128794013) measured 17 post-warmup sequential requests for each seeded scenario. Case-law hit p50/p95 was 15/22 ms, statute hit 13/20 ms, empty citation 12/21 ms, and document detail 18/69 ms. These are measurements on a disposable two-record local database inside CI, not a forecast for a hosted or expanded corpus.
- Prepared a [small student beta script](beta-session.md) with concrete phone, desktop, and keyboard tasks. No testers have been recruited or invited yet.

## Pending before a beta or public release

- Local Docker Desktop is excluded while C: is full. Its WSL image is on D:, but its Windows application and settings still use C:. CI database checks run on an isolated Linux runner. A full restore of real user data remains pending.
- Perform keyboard and screen-reader checks on search, document, sign-in, saved citations, and editorial pages. The computer-use browser helper exited twice during this pass, so interactive assistive-technology checks remain open.
- Measure search latency with a larger, representative corpus and compare fresh published records with their linked official documents. CI holds only labeled metadata samples; the separately reviewed FCCP pilot record remains in the owner's local database, which is unavailable while local Docker stays off.
- Arrange a small student beta and collect feedback. A qualified reviewer must check any substantive learning content before publication; those collections are currently empty.
- Verify recovery email delivery with the eventual email provider and complete a full backup/restore drill, including Auth, before hosting real user data.

## Tasks requiring human action

- Once a hosted test environment and account-data recovery are ready, recruit three to five student beta users using the [beta session script](beta-session.md). Arrange a qualified reviewer only if substantive legal learning content is written. No legal background or article writing is required from the project owner.
