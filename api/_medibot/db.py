"""Storage for MediBot.

Production: PostgreSQL (Neon, via Vercel Storage) using the pure-Python pg8000
driver, read from DATABASE_URL / POSTGRES_URL.
Local / not yet connected: SQLite. On Vercel without a database the SQLite file
lives in /tmp and is temporary, so /api/health reports `database: "temporary"`.

All tables use the `mb_` prefix so MediBot can share a database with other apps.
SQL is written once with %s placeholders and converted for SQLite.
"""
from __future__ import annotations

import json
import os
import sqlite3
import ssl
import threading
import uuid
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse

URL = (os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
       or os.environ.get("POSTGRES_PRISMA_URL") or os.environ.get("NEON_DATABASE_URL") or "")
KIND = "postgres" if URL.startswith(("postgres://", "postgresql://")) else "sqlite"

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS mb_users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, pass_hash TEXT NOT NULL,
       lang TEXT DEFAULT 'en', age_group TEXT, sex TEXT, conditions TEXT, created_at TEXT)""",
    "CREATE TABLE IF NOT EXISTS mb_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT, expires_at TEXT)",
    """CREATE TABLE IF NOT EXISTS mb_conversations (id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT, lang TEXT,
       created_at TEXT, updated_at TEXT)""",
    """CREATE TABLE IF NOT EXISTS mb_messages (id TEXT PRIMARY KEY, conv_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT,
       meta TEXT, type TEXT, topics TEXT, engine TEXT, rating INTEGER, created_at TEXT)""",
    "CREATE TABLE IF NOT EXISTS mb_checks (id TEXT PRIMARY KEY, owner TEXT, payload TEXT, level TEXT, topics TEXT, created_at TEXT)",
    """CREATE TABLE IF NOT EXISTS mb_reminders (id TEXT PRIMARY KEY, owner TEXT NOT NULL, medicine TEXT NOT NULL, dose TEXT,
       times TEXT, days INTEGER, notes TEXT, active INTEGER DEFAULT 1, created_at TEXT)""",
    "CREATE TABLE IF NOT EXISTS mb_events (id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner TEXT, detail TEXT, created_at TEXT)",
    "CREATE TABLE IF NOT EXISTS mb_contacts (id TEXT PRIMARY KEY, name TEXT, email TEXT, message TEXT, created_at TEXT)",
    "CREATE INDEX IF NOT EXISTS mb_msg_conv ON mb_messages (conv_id)",
    "CREATE INDEX IF NOT EXISTS mb_conv_owner ON mb_conversations (owner)",
    "CREATE INDEX IF NOT EXISTS mb_rem_owner ON mb_reminders (owner)",
    "CREATE INDEX IF NOT EXISTS mb_evt_kind ON mb_events (kind)",
]

_lock = threading.Lock()
_conn = None
_ready = False


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def new_id() -> str:
    return uuid.uuid4().hex


def _connect():
    if KIND == "postgres":
        import pg8000.dbapi
        u = urlparse(URL)
        ctx = ssl.create_default_context()
        return pg8000.dbapi.connect(user=unquote(u.username or ""), password=unquote(u.password or ""), host=u.hostname,
                                    port=u.port or 5432, database=(u.path or "/postgres").lstrip("/") or "postgres",
                                    ssl_context=ctx, timeout=10)
    path = os.environ.get("SQLITE_PATH") or ("/tmp/medibot.sqlite3" if os.environ.get("VERCEL") else
                                             os.path.join(os.path.dirname(__file__), "..", "..", "medibot.sqlite3"))
    c = sqlite3.connect(path, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def _q(sql: str) -> str:
    return sql if KIND == "postgres" else sql.replace("%s", "?")


def _get():
    global _conn, _ready
    if _conn is None:
        _conn = _connect()
    if not _ready:
        cur = _conn.cursor()
        for s in SCHEMA:
            cur.execute(s)
        _conn.commit()
        _ready = True
    return _conn


def _run(sql: str, args: tuple = (), fetch: str | None = None):
    global _conn, _ready
    with _lock:
        for attempt in (1, 2):
            try:
                c = _get()
                cur = c.cursor()
                cur.execute(_q(sql), args)
                rows = None
                if fetch:
                    cols = [d[0] for d in cur.description] if cur.description else []
                    data = cur.fetchall() if fetch == "all" else ([cur.fetchone()] if cur.description else [])
                    rows = [dict(zip(cols, tuple(r))) for r in data if r is not None]
                c.commit()
                return rows if fetch == "all" else (rows[0] if rows else None) if fetch == "one" else None
            except Exception:
                # a dropped serverless connection: reconnect once
                try:
                    _conn and _conn.rollback()
                except Exception:
                    pass
                if attempt == 2 or KIND == "sqlite":
                    raise
                _conn, _ready = None, False


def all(sql: str, *args):  # noqa: A001 - short helper names keep the API code readable
    return _run(sql, args, "all") or []


def one(sql: str, *args):
    return _run(sql, args, "one")


def run(sql: str, *args) -> None:
    _run(sql, args)


def status() -> dict:
    try:
        one("SELECT 1 AS ok")
        ok = True
    except Exception:
        ok = False
    persistent = KIND == "postgres" or not os.environ.get("VERCEL")
    return {"kind": KIND, "ok": ok, "persistent": persistent}


# ------------------------------------------------------------- helpers

def log_event(kind: str, owner: str | None = None, **detail) -> None:
    try:
        run("INSERT INTO mb_events (id, kind, owner, detail, created_at) VALUES (%s,%s,%s,%s,%s)",
            new_id(), kind, owner, json.dumps(detail, ensure_ascii=False)[:4000], now())
    except Exception:
        pass  # analytics must never break a reply
