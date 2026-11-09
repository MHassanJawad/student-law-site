# Student Law Site

Research platform for Pakistani law students, scoped to reviewed FCCP judgments and federal/provincial legislation. The app has:
- five research search modes and source-linked document detail;
- sign-in, with account-owned saved citations, notes, export, and deletion;
- reviewed Maxims, Articles, and Dictionary collections;
- About/terms and Privacy pages.

The seed provides one judgment and one clearly labeled legislation metadata sample. No public deployment is configured; see [launch readiness](docs/operations/launch-readiness.md).

## Status

CI (`.github/workflows/ci.yml`) runs on every pull request:
- lint, typecheck, unit tests, and a dependency audit;
- migration validation and cross-user isolation checks;
- latency, accessibility, and security-control checks;
- restore drills, a container build and smoke test, and a secret scan.

## Quick start

Use Node.js 22. For a frontend-only preview, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-on-d.ps1`; project temporary and cache files go to D:, and data requests need a running database. CI runs the database checks on Linux. See [setup](docs/SETUP.md) for the full local workflow.

Architecture: the web app serves public research pages and owner-scoped APIs. Supabase provides Auth and PostgreSQL. A separate worker handles controlled FCCP collection and review. See [system design](docs/DESIGN.md).

## Documentation

- Product and design:
  - [Requirements](docs/REQUIREMENTS.md)
  - [System design](docs/DESIGN.md)
  - [Technology decisions](docs/TECH_STACK.md)
  - [API contract](docs/api/openapi.yaml)
  - [Search semantics](docs/product/search-semantics.md)
  - [Phase 0 source research](docs/product/phase-0-discovery.md)
- Testing: [test plan](docs/TEST_PLAN.md), [testing guide](docs/TESTING.md)
- Operations:
  - [Deployment](docs/DEPLOYMENT.md)
  - [Runbook](docs/RUNBOOK.md)
  - [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
  - [FCCP ingestion](docs/operations/fccp-ingestion.md)
  - [Pakistan Code ingestion](docs/operations/pakistan-code-ingestion.md)
  - [Launch readiness](docs/operations/launch-readiness.md)
- Security and compliance:
  - [Security](docs/SECURITY.md)
  - [Data privacy](docs/DATA_PRIVACY.md)
  - [Roles](docs/ROLES_PERMISSIONS.md)
  - [Third-party licences](docs/THIRD_PARTY_LICENSES.md)
- Phase status: [2](docs/operations/phase-2-status.md), [3](docs/operations/phase-3-status.md), [4](docs/operations/phase-4-status.md), [5](docs/operations/phase-5-status.md), [6](docs/operations/phase-6-status.md)
- Contributing: [contributing](CONTRIBUTING.md), [commit convention](COMMIT_CONVENTION.md), [changelog](CHANGELOG.md)

The FCCP and Pakistan Code importers are manually triggered and stage records privately for review. Published legislation carries metadata only and an unknown legal status. `npm run sync:corpus` copies reviewed records to a hosted database.

## License

No licence has been chosen; all rights are reserved by the owner until one is added.
