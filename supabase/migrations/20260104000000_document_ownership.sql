-- Ownership for uploads.
--
-- A public corpus cannot be deletable by every reader, but whoever published a
-- document must be able to retract it without an operator. Ingest records the
-- authenticated uploader here; deletes are authorised by the `documents` Edge
-- Function (uploader or admin), which also removes the stored file and purges
-- the answer cache.

alter table public.documents
  add column if not exists uploaded_by uuid references auth.users (id) on delete set null;

create index if not exists documents_uploaded_by_idx on public.documents (uploaded_by);

-- Rows ingested with the shared secret have no owner: only an admin can remove them.
comment on column public.documents.uploaded_by is
  'Authenticated user who ingested this document; null when published with the ingest secret.';
