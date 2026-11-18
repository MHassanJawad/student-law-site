# Security controls and incident response

Updated 2026-10-25. Scope: the Next.js web app, Supabase Auth/PostgreSQL, and the operator-run ingestion worker. No hosted environment exists yet; items marked **hosting** must be configured and verified when one is chosen.

## Threat model summary

| Asset | Main threats | Controls |
| --- | --- | --- |
| Saved citations and notes | Another user reads or changes them (IDOR); stolen session | Bearer session verified on every `/me` route, then RLS `auth.uid() = owner_id` in the database. Cross-user denial is tested in CI (`check-local.mjs`, `check-phase5-local.mjs`). |
| Accounts | Password guessing, account enumeration, takeover | Supabase Auth hashes passwords (bcrypt). Account deletion requires the current password in both the route and the database RPC. Supabase Auth rate limits apply to sign-in and recovery (**hosting**: review the project's limits). |
| Published corpus | Unreviewed or altered records shown as authoritative | Search functions return only published, approved, visible-source records. Publication and withdrawal are atomic operator actions with audit rows. The web app has no write path to corpus tables. |
| Editorial content | Students or attackers publishing content | Only `profiles.role = 'operator'` passes RLS for writes; clients cannot set their own role; a trigger stamps review metadata and audit history. |
| Service-role key | Leak gives full database access | Used only by the local worker; never in the web app or browser bundle. CI scans history for committed secrets with gitleaks. |
| Ingestion worker | SSRF, oversized or malicious PDFs | Fixed official host, no redirects, byte limits, timeouts, robots check; PDF text stays private. The worker refuses non-local databases. |
| Availability | Request floods, scraping | Per-client API rate limits; maintenance mode; health endpoint for monitoring. |

## Controls in place

- **Input validation:** Zod schemas on every API input; bounded pagination and string lengths; `415` for non-JSON writes; consistent error JSON with a request ID and no database detail.
- **SQL injection:** All queries go through Supabase parameterised calls or SQL functions; there is no string-built SQL. CI sends a `DROP TABLE` payload and checks the corpus is intact (`ci-security-checks.mjs`).
- **XSS:** React escapes rendered text; the code has no `dangerouslySetInnerHTML`. A Content-Security-Policy limits scripts, connections, frames, and objects.
- **CSRF:** State-changing routes need a bearer token held by the page script, not a cookie, and reject a foreign `Origin`.
- **Headers:** `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy` on every response. CI checks them on the build and the container image.
- **Rate limits:** Search 120/min, other public reads 240/min, account operations 60/min, and account deletion 5 per 15 minutes per client address. Exceeding a limit returns `429` with `Retry-After`. `/api/v1/health` is exempt.
- **Supply chain:** Exact dependency versions and a lockfile; `npm audit --audit-level=high` in CI; Dependabot for npm, GitHub Actions, and the Docker base image; [licence inventory](THIRD_PARTY_LICENSES.md).
- **Worker-only functions:** Supabase grants browser roles `EXECUTE` on new functions by default. Migration 018 revokes the FCCP approve and withdraw functions from `anon` and `authenticated`, and the legislation approve function is revoked from them when it is created. CI calls each one with the public key and expects a refusal.
- **Corpus sync:** reads only from local Supabase and requires an HTTPS target unless the CI-only `--allow-local-target` flag is given. It defaults to a dry run, upserts only, and never touches account, editorial, or review-queue tables.
- **Container:** Multi-stage build, Alpine base, non-root `node` user, no secrets in the image. CI checks the image does not run as root.

## Known limitations and deferred items

- **Rate limit state is per process and in memory.** Several web instances multiply the effective limit, and a restart resets counts. The client address is the `X-Forwarded-For` entry added by the trusted proxy, counted from the right by `TRUSTED_PROXY_HOPS` (default 1). If the app is exposed directly without a proxy, a client can choose its own bucket; if the hop count is too low, clients behind a CDN share one bucket. Add a shared store (for example Postgres or Redis) if the deployment scales beyond one instance or abuse is observed.
- **CSP allows inline scripts.** Next.js emits inline bootstrap scripts; removing `'unsafe-inline'` needs nonce-based dynamic rendering. Output encoding remains the primary XSS control.
- **No multi-factor authentication.** Saved citations are low-sensitivity study data. Supabase supports TOTP MFA; enable it for operator accounts before publishing editorial content (**hosting**).
- **No structured request logging or alerting yet.** The [runbook](RUNBOOK.md) defines uptime monitoring through `/api/v1/health`; hosted log retention and alerts depend on the provider.
- **Email confirmation is off locally** (`enable_confirmations = false`). Turn it on for the hosted project (**hosting**).

## Incident response

**Contact:** the project owner is the security contact until a support address is published (`NEXT_PUBLIC_SUPPORT_EMAIL`). Record each incident with time, impact, actions, and follow-up.

1. **Contain.** Set `MAINTENANCE_MODE=on` and restart the web process to stop traffic while keeping `/api/v1/health` reachable. For a suspected data exposure, also pause the Supabase project or revoke API keys.
2. **Rotate compromised credentials.**
   - Service-role or secret key: rotate it in the Supabase dashboard (API keys), update the worker's `apps/worker/.env`, and confirm the old key fails.
   - Publishable key: rotate, rebuild the web image with the new build argument, and redeploy.
   - JWT signing secret: rotating it signs every user out; do this when a session token leak is suspected.
   - Operator account: reset its password, then sign out all its sessions from Supabase Auth.
3. **Roll back** a bad release by redeploying the previous image tag (see [deployment](DEPLOYMENT.md#rollback)). Database migrations are forward-fixed: write a new migration that reverses the change instead of editing an applied one.
4. **Recover data** from the latest backup using the restore procedure in the [runbook](RUNBOOK.md#backup-and-restore).
5. **Notify** affected account holders by email when their personal data may have been exposed, describing what happened and what they should do.

## Maintenance policy

- Patch critical and high advisories within 48 hours of a Dependabot or audit alert; others in the next weekly update.
- Run `npm audit` and review Dependabot pull requests monthly at minimum; regenerate the licence inventory after dependency changes.
- Re-review this document when adding a sign-in method, a hosted worker, file storage, or a new data category.
