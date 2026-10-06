# Student Law Site

Research platform for Pakistani law students, scoped to Federal Constitutional Court of Pakistan judgments and verified federal/provincial legislation. Phase 2 includes a local Next.js/Supabase vertical slice with one official-listing metadata fixture, search/detail, sign-in, and account-owned saved citations. No public deployment is configured.

## Quick start

Use Node.js 22 and a running Docker-compatible engine. From the repository root, run `npm install --legacy-peer-deps`, `npx supabase start`, copy `.env.example` to `apps/web/.env.local` using values from `npx supabase status`, and set up `apps/worker/.env` from its example. Then run `npx supabase db reset --local` and `npm run dev`. On Windows PowerShell where scripts are disabled, use `npm.cmd` and `npx.cmd`. See [full setup](docs/SETUP.md).

Architecture: the web app serves public research pages and owner-scoped APIs; Supabase provides Auth/PostgreSQL; a separate worker handles fixture import and later source adapters. See [system design](docs/DESIGN.md).

## Design documents

- [Requirements](docs/REQUIREMENTS.md)
- [System design](docs/DESIGN.md)
- [Technology decisions](docs/TECH_STACK.md)
- [API contract](docs/api/openapi.yaml)
- [Test plan](docs/TEST_PLAN.md)
- [Testing guide](docs/TESTING.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Phase 2 status](docs/operations/phase-2-status.md)
- [Phase 0 source research](docs/product/phase-0-discovery.md)

The planned ingestion worker will collect approved public source material automatically, with controlled manual import as a fallback. Sources and coverage are recorded before publication.
