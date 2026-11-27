<p align="center">
  <img src="web/app/icon.svg" width="76" height="76" alt="अभिलेख mark">
</p>

# अभिलेख · Abhilekh

Nepal's public record, answered. A bilingual retrieval system over the public
administrative record: every answer is generated only from indexed government
documents and arrives with the passages it was drawn from.

*Abhilekh* (अभिलेख) is the Nepali word for a record — the archived, citable
original.

```
web/        Next.js 15 + TypeScript + Tailwind v4 frontend (Vercel)
supabase/   Postgres schema (pgvector), RLS, RPCs, Edge Functions (chat, ingest, documents)
scripts/    MySQL → Supabase migration
rag/        Python retrieval pipeline (embeddings, chunking, validation)
app_chat.py Legacy FastAPI backend (local development / fallback)
```

## Run the frontend

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

Without Supabase credentials the UI falls back to the local FastAPI backend.

## Run the Python backend (local fallback)

```bash
conda activate rag-st
python app_chat.py   # http://localhost:8001
```

Requires MySQL running with the `rag` database and Ollama serving the configured
model (`USE_OLLAMA=true`, `OLLAMA_MODEL=qwen2.5-coder:7b` in `.env`).

## Deploy

Vercel (frontend) + Supabase (Postgres, Auth, Edge Functions) — see
[DEPLOYMENT.md](DEPLOYMENT.md). The migration script re-embeds the corpus with
Gemini embeddings so the Edge Function can answer queries:

```bash
python scripts/migrate_to_supabase.py --dry-run
python scripts/migrate_to_supabase.py
```

## Design

The interface replaces the previous minimalist purple-gradient chat UI with an
"Ink & Brass" editorial system: ink-green ground, bone type, saffron accents,
serif display headings, monospace metadata, hairline rules and a three-pane
workbench (sessions · conversation · evidence).
