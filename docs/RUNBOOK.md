# Operations runbook

Updated 2026-10-25. Applies once a hosted environment exists ([deployment](DEPLOYMENT.md)). Owner: the project owner, until an operator is named in the [launch record](operations/launch-readiness.md).

## Monitoring

| Signal | How | Alert when |
| --- | --- | --- |
| Availability | External monitor polls `GET /api/v1/health` every 5 minutes | Two consecutive non-200 responses |
| Database reachability | Same check: `checks.database` | `failed` |
| Database latency | `databaseLatencyMs` in the health response | Consistently above 1,000 ms |
| Errors and 429s | Host request logs | A sustained spike in 5xx or 429 responses |
| Quotas | Supabase usage page (database size, Auth users, egress) and host billing | Above 80% of plan limits |
| Source freshness | `npm run review:fccp -- report` on the operator machine | The FCCP listing not checked within its cadence below |

The health endpoint is not rate limited and returns `503` with a reason during maintenance or a database failure.

## Routine schedule

- **Weekly:** check uptime history and review Dependabot pull requests.
- **Monthly, a few letters at a time:** run `npm run ingest:pakistan-code -- --letter <A-Z>` and review new or changed federal laws using the [Pakistan Code runbook](operations/pakistan-code-ingestion.md), then run the corpus sync.
- **Every two weeks:** run a bounded FCCP listing check (`npm run ingest:fccp -- --all`), then review new or quarantined candidates using the [FCCP runbook](operations/fccp-ingestion.md). Extract text for newly approved judgments (`npm run extract:fccp-text`), draft summaries (`npm run summarize:judgments`), and review them (`npm run review:summaries -- list`). Then run `npm run sync:corpus` to see the planned upserts, and `npm run sync:corpus -- --apply` to publish the changes to the hosted database. The sync never deletes rows. Never truncate corpus tables on a hosted database: saved citations reference `legal_documents`, so a cascade would delete users' data.
- **Monthly:**
  - Run a quality review: sample five published records against their official sources (TC-019) and record mismatches.
  - Run `npm audit`.
  - Regenerate the [licence inventory](THIRD_PARTY_LICENSES.md).
  - Confirm a recent backup exists.
- **Quarterly:** rehearse a restore into a scratch project and record the result in the operations status file.

## Common procedures

- **Restart:** redeploy or restart the current image tag on the host. In-memory rate-limit counts reset.
- **Maintenance mode:** set `MAINTENANCE_MODE=on` and restart. Pages and APIs return `503` with `Retry-After`; health reports `maintenance`. Unset the variable and restart to resume.
- **Rollback:** see [deployment rollback](DEPLOYMENT.md#rollback).
- **Withdraw a record:** run `npm run review:fccp -- withdraw <candidate-uuid> "<reason>"` locally. Then run `npm run sync:corpus -- --apply`; the withdrawn status is copied to the hosted record. Until then, the hosted record stays published.
- **Research assistant:** see [below](#research-assistant).
- **Promote an operator:** with service-role access, run `update public.profiles set role = 'operator' where id = '<user-id>';`. Enable MFA for that account first.
- **Account help:** users export and delete their own data in account settings. The owner can trigger a password reset email from Supabase Auth; never ask for or handle a user's password.

## Backup and restore

- **Production** must use a Supabase plan with daily backups. Record the plan's retention period in [data privacy](DATA_PRIVACY.md).
- **Independent copy:** each month, run `npx supabase db dump --linked --schema auth,public --data-only --use-copy --file <dated file>` together with a schema dump. Store the files encrypted, outside the repository and outside the provider. Delete them after the retention period.
- **Restore rehearsal:** CI already restores Auth accounts and saved citations into a disposable stack (`scripts/ci-full-restore-drill.sh`). On hosted infrastructure, restore into a new scratch project first. Verify sign-in and a saved citation, then promote the project or copy the data back. After restoring a backup into the live service, re-apply any account deletions made since the backup was taken.
- **Data-only restore:** run `truncate public.assistant_settings;` first. Migration 025 seeds that singleton row, so the restore otherwise fails on a duplicate key; the CI drill already does this.
- **Targets:** RPO 24 hours (daily backups) and RTO 8 hours, as proposed in the plan. Confirm them with the owner before launch.

## Research assistant

- **Kill switch:** set `ASSISTANT_ENABLED=off` and redeploy. The assistant API then returns 503 `ASSISTANT_DISABLED`.
- **Provider outage or rate limits:** users see a retry message and the question is refunded to their quota. A client disconnect is not refunded. If the outage lasts, use the kill switch.
- **Raising limits:** the environment variables can only lower the daily limits, because the database clamps them to the `assistant_settings` row (`user_max` 30, `global_max` 500). To raise them, update that row, then raise the matching `ASSISTANT_*_DAILY_LIMIT`.
- **After new judgments:** run `npm run build:chunks` before `sync:corpus` (see the [FCCP runbook](operations/fccp-ingestion.md)).
- **Quality check:** `EVAL_PAUSE_MS=60000 npm run eval:assistant -w @student-law/web` runs the golden questions against the local database. It passes only when every item is scored, hits are at least 0.80, verified answers at least 0.95, and every out-of-scope or injection item is declined. Groq's free tier allows about one full run a day.
- **Capacity:** Groq's free tier (about 8,000 tokens a minute) supports roughly one answer a minute site-wide, so a public launch needs a paid tier. Netlify's function time limit must exceed `ASSISTANT_TIMEOUT_MS`; confirm it for the plan.

## Incident handling

Follow [security incident response](SECURITY.md#incident-response). For a non-security outage:
1. Check health and host status.
2. Check the Supabase status page.
3. Roll back if the outage began with a release.
4. Post a short notice on the support channel if the outage exceeds one hour.
