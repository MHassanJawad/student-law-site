#!/usr/bin/env bash
# Scan the full git history for committed credentials with a pinned gitleaks release.
set -Eeuo pipefail

version='8.18.4'
workdir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/gitleaks.XXXXXX")"
trap 'rm -rf -- "$workdir"' EXIT

curl --fail --silent --show-error --location --proto '=https' \
  "https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_linux_x64.tar.gz" \
  | tar -xz -C "$workdir" gitleaks

"$workdir/gitleaks" detect --source . --config .gitleaks.toml --redact --no-banner --verbose
