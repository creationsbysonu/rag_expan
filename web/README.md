# अभिलेख · Abhilekh — web

Next.js 15 (App Router) + TypeScript + Tailwind v4 frontend for Abhilekh, the
bilingual retrieval system over Nepal's public administrative record. Deployed on Vercel, backed by Supabase
(Postgres + pgvector + Auth + Edge Functions).

## Run locally

```bash
cd web
cp .env.example .env.local     # optional: works without Supabase in local mode
npm install
npm run dev                    # http://localhost:3000
```

Two backends are supported, chosen automatically:

| Mode | Trigger | Chat endpoint |
| --- | --- | --- |
| Supabase (production) | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set | `${SUPABASE_URL}/functions/v1/chat` |
| Local FastAPI (development) | Supabase env absent, `NEXT_PUBLIC_RAG_API_URL` set | `${RAG_API_URL}/chat/stream` |

Start the Python backend for local mode:

```bash
cd ..
conda activate rag-st
python app_chat.py            # port 8001
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing: corpus counts, method, bilingual demonstration |
| `/chat` | Workbench: streaming answers, evidence panel, sessions, ministry filter |
| `/documents` | Corpus browser with search, ministry filter, sorting |
| `/dashboard` | Signals: volume, latency, grounding distribution, citation demand |
| `/about` | Method note, stack, citation policy, known limits |
| `/login`, `/account` | Magic-link and anonymous auth |

## Design system

`app/globals.css` defines the "Ink & Brass" tokens: ink-greens, bone type,
saffron accents, hairline rules, serif display against monospace metadata. All
components consume those tokens; there is no component library dependency.

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

Deployment steps live in [`../DEPLOYMENT.md`](../DEPLOYMENT.md).
