"""MediBot API v3 (FastAPI) - Groq-powered, knowledge-grounded health assistant.

Runs as one Vercel Python function (entrypoint /app.py re-exports `app`).
Storage: PostgreSQL (Neon) when DATABASE_URL is set, SQLite otherwise.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sys
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.formparsers import MultiPartParser

sys.path.insert(0, str(Path(__file__).parent))
from _medibot import packs  # noqa: E402,F401  (loads v3 knowledge packs first)
from _medibot import admin, db, engine, llm, tools, upload  # noqa: E402

# Keep uploaded reports in memory: Starlette spools files over 1 MB to a temp file on disk by default.
# Vercel caps request bodies at 4.5 MB, so 5 MB keeps every accepted upload off the disk.
MultiPartParser.max_file_size = 5 * 1024 * 1024

app = FastAPI(title="MediBot API", version="3.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["*"])

SESSION_COOKIE, GUEST_COOKIE = "mb_s", "mb_g"
SECURE = bool(os.environ.get("VERCEL"))
_hits: dict[str, deque] = defaultdict(deque)


# ------------------------------------------------------------ helpers

def _limit(req: Request, per_min: int = 30, bucket: str = "") -> None:
    ip = (req.headers.get("x-forwarded-for") or (req.client.host if req.client else "?")).split(",")[0].strip()
    q, now = _hits[bucket + ip], time.time()
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= per_min:
        raise HTTPException(429, "Too many requests. Please wait a minute.")
    q.append(now)


def _hash_pw(pw: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000)
    return f"pbkdf2${salt}${dk.hex()}"


def _check_pw(pw: str, stored: str) -> bool:
    try:
        _, salt, _h = stored.split("$")
        return hmac.compare_digest(_hash_pw(pw, salt), stored)
    except ValueError:
        return False


def _tok_hash(tok: str) -> str:
    return hashlib.sha256(tok.encode()).hexdigest()


class Who:
    """The current visitor: a signed-in user, or an anonymous guest id kept in a cookie."""

    def __init__(self, user: dict | None, guest: str | None):
        self.user, self.guest = user, guest

    @property
    def owner(self) -> str:
        return f"u:{self.user['id']}" if self.user else f"g:{self.guest}"

    def profile(self) -> dict | None:
        return {k: self.user.get(k) for k in ("age_group", "sex", "conditions")} if self.user else None


def who(request: Request, response: Response) -> Who:
    user = None
    tok = request.cookies.get(SESSION_COOKIE)
    if tok:
        s = db.one("SELECT user_id, expires_at FROM mb_sessions WHERE token_hash=%s", _tok_hash(tok))
        if s and s["expires_at"] > db.now():
            user = db.one("SELECT id, email, name, lang, age_group, sex, conditions, created_at FROM mb_users WHERE id=%s", s["user_id"])
    guest = request.cookies.get(GUEST_COOKIE)
    if not user and not (guest and len(guest) == 32 and guest.isalnum()):
        guest = db.new_id()
        response.set_cookie(GUEST_COOKIE, guest, max_age=60 * 60 * 24 * 365, httponly=True, samesite="lax", secure=SECURE)
    return Who(user, guest)


def _start_session(response: Response, user_id: str) -> None:
    tok = secrets.token_urlsafe(32)
    exp = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    db.run("INSERT INTO mb_sessions (token_hash, user_id, created_at, expires_at) VALUES (%s,%s,%s,%s)", _tok_hash(tok), user_id, db.now(), exp)
    response.set_cookie(SESSION_COOKIE, tok, max_age=60 * 60 * 24 * 30, httponly=True, samesite="lax", secure=SECURE)


def _lang(lang: str) -> str:
    return "ur" if lang == "ur" else "en"


# ------------------------------------------------------------ auth

class SignUp(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: str = Field(..., min_length=5, max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(..., min_length=8, max_length=128)


class Login(BaseModel):
    email: str = Field(..., max_length=120)
    password: str = Field(..., max_length=128)


class Profile(BaseModel):
    name: str | None = Field(None, max_length=80)
    lang: str | None = Field(None, pattern="^(en|ur)$")
    age_group: str | None = Field(None, pattern="^(|child|teen|adult|older|pregnant)$")
    sex: str | None = Field(None, pattern="^(|f|m|other)$")
    conditions: str | None = Field(None, max_length=300)


@app.post("/api/auth/signup")
def signup(body: SignUp, request: Request, response: Response, w: Who = Depends(who)):
    _limit(request, 10, "auth")
    email = body.email.strip().lower()
    if db.one("SELECT id FROM mb_users WHERE email=%s", email):
        raise HTTPException(409, "An account with this email already exists.")
    uid = db.new_id()
    db.run("INSERT INTO mb_users (id, email, name, pass_hash, lang, created_at) VALUES (%s,%s,%s,%s,%s,%s)",
           uid, email, body.name.strip(), _hash_pw(body.password), "en", db.now())
    if w.guest:  # keep the chats, checks and reminders made before signing up
        for t in ("mb_conversations", "mb_checks", "mb_reminders"):
            db.run(f"UPDATE {t} SET owner=%s WHERE owner=%s", f"u:{uid}", f"g:{w.guest}")
    _start_session(response, uid)
    db.log_event("signup", f"u:{uid}")
    return {"ok": True, "user": {"id": uid, "email": email, "name": body.name.strip()}}


@app.post("/api/auth/login")
def login(body: Login, request: Request, response: Response, w: Who = Depends(who)):
    _limit(request, 10, "auth")
    u = db.one("SELECT id, email, name, pass_hash FROM mb_users WHERE email=%s", body.email.strip().lower())
    if not u or not _check_pw(body.password, u["pass_hash"]):
        raise HTTPException(401, "Email or password is incorrect.")
    if w.guest:
        for t in ("mb_conversations", "mb_checks", "mb_reminders"):
            db.run(f"UPDATE {t} SET owner=%s WHERE owner=%s", f"u:{u['id']}", f"g:{w.guest}")
    _start_session(response, u["id"])
    return {"ok": True, "user": {"id": u["id"], "email": u["email"], "name": u["name"]}}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    tok = request.cookies.get(SESSION_COOKIE)
    if tok:
        db.run("DELETE FROM mb_sessions WHERE token_hash=%s", _tok_hash(tok))
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@app.get("/api/auth/me")
def me(w: Who = Depends(who)):
    return {"user": w.user, "guest": not w.user}


@app.put("/api/profile")
def update_profile(body: Profile, w: Who = Depends(who)):
    if not w.user:
        raise HTTPException(401, "Please sign in.")
    for k, v in body.model_dump(exclude_none=True).items():
        db.run(f"UPDATE mb_users SET {k}=%s WHERE id=%s", v, w.user["id"])  # k comes from the model's fixed fields
    return {"ok": True}


@app.delete("/api/me/data")
def delete_my_data(response: Response, w: Who = Depends(who)):
    """Right to erasure: removes every record linked to this visitor."""
    convs = db.all("SELECT id FROM mb_conversations WHERE owner=%s", w.owner)
    for c in convs:
        db.run("DELETE FROM mb_messages WHERE conv_id=%s", c["id"])
    for t in ("mb_conversations", "mb_checks", "mb_reminders", "mb_events"):
        db.run(f"DELETE FROM {t} WHERE owner=%s", w.owner)
    if w.user:
        db.run("DELETE FROM mb_sessions WHERE user_id=%s", w.user["id"])
        db.run("DELETE FROM mb_users WHERE id=%s", w.user["id"])
        response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


# ------------------------------------------------------------ chat

class ChatIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    lang: str = Field("en", pattern="^(en|ur)$")
    conversation_id: str | None = Field(None, max_length=40)
    context: list[str] = Field(default_factory=list, max_length=5)
    lock: bool = False      # keep the reply in the UI language (symptom checker)
    private: bool = False   # private mode: answer, but do not save the conversation


def _script(raw: str, lang: str) -> str:
    if lang != "ur":
        return "en"
    return "urdu" if engine.URDU.search(raw) else "roman"


def _reply(message: str, lang: str, context: list[str], lock: bool, history: list[dict], profile: dict | None) -> dict:
    out = engine.answer(message, lang, context, lock)
    out.pop("summary_ai", None)
    out["engine"] = "rules"
    if not llm.enabled():
        return out
    script = "urdu" if (lock and lang == "ur") else _script(message, out["lang"])
    if out["type"] == "answer":
        r = llm.grounded_reply(message, out, history, profile, script)
        if r:
            out["ai_text"], out["engine"] = r[0], r[1]
    elif out["type"] in ("unknown", "offtopic") and (engine.HEALTH_HINT.search(engine.normalise(message)) or history):
        r = llm.general_reply(message, history, profile, script)
        if r and "only help with health" not in r[0].lower():
            out.update(type="general", ai_text=r[0], engine=r[1])
    return out


@app.post("/api/chat")
def chat(body: ChatIn, request: Request, w: Who = Depends(who)):
    _limit(request)
    conv = None
    history: list[dict] = []
    context = list(body.context)
    if body.conversation_id:
        conv = db.one("SELECT id FROM mb_conversations WHERE id=%s AND owner=%s", body.conversation_id, w.owner)
        if conv:
            rows = db.all("SELECT role, content, topics FROM mb_messages WHERE conv_id=%s ORDER BY created_at DESC LIMIT 8", conv["id"])
            rows.reverse()
            history = [{"role": r["role"], "content": r["content"]} for r in rows]
            if not context:
                for r in reversed(rows):
                    if r["topics"]:
                        context = json.loads(r["topics"])
                        break
    out = _reply(body.message, body.lang, context, body.lock, history, w.profile())
    shown = out.get("ai_text") or out.get("text", "")
    if body.private:
        db.log_event("chat_private", None, type=out["type"], topics=out.get("topics", []))
        return {**out, "conversation_id": None, "message_id": None}
    ts = db.now()
    if not conv:
        cid = db.new_id()
        db.run("INSERT INTO mb_conversations (id, owner, title, lang, created_at, updated_at) VALUES (%s,%s,%s,%s,%s,%s)",
               cid, w.owner, body.message.strip()[:70], out["lang"], ts, ts)
    else:
        cid = conv["id"]
        db.run("UPDATE mb_conversations SET updated_at=%s WHERE id=%s", ts, cid)
    db.run("INSERT INTO mb_messages (id, conv_id, role, content, type, created_at) VALUES (%s,%s,'user',%s,%s,%s)",
           db.new_id(), cid, body.message.strip(), "user", ts)
    mid = db.new_id()
    meta = {k: out.get(k) for k in ("cards", "triage", "emergency", "suggestions", "disclaimer", "lang", "intro")}
    db.run("INSERT INTO mb_messages (id, conv_id, role, content, meta, type, topics, engine, created_at) "
           "VALUES (%s,%s,'assistant',%s,%s,%s,%s,%s,%s)", mid, cid, shown, json.dumps(meta, ensure_ascii=False),
           out["type"], json.dumps(out.get("topics", [])), out["engine"], db.now())
    if out["type"] in ("unknown", "general"):
        db.log_event("unanswered", w.owner, q=body.message[:300])
    return {**out, "conversation_id": cid, "message_id": mid}


@app.get("/api/ask")
def ask(q: str, request: Request, lang: str = "en"):
    """GET version of /api/chat (not saved) for quick tests and shareable links."""
    _limit(request)
    return _reply(q[:1000], _lang(lang), [], False, [], None)


@app.get("/api/conversations")
def conversations(w: Who = Depends(who)):
    rows = db.all("SELECT id, title, lang, updated_at FROM mb_conversations WHERE owner=%s ORDER BY updated_at DESC LIMIT 50", w.owner)
    return {"conversations": rows}


@app.get("/api/conversations/{cid}")
def conversation(cid: str, w: Who = Depends(who)):
    c = db.one("SELECT id, title, lang, updated_at FROM mb_conversations WHERE id=%s AND owner=%s", cid, w.owner)
    if not c:
        raise HTTPException(404, "Not found")
    msgs = db.all("SELECT id, role, content, meta, type, topics, engine, rating, created_at FROM mb_messages WHERE conv_id=%s "
                  "ORDER BY created_at, role DESC", cid)
    for m in msgs:
        m["meta"] = json.loads(m["meta"]) if m["meta"] else None
        m["topics"] = json.loads(m["topics"]) if m["topics"] else []
    return {**c, "messages": msgs}


@app.delete("/api/conversations/{cid}")
def delete_conversation(cid: str, w: Who = Depends(who)):
    if db.one("SELECT id FROM mb_conversations WHERE id=%s AND owner=%s", cid, w.owner):
        db.run("DELETE FROM mb_messages WHERE conv_id=%s", cid)
        db.run("DELETE FROM mb_conversations WHERE id=%s", cid)
    return {"ok": True}


class Feedback(BaseModel):
    message_id: str = Field(..., max_length=40)
    rating: int = Field(..., ge=-1, le=1)


@app.post("/api/feedback")
def feedback(body: Feedback, w: Who = Depends(who)):
    m = db.one("SELECT m.id FROM mb_messages m JOIN mb_conversations c ON c.id=m.conv_id WHERE m.id=%s AND c.owner=%s",
               body.message_id, w.owner)
    if not m:
        raise HTTPException(404, "Not found")
    db.run("UPDATE mb_messages SET rating=%s WHERE id=%s", body.rating, body.message_id)
    return {"ok": True}


# ------------------------------------------------------------ symptom checker

class CheckIn(BaseModel):
    who: str = Field("adult", pattern="^(adult|child|baby|pregnant|older)$")
    areas: list[str] = Field(default_factory=list, max_length=6)
    symptoms: list[str] = Field(..., min_length=1, max_length=5)
    redflags: list[str] = Field(default_factory=list, max_length=8)
    days: int | None = Field(None, ge=0, le=365)
    temp_f: float | None = Field(None, ge=90, le=110)
    lang: str = Field("en", pattern="^(en|ur)$")
    message: str = Field(..., max_length=600)


@app.post("/api/checker")
def checker(body: CheckIn, request: Request, w: Who = Depends(who)):
    _limit(request)
    out = engine.answer(body.message, body.lang, [], True)
    out["engine"] = "rules"
    if body.redflags and out["type"] != "emergency":
        out["triage"] = {"level": "emergency", "reasons": body.redflags}
        out["type"] = "emergency"
    level = (out.get("triage") or {}).get("level") or ("emergency" if out["type"] == "emergency" else "self_care")
    cid = db.new_id()
    db.run("INSERT INTO mb_checks (id, owner, payload, level, topics, created_at) VALUES (%s,%s,%s,%s,%s,%s)", cid, w.owner,
           json.dumps(body.model_dump(exclude={"message"}), ensure_ascii=False), level, json.dumps(out.get("topics", [])), db.now())
    return {**out, "check_id": cid, "level": level}


@app.get("/api/checks")
def my_checks(w: Who = Depends(who)):
    rows = db.all("SELECT id, payload, level, topics, created_at FROM mb_checks WHERE owner=%s ORDER BY created_at DESC LIMIT 30", w.owner)
    for r in rows:
        r["payload"], r["topics"] = json.loads(r["payload"]), json.loads(r["topics"] or "[]")
    return {"checks": rows}


# ------------------------------------------------------------ medicines, interactions, lab

@app.get("/api/medicines")
def medicines(q: str = "", lang: str = "en"):
    return {"results": engine.search_medicines(q[:60], _lang(lang))}


@app.get("/api/interactions/items")
def interaction_items(lang: str = "en"):
    return {"items": tools.items(_lang(lang))}


@app.get("/api/interactions")
def interactions(ids: str, lang: str = "en", w: Who = Depends(who)):
    res = tools.check([i for i in ids.split(",") if i][:6], _lang(lang))
    db.log_event("interaction", w.owner, ids=ids[:200], found=len(res["results"]))
    return res


class LabIn(BaseModel):
    text: str = Field(..., min_length=2, max_length=3000)
    lang: str = Field("en", pattern="^(en|ur)$")
    sex: str | None = Field(None, pattern="^(|f|m)$")


@app.post("/api/lab")
def lab(body: LabIn, request: Request, w: Who = Depends(who)):
    _limit(request, 15, "lab")
    res = tools.read_lab(body.text, body.lang, body.sex or (w.user or {}).get("sex"))
    res["engine"] = "rules"
    if res["rows"] and llm.enabled():
        r = llm.explain_lab(res["rows"], body.text, "urdu" if body.lang == "ur" else "en")
        if r:
            res["ai_text"], res["engine"] = r[0], r[1]
    db.log_event("lab", w.owner, tests=[r["id"] for r in res["rows"]], abnormal=res["abnormal"])
    res["critical"] = upload.critical_checks(res["rows"], body.lang)
    return res


@app.post("/api/lab/upload")
def lab_upload(request: Request, file: UploadFile = File(...), sex: str = Form(""), lang: str = Form("en"),
               w: Who = Depends(who)):
    """Photo or PDF of a report -> same shape as /api/lab (+ extracted_text_lines, unreadable_parts, report_type,
    confidence_note). Processed in memory only; the file and its text are never stored or logged."""
    _limit(request, 6, "labup")
    lang = _lang(lang)
    sex = sex if sex in ("f", "m") else (w.user or {}).get("sex")
    data = file.file.read(upload.MAX_BYTES + 1)
    try:
        res = upload.process(data, file.content_type, lang, sex if sex in ("f", "m") else None)
    except upload.UploadError as e:
        raise HTTPException(e.status, e.text(lang))
    except Exception:
        raise HTTPException(500, upload.UploadError(500, "server").text(lang))
    db.log_event("lab_upload", w.owner, report_type=res["report_type"], tests=[r["id"] for r in res["rows"] if not r["id"].startswith("rep_")],
                 abnormal=res["abnormal"])
    return res


@app.get("/api/lab/tests")
def lab_tests(lang: str = "en"):
    return {"tests": [t[_lang(lang)] for t in tools.LABS["tests"]]}


@app.get("/api/topics")
def topics(lang: str = "en"):
    return {"topics": engine.topics(_lang(lang))}


@app.get("/api/topic/{tid}")
def topic(tid: str, lang: str = "en"):
    d = engine.BY_ID.get(tid)
    if not d:
        raise HTTPException(404, "Not found")
    return engine.card(d, _lang(lang))


# ------------------------------------------------------------ reminders

class ReminderIn(BaseModel):
    medicine: str = Field(..., min_length=1, max_length=80)
    dose: str | None = Field(None, max_length=60)
    times: list[str] = Field(..., min_length=1, max_length=6)
    days: int | None = Field(None, ge=1, le=365)
    notes: str | None = Field(None, max_length=200)
    active: bool = True


def _valid_times(times: list[str]) -> list[str]:
    ok = []
    for t in times:
        try:
            datetime.strptime(t, "%H:%M")
            ok.append(t)
        except ValueError:
            raise HTTPException(422, f"Invalid time: {t}")
    return sorted(set(ok))


@app.get("/api/reminders")
def reminders(w: Who = Depends(who)):
    rows = db.all("SELECT id, medicine, dose, times, days, notes, active, created_at FROM mb_reminders WHERE owner=%s "
                  "ORDER BY created_at DESC", w.owner)
    for r in rows:
        r["times"], r["active"] = json.loads(r["times"]), bool(r["active"])
    return {"reminders": rows}


@app.post("/api/reminders")
def add_reminder(body: ReminderIn, w: Who = Depends(who)):
    if len(db.all("SELECT id FROM mb_reminders WHERE owner=%s", w.owner)) >= 30:
        raise HTTPException(400, "You can save up to 30 reminders.")
    rid = db.new_id()
    db.run("INSERT INTO mb_reminders (id, owner, medicine, dose, times, days, notes, active, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
           rid, w.owner, body.medicine.strip(), body.dose, json.dumps(_valid_times(body.times)), body.days, body.notes,
           1 if body.active else 0, db.now())
    return {"ok": True, "id": rid}


@app.put("/api/reminders/{rid}")
def edit_reminder(rid: str, body: ReminderIn, w: Who = Depends(who)):
    db.run("UPDATE mb_reminders SET medicine=%s, dose=%s, times=%s, days=%s, notes=%s, active=%s WHERE id=%s AND owner=%s",
           body.medicine.strip(), body.dose, json.dumps(_valid_times(body.times)), body.days, body.notes, 1 if body.active else 0, rid, w.owner)
    return {"ok": True}


@app.delete("/api/reminders/{rid}")
def delete_reminder(rid: str, w: Who = Depends(who)):
    db.run("DELETE FROM mb_reminders WHERE id=%s AND owner=%s", rid, w.owner)
    return {"ok": True}


# ------------------------------------------------------------ contact, events, stats

class ContactIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: str = Field(..., max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    message: str = Field(..., min_length=5, max_length=2000)


@app.post("/api/contact")
def contact(body: ContactIn, request: Request):
    _limit(request, 5, "contact")
    db.run("INSERT INTO mb_contacts (id, name, email, message, created_at) VALUES (%s,%s,%s,%s,%s)",
           db.new_id(), body.name.strip(), body.email.strip(), body.message.strip(), db.now())
    return {"ok": True}


class EventIn(BaseModel):
    kind: str = Field(..., pattern="^(hospital_search|tts|share|install|reminder_fired)$")
    detail: dict = Field(default_factory=dict)


@app.post("/api/event")
def event(body: EventIn, w: Who = Depends(who)):
    db.log_event(body.kind, w.owner, **{k: str(v)[:80] for k, v in list(body.detail.items())[:5]})
    return {"ok": True}


@app.get("/api/stats")
def stats():
    def n(sql, *a):
        r = db.one(sql, *a)
        return int(list(r.values())[0] or 0) if r else 0
    rated = n("SELECT COUNT(*) AS c FROM mb_messages WHERE rating IS NOT NULL")
    good = n("SELECT COUNT(*) AS c FROM mb_messages WHERE rating=1")
    return {"questions": n("SELECT COUNT(*) AS c FROM mb_messages WHERE role='user'"),
            "users": n("SELECT COUNT(*) AS c FROM mb_users"), "checks": n("SELECT COUNT(*) AS c FROM mb_checks"),
            "documents": len(engine.DOCS), "satisfaction": round(100 * good / rated) if rated else None}


# ------------------------------------------------------------ admin & staff panel (see _medibot/admin.py)

app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"ok": True, "version": app.version, "documents": len(engine.DOCS), "ai": llm.provider(),
            "database": db.status()}
