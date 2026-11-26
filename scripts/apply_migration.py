#!/usr/bin/env python3
"""
Apply the Supabase SQL migration over a Postgres connection.

Supabase's direct database host is IPv6-only on most plans, so this script
discovers the IPv4 session pooler for the project's region and falls back to the
direct host. Reads the password from DB_PASSWORD (or a DB_URL override).

Usage:
    export DB_PASSWORD=...
    python scripts/apply_migration.py --dry-run
    python scripts/apply_migration.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MIGRATION = PROJECT_ROOT / "supabase" / "migrations" / "20260101000000_init.sql"

REGIONS = [
    "ap-south-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "ap-northeast-2",
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
    "eu-central-1",
    "eu-central-2",
    "eu-west-1",
    "eu-west-2",
    "eu-west-3",
    "eu-north-1",
    "sa-east-1",
]


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
    if not url:
        raise SystemExit("SUPABASE_URL is not set")
    host = urlparse(url).hostname or ""
    ref = host.split(".")[0]
    if not ref:
        raise SystemExit(f"Could not derive project ref from {url}")
    return ref


def candidates(ref: str) -> list[tuple[str, int, str]]:
    """(host, port, user) combinations to try, most likely first."""
    hosts: list[tuple[str, int, str]] = []
    for prefix in ("aws-0", "aws-1"):
        for region in REGIONS:
            hosts.append((f"{prefix}-{region}.pooler.supabase.com", 5432, f"postgres.{ref}"))
    hosts.append((f"db.{ref}.supabase.co", 5432, "postgres"))
    return hosts


def connect(args: argparse.Namespace):
    import psycopg

    override = os.getenv("DB_URL", "").strip()
    password = os.getenv("DB_PASSWORD", "").strip()
    if not override and not password:
        raise SystemExit("Set DB_PASSWORD (Project Settings -> Database) or DB_URL")

    if override:
        print("→ connecting via DB_URL")
        return psycopg.connect(override, connect_timeout=10)

    ref = project_ref()
    last_error: Exception | None = None
    for host, port, user in candidates(ref):
        if args.host and host != args.host:
            continue
        try:
            conn = psycopg.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                dbname="postgres",
                sslmode="require",
                connect_timeout=6,
            )
            print(f"→ connected: {host}:{port} as {user}")
            return conn
        except Exception as exc:  # noqa: BLE001 - probing hosts
            last_error = exc
            print(f"  · {host}: {str(exc).strip().splitlines()[0][:90]}")

    raise SystemExit(f"No reachable database host. Last error: {last_error}")


def apply(conn, sql: str) -> None:
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="connect and report, change nothing")
    parser.add_argument("--file", default=str(MIGRATION))
    parser.add_argument("--host", help="only try this host")
    args = parser.parse_args()

    load_env()
    sql = Path(args.file).read_text(encoding="utf-8")
    print(f"migration: {Path(args.file).name} ({len(sql.splitlines())} lines)")

    conn = connect(args)
    try:
        if args.dry_run:
            with conn.cursor() as cur:
                cur.execute("select current_database(), current_user, version()")
                print("server:", cur.fetchone())
                cur.execute(
                    "select count(*) from information_schema.tables "
                    "where table_schema = 'public'"
                )
                print("public tables:", cur.fetchone()[0])
            print("Dry run only. Nothing was applied.")
            return

        apply(conn, sql)
        print("✓ migration applied")

        with conn.cursor() as cur:
            cur.execute(
                "select table_name from information_schema.tables "
                "where table_schema = 'public' order by table_name"
            )
            tables = [row[0] for row in cur.fetchall()]
            cur.execute(
                "select routine_name from information_schema.routines "
                "where routine_schema = 'public' order by routine_name"
            )
            functions = [row[0] for row in cur.fetchall()]
        print("tables:", ", ".join(tables))
        print("functions:", ", ".join(functions))
    except Exception as exc:
        conn.rollback()
        print(f"✗ failed: {exc}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
