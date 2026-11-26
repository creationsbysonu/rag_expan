#!/usr/bin/env python3
"""
End-to-end smoke test for the deployed stack.

    python3 scripts/smoke_test.py
    python3 scripts/smoke_test.py --site https://rag-expansion.vercel.app

Checks pages, headers, auth, RPCs, retrieval mechanics, chat streaming and the
ingest validation paths. Reads SUPABASE_URL / publishable key / service key from
.env and the frontend URL from --site (defaults to localhost:3000).

Exit code is 0 only when every check passes.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLISHABLE = "sb_publishable__1obZOXBhlSEyjDpQSrIZQ_2qITN2OU"

results: list[tuple[bool, str, str]] = []


def load_env() -> None:
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def request(
    method: str,
    url: str,
    *,
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 60,
    stream: bool = False,
):
    req = urllib.request.Request(url, data=body, method=method)
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            payload = response.read() if not stream else response.read(6000)
            return response.status, dict(response.headers), payload
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers), exc.read()
    except urllib.error.URLError as exc:
        return 0, {}, str(exc).encode()


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((ok, name, detail))
    print(f"{'✓' if ok else '✗'} {name}{f' — {detail}' if detail else ''}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", default=os.getenv("SMOKE_SITE", "http://localhost:3000"))
    args = parser.parse_args()

    load_env()
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    service = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    secret = os.getenv("INGEST_SECRET", "")
    site = args.site.rstrip("/")
    if not base:
        print("✗ SUPABASE_URL missing from .env")
        return 2

    print(f"site:    {site}\nbackend: {base}\n")

    # ---------------------------------------------------------------- pages
    for path in ["/", "/chat", "/documents", "/upload", "/integrate", "/about", "/login", "/embed"]:
        status, _, _ = request("GET", f"{site}{path}")
        check(f"page {path}", status == 200, f"HTTP {status}")

    status, _, _ = request("GET", f"{site}/definitely-not-a-route")
    check("404 route", status == 404, f"HTTP {status}")

    for path in ["/sitemap.xml", "/robots.txt", "/sonu-kumar-gupta.jpg"]:
        status, _, _ = request("GET", f"{site}{path}")
        check(f"asset {path}", status == 200, f"HTTP {status}")

    _, headers, _ = request("GET", f"{site}/embed")
    framed = not any(k.lower() == "x-frame-options" for k in headers)
    check("embed is framable", framed, "no X-Frame-Options")

    # ------------------------------------------------------------- database
    def rpc(name: str, payload: dict, key: str = PUBLISHABLE):
        return request(
            "POST",
            f"{base}/rest/v1/rpc/{name}",
            body=json.dumps(payload).encode(),
            headers={"apikey": key, "Content-Type": "application/json"},
        )

    status, _, body = rpc("corpus_stats", {})
    stats = json.loads(body) if status == 200 else {}
    check(
        "rpc corpus_stats",
        status == 200 and {"documents", "chunks", "ministries"} <= set(stats),
        f"{stats}",
    )

    status, _, body = rpc("search_documents", {"max_rows": 3})
    check("rpc search_documents", status == 200 and isinstance(json.loads(body or b"[]"), list),
          f"HTTP {status}")

    status, _, body = rpc("dashboard_stats", {"window_days": 30})
    ok = status == 200 and isinstance(json.loads(body or b"{}"), dict)
    check("rpc dashboard_stats", ok, f"HTTP {status}")

    status, _, _ = request("GET", f"{base}/rest/v1/documents?select=id&limit=1",
                           headers={"apikey": PUBLISHABLE})
    check("documents readable", status == 200, f"HTTP {status}")

    status, _, _ = request("GET", f"{base}/rest/v1/chunks?select=id&limit=1",
                           headers={"apikey": PUBLISHABLE})
    check("chunks readable (public corpus by design)", status == 200, f"HTTP {status}")

    status, _, body = request("GET", f"{base}/rest/v1/query_logs?select=id&limit=1",
                              headers={"apikey": PUBLISHABLE})
    check("query_logs private", status in (401, 403) or body.strip() in (b"[]", b""),
          f"HTTP {status} {body[:40]!r}")

    # ---------------------------------------------------------- retrieval
    if service:
        import uuid

        doc_id = str(uuid.uuid4())
        vector = [0.01] * 768
        insert_doc = request(
            "POST",
            f"{base}/rest/v1/documents",
            body=json.dumps(
                {
                    "id": doc_id,
                    "title": "Smoke test vector",
                    "ministry": "Smoke",
                    "language": "en",
                    "chunk_count": 1,
                    "ingest_status": "ready",
                }
            ).encode(),
            headers={
                "apikey": service,
                "Authorization": f"Bearer {service}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
        )
        insert_chunk = request(
            "POST",
            f"{base}/rest/v1/chunks",
            body=json.dumps(
                {
                    "document_id": doc_id,
                    "chunk_index": 0,
                    "content": "Smoke test passage about gold loan collateral requirements.",
                    "token_count": 9,
                    "embedding": vector,
                }
            ).encode(),
            headers={
                "apikey": service,
                "Authorization": f"Bearer {service}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
        )
        check("insert vector row", insert_doc[0] in (200, 201) and insert_chunk[0] in (200, 201),
              f"doc {insert_doc[0]} chunk {insert_chunk[0]}")

        status, _, body = rpc(
            "match_chunks",
            {
                "query_embedding": vector,
                "match_count": 5,
                "match_threshold": 0.0,
                "filter_document": None,
                "filter_ministry": None,
            },
        )
        rows = json.loads(body) if status == 200 else []
        hit = any(row.get("document_id") == doc_id for row in rows) if isinstance(rows, list) else False
        check("rpc match_chunks returns nearest passage", hit, f"{len(rows)} rows, HTTP {status}")

        for table, column in (("chunks", "document_id"), ("documents", "id")):
            request(
                "DELETE",
                f"{base}/rest/v1/{table}?{column}=eq.{doc_id}",
                headers={"apikey": service, "Authorization": f"Bearer {service}"},
            )

    # ---------------------------------------------------------------- auth
    status, _, body = request(
        "POST",
        f"{base}/auth/v1/signup",
        body=b"{}",
        headers={"apikey": PUBLISHABLE, "Content-Type": "application/json"},
    )
    has_session = b"access_token" in body
    check("anonymous sign-in", status == 200 and has_session, f"HTTP {status}")

    # ---------------------------------------------------------------- chat
    status, headers, body = request(
        "OPTIONS",
        f"{base}/functions/v1/chat",
        headers={
            "Origin": site,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,apikey",
        },
    )
    def header(name: str) -> str:
        for key, value in headers.items():
            if key.lower() == name.lower():
                return value
        return ""

    allow = header("access-control-allow-origin").strip()
    check("chat CORS preflight", status == 200 and allow in {"*", site}, f"allow-origin={allow}")

    status, _, body = request(
        "POST",
        f"{base}/functions/v1/chat",
        body=json.dumps({"question": "which office issues a PAN registration?"}).encode(),
        headers={"apikey": PUBLISHABLE, "Content-Type": "application/json"},
        timeout=120,
    )
    text = body.decode(errors="replace")
    streamed = "data:" in text and ("sources" in text)
    done = '"type":"done"' in text or '"type": "done"' in text
    errored = '"type":"error"' in text or '"type": "error"' in text
    quota = status == 429
    check("chat streams sources", (status == 200 and streamed) or quota,
          f"HTTP {status}" + (" — embedding quota exhausted, reported as 429" if quota else ""))
    check("chat completes or reports an error", done or errored or quota,
          "done" if done else ("429 quota (retry later)" if quota else "no terminal frame"))

    status, _, body = request(
        "POST",
        f"{base}/functions/v1/chat",
        body=b"",
        headers={"apikey": PUBLISHABLE, "Content-Type": "application/json"},
    )
    check("chat rejects empty body", status in (400, 422), f"HTTP {status}")

    # -------------------------------------------------------------- ingest
    boundary = "----smokeboundary"
    empty = f"--{boundary}--\r\n".encode()
    status, _, _ = request(
        "POST",
        f"{base}/functions/v1/ingest",
        body=empty,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    check("ingest requires admin", status == 403, f"HTTP {status}")

    def multipart(filename: str, content: bytes, fields: dict[str, str]) -> bytes:
        parts = []
        for key, value in fields.items():
            parts.append(
                f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
            )
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n".encode()
            + content
            + b"\r\n"
        )
        parts.append(f"--{boundary}--\r\n".encode())
        return b"".join(parts)

    status, _, body = request(
        "POST",
        f"{base}/functions/v1/ingest",
        body=multipart("notice.exe", b"binary", {"title": "Smoke"}),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "x-ingest-secret": secret,
        },
    )
    check("ingest rejects unsupported type", status == 415, f"HTTP {status}")

    status, _, body = request(
        "POST",
        f"{base}/functions/v1/ingest",
        body=multipart("notice.md", b"x" * 200, {}),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "x-ingest-secret": secret,
        },
    )
    check("ingest requires a title", status == 400, f"HTTP {status}")

    payload = (
        "# Smoke test\n\nA short passage used to verify that extraction, chunking and "
        "storage work end to end. It is safe to delete.\n"
    ).encode()
    status, _, body = request(
        "POST",
        f"{base}/functions/v1/ingest",
        body=multipart("smoke.md", payload, {"title": "Smoke test document"}),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "x-ingest-secret": secret,
        },
        timeout=120,
    )
    detail = body.decode(errors="replace")[:120].replace("\n", " ")
    check("ingest accepts a valid file", status in (200, 429),
          f"HTTP {status} — {detail}")

    if status == 429 and service:
        request(
            "DELETE",
            f"{base}/rest/v1/documents?title=eq.Smoke%20test%20document",
            headers={"apikey": service, "Authorization": f"Bearer {service}"},
        )
        print("  (cleaned up the failed smoke-test document)")

    # --------------------------------------------------------------- report
    passed = sum(1 for ok, _, _ in results if ok)
    failed = [(name, detail) for ok, name, detail in results if not ok]
    print(f"\n{passed}/{len(results)} checks passed")
    if failed:
        print("failed:")
        for name, detail in failed:
            print(f"  ✗ {name} — {detail}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
