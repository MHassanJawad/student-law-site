#!/usr/bin/env bash
# Start the built web image and confirm it serves pages, security headers, and an honest health status.
set -Eeuo pipefail

image="${1:?Pass the image tag to test}"
container="$(docker run -d --rm -p 127.0.0.1:3300:3000 "$image")"
cleanup() { docker stop "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

for _ in {1..30}; do
  if curl --fail --silent --output /dev/null http://127.0.0.1:3300/about; then break; fi
  sleep 1
done

headers="$(curl --fail --silent --dump-header - --output /dev/null http://127.0.0.1:3300/privacy)"
grep -qi '^content-security-policy: .*frame-ancestors' <<<"$headers"
grep -qi '^strict-transport-security: max-age=' <<<"$headers"

[[ "$(docker exec "$container" id -u)" != "0" ]] || { echo 'The image must not run as root.' >&2; exit 1; }

# No database runs beside this container, so health must report 503 rather than a false success.
status="$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3300/api/v1/health)"
[[ "$status" == "503" ]] || { echo "Expected health 503 without a database, got $status." >&2; exit 1; }
echo 'Container served pages with security headers as a non-root user and reported missing database health.'
