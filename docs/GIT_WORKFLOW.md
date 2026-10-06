# Git workflow

Use short feature branches from `main`, such as `feat/fccp-search`. Open a pull request with the requirement ID, tests run, source/provenance impact, and any migration or rollback note. Require one review before merge when a reviewer is available; a solo owner may document a self-review. Protect `main` with CI once remote repository settings are available. Use [Conventional Commits](../COMMIT_CONVENTION.md) and update [Changelog](../CHANGELOG.md) for user-facing changes.
