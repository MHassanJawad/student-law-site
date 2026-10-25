# Deployment

Updated 2026-10-25. **No environment is deployed yet.** This is the procedure for the first hosted staging environment and, after the [launch gate](operations/launch-readiness.md) passes, production. Provider accounts, billing, and domain steps are owner tasks; the rest can be scripted once credentials exist.

## Target topology

```text
Browser ──HTTPS──> Host proxy/CDN ──> Web container (Dockerfile, port 3000)
   │                                      │ public key only, RLS-scoped
   └──HTTPS (sign-in)──> Supabase Auth    └──> Supabase Postgres (hosted project)
Operator laptop: worker + local Supabase review database ──(reviewed corpus copy)──> hosted Postgres
```

- **Web:** the [Dockerfile](../Dockerfile) image on any container host that terminates TLS and sets `X-Forwarded-For`. One instance keeps the in-memory rate limits exact (see [security](SECURITY.md#known-limitations-and-deferred-items)).
- **Database and Auth:** one hosted Supabase project per environment (staging, then production). Never share a project between them.
- **Worker:** stays on the operator's machine against local Supabase. It refuses remote URLs by design. Reviewed records are copied to the hosted database as described below. Running the worker directly against a hosted database needs a recorded decision and a change to that guard.

## Hosting options and budget

The owner's ceiling is below PKR 10,000 per month. Prices change; check each provider's current pricing page before choosing, and record the decision in [phase-0 discovery](product/phase-0-discovery.md).

| Need | Lowest-cost option | Trade-off |
| --- | --- | --- |
| Staging database/Auth | Supabase Free | Pauses after inactivity; no managed backups. Acceptable for staging only. |
| Production database/Auth | Supabase paid plan with daily backups | The main recurring cost; confirm backup retention and region. |
| Web container | A container host with a free or low tier (for example Google Cloud Run, Render, or a small VPS running Docker) | Free tiers may sleep or need a billing card. Vercel Hobby is excluded: its terms restrict non-personal use. |
| Email | A transactional SMTP provider's free tier | Needed for password recovery; Supabase's default sender is for testing only. |
| Uptime check | A free external monitor such as UptimeRobot | Polls `/api/v1/health`. |

## First deployment (staging)

1. **Create the Supabase project.** Choose a region close to Pakistan. Note the project ref, API URL, publishable key, and database connection string. Keep the service-role key in a password manager; the web app does not need it.
2. **Apply migrations** from a clean checkout of `main`:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   `db push` applies `supabase/migrations/` only; it does not load `seed.sql`. Then run `npx supabase db lint --linked`.
3. **Configure Auth** in the Supabase dashboard:
   - Site URL: the web origin, such as `https://staging.example.org`. Redirect URLs: that origin and `<origin>/reset-password`.
   - Turn email confirmation **on**.
   - Configure custom SMTP and send a test recovery email.
   - Review Auth rate limits for sign-in, sign-up, and recovery emails.
4. **Load the reviewed corpus.** Do this only before any real accounts exist. From the operator machine with local Supabase running:
   ```bash
   npx supabase db dump --local --data-only --use-copy --schema public \
     -x public.profiles -x public.saved_citations -x public.editorial_entries -x public.editorial_audit \
     -x public.ingestion_runs -x public.ingestion_candidates -x public.pdf_inspections \
     --file corpus.sql
   psql "<hosted connection string>" --single-transaction -v ON_ERROR_STOP=1 -f corpus.sql
   ```
   Decide first whether the labeled local seed records (the Phase 2 FCCP fixture and the `LOCAL SAMPLE` Contract Act) belong in the hosted corpus. Delete them locally or after loading if not. Keep `corpus.sql` out of the repository. This is a one-time load: later corpus updates need an upsert-based sync that is not built yet (see the [runbook](RUNBOOK.md#routine-schedule)).
5. **Build the image** with the hosted public settings:
   ```bash
   docker build \
     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key> \
     --build-arg NEXT_PUBLIC_SUPPORT_EMAIL=<support address> \
     --build-arg APP_VERSION="$(git rev-parse --short HEAD)" \
     -t student-law-web:<version> .
   ```
   Push it to the host's registry and deploy with port 3000, and `TRUSTED_PROXY_HOPS` set to match the host's proxy chain.
6. **Smoke test** the deployed origin:
   - `GET /api/v1/health` returns `200` with both checks `ok`.
   - Home shows the expected published counts.
   - `/search?mode=case-law` finds a published record, and its document page links to the official source.
   - Create a test account, confirm the email, save a citation, then sign in from a second browser and find it.
   - Request a password reset and complete it from the email.
   - Export, then delete the test account.
7. **Monitor:** add the uptime check described in the [runbook](RUNBOOK.md#monitoring).

Production repeats these steps on a separate Supabase project and host service. Add the custom domain with DNS records from the host; TLS is issued by the host.

## Releasing changes

1. Merge to `main` after CI passes.
2. Apply any new migrations with `npx supabase db push` against staging, smoke test, then production. Migrations are forward-only. Write additive migrations where possible, so the previous image keeps working until the new one is live.
3. Build and tag the image with the commit hash, deploy to staging, smoke test, then deploy the same tag to production.

There is no automated CD workflow yet, because no host is chosen. Add one once the host and its registry credentials exist, using GitHub environment secrets and a manual approval for production.

## Rollback

- **Web:** redeploy the previous image tag. Keep at least the last three tags in the registry.
- **Database:** do not edit or revert an applied migration. Write a corrective migration. For data loss, restore from backup using the [runbook](RUNBOOK.md#backup-and-restore).
- **Emergency stop:** set `MAINTENANCE_MODE=on` and restart the web service.
