#!/usr/bin/env python3
"""
Finish the Supabase side of the deployment in one shot.

Requires a personal access token (sbp_...) for the account that owns the
project: https://supabase.com/dashboard/account/tokens

Steps:
  1. Enable anonymous sign-ins (the chat UI signs visitors in anonymously).
  2. Push the Edge Function secrets (Gemini key, ingest secret, limits).
  3. Deploy the `chat` and `ingest` functions with --no-verify-jwt.

Usage:
    SUPABASE_ACCESS_TOKEN=sbp_... python3 scripts/deploy_supabase.py
    python3 scripts/deploy_supabase.py --dry-run
    python3 scripts/deploy_supabase.py --only auth|secrets|functions
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CLI = "supabase@2.40.7"
FUNCTIONS = ["chat", "ingest"]
SECRETS = ["GEMINI_API_KEY", "INGEST_SECRET", "RATE_LIMIT_PER_MINUTE", "GEMINI_CHAT_MODEL"]
DEFAULTS = {"RATE_LIMIT_PER_MINUTE": "30", "GEMINI_CHAT_MODEL": "gemini-2.5-flash"}


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


def project_ref() -> str:
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    host = urlparse(url).hostname or ""
    ref = host.split(".")[0] if host else ""
    if not ref:
        raise SystemExit("SUPABASE_URL is not set (or unparseable) in .env")
    return ref


def api(method: str, path: str, token: str, body: dict | list | None = None):
    url = f"https://api.supabase.com{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = resp.read().decode()
            return resp.status, json.loads(payload) if payload else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise SystemExit(f"✗ {method} {path} → {exc.code}: {detail[:400]}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"✗ {method} {path} → network error: {exc.reason}") from exc


def collect_secrets() -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for name in SECRETS:
        if name == "GEMINI_API_KEY":
            value = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_GEMINI_API_KEY", "")
        else:
            value = os.getenv(name, "") or DEFAULTS.get(name, "")
        if not value:
            raise SystemExit(f"✗ {name} is missing from .env")
        out.append({"name": name, "value": value})
    return out


def enable_anonymous(ref: str, token: str, site_url: str | None = None) -> None:
    body: dict[str, object] = {"external_anonymous_users_enabled": True}
    if site_url:
        site_url = site_url.rstrip("/")
        body["site_url"] = site_url
        body["uri_allow_list"] = ",".join(
            [
                f"{site_url}/auth/callback",
                "http://localhost:3000/auth/callback",
            ]
        )
    status, _ = api("PATCH", f"/v1/projects/{ref}/config/auth", token, body)
    print(f"✓ anonymous sign-ins enabled (HTTP {status})")
    if site_url:
        print(f"✓ auth site URL → {site_url} (redirect: {site_url}/auth/callback)")


def push_secrets(ref: str, token: str, secrets: list[dict[str, str]]) -> None:
    status, _ = api("POST", f"/v1/projects/{ref}/secrets", token, secrets)
    names = ", ".join(s["name"] for s in secrets)
    print(f"✓ secrets set (HTTP {status}): {names}")


def deploy_functions(ref: str, token: str) -> None:
    for fn in FUNCTIONS:
        cmd = [
            "npx",
            "--yes",
            CLI,
            "functions",
            "deploy",
            fn,
            "--project-ref",
            ref,
            "--no-verify-jwt",
            "--yes",
        ]
        print(f"→ deploying {fn} …")
        env = {**os.environ, "SUPABASE_ACCESS_TOKEN": token}
        result = subprocess.run(cmd, cwd=PROJECT_ROOT, env=env, capture_output=True, text=True)
        tail = (result.stdout + result.stderr).strip().splitlines()
        if result.returncode != 0:
            print("\n".join(tail[-15:]))
            raise SystemExit(f"✗ deploy of {fn} failed (exit {result.returncode})")
        print(f"✓ {fn} deployed → {[l for l in tail if 'https://' in l][-1:]}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", choices=["auth", "secrets", "functions"])
    parser.add_argument("--site-url", help="production URL for auth redirects, e.g. https://app.vercel.app")
    args = parser.parse_args()

    load_env()
    ref = project_ref()
    token = os.getenv("SUPABASE_ACCESS_TOKEN", "").strip()
    secrets = collect_secrets()

    print(f"project: {ref}")
    print(f"steps:   {args.only or 'auth → secrets → functions'}")
    print(f"secrets: {', '.join(s['name'] for s in secrets)}")

    if args.dry_run:
        print("(dry run — nothing sent)")
        return

    if not token.startswith("sbp_"):
        raise SystemExit(
            "✗ SUPABASE_ACCESS_TOKEN missing.\n"
            "  Create one at https://supabase.com/dashboard/account/tokens "
            "(the account that owns this project), then re-run."
        )

    if args.only in (None, "auth"):
        enable_anonymous(ref, token, args.site_url)
    if args.only in (None, "secrets"):
        push_secrets(ref, token, secrets)
    if args.only in (None, "functions"):
        deploy_functions(ref, token)

    print("\nDone. Test: curl -s -X POST "
          f"'https://{ref}.supabase.co/functions/v1/chat' -H 'Content-Type: application/json' "
          "-d '{\"question\":\"what is the constitution?\"}'")


if __name__ == "__main__":
    main()
