# MediBot v3 – AI Health Assistant (FYP)
Live: https://medibot-ai-chi.vercel.app   ·   Staff panel: /admin

## Stack
FastAPI (Python) on Vercel · Groq GPT-OSS 120B · Neon PostgreSQL · Vanilla JS PWA (English/Urdu)

## Vercel environment variables
- GROQ_API_KEY      – Groq key (console.groq.com/keys)
- DATABASE_URL      – Neon Postgres (added automatically by Vercel Storage → Neon)
- ADMIN_PASSWORD    – full access to /admin (backup, CSV export, delete)
- STAFF_PASSWORD    – view-only access to /admin
Optional: LLM_MODEL, GEMINI_API_KEY (backup AI)

## Run locally
pip install -r requirements.txt uvicorn
python dev.py            # http://localhost:8091  (uses SQLite if no DATABASE_URL)
python tests/evaluate.py # 64 automatic test cases

## Data & backup
All data (users, chats, messages, symptom checks, reminders, contact messages, events) is stored in Neon
(tables start with mb_). Backup: /admin → Backup tab → "Download full backup (JSON)" or CSV per table.
Neon also keeps its own restore history (Neon console → Branches/Restore).

## Edit team names
public/assets/js/team.js → TEAM and SUPERVISOR at the top.

## Pages
Home, Chat (voice + read-aloud + share/PDF), Symptom checker (body map), Medicines + interaction checker,
Lab report explainer, Nearby hospitals (map), Medicine reminders, Health topics, Team, How it works, Account, Admin.
