-- ---------------------------------------------------------------------------
-- सरकार Record Index — Supabase schema
-- Postgres 15+, pgvector. Safe to re-run.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Profiles (mirrors auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  locale text not null default 'en' check (locale in ('en', 'ne')),
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Corpus
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  notice_id text,
  title text not null,
  ministry text,
  service_name text,
  category text,
  source_url text,
  storage_path text,
  language text not null default 'ne',
  page_count int,
  chunk_count int not null default 0,
  ingest_status text not null default 'ready'
    check (ingest_status in ('pending', 'ready', 'failed')),
  published_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists documents_notice_id_key
  on public.documents (notice_id)
  where notice_id is not null;
create index if not exists documents_ministry_idx on public.documents (ministry);
create index if not exists documents_created_at_idx on public.documents (created_at desc);
create index if not exists documents_title_trgm_idx
  on public.documents using gin (title gin_trgm_ops);

create table if not exists public.chunks (
  id bigserial primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index int not null,
  page_hint text,
  content text not null,
  token_count int,
  embedding vector(768),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists chunks_document_idx on public.chunks (document_id, chunk_index);
create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
create index if not exists chunks_content_fts_idx
  on public.chunks using gin (to_tsvector('simple', content));

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  language text not null default 'en' check (language in ('en', 'ne')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_idx
  on public.conversations (user_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  quality_score int,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Telemetry
-- ---------------------------------------------------------------------------
create table if not exists public.query_logs (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  question text not null,
  answer_chars int not null default 0,
  language text not null default 'en',
  ministry text,
  quality_score int,
  latency_ms int,
  matched_chunks int not null default 0,
  client_hash text,
  created_at timestamptz not null default now()
);

create index if not exists query_logs_created_idx on public.query_logs (created_at desc);
create index if not exists query_logs_user_idx on public.query_logs (user_id, created_at desc);
create index if not exists query_logs_client_idx on public.query_logs (client_hash, created_at desc);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  rating smallint not null check (rating in (-1, 1)),
  comment text,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

drop trigger if exists conversations_touch on public.conversations;
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Retrieval
-- ---------------------------------------------------------------------------
create or replace function public.match_chunks(
  query_embedding vector(768),
  match_threshold float default 0.15,
  match_count int default 6,
  filter_ministry text default null,
  filter_document uuid default null
)
returns table (
  chunk_id bigint,
  document_id uuid,
  content text,
  chunk_index int,
  page_hint text,
  similarity float,
  title text,
  ministry text,
  service_name text,
  notice_id text,
  source_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    c.page_hint,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.title,
    d.ministry,
    d.service_name,
    d.notice_id,
    d.source_url
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where c.embedding is not null
    and (filter_ministry is null or d.ministry = filter_ministry)
    and (filter_document is null or c.document_id = filter_document)
    and 1 - (c.embedding <=> query_embedding) > coalesce(match_threshold, 0.15)
  order by c.embedding <=> query_embedding
  limit least(coalesce(match_count, 6), 20);
$$;

create or replace function public.search_documents(
  search_query text default null,
  filter_ministry text default null,
  max_rows int default 60
)
returns setof public.documents
language sql
stable
security definer
set search_path = public
as $$
  select d.*
  from public.documents d
  where (filter_ministry is null or d.ministry = filter_ministry)
    and (
      search_query is null
      or search_query = ''
      or d.title ilike '%' || search_query || '%'
      or coalesce(d.notice_id, '') ilike '%' || search_query || '%'
      or coalesce(d.service_name, '') ilike '%' || search_query || '%'
      or coalesce(d.ministry, '') ilike '%' || search_query || '%'
    )
  order by coalesce(d.published_at, d.created_at::date) desc, d.created_at desc
  limit least(coalesce(max_rows, 60), 200);
$$;

create or replace function public.corpus_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'documents', (select count(*) from public.documents),
    'chunks', (select count(*) from public.chunks where embedding is not null),
    'ministries', (select count(distinct ministry) from public.documents where ministry is not null),
    'services', (select count(distinct service_name) from public.documents where service_name is not null),
    'last_ingested_at', (select max(created_at) from public.documents)
  );
$$;

create or replace function public.dashboard_stats(window_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select greatest(1, least(coalesce(window_days, 30), 365)) as days
  ),
  logs as (
    select l.*
    from public.query_logs l, bounds b
    where l.created_at >= now() - make_interval(days => b.days)
  ),
  totals as (
    select
      count(*)::int as total,
      count(*) filter (where coalesce(answer_chars, 0) > 0)::int as answered,
      coalesce(round(avg(latency_ms)), 0)::int as avg_latency,
      coalesce(round(avg(quality_score)), 0)::int as avg_quality,
      count(*) filter (where language = 'ne')::int as ne_count,
      count(*) filter (where language <> 'ne')::int as en_count
    from logs
  ),
  daily as (
    select
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
      count(*)::int as queries,
      round(avg(quality_score))::int as avg_quality
    from logs
    group by 1
    order by 1
  ),
  buckets as (
    select bucket, count(*)::int as count
    from (
      select case
        when quality_score is null then 'unscored'
        when quality_score >= 80 then '80–100'
        when quality_score >= 60 then '60–79'
        when quality_score >= 40 then '40–59'
        else '0–39'
      end as bucket
      from logs
    ) scored
    group by bucket
  ),
  top_docs as (
    select d.title, count(*)::int as hits
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    cross join lateral jsonb_array_elements(m.sources) as source
    join public.documents d on d.id = (source ->> 'documentId')::uuid
    where m.role = 'assistant'
      and m.created_at >= now() - make_interval(days => (select days from bounds))
    group by d.title
    order by hits desc
    limit 6
  )
  select jsonb_build_object(
    'window_days', (select days from bounds),
    'total_queries', (select total from totals),
    'answered_queries', (select answered from totals),
    'failure_rate',
      case when (select total from totals) = 0 then 0
           else round(100.0 * ((select total from totals) - (select answered from totals))
                      / (select total from totals), 1)
      end,
    'avg_latency_ms', (select avg_latency from totals),
    'avg_quality', (select avg_quality from totals),
    'language_split', jsonb_build_object(
      'en', (select en_count from totals),
      'ne', (select ne_count from totals)
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'day', day, 'queries', queries, 'avg_quality', avg_quality)) from daily), '[]'::jsonb),
    'top_documents', coalesce((select jsonb_agg(jsonb_build_object(
      'title', title, 'hits', hits)) from top_docs), '[]'::jsonb),
    'quality_buckets', coalesce((select jsonb_agg(jsonb_build_object(
      'bucket', bucket, 'count', count)) from buckets), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.query_logs enable row level security;
alter table public.feedback enable row level security;

-- profiles
drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- corpus: public read, admin write
drop policy if exists "documents public read" on public.documents;
create policy "documents public read" on public.documents
  for select using (true);

drop policy if exists "documents admin write" on public.documents;
create policy "documents admin write" on public.documents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "chunks public read" on public.chunks;
create policy "chunks public read" on public.chunks
  for select using (true);

drop policy if exists "chunks admin write" on public.chunks;
create policy "chunks admin write" on public.chunks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- conversations
drop policy if exists "conversations owner read" on public.conversations;
create policy "conversations owner read" on public.conversations
  for select using (auth.uid() = user_id);

drop policy if exists "conversations owner write" on public.conversations;
create policy "conversations owner write" on public.conversations
  for insert with check (auth.uid() = user_id);

drop policy if exists "conversations owner update" on public.conversations;
create policy "conversations owner update" on public.conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "conversations owner delete" on public.conversations;
create policy "conversations owner delete" on public.conversations
  for delete using (auth.uid() = user_id);

-- messages: scoped through the parent conversation
drop policy if exists "messages owner read" on public.messages;
create policy "messages owner read" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "messages owner write" on public.messages;
create policy "messages owner write" on public.messages
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "messages owner update" on public.messages;
create policy "messages owner update" on public.messages
  for update using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "messages owner delete" on public.messages;
create policy "messages owner delete" on public.messages
  for delete using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- query logs: insert only, read for admins
drop policy if exists "query logs insert" on public.query_logs;
create policy "query logs insert" on public.query_logs
  for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());

drop policy if exists "query logs admin read" on public.query_logs;
create policy "query logs admin read" on public.query_logs
  for select to authenticated using (public.is_admin());

-- feedback
drop policy if exists "feedback owner write" on public.feedback;
create policy "feedback owner write" on public.feedback
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "feedback owner read" on public.feedback;
create policy "feedback owner read" on public.feedback
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------------
grant execute on function public.match_chunks(vector, float, int, text, uuid)
  to anon, authenticated;
grant execute on function public.search_documents(text, text, int)
  to anon, authenticated;
grant execute on function public.corpus_stats() to anon, authenticated;
grant execute on function public.dashboard_stats(int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage for source files
-- ---------------------------------------------------------------------------
-- Public bucket: originals are readable, writes go through the service role in
-- the `ingest` function, so no storage.objects policies are required here.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;
