# Student Law Site

Research platform for Pakistani law students, scoped to reviewed FCCP judgments and federal/provincial legislation. The local app has five research search modes, source-linked document detail, sign-in, and account-owned saved citations. The seed provides one judgment and one clearly labeled legislation metadata sample. No public deployment is configured.

## Quick start

Use Node.js 22. With C: full, do not start Docker Desktop locally: its WSL disk is on D:, but the Windows application still uses C:. CI runs the database checks on Linux. For a frontend-only preview, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-on-d.ps1`; project temporary and cache files go to D:, while data requests need a running database. See the [frontend click path and full setup](docs/SETUP.md) for the full local workflow after the storage restriction is resolved.

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
