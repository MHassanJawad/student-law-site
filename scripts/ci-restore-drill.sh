#!/usr/bin/env bash
# Rehearse a corpus restore on an isolated GitHub Linux runner.
set -Eeuo pipefail

if [[ "${GITHUB_ACTIONS:-}" != 'true' || "${RUNNER_OS:-}" != 'Linux' ]]; then
  echo 'Restore drill is restricted to the disposable GitHub Linux runner.' >&2
  exit 1
fi

mapfile -t db_containers < <(docker ps --format '{{.Names}}' --filter 'name=^supabase_db_')
if [[ "${#db_containers[@]}" -ne 1 ]]; then
  echo 'Expected exactly one local Supabase database container.' >&2
  exit 1
fi
db_container="${db_containers[0]}"
restore_db="student_law_restore_${GITHUB_RUN_ID:?}_${GITHUB_RUN_ATTEMPT:?}"
backup_path="/tmp/${restore_db}.dump"

cleanup() {
  docker exec "$db_container" dropdb -U postgres --if-exists "$restore_db" >/dev/null 2>&1 || true
  docker exec "$db_container" rm -f -- "$backup_path" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Supabase manages its own schemas and Realtime functions. Restore the app's
# source/corpus tables into a separate database without recreating those internals.
docker exec "$db_container" pg_dump -U postgres -d postgres -Fc \
  -t public.source_registry -t public.legal_documents \
  -t public.document_versions -t public.judgment_metadata \
  --file="$backup_path"
docker exec "$db_container" createdb -U postgres -T template0 "$restore_db"
# The selected judgment indexes use the trigram operator class supplied by
# the project's first migration; table-only dumps do not include extensions.
docker exec "$db_container" psql -U postgres -d "$restore_db" -v ON_ERROR_STOP=1 \
  -c 'CREATE EXTENSION pg_trgm WITH SCHEMA public;'
docker exec "$db_container" pg_restore -U postgres -d "$restore_db" --no-owner --no-acl --exit-on-error "$backup_path"

sql='select (select count(*) from public.source_registry), (select count(*) from public.legal_documents), (select count(*) from public.document_versions), (select count(*) from public.judgment_metadata);'
original="$(docker exec "$db_container" psql -U postgres -d postgres -Atc "$sql")"
restored="$(docker exec "$db_container" psql -U postgres -d "$restore_db" -Atc "$sql")"
if [[ "$original" != "$restored" || "$original" == '0|0|0|0' ]]; then
  echo 'Restored source, document, version, or judgment counts differ.' >&2
  exit 1
fi
echo 'Disposable Supabase corpus backup and restore drill passed.'
