-- Move retrieval to a multilingual 1024-dimension vector space.
--
-- Cloudflare's multilingual embedders (bge-m3, qwen3-embedding) emit 1024
-- dimensions and ignore a truncation request, so bilingual retrieval (Nepali
-- questions against the English record) requires widening the column.
--
-- Existing vectors are dropped first: a 768-dimension vector cannot be cast to
-- 1024, and a vector from another model is meaningless anyway. Re-run
-- `migrate_to_supabase.py --replace` (or re-upload) to refill.

begin;

update public.chunks set embedding = null where embedding is not null;
truncate public.query_cache;

drop index if exists chunks_embedding_idx;

alter table public.chunks alter column embedding type vector(1024);
alter table public.query_cache alter column embedding type vector(1024);

create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

drop function if exists public.match_chunks(vector, float, int, text, uuid);

create or replace function public.match_chunks(
  query_embedding vector(1024),
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

grant execute on function public.match_chunks(vector, float, int, text, uuid) to anon, authenticated;

commit;
