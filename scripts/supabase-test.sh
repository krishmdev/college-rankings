#!/usr/bin/env bash
# Starts a trimmed local Supabase stack, resets it (migrations + seed), runs pgTAP and the Auth
# integration test, and stops the stack. The full stack is memory-heavy; RUN_WRAPPER (optional,
# empty by default) is a command prefix that makes the run exclusive on the machine.
set -euo pipefail
cd "$(dirname "$0")/.."
out="docs/results/supabase-tests.txt"

body() {
  set -euo pipefail
  trap 'npx supabase stop --no-backup >/dev/null 2>&1 || true' EXIT
  # The CLI's agent mode prints JSON even for `status -o env`. Read explicit JSON fields and
  # keep the local service keys out of the test log.
  npx supabase start --agent no -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor >/dev/null
  npx supabase db reset --agent no
  status_json="$(npx supabase status --agent no -o json)"
  SB_API_URL="$(jq -er '.API_URL' <<<"$status_json")"
  SB_ANON_KEY="$(jq -er '.ANON_KEY' <<<"$status_json")"
  SB_SERVICE_ROLE_KEY="$(jq -er '.SERVICE_ROLE_KEY' <<<"$status_json")"
  SB_MAIL_URL="$(jq -r '.MAILPIT_URL // .INBUCKET_URL // "http://127.0.0.1:54324"' <<<"$status_json")"
  unset status_json
  {
    echo "# supabase tests $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "## pgTAP"
    npx supabase test db 2>&1
    echo "## auth integration"
    SUPABASE_URL="$SB_API_URL" SUPABASE_ANON_KEY="$SB_ANON_KEY" SUPABASE_SERVICE_KEY="$SB_SERVICE_ROLE_KEY" \
      MAILPIT_URL="$SB_MAIL_URL" \
      node --test supabase/integration/auth-flow.test.mjs 2>&1
  } 2>&1 | sed "s|$PWD/||g" | tee "$out"
  python3 scripts/supabase-manifest.py "$out"
}
export -f body; export out

${RUN_WRAPPER:-} bash -c body
