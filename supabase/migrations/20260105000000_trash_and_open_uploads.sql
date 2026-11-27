-- Trash with a restore window, and ownership lookups for /account.
--
-- Deleting a document no longer destroys it: it is marked `deleted_at`, hidden
-- from retrieval, the corpus listings and the stats, and kept in storage for
-- seven days so the uploader can restore it. The `documents` Edge Function
-- restores or purges it, and lazily purges anything past the window.

alter table public.documents
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null;

create index if not exists documents_deleted_at_idx on public.documents (deleted_at);
create index if not exists documents_uploaded_by_created_idx
  on public.documents (uploaded_by, created_at desc);

-- Single source of truth for the window; the Edge Function mirrors this value.
create or replace function public.trash_retention()
returns interval
language sql
immutable
as $$ select interval '7 days' $$;

comment on column public.documents.deleted_at is
  'Moved to trash at this time; hidden from retrieval until restored or purged.';

-- ---------------------------------------------------------------------------
-- Visibility: the record is public, but a trashed row is visible only to the
-- account that uploaded it and to admins (so it can be restored).
-- ---------------------------------------------------------------------------
drop policy if exists "documents public read" on public.documents;
create policy "documents public read" on public.documents
  for select using (
    deleted_at is null or public.is_admin() or uploaded_by = auth.uid()
  );

drop policy if exists "chunks public read" on public.chunks;
create policy "chunks public read" on public.chunks
  for select using (
    exists (
      select 1 from public.documents d
      where d.id = public.chunks.document_id and d.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- Retrieval and listings must ignore trashed rows.
-- ---------------------------------------------------------------------------
create or replace function public.match_chunks(
  query_embedding vector(1024),
  match_count int default 6,
  match_threshold float default 0.15,
  filter_document uuid default null,
  filter_ministry text default null
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
    and d.deleted_at is null
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
  where d.deleted_at is null
    and (filter_ministry is null or d.ministry = filter_ministry)
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
    'documents', (select count(*) from public.documents where deleted_at is null),
    'chunks', (
      select count(*)
      from public.chunks c
      join public.documents d on d.id = c.document_id
      where c.embedding is not null and d.deleted_at is null
    ),
    'ministries', (
      select count(distinct ministry) from public.documents
      where ministry is not null and deleted_at is null
    ),
    'services', (
      select count(distinct service_name) from public.documents
      where service_name is not null and deleted_at is null
    ),
    'last_ingested_at', (select max(created_at) from public.documents where deleted_at is null)
  );
$$;

-- ---------------------------------------------------------------------------
-- Trash and ownership listings for the signed-in account.
-- ---------------------------------------------------------------------------
create or replace function public.trashed_documents()
returns table (
  id uuid,
  title text,
  ministry text,
  notice_id text,
  chunk_count int,
  uploaded_by uuid,
  deleted_at timestamptz,
  purge_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.title,
    d.ministry,
    d.notice_id,
    d.chunk_count,
    d.uploaded_by,
    d.deleted_at,
    d.deleted_at + public.trash_retention() as purge_at
  from public.documents d
  where d.deleted_at is not null
    and (public.is_admin() or d.uploaded_by = auth.uid())
  order by d.deleted_at desc;
$$;

create or replace function public.my_documents()
returns table (
  id uuid,
  title text,
  ministry text,
  notice_id text,
  chunk_count int,
  ingest_status text,
  language text,
  created_at timestamptz,
  deleted_at timestamptz,
  purge_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.title,
    d.ministry,
    d.notice_id,
    d.chunk_count,
    d.ingest_status,
    d.language,
    d.created_at,
    d.deleted_at,
    case when d.deleted_at is null then null
         else d.deleted_at + public.trash_retention() end as purge_at
  from public.documents d
  where d.uploaded_by = auth.uid()
  order by d.created_at desc;
$$;

-- How many uploads this account made in the last day, so the console can show
-- the remaining allowance before a large file is submitted.
create or replace function public.my_upload_usage(daily_limit int default 10)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'limit', least(greatest(coalesce(daily_limit, 10), 1), 100),
    'used', (
      select count(*) from public.documents
      where uploaded_by = auth.uid() and created_at >= now() - interval '24 hours'
    )
  );
$$;

grant execute on function public.trashed_documents() to authenticated, service_role;
grant execute on function public.my_documents() to authenticated, service_role;
grant execute on function public.my_upload_usage(int) to authenticated, service_role;
