"""Staff & admin panel API.

Two access levels, set as Vercel environment variables:
  ADMIN_PASSWORD  – full access: dashboard, all records, delete, backup/export
  STAFF_PASSWORD  – view-only: dashboard and records (no export, no delete)
The password is sent in the `x-admin-key` header by /admin.
Password hashes and session tokens are never returned.
"""
from __future__ import annotations

import csv
import hmac
import io
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from . import db, engine, llm

router = APIRouter(prefix="/api/admin", tags=["admin"])

# columns exported per table (never pass_hash or session tokens)
TABLES = {
    "users": "id, email, name, lang, age_group, sex, conditions, created_at",
    "conversations": "id, owner, title, lang, created_at, updated_at",
    "messages": "id, conv_id, role, content, type, topics, engine, rating, created_at",
    "checks": "id, owner, payload, level, topics, created_at",
    "reminders": "id, owner, medicine, dose, times, days, notes, active, created_at",
    "events": "id, kind, owner, detail, created_at",
    "contacts": "id, name, email, message, created_at",
}


def role(request: Request) -> str:
    admin_pw, staff_pw = os.environ.get("ADMIN_PASSWORD"), os.environ.get("STAFF_PASSWORD")
    if not admin_pw and not staff_pw:
        raise HTTPException(503, "Set ADMIN_PASSWORD (and optionally STAFF_PASSWORD) in Vercel to enable the admin panel.")
    given = request.headers.get("x-admin-key", "")
    if admin_pw and hmac.compare_digest(given, admin_pw):
        return "admin"
    if staff_pw and hmac.compare_digest(given, staff_pw):
        return "staff"
    raise HTTPException(401, "Wrong password.")


def admin_only(r: str = Depends(role)) -> str:
    if r != "admin":
        raise HTTPException(403, "Only the admin can do this.")
    return r


def _count(sql: str, *a) -> int:
    r = db.one(sql, *a)
    return int(list(r.values())[0] or 0) if r else 0


def _who(owner: str | None, emails: dict) -> str:
    if not owner:
        return "–"
    if owner.startswith("u:"):
        return emails.get(owner[2:], "registered user")
    return "guest " + owner[2:8]


def _emails() -> dict:
    return {u["id"]: u["email"] for u in db.all("SELECT id, email FROM mb_users")}


@router.get("/whoami")
def whoami(r: str = Depends(role)):
    return {"role": r}


@router.get("/overview")
def overview(r: str = Depends(role)):
    since = (datetime.now(timezone.utc) - timedelta(days=13)).strftime("%Y-%m-%d")
    daily = db.all("SELECT substr(created_at,1,10) AS day, COUNT(*) AS n FROM mb_messages WHERE role='user' AND created_at>=%s "
                   "GROUP BY substr(created_at,1,10) ORDER BY day", since)
    tally: dict[str, int] = defaultdict(int)
    for row in db.all("SELECT topics FROM mb_messages WHERE role='assistant' AND topics IS NOT NULL ORDER BY created_at DESC LIMIT 2000"):
        for t in json.loads(row["topics"] or "[]"):
            tally[t] += 1
    top = sorted(tally.items(), key=lambda x: -x[1])[:10]
    unanswered = db.all("SELECT detail, created_at FROM mb_events WHERE kind='unanswered' ORDER BY created_at DESC LIMIT 20")
    return {
        "role": r, "database": db.status(), "ai": llm.provider(),
        "totals": {"users": _count("SELECT COUNT(*) AS c FROM mb_users"),
                   "conversations": _count("SELECT COUNT(*) AS c FROM mb_conversations"),
                   "questions": _count("SELECT COUNT(*) AS c FROM mb_messages WHERE role='user'"),
                   "checks": _count("SELECT COUNT(*) AS c FROM mb_checks"),
                   "reminders": _count("SELECT COUNT(*) AS c FROM mb_reminders"),
                   "contacts": _count("SELECT COUNT(*) AS c FROM mb_contacts"),
                   "thumbs_up": _count("SELECT COUNT(*) AS c FROM mb_messages WHERE rating=1"),
                   "thumbs_down": _count("SELECT COUNT(*) AS c FROM mb_messages WHERE rating=-1")},
        "daily": daily,
        "top_topics": [{"id": k, "title": engine.BY_ID[k]["en"]["title"] if k in engine.BY_ID else k, "n": v} for k, v in top],
        "reply_types": db.all("SELECT type, COUNT(*) AS n FROM mb_messages WHERE role='assistant' GROUP BY type"),
        "engines": db.all("SELECT engine, COUNT(*) AS n FROM mb_messages WHERE role='assistant' GROUP BY engine"),
        "check_levels": db.all("SELECT level, COUNT(*) AS n FROM mb_checks GROUP BY level"),
        "events": db.all("SELECT kind, COUNT(*) AS n FROM mb_events GROUP BY kind"),
        "unanswered": [{"q": json.loads(u["detail"]).get("q"), "at": u["created_at"]} for u in unanswered],
    }


@router.get("/conversations")
def conversations(q: str = "", page: int = 0, r: str = Depends(role)):
    page = max(0, min(page, 500))
    like = f"%{q.strip().lower()[:80]}%"
    rows = db.all(
        "SELECT c.id, c.owner, c.title, c.lang, c.updated_at, (SELECT COUNT(*) FROM mb_messages m WHERE m.conv_id=c.id) AS n "
        "FROM mb_conversations c WHERE LOWER(COALESCE(c.title,'')) LIKE %s OR EXISTS (SELECT 1 FROM mb_messages m "
        "WHERE m.conv_id=c.id AND LOWER(COALESCE(m.content,'')) LIKE %s) ORDER BY c.updated_at DESC LIMIT 25 OFFSET %s",
        like, like, page * 25)
    emails = _emails()
    for row in rows:
        row["who"] = _who(row.pop("owner"), emails)
    return {"rows": rows, "page": page, "more": len(rows) == 25}


@router.get("/conversations/{cid}")
def conversation(cid: str, r: str = Depends(role)):
    c = db.one("SELECT id, owner, title, lang, created_at, updated_at FROM mb_conversations WHERE id=%s", cid)
    if not c:
        raise HTTPException(404, "Not found")
    c["who"] = _who(c.pop("owner"), _emails())
    msgs = db.all("SELECT role, content, type, topics, engine, rating, created_at FROM mb_messages WHERE conv_id=%s "
                  "ORDER BY created_at, role DESC", cid)
    return {**c, "messages": msgs}


@router.delete("/conversations/{cid}")
def delete_conversation(cid: str, r: str = Depends(admin_only)):
    db.run("DELETE FROM mb_messages WHERE conv_id=%s", cid)
    db.run("DELETE FROM mb_conversations WHERE id=%s", cid)
    return {"ok": True}


@router.get("/users")
def users(r: str = Depends(role)):
    rows = db.all("SELECT id, email, name, age_group, sex, conditions, created_at FROM mb_users ORDER BY created_at DESC LIMIT 200")
    for u in rows:
        u["chats"] = _count("SELECT COUNT(*) AS c FROM mb_conversations WHERE owner=%s", "u:" + u["id"])
    return {"rows": rows}


@router.get("/checks")
def checks(r: str = Depends(role)):
    rows = db.all("SELECT id, owner, payload, level, topics, created_at FROM mb_checks ORDER BY created_at DESC LIMIT 100")
    emails = _emails()
    for c in rows:
        c["who"] = _who(c.pop("owner"), emails)
        c["payload"], c["topics"] = json.loads(c["payload"] or "{}"), json.loads(c["topics"] or "[]")
    return {"rows": rows}


@router.get("/reminders")
def reminders(r: str = Depends(role)):
    rows = db.all("SELECT owner, medicine, dose, times, days, active, created_at FROM mb_reminders ORDER BY created_at DESC LIMIT 100")
    emails = _emails()
    for x in rows:
        x["who"] = _who(x.pop("owner"), emails)
        x["times"] = json.loads(x["times"] or "[]")
    return {"rows": rows}


@router.get("/contacts")
def contacts(r: str = Depends(role)):
    return {"rows": db.all("SELECT id, name, email, message, created_at FROM mb_contacts ORDER BY created_at DESC LIMIT 200")}


@router.get("/export/{table}")
def export_csv(table: str, r: str = Depends(admin_only)):
    if table not in TABLES:
        raise HTTPException(404, "Unknown table")
    rows = db.all(f"SELECT {TABLES[table]} FROM mb_{table} ORDER BY created_at")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c.strip() for c in TABLES[table].split(",")])
    for row in rows:
        w.writerow(list(row.values()))
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="medibot-{table}-{stamp}.csv"'})


@router.get("/backup")
def backup(r: str = Depends(admin_only)):
    data = {t: db.all(f"SELECT {cols} FROM mb_{t} ORDER BY created_at") for t, cols in TABLES.items()}
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    body = json.dumps({"app": "MediBot", "exported_at": db.now(), "database": db.KIND, "tables": data}, ensure_ascii=False, indent=1)
    return Response(body, media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="medibot-backup-{stamp}.json"'})
