#!/usr/bin/env bash
# Runs the SQL checks in supabase/checks/ against a DISPOSABLE postgres:17
# container. It never connects to any other database: there is no host, port
# or URL parameter on purpose. Requires Docker.
#
#   supabase/checks/run.sh                                # every check
#   supabase/checks/run.sh process_revenuecat_event.sql   # one check
#
# A check that needs schema the throwaway database lacks (auth.users, a
# migration under test) ships a fixture of the same name in fixtures/, run
# first in the same container.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
supabase_dir="$(dirname "$here")"
image="postgres:17"
name="motovault-sql-check-$$"

cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$name" \
  -e POSTGRES_PASSWORD=throwaway \
  -v "$supabase_dir:/supabase:ro" \
  "$image" >/dev/null

for _ in $(seq 1 60); do
  # The image's init runs a temporary server first; wait for the real one.
  if docker exec "$name" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then break; fi
  sleep 1
done

if [ "$#" -gt 0 ]; then checks=("$@"); else
  checks=()
  for f in "$here"/*.sql; do checks+=("$(basename "$f")"); done
fi

for check in "${checks[@]}"; do
  echo "== $check"
  if [ -f "$here/fixtures/$check" ]; then
    docker exec "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 -d postgres \
      -f "/supabase/checks/fixtures/$check"
  fi
  docker exec "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -h 127.0.0.1 -d postgres \
    -f "/supabase/checks/$check"
done
