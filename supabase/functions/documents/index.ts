import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, preflight } from "../_shared/cors.ts";
import { resolveUser, serviceClient } from "../_shared/supabase.ts";

/**
 * Document lifecycle. Every route is authorised for the uploader, an admin, or
 * the shared ingest secret (scripted cleanup).
 *
 *   DELETE /functions/v1/documents?id=<uuid>            → move to trash
 *   POST   /functions/v1/documents?id=<uuid>&action=restore → back into the corpus
 *   POST   /functions/v1/documents?id=<uuid>&action=purge   → delete permanently
 *
 * Trash is a soft delete: the row keeps its passages and stored original for
 * seven days (mirrors `public.trash_retention()`), hidden from retrieval, so a
 * restore is instant. Anything older is purged on the next call.
 */
const RETENTION_DAYS = 7;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

type DocumentRow = {
  id: string;
  title: string;
  storage_path: string | null;
  uploaded_by: string | null;
  deleted_at: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Supabase = ReturnType<typeof serviceClient>;

async function purgeExpired(supabase: Supabase) {
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  const { data } = await supabase
    .from("documents")
    .select("id, storage_path")
    .lt("deleted_at", cutoff);

  const expired = (data ?? []) as { id: string; storage_path: string | null }[];
  if (expired.length === 0) return 0;

  const paths = expired.map((row) => row.storage_path).filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error } = await supabase.storage.from("documents").remove(paths);
    if (error) console.error("storage removal failed", error.message);
  }

  const { error } = await supabase
    .from("documents")
    .delete()
    .in("id", expired.map((row) => row.id));
  if (error) console.error("expired trash purge failed", error.message);
  return expired.length;
}

async function purgeAnswerCache(supabase: Supabase) {
  // A cached answer can cite a passage that is no longer retriable (or is new
  // again after a restore), so any corpus change clears the cache.
  const { error } = await supabase
    .from("query_cache")
    .delete()
    .gte("created_at", "1970-01-01T00:00:00Z");
  if (error) console.error("cache purge failed", error.message);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "DELETE" && request.method !== "POST") {
    return json({ message: "Method not allowed" }, 405);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const action = url.searchParams.get("action") ?? "trash";
  if (!UUID.test(id)) return json({ message: "A document id is required" }, 400);
  if (!["trash", "restore", "purge"].includes(action)) {
    return json({ message: "action must be one of trash, restore, purge" }, 400);
  }

  const supabase = serviceClient();
  const purged = await purgeExpired(supabase);

  const { data, error: readError } = await supabase
    .from("documents")
    .select("id, title, storage_path, uploaded_by, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (readError) return json({ message: readError.message }, 500);
  if (!data) return json({ message: "Document not found" }, 404);
  const document = data as DocumentRow;

  const secret = Deno.env.get("INGEST_SECRET");
  const viaSecret = Boolean(secret) && request.headers.get("x-ingest-secret") === secret;
  const user = viaSecret ? null : await resolveUser(request);

  let allowed = viaSecret;
  if (!allowed) {
    if (!user) return json({ message: "Sign in to change a document." }, 401);
    if (document.uploaded_by === user.id) {
      allowed = true;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      allowed = profile?.role === "admin";
    }
  }
  if (!allowed) {
    return json({ message: "Only the uploader or an admin can change this document." }, 403);
  }

  if (action === "trash") {
    if (document.deleted_at) {
      return json({ id, title: document.title, deleted_at: document.deleted_at }, 200);
    }
    const now = new Date();
    const { error } = await supabase
      .from("documents")
      .update({ deleted_at: now.toISOString(), deleted_by: user?.id ?? null })
      .eq("id", id);
    if (error) return json({ message: error.message }, 500);
    await purgeAnswerCache(supabase);
    return json({
      deleted: id,
      title: document.title,
      purge_at: new Date(now.getTime() + RETENTION_MS).toISOString(),
      purged_expired: purged,
    });
  }

  if (action === "restore") {
    if (!document.deleted_at) {
      return json({ id, title: document.title, restored: true }, 200);
    }
    if (Date.now() - new Date(document.deleted_at).getTime() > RETENTION_MS) {
      return json(
        { message: "The restore window has passed; this document can no longer be restored.", code: "restore_expired" },
        410,
      );
    }
    const { error } = await supabase
      .from("documents")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", id);
    if (error) return json({ message: error.message }, 500);
    await purgeAnswerCache(supabase);
    return json({ restored: id, title: document.title });
  }

  // purge: permanent, from trash or directly by an operator.
  if (document.storage_path) {
    const { error } = await supabase.storage.from("documents").remove([document.storage_path]);
    if (error) console.error("storage removal failed", error.message);
  }
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return json({ message: error.message }, 500);
  await purgeAnswerCache(supabase);
  return json({ purged: id, title: document.title, purged_expired: purged });
});
