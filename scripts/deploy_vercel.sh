#!/usr/bin/env bash
# Deploy the Next.js app in web/ to Vercel.
#
#   VERCEL_TOKEN=xxx ./scripts/deploy_vercel.sh
#   VERCEL_SITE_URL=https://rag-expansion.vercel.app VERCEL_TOKEN=xxx ./scripts/deploy_vercel.sh
#
# Environment variables are written through the REST API (the CLI's `env add`
# prompts interactively and silently drops piped values), then a production
# build is shipped.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/web"

: "${VERCEL_TOKEN:?set VERCEL_TOKEN (vercel.com/account/tokens)}"
PROJECT="${VERCEL_PROJECT:-rag-expansion}"
TEAM="${VERCEL_TEAM:-creationsbysonus-projects}"
API="https://api.vercel.com"
VCLI=(npx --yes vercel@48.2.0 --token "$VERCEL_TOKEN" --scope "$TEAM")

envval() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2-; }

SUPABASE_URL="$(envval NEXT_PUBLIC_SUPABASE_URL)"
SUPABASE_KEY="$(envval NEXT_PUBLIC_SUPABASE_ANON_KEY)"
SITE_URL="${VERCEL_SITE_URL:-$(envval NEXT_PUBLIC_SITE_URL)}"
: "${SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL missing from web/.env.local}"
: "${SUPABASE_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY missing from web/.env.local}"

PROJECT_ID="$(curl -sf -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$API/v9/projects/$PROJECT?slug=$TEAM" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
echo "project: $PROJECT ($PROJECT_ID)"

upsert_env() {  # key value
  python3 - "$1" "$2" <<'PY' | curl -sf -o /dev/null -X POST \
      -H "Authorization: Bearer $VERCEL_TOKEN" -H 'Content-Type: application/json' \
      --data @- "$API/v10/projects/$PROJECT_ID/env?upsert=true&slug=$TEAM"
import json, sys
key, value = sys.argv[1], sys.argv[2]
print(json.dumps({"key": key, "value": value, "type": "plain",
                  "target": ["production", "preview"]}))
PY
  echo "  ✓ $1"
}

echo "→ environment variables"
upsert_env NEXT_PUBLIC_SUPABASE_URL "$SUPABASE_URL"
upsert_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$SUPABASE_KEY"
[ -n "$SITE_URL" ] && upsert_env NEXT_PUBLIC_SITE_URL "$SITE_URL"

echo "→ production deploy"
"${VCLI[@]}" deploy --prod --yes | tee /tmp/vercel-deploy.log | tail -3

URL="$(grep -oE 'https://[a-z0-9.-]+\.vercel\.app' /tmp/vercel-deploy.log | tail -1)"
echo
echo "Deployment: ${URL}"
[ -n "$SITE_URL" ] && echo "Site URL:   ${SITE_URL}"
echo "Verify: curl -s -o /dev/null -w '%{http_code}' ${SITE_URL:-$URL}/"
