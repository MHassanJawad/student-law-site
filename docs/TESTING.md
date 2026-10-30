# Testing

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` from the repository root. Unit tests cover query boundaries, editorial and saved-citation validation, rate-limit rules, client-address parsing, security headers, FCCP listing parsing and enumeration, Pakistan Code listing parsing and robots policy, corpus-sync target rules, and the sample import's source/date/idempotence rules.

After local Supabase starts, run `npx supabase db reset --local`, start the web app, and run `npm run test:local`. This repeatable acceptance check creates two disposable accounts and verifies that each sees only its own saved citations. It also checks that account B cannot read or delete account A's citation through either the API or a direct database request, and that repeated fixture imports leave one document version. `npm run test:ingestion-local` and `npm run test:phase5-local` cover the ingestion review queue and the account and editorial lifecycle. Run database checks only against the disposable local database.

## CI

`.github/workflows/ci.yml` has three jobs:

- **verify:** lint, typecheck, unit tests, and `npm audit`, then migration validation on disposable Supabase. `scripts/ci-verify-local.sh` then builds and serves the app and runs, in order:
  1. account isolation;
  2. the Phase 5 lifecycle;
  3. an offline ingestion failure;
  4. `ci-legislation-sync.mjs`. It imports the Pakistan Code fixture twice, to prove idempotence, and blocks approval before the source review. It then publishes one law, finds it in statutes search with status `unknown`, and runs the corpus sync with the local database as target. That run checks the dry run, the refusal of a local target, and that a repeated apply adds no rows;
  5. seeded latency;
  6. axe accessibility at 390px and 1280px, including CSP violations;
  7. `ci-security-checks.mjs`, which covers headers, health, SQL-injection handling, auth denial, refusal of worker-only functions, and rate limiting.

  The security check runs last because it exhausts the client's read limit. Two restore drills follow.
- **container:** builds the [Dockerfile](../Dockerfile) and runs `scripts/ci-container-smoke.sh`, which checks pages, headers, the non-root user, and an honest `503` health status without a database.
- **secrets:** `scripts/ci-secret-scan.sh` scans full history with gitleaks using `.gitleaks.toml`.

The [test plan](TEST_PLAN.md) lists remaining manual checks: the screen-reader and keyboard pass, corpus comparison against official sources, and the student beta.
