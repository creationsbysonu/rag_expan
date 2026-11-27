import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, preflight } from "../_shared/cors.ts";
import { resolveUser, serviceClient } from "../_shared/supabase.ts";

/**
 * DELETE /functions/v1/documents?id=<uuid>
 *
 * The corpus is public, so deletion is not open to every reader: a document can
 * be removed by the account that uploaded it, or by an admin. Removing it drops
 * its passages (cascade), the stored original, and every cached answer — an
 * answer can cite a passage that no longer exists.
 */
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "DELETE") return json({ message: "Method not allowed" }, 405);

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return json({ message: "A document id is required" }, 400);
  }

  const supabase = serviceClient();
  const { data: document, error: readError } = await supabase
    .from("documents")
    .select("id, title, storage_path, uploaded_by")
    .eq("id", id)
    .maybeSingle();

  if (readError) return json({ message: readError.message }, 500);
  if (!document) return json({ message: "Document not found" }, 404);

  const secret = Deno.env.get("INGEST_SECRET");
  const viaSecret = Boolean(secret) && request.headers.get("x-ingest-secret") === secret;
  const user = viaSecret ? null : await resolveUser(request);

  let allowed = viaSecret;
  if (!allowed) {
    if (!user) return json({ message: "Sign in to remove a document." }, 401);
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
    return json({ message: "Only the uploader or an admin can remove this document." }, 403);
  }

  if (document.storage_path) {
    const { error } = await supabase.storage.from("documents").remove([document.storage_path]);
    if (error) console.error("storage removal failed", error.message);
  }

  const { error: deleteError } = await supabase.from("documents").delete().eq("id", id);
  if (deleteError) return json({ message: deleteError.message }, 500);

  const { error: purgeError } = await supabase
    .from("query_cache")
    .delete()
    .gte("created_at", "1970-01-01T00:00:00Z");
  if (purgeError) console.error("cache purge failed", purgeError.message);

  return json({ deleted: id, title: document.title });
});
