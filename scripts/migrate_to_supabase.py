#!/usr/bin/env python3
"""
Migrate the existing MySQL corpus (documents + chunks) into Supabase.

Chunk text is re-embedded with Gemini's `gemini-embedding-001` at 768
dimensions so that query embeddings produced by the `chat` Edge Function live in
the same vector space. Existing E5 vectors are intentionally not reused.

Usage:
    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=...
    export GEMINI_API_KEY=...
    python scripts/migrate_to_supabase.py --dry-run
    python scripts/migrate_to_supabase.py
    python scripts/migrate_to_supabase.py --replace --limit 25
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import httpx
import pymysql

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rag.config import settings  # noqa: E402


def load_project_env() -> None:
    """Load KEY=VALUE pairs from the project .env without overriding real env vars."""
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_project_env()

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
EMBED_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
DIMS = 768

# Embedding provider: "gemini" (default) or "cloudflare" (Workers AI).
# Must match LLM_PROVIDER in the Edge Functions, or queries and passages end up
# in different vector spaces.
PROVIDER = (os.getenv("LLM_PROVIDER") or "gemini").lower()
CF_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
CF_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")
CF_EMBED_MODEL = os.getenv("CF_EMBED_MODEL", "@cf/baai/bge-base-en-v1.5")
CF_MAX_CHARS = 2000  # bge-base-en-v1.5 accepts 512 tokens
BATCH = 8
PAUSE_SECONDS = float(os.getenv("EMBED_PAUSE", "1.2"))
TOTAL_CHUNKS = 0


@dataclass
class Document:
    id: int
    title: str
    ministry: str | None
    service_name: str | None
    notice_id: str | None
    published_at: str | None
    source_url: str | None
    chunks: list[tuple[int, str]]


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


def normalise_date(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(r"(\d{4})-(\d{2})-(\d{2})", value)
    return match.group(0) if match else None


def load_from_mysql(limit: int | None) -> list[Document]:
    connection = pymysql.connect(
        host=settings.mysql_host,
        user=settings.mysql_user,
        password=settings.mysql_password,
        database=settings.mysql_database,
        port=settings.mysql_port,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, ministry, title, upload_date, path, notice_id, service_name
            FROM documents
            ORDER BY id
            """
        )
        rows = cursor.fetchall()

        if limit:
            rows = rows[:limit]

        documents: list[Document] = []
        for row in rows:
            cursor.execute(
                "SELECT chunk_order, text FROM chunks WHERE document_id = %s ORDER BY chunk_order",
                (row["id"],),
            )
            chunks = [
                (int(chunk["chunk_order"] or index), (chunk["text"] or "").strip())
                for index, chunk in enumerate(cursor.fetchall())
                if (chunk["text"] or "").strip()
            ]
            documents.append(
                Document(
                    id=int(row["id"]),
                    title=(row["title"] or f"Document {row['id']}").strip(),
                    ministry=(row["ministry"] or None),
                    service_name=(row["service_name"] or None),
                    notice_id=(str(row["notice_id"]) if row["notice_id"] else None),
                    published_at=normalise_date(row["upload_date"]),
                    source_url=(row["path"] or None),
                    chunks=chunks,
                )
            )

    connection.close()

    # MySQL holds the same file under several document rows; keep the copy with
    # the most chunks so the corpus is not embedded (and overwritten) twice.
    unique: dict[str, Document] = {}
    for document in documents:
        key = re.sub(r"\s+", " ", document.title.lower())
        current = unique.get(key)
        if current is None:
            unique[key] = document
        elif len(document.chunks) > len(current.chunks):
            print(f"  · duplicate skipped: {current.title} (id {current.id})")
            unique[key] = document
        else:
            print(f"  · duplicate skipped: {document.title} (id {document.id})")

    return list(unique.values())


def cf_embed_batch(client: httpx.Client, texts: list[str]) -> list[list[float]]:
    """Embeddings from Cloudflare Workers AI (OpenAI-compatible endpoint)."""
    if not CF_ACCOUNT_ID or not CF_API_TOKEN:
        raise RuntimeError(
            "LLM_PROVIDER=cloudflare needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env"
        )

    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/v1/embeddings"
    last_error = ""
    for attempt in range(6):
        response = client.post(
            url,
            headers={"Authorization": f"Bearer {CF_API_TOKEN}"},
            json={"model": CF_EMBED_MODEL, "input": [t[:CF_MAX_CHARS] for t in texts]},
            timeout=120,
        )
        if response.status_code == 429 or response.status_code >= 500:
            last_error = f"HTTP {response.status_code}: {response.text[:300]}"
            wait = min(2 ** (attempt + 1), 45)
            print(f"    · Cloudflare rate limited, retrying in {wait}s")
            time.sleep(wait)
            continue
        if response.status_code >= 400:
            raise RuntimeError(f"Cloudflare embedding failed: HTTP {response.status_code}: {response.text[:400]}")

        vectors = [item.get("embedding", []) for item in response.json().get("data", [])]
        if len(vectors) != len(texts):
            raise RuntimeError("Cloudflare embedding count mismatch")
        for vector in vectors:
            if len(vector) != DIMS:
                raise RuntimeError(
                    f"{CF_EMBED_MODEL} returned {len(vector)} dimensions, expected {DIMS} — "
                    "the pgvector column is 768, so pick a 768-dim embedding model"
                )
        return vectors

    raise RuntimeError(f"Cloudflare embedding failed after retries. Last error: {last_error}")


def embed_batch(client: httpx.Client, api_key: str, texts: Iterable[str]) -> list[list[float]]:
    texts = list(texts)
    if PROVIDER == "cloudflare":
        return cf_embed_batch(client, texts)
    payload = {
        "requests": [
            {
                "model": f"models/{EMBED_MODEL}",
                "content": {"parts": [{"text": text[:8000]}]},
                "taskType": "RETRIEVAL_DOCUMENT",
                "outputDimensionality": DIMS,
            }
            for text in texts
        ]
    }

    last_error = ""
    for attempt in range(6):
        response = client.post(
            f"{GEMINI_BASE}/models/{EMBED_MODEL}:batchEmbedContents",
            params={"key": api_key},
            json=payload,
            timeout=120,
        )
        if response.status_code == 429 or response.status_code >= 500:
            last_error = f"HTTP {response.status_code}: {response.text[:300]}"
            if "per day limit" in response.text or "RESOURCE_EXHAUSTED" in response.text:
                raise RuntimeError(
                    "Daily embedding quota exhausted for this API key. Free tier allows "
                    "1,000 embed requests/day; the corpus needs "
                    f"{TOTAL_CHUNKS}. Re-run tomorrow, "
                    "enable billing on the key, or pass a key with higher quota."
                )
            wait = min(2 ** (attempt + 1), 45)
            print(f"    · rate limited ({response.status_code}), retrying in {wait}s")
            time.sleep(wait)
            continue
        if response.status_code >= 400:
            raise RuntimeError(f"Embedding failed: HTTP {response.status_code}: {response.text[:400]}")
        embeddings = response.json().get("embeddings", [])
        if len(embeddings) != len(texts):
            raise RuntimeError("Embedding count mismatch")
        return [item["values"] for item in embeddings]

    raise RuntimeError(f"Embedding failed after retries. Last error: {last_error}")


class Supabase:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.client = httpx.Client(
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            timeout=120,
        )

    def find_document(self, notice_id: str | None, title: str) -> dict | None:
        if notice_id:
            response = self.client.get(
                f"{self.url}/rest/v1/documents",
                params={"notice_id": f"eq.{notice_id}", "select": "id"},
            )
            response.raise_for_status()
            rows = response.json()
            if rows:
                return rows[0]
        response = self.client.get(
            f"{self.url}/rest/v1/documents",
            params={"title": f"eq.{title}", "select": "id"},
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else None

    def insert_document(self, payload: dict) -> str:
        response = self.client.post(f"{self.url}/rest/v1/documents", json=payload)
        response.raise_for_status()
        return response.json()[0]["id"]

    def delete_chunks(self, document_id: str) -> None:
        response = self.client.delete(
            f"{self.url}/rest/v1/chunks", params={"document_id": f"eq.{document_id}"}
        )
        response.raise_for_status()

    def insert_chunks(self, rows: list[dict]) -> None:
        for offset in range(0, len(rows), 50):
            batch = [
                {**row, "embedding": "[" + ",".join(f"{v:.7f}" for v in row["embedding"]) + "]"}
                for row in rows[offset : offset + 50]
            ]
            response = self.client.post(
                f"{self.url}/rest/v1/chunks",
                params={"on_conflict": "document_id,chunk_index"},
                json=batch,
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            )
            if response.status_code >= 400:
                raise RuntimeError(f"chunk insert failed: {response.status_code} {response.text[:300]}")

    def update_document(self, document_id: str, payload: dict) -> None:
        response = self.client.patch(
            f"{self.url}/rest/v1/documents",
            params={"id": f"eq.{document_id}"},
            json=payload,
        )
        response.raise_for_status()


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate MySQL corpus to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Read and embed nothing; report only")
    parser.add_argument("--limit", type=int, default=None, help="Only migrate the first N documents")
    parser.add_argument("--replace", action="store_true", help="Replace chunks of existing documents")
    parser.add_argument("--skip-existing", action="store_true", help="Skip documents already present")
    args = parser.parse_args()

    documents = load_from_mysql(args.limit)
    total_chunks = sum(len(document.chunks) for document in documents)
    global TOTAL_CHUNKS
    TOTAL_CHUNKS = total_chunks
    print(f"Loaded {len(documents)} documents / {total_chunks} chunks from MySQL")

    if args.dry_run:
        for document in documents[:10]:
            print(f"  · {document.title} — {len(document.chunks)} chunks, notice={document.notice_id}")
        print("Dry run complete. Nothing was written.")
        return

    supabase_url = require_env("SUPABASE_URL")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    if PROVIDER == "cloudflare":
        api_key = ""  # unused, but embed_batch keeps one signature for both paths
        require_env("CLOUDFLARE_ACCOUNT_ID")
        require_env("CLOUDFLARE_API_TOKEN")
    else:
        api_key = (
            require_env("GEMINI_API_KEY")
            if not os.getenv("GOOGLE_GEMINI_API_KEY")
            else os.environ["GOOGLE_GEMINI_API_KEY"]
        )
    print(f"embeddings: {PROVIDER}" + (f" ({CF_EMBED_MODEL})" if PROVIDER == "cloudflare" else f" ({EMBED_MODEL})"))

    supabase = Supabase(supabase_url, service_key)
    embedded = 0

    with httpx.Client() as gemini:
        for index, document in enumerate(documents, start=1):
            existing = supabase.find_document(document.notice_id, document.title)

            if existing and args.skip_existing:
                print(f"[{index}/{len(documents)}] skip {document.title}")
                continue

            if existing:
                if not args.replace:
                    print(
                        f"[{index}/{len(documents)}] exists, replacing chunks "
                        f"(pass --skip-existing to skip): {document.title}"
                    )
                supabase.delete_chunks(existing["id"])
                document_id = existing["id"]
            else:
                document_id = supabase.insert_document(
                    {
                        "notice_id": document.notice_id,
                        "title": document.title,
                        "ministry": document.ministry,
                        "service_name": document.service_name,
                        "source_url": document.source_url,
                        "language": "ne",
                        "published_at": document.published_at,
                        "chunk_count": len(document.chunks),
                        "ingest_status": "pending",
                    }
                )

            if not document.chunks:
                print(f"[{index}/{len(documents)}] {document.title} — no chunks, skipped")
                continue

            rows: list[dict] = []
            for offset in range(0, len(document.chunks), BATCH):
                batch = document.chunks[offset : offset + BATCH]
                vectors = embed_batch(gemini, api_key, [text for _, text in batch])
                for (order, text), vector in zip(batch, vectors):
                    rows.append(
                        {
                            "document_id": document_id,
                            "chunk_index": order,
                            "content": text,
                            "token_count": len(text.split()),
                            "embedding": vector,
                        }
                    )
                embedded += len(batch)
                if PAUSE_SECONDS:
                    time.sleep(PAUSE_SECONDS)

            supabase.insert_chunks(rows)
            supabase.update_document(
                document_id, {"ingest_status": "ready", "chunk_count": len(rows)}
            )
            print(
                f"[{index}/{len(documents)}] {document.title} — {len(rows)} chunks embedded"
                f" ({embedded} total)"
            )

    print(f"Done. {embedded} chunks embedded into {supabase_url}")


if __name__ == "__main__":
    main()
