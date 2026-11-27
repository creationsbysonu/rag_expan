-- The 768-dim overload was left behind by the bilingual migration. It has the
-- same parameter names as the 1024-dim function, so PostgREST could resolve an
-- RPC call to a version that does not exclude trashed documents (and whose
-- vectors no longer exist). Only the 1024-dim signature is supported.
drop function if exists public.match_chunks(vector(768), double precision, integer, text, uuid);
