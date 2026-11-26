#!/usr/bin/env python3
"""
Grant the `admin` role to a signed-up account so it can publish documents.

    python3 scripts/grant_admin.py you@example.com

Sign in to the web app at least once first (magic link or anonymous), otherwise
there is no profile row to promote. Uses SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY from .env.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

PROJECT_ROOT = Path(__file__).resolve().parent.parent


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


def call(method: str, url: str, key: str, body: dict | None = None, prefer: str | None = None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("apikey", key)
    request.add_header("Authorization", f"Bearer {key}")
    request.add_header("Content-Type", "application/json")
    if prefer:
        request.add_header("Prefer", prefer)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read().decode()
            return response.status, json.loads(payload) if payload else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise SystemExit(f"✗ {method} {url} → {exc.code}: {detail[:300]}") from exc


def find_user(base: str, key: str, email: str) -> dict:
    _, users = call("GET", f"{base}/auth/v1/admin/users?page=1&per_page=200", key)
    for user in (users or {}).get("users", []):
        if (user.get("email") or "").lower() == email.lower():
            return user
    raise SystemExit(
        f"✗ No account for {email}. Sign in to the web app first, then re-run this script."
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("email", help="email address that signed in to the app")
    args = parser.parse_args()

    load_env()
    base = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base or not key:
        raise SystemExit("✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env")

    project = (urlparse(base).hostname or "").split(".")[0]
    user = find_user(base, key, args.email)
    print(f"project: {project}")
    print(f"user:    {args.email} ({user['id']})")

    status, rows = call(
        "PATCH",
        f"{base}/rest/v1/profiles?id=eq.{user['id']}",
        key,
        {"role": "admin"},
        prefer="return=representation",
    )

    if not rows:
        status, rows = call(
            "POST",
            f"{base}/rest/v1/profiles",
            key,
            {"id": user["id"], "email": args.email, "role": "admin"},
            prefer="return=representation,resolution=merge-duplicates",
        )

    role = (rows or [{}])[0].get("role") if isinstance(rows, list) else None
    print(f"✓ profile updated (HTTP {status}) — role: {role or 'admin'}")
    print("Reload /upload; the publish button is now enabled.")


if __name__ == "__main__":
    sys.exit(main())
