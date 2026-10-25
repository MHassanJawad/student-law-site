#!/usr/bin/env bash
# Rebuild disposable CI Supabase from a data dump, including Auth and saved data.
set -Eeuo pipefail

if [[ "${GITHUB_ACTIONS:-}" != 'true' || "${RUNNER_OS:-}" != 'Linux' ]]; then
  echo 'Full restore drill is restricted to the disposable GitHub Linux runner.' >&2
  exit 1
fi

env_file="$(mktemp "${RUNNER_TEMP:-/tmp}/student-law-restore-env.XXXXXX")"
backup_path="$(mktemp "${RUNNER_TEMP:-/tmp}/student-law-data.XXXXXX.sql")"
fixture_path="$(mktemp "${RUNNER_TEMP:-/tmp}/student-law-restore-fixture.XXXXXX.json")"
cleanup() { rm -f -- "$env_file" "$backup_path" "$fixture_path"; }
trap cleanup EXIT

npx supabase status -o env > "$env_file"
set -a
source "$env_file"
set +a
export SUPABASE_URL="${API_URL:?Supabase API URL is required}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${PUBLISHABLE_KEY:-${ANON_KEY:?A public key is required}}"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-${SECRET_KEY:?A service-role key is required}}"

node scripts/ci-full-restore-fixture.mjs create "$fixture_path"
npx supabase db dump --local --schema auth,public --data-only --use-copy --file "$backup_path"
if [[ ! -s "$backup_path" ]]; then
  echo 'Supabase data dump is empty.' >&2
  exit 1
fi

# This only resets the disposable local CI database. Never omit --local.
npx supabase db reset --local --no-seed
mapfile -t db_containers < <(docker ps --format '{{.Names}}' --filter 'name=^supabase_db_')
if [[ "${#db_containers[@]}" -ne 1 ]]; then
  echo 'Expected exactly one disposable Supabase database container.' >&2
  exit 1
fi
{ printf 'SET session_replication_role = replica;\n'; cat "$backup_path"; } |
  docker exec -i "${db_containers[0]}" psql -U postgres -d postgres --single-transaction -v ON_ERROR_STOP=1
node scripts/ci-full-restore-fixture.mjs verify "$fixture_path"
echo 'Disposable Auth and application-data restore drill passed.'
