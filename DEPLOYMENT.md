# Deployment — Vercel + Supabase

Architecture:

```
Browser ──► Next.js on Vercel (web/)
              │  anon key + user JWT
              ├──► Supabase Auth (magic link / anonymous)
              ├──► Supabase Postgres + pgvector (documents, chunks, sessions, logs)
              └──► Supabase Edge Function `chat` (embed → match_chunks → Gemini stream)
                          └──► Supabase Edge Function `ingest` (admin PDF/text upload)
```

The legacy FastAPI app (`app_chat.py`) still runs locally and remains a fallback
backend: `web/.env.local` without Supabase envs plus `NEXT_PUBLIC_RAG_API_URL=http://localhost:8001`.

---

## 1. Create the Supabase project

1. Create a project at [database.new](https://database.new) (region: Singapore or Mumbai for latency to Nepal).
2. Copy the project URL, `anon` key and `service_role` key from **Project Settings → API**.

## 2. Apply the schema

Either paste `supabase/migrations/20260101000000_init.sql` into the SQL editor, or use the CLI:

```bash
npm i -g supabase
supabase link --project-ref <project-ref>
supabase db push
```

This creates `profiles`, `documents`, `chunks` (vector(768), HNSW index),
`conversations`, `messages`, `query_logs`, `feedback`, the RPCs `match_chunks`,
`search_documents`, `corpus_stats`, `dashboard_stats`, RLS policies, the
`documents` storage bucket and the signup profile trigger.

## 3. Configure Auth

**Authentication → Providers → Email**: enable, and turn on **Confirm email** if you want verified addresses.
**Authentication → Sign In / Providers → Anonymous**: enable (powers “Continue without an account”).
**Authentication → URL Configuration**:

- Site URL: `https://<your-app>.vercel.app`
- Redirect URLs: `https://<your-app>.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`

## 4. Deploy the Edge Functions

> If `supabase login` reports `failed to parse environment file: .env`, the
> project `.env` contains a non-dotenv line (for example a `[TEMPLATE]` header
> copied from a template). Remove it and log in again.

```bash
supabase secrets set \
  GEMINI_API_KEY=<google-ai-studio-key> \
  GEMINI_CHAT_MODEL=gemini-2.5-flash \
  GEMINI_EMBEDDING_MODEL=gemini-embedding-001 \
  RATE_LIMIT_PER_MINUTE=30 \
  INGEST_SECRET=<random-long-string>

supabase functions deploy chat  --no-verify-jwt
supabase functions deploy ingest --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically. `chat` is public (rate-limited per user/IP); `ingest` requires an
admin profile or the `x-ingest-secret` header.

### One-shot alternative

`scripts/deploy_supabase.py` does the same work without the CLI's interactive
OAuth: it enables anonymous sign-ins via the Management API, pushes the secrets
read from `.env`, and deploys both functions with `--no-verify-jwt`.

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...   # dashboard -> Account -> Access Tokens
python3 scripts/deploy_supabase.py --dry-run
python3 scripts/deploy_supabase.py
python3 scripts/deploy_supabase.py --only functions   # re-deploy code only
```

## 5. Migrate the existing corpus

The migration re-embeds every chunk with `gemini-embedding-001` (768 dims) so
query embeddings are in the same space as document embeddings.

```bash
conda activate rag-st
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
export GEMINI_API_KEY=<google-ai-studio-key>
export MYSQL_PASSWORD=<local mysql password>

python scripts/migrate_to_supabase.py --dry-run
python scripts/migrate_to_supabase.py
```

Useful flags: `--limit N`, `--skip-existing`, `--replace`. Duplicate rows in
MySQL (the same file ingested twice) are collapsed by title, keeping the copy
with the most chunks. `EMBED_PAUSE=2.5` spaces requests out to stay under the
per-minute quota.

Gemini's free tier allows 1,000 embedding requests per day. This corpus needs
667, so a single run fits — but a run that exhausts the quota aborts with a clear
message and must be repeated after the daily reset, or with billing enabled on
the key.

Verify in SQL:

```sql
select count(*) from documents;
select count(*) from chunks where embedding is not null;
```

## 6. Make yourself an admin

Sign in to the app once, then either:

```bash
python3 scripts/grant_admin.py you@example.com
```

or run the SQL directly:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Admins publish documents from **`/upload`** — drag a PDF/TXT/MD/CSV, fill in the
title and metadata, and the function extracts, chunks and embeds it in one pass.
The same call works from a script:

```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/ingest" \
  -H "Authorization: Bearer <user-jwt>" \
  -F "file=@notice.pdf" \
  -F "title=Passport renewal directive" \
  -F "ministry=Ministry of Foreign Affairs" \
  -F "service_name=Passport" \
  -F "notice_id=MoFA-2081-014"
```

## 7. Deploy the frontend to Vercel

1. Import the repository in Vercel.
2. **Root Directory: `web`** (framework auto-detects Next.js).
3. Environment variables (Production + Preview):

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` |
   | `NEXT_PUBLIC_RAG_API_URL` | leave empty in production |

4. Deploy. Add the production domain to Supabase redirect URLs afterwards.

## 8. Embedding the assistant

`/integrate` documents the three integration depths. In short:

- **Widget** — `<iframe src="https://<your-app>.vercel.app/embed?accent=%23dfa851">`
  (or the floating-bubble snippet on that page). No build step.
- **API** — `POST https://<ref>.supabase.co/functions/v1/chat` with the publishable
  key in `apikey`; reads SSE frames `sources` → `token` → `done`.
- **Server-side** — same endpoint from your backend, which keeps keys and PII on
  your side. A Python example is on that page.

## 9. Local development

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Without Supabase envs the UI runs against the local FastAPI backend; set
`NEXT_PUBLIC_RAG_API_URL=http://localhost:8001` and run `python app_chat.py`.

## Operational notes

- **Rate limiting** lives in the `chat` function (counts `query_logs` per user or
  client hash per minute, default 30). Tighten with `RATE_LIMIT_PER_MINUTE`.
- **Costs**: one embedding call per question plus streamed generation. `gemini-2.5-flash`
  is the default; swap with `GEMINI_CHAT_MODEL`.
- **Re-embedding**: changing `GEMINI_EMBEDDING_MODEL` requires re-running the
  migration; dimensions must match `vector(768)` or the column must be altered.
- **Backups**: Supabase daily backups; the corpus can always be rebuilt from MySQL
  plus the migration script.
- **RLS**: the corpus is public-readable by design; conversations, messages,
  feedback and query logs are owner-scoped.
