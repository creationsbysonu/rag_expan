#!/usr/bin/env bash
# Deploy the Next.js app in web/ to Vercel.
#
#   VERCEL_TOKEN=xxx ./scripts/deploy_vercel.sh
#
# Reads the public Supabase values from web/.env.local, pushes them into the
# Vercel project (production + preview), and ships a production build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/web"

: "${VERCEL_TOKEN:?set VERCEL_TOKEN (vercel.com/account/tokens)}"
PROJECT="${VERCEL_PROJECT:-rag-expansion}"
VCLI=(npx --yes vercel@48.2.0 --token "$VERCEL_TOKEN")

envval() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2-; }

SUPABASE_URL="$(envval NEXT_PUBLIC_SUPABASE_URL)"
SUPABASE_KEY="$(envval NEXT_PUBLIC_SUPABASE_ANON_KEY)"
: "${SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL missing from web/.env.local}"
: "${SUPABASE_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY missing from web/.env.local}"

echo "→ linking project ${PROJECT}"
"${VCLI[@]}" link --yes --project "$PROJECT"

setenv() {  # name value
  for target in production preview; do
    printf '%s' "$2" | "${VCLI[@]}" env add "$1" "$target" --force >/dev/null
  done
  echo "  ✓ $1"
}

echo "→ environment variables"
setenv NEXT_PUBLIC_SUPABASE_URL "$SUPABASE_URL"
setenv NEXT_PUBLIC_SUPABASE_ANON_KEY "$SUPABASE_KEY"
setenv NEXT_PUBLIC_SITE_URL ""
setenv NEXT_PUBLIC_RAG_API_URL ""

echo "→ production deploy"
"${VCLI[@]}" deploy --prod --yes | tee /tmp/vercel-deploy.log | tail -5

URL="$(grep -oE 'https://[a-z0-9.-]+\.vercel\.app' /tmp/vercel-deploy.log | tail -1)"
echo
echo "Deployed: ${URL}"
echo "Next: set Supabase Site URL + redirect (${URL}/auth/callback), then re-run"
echo "  NEXT_PUBLIC_SITE_URL=${URL} VERCEL_TOKEN=... ./scripts/deploy_vercel.sh"
