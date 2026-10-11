# Student Law Site

Research platform for Pakistani law students, scoped to reviewed FCCP judgments and federal/provincial legislation. The local app has five research search modes, source-linked document detail, sign-in, and account-owned saved citations. The seed provides one judgment and one clearly labeled legislation metadata sample. No public deployment is configured.

## Quick start

Use Node.js 22 and Docker Desktop. From the repository root, run `npm.cmd ci --legacy-peer-deps`, `npx.cmd supabase start`, then `npx.cmd supabase db reset --local` **only for a fresh disposable database**. Copy `.env.example` to `apps/web/.env.local` and fill in the local public URL and anon key from `npx.cmd supabase status`. Run `npm.cmd run dev` and open `http://localhost:3000`. Existing local databases should use `npx.cmd supabase migration up --local` to preserve reviewed pilot data. See the [frontend click path and full setup](docs/SETUP.md).

Architecture: the web app serves public research pages and owner-scoped APIs; Supabase provides Auth/PostgreSQL; a separate worker handles controlled FCCP collection and review. See [system design](docs/DESIGN.md).

## Design documents

- [Requirements](docs/REQUIREMENTS.md)
- [System design](docs/DESIGN.md)
- [Technology decisions](docs/TECH_STACK.md)
- [API contract](docs/api/openapi.yaml)
- [Test plan](docs/TEST_PLAN.md)
- [Testing guide](docs/TESTING.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Phase 2 status](docs/operations/phase-2-status.md)
- [Phase 3 ingestion status](docs/operations/phase-3-status.md)
- [Phase 4 research status](docs/operations/phase-4-status.md)
- [Search semantics](docs/product/search-semantics.md)
- [Phase 0 source research](docs/product/phase-0-discovery.md)

The FCCP ingestion pilot is manually triggered and stages records privately before review. The local Pakistan Code sample contains metadata only and has unknown current legal status.
