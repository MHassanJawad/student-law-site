# Launch readiness and decision record

Updated 2026-10-25. Status: **not ready for a public launch.** The engineering controls for a hosted beta are in place. The remaining gates need hosting, people, or reviewed content. Each row maps to the Phase 6 and Phase 7 exit gates in `plan.md`.

## Phase 6 exit gate

| Gate | Status | Evidence or next action |
| --- | --- | --- |
| No unresolved critical/high security defects | **Met for the code** | Audit clean; rate limits, CSP/HSTS, and secret scanning added; [security](../SECURITY.md) lists deferred, non-critical items. |
| Data ownership verified | **Met** | Cross-user denial for saved citations and editorial roles passes in CI. |
| Source controls verified | **Met for the pilot** | Only reviewed records are public; withdrawal rollback drill passed ([Phase 3](phase-3-status.md)). |
| Restore procedure tested | **Partly met** | CI restores corpus, Auth accounts, and saved citations. A hosted backup restore is pending a host. |
| Incident procedures defined | **Met; rehearsal pending** | [Security incident response](../SECURITY.md#incident-response) and [runbook](../RUNBOOK.md). Rehearse maintenance mode and rollback on staging. |
| Accessibility reviewed | **Partly met** | Axe passes on all public and signed-in pages at phone and desktop widths. A manual screen-reader and full keyboard pass is still needed. |
| Performance target | **Met on a tiny corpus only** | p95 under 70 ms in CI with two records. Re-measure on staging with the published corpus. |
| Student beta | **Not started** | [Beta script](beta-session.md) is ready; it needs staging. |
| Owner accepts known gaps and launch scope | **Pending** | Complete the decision below. |

## Phase 7 readiness

| Item | Status |
| --- | --- |
| Containerised web build, health check, maintenance mode | Done; CI builds and smoke-tests the image |
| Deployment and rollback procedure | Documented in [deployment](../DEPLOYMENT.md); not yet run |
| Monitoring and source freshness schedule | Defined in the [runbook](../RUNBOOK.md); uptime monitor not yet created |
| Privacy notice, terms, disclaimer | Pages at `/privacy` and `/about`; need review and a support address |
| Coverage wording matches verified coverage | Home shows measured counts and states the site is not a complete archive |
| Hosted corpus updates after launch | **Gap:** an upsert-based corpus sync from the review database is not built |
| Operational owner and alert responsibility | **Pending owner** |
| Support channel | **Pending:** set `NEXT_PUBLIC_SUPPORT_EMAIL` |

## Scope that a launch would actually have

- One reviewed FCCP judgment metadata record out of 110 staged candidates, plus the Phase 2 fixture and any further records the owner reviews before launch. No judgment text or summaries.
- At most one legislation metadata sample, of unknown status. No legislation adapter exists yet.
- Empty Maxims, Articles, and Dictionary collections unless reviewed entries are published.

That scope suits a closed student beta. It is too thin for a public launch announced as a legal research site. The recommended order is:
1. Staging and the beta.
2. Legislation adapter and corpus growth.
3. Corpus sync.
4. Public launch.

## Decision

| Field | Value |
| --- | --- |
| Decision | _Pending: closed beta on staging / public launch / defer_ |
| Accepted known gaps | _Owner to list_ |
| Operational owner | _Owner to name_ |
| Date and approver | _Owner to complete_ |
