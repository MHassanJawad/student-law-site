# Testing the Phase 2 slice

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` from the repository root. Unit tests cover query boundaries and the sample import's source/date/idempotence rules. CI also starts local Supabase and validates migrations.

After local Supabase starts, run `npx supabase db reset --local`, start the web app, and run `npm run test:local`. This repeatable acceptance check creates two disposable accounts, verifies that each sees only its own saved citations, and checks that account B cannot read or delete account A's citation through either the API or a direct database request. It also verifies that the fixture importer leaves one document version after repeated runs. Run migration or RLS integration tests only against the disposable local database.

The Phase 2 fixture contains listing metadata, not judgment body text. Search and detail should state that limitation. Later ingestion and search phases add source adapters, representative corpus fixtures, broader API checks, accessibility scans, load testing, and coverage thresholds described in [TEST_PLAN](TEST_PLAN.md).
