-- Answer + embedding cache.
--
-- The free Gemini tier allows 1,000 embedding requests and a few hundred
-- generations per day. Every repeated question would otherwise spend both, so
-- identical questions are answered from here instead: the stored embedding,
-- the generated answer and its sources, keyed by a hash of the normalised
-- question. Publishing a document clears the table (see the ingest function).

create table if not exists public.query_cache (
  cache_key     text primary key,
  question      text not null,
  language      text not null,
  ministry      text,
  embedding     vector(768),
  answer        text,
  sources       jsonb not null default '[]'::jsonb,
  quality_score integer,
  hits          integer not null default 0,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now()
);

create index if not exists query_cache_created_idx
  on public.query_cache (created_at desc);

create index if not exists query_cache_hits_idx
  on public.query_cache (hits desc);

-- Service role only: RLS on with no policies means anon/authenticated clients
-- cannot read other people's questions or the cached answers.
alter table public.query_cache enable row level security;

-- Housekeeping: drop entries older than the retention window.
create or replace function public.query_cache_purge(older_than_days integer default 30)
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.query_cache
    where created_at < now() - make_interval(days => older_than_days)
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke all on function public.query_cache_purge(integer) from anon, authenticated;

-- Surfaced on the admin dashboard as a savings figure.
create or replace function public.cache_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'entries', count(*),
    'hits', coalesce(sum(hits), 0),
    'answers', count(*) filter (where answer is not null),
    'oldest', min(created_at)
  )
  from public.query_cache;
$$;
