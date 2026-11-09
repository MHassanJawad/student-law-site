# Contributing

1. Branch from `main` (`feat/…`, `fix/…`, `docs/…`) and follow the [commit convention](COMMIT_CONVENTION.md) and [git workflow](docs/GIT_WORKFLOW.md).
2. Before pushing, run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Database, browser, container, and secret checks run in CI ([testing guide](docs/TESTING.md)).
3. Open a pull request that lists the requirement ID, tests run, source or provenance impact, and any migration with its forward-fix note. Update the [changelog](CHANGELOG.md) for user-facing changes and the relevant `docs/` page.

## Review checklist

Reviewers check:
- **Correctness:** behaviour and edge cases match the requirement.
- **Security:** inputs are validated, ownership and RLS hold, and no secret is in client code.
- **Provenance:** nothing unreviewed becomes public, and no metadata is invented.
- **Tests:** new logic has unit tests; database or route behaviour has CI coverage.
- **Accessibility:** labels, focus, and status announcements are present.
- **Documentation:** affected docs are updated.

Every change needs one approving review. The project currently has a solo owner, who may merge their own pull request after CI passes, with a short self-review note in the description.

## Rules that are easy to miss

- Add a new numbered migration; never edit an applied one.
- Keep the service-role key in the worker only.
- Do not commit source PDFs, extracted judgment text, database dumps, or `.env` files.
- New source adapters need a source-register entry with the access and rights review before any retrieval.
