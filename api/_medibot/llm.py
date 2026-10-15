"""AI answer generation through a free, OpenAI-compatible LLM API.

Providers (first key found wins):
  GROQ_API_KEY        -> Groq (GPT-OSS 120B, multilingual, fast)    console.groq.com/keys
  GEMINI_API_KEY      -> Google Gemini (free tier)                   aistudio.google.com/apikey
  OPENROUTER_API_KEY  -> OpenRouter free models                      openrouter.ai/keys
Optional LLM_MODEL overrides the model name.

The rule engine stays in charge of safety: emergencies, small talk and
off-topic refusals are decided before the model is called. The model only
turns retrieved, trusted knowledge-base text into a conversational reply.
Without a key (or if the provider fails) MediBot falls back to the
knowledge-base answer, so the app never breaks.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

PROVIDERS = [
    ("groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1/chat/completions", ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"]),
    ("gemini", "GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", ["gemini-2.5-flash", "gemini-2.0-flash"]),
    ("openrouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/chat/completions", ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free"]),
]


def _active():
    for name, env, url, models in PROVIDERS:
        key = os.environ.get(env)
        if key:
            custom = os.environ.get("LLM_MODEL") or (os.environ.get("GROQ_MODEL") if name == "groq" else None)
            return name, key, url, ([custom] if custom else []) + models
    return None


def enabled() -> bool:
    return _active() is not None


def provider() -> str | None:
    a = _active()
    return a[0] if a else None


RULES = """You are MediBot, a careful health-information assistant for people in Pakistan.
Rules you must always follow:
1. Health topics only. If the user asks about anything else, reply only: "I can only help with health questions."
2. Never diagnose. Never say "you have X". Say what it *could* be linked to and who should check it.
3. Use ONLY the facts in the TRUSTED CONTEXT when it is given. Do not invent facts, statistics, doses or brand claims.
4. Never give personal medicine doses beyond what the context says; point to the label, pharmacist or doctor.
5. Always include when to see a doctor, and the emergency warning signs if the context lists them.
6. If anything sounds like an emergency, tell them to call 1122 (Rescue) or 115 (Edhi) now.
7. Be warm, plain and short: 90-180 words, short paragraphs or bullet points, no headings bigger than bold text.
8. Respect the user's profile (age group, pregnancy, conditions) when it is given, e.g. extra caution for children, pregnancy, elderly.
"""

LANG_RULE = {
    "en": "Reply in simple English.",
    "ur": "Reply in Urdu script (اردو) with simple everyday words.",
    "roman": "Reply in Roman Urdu (Urdu written in English letters, e.g. 'Aap ko aaram karna chahiye'), simple words.",
}


def _call(messages: list[dict], max_tokens: int = 500, temperature: float = 0.3, models: dict | None = None,
          extra: dict | None = None, timeout: float | None = None) -> tuple[str, str] | None:
    """Returns (text, "provider:model") or None. Tries the next model if one is retired.
    `models` (provider -> model list) overrides the default text models, e.g. for vision."""
    a = _active()
    if not a:
        return None
    name, key, url, default = a
    if models is not None and not models.get(name):
        return None  # this provider has no model for the job
    for model in dict.fromkeys(models[name] if models is not None else default):
        payload = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens, **(extra or {})}
        if "gpt-oss" in model:  # reasoning model: keep thinking short so the reply fits the token budget
            payload.update(reasoning_effort="low", max_tokens=max_tokens + 700)
        body = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=body, headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json", "User-Agent": "MediBot/3.0",
            "HTTP-Referer": "https://medibot-ai-chi.vercel.app", "X-Title": "MediBot"})
        try:
            with urllib.request.urlopen(req, timeout=timeout or float(os.environ.get("LLM_TIMEOUT", "12"))) as r:
                text = (json.loads(r.read())["choices"][0]["message"]["content"] or "").strip()
                if text:
                    return text, f"{name}:{model}"
        except urllib.error.HTTPError as e:
            # status + provider's error message only, never request content (shows in Vercel logs)
            print(f"llm {name}:{model} HTTP {e.code} {e.read()[:200]!r}")
            if e.code in (400, 404):  # model retired or unavailable: try the next one
                continue
            return None
        except Exception as e:
            print(f"llm {name}:{model} {type(e).__name__}")
            return None
    return None


def grounded_reply(question: str, out: dict, history: list[dict], profile: dict | None, script: str) -> tuple[str, str] | None:
    """Rewrite a knowledge-base answer as a conversational reply."""
    ctx = out.get("text", "")
    if out.get("triage"):
        ctx += "\n\nTRIAGE (from MediBot rules): " + out["triage"]["level"] + " – " + "; ".join(out["triage"].get("reasons", []))
    msgs = [{"role": "system", "content": RULES + "\n" + LANG_RULE.get(script, LANG_RULE["en"])}]
    for h in history[-6:]:
        msgs.append({"role": h["role"], "content": (h.get("content") or "")[:1200]})
    prof = _profile_text(profile)
    msgs.append({"role": "user", "content": f"TRUSTED CONTEXT (from NHS/WHO-based knowledge base):\n{ctx}\n\n{prof}"
                                            f"USER QUESTION: {question}\n\nWrite the reply now."})
    return _call(msgs)


def general_reply(question: str, history: list[dict], profile: dict | None, script: str) -> tuple[str, str] | None:
    """Health question the knowledge base does not cover: cautious general guidance, clearly labelled."""
    msgs = [{"role": "system", "content": RULES + "\nThere is NO trusted context for this question. Give only widely accepted, "
             "general guidance, say clearly that a doctor should confirm, and keep it under 140 words. If the question is not "
             "about health, refuse as in rule 1.\n" + LANG_RULE.get(script, LANG_RULE["en"])}]
    for h in history[-6:]:
        msgs.append({"role": h["role"], "content": (h.get("content") or "")[:1200]})
    msgs.append({"role": "user", "content": _profile_text(profile) + "USER QUESTION: " + question})
    return _call(msgs, max_tokens=380)


def explain_lab(rows: list[dict], raw: str, lang: str, extra: str = "") -> tuple[str, str] | None:
    facts = "\n".join(f"- {r['name']}: {r['value']} {r['unit']} (reference {r['range']}) → {r['status']}" for r in rows)
    msgs = [{"role": "system", "content": RULES + "\nYou explain lab reports in plain language. Use ONLY the parsed values and "
             "reference ranges given. Do not diagnose; explain what high/low can be linked to in general and which doctor to show. "
             + extra + LANG_RULE.get(lang, LANG_RULE["en"])},
            {"role": "user", "content": f"Parsed results:\n{facts or '(none parsed)'}\n\nOriginal text:\n{raw[:1500]}"}]
    return _call(msgs, max_tokens=450)


# ------------------------------------------------------------ report upload (photo / PDF)

# Vision-capable models per provider. GROQ_VISION_MODEL overrides the first Groq choice.
# Groq docs (Oct 2026): qwen/qwen3.8-27b is the current vision model; Llama 4 Scout is being retired.
VISION = {"groq": ["qwen/qwen3.8-27b", "meta-llama/llama-4-scout-17b-16e-instruct"], "gemini": ["gemini-2.5-flash"]}

EXTRACT_RULES = """You copy values from a photo or text of a medical report into JSON. You are a careful transcriber, not a doctor.
Reply with ONE JSON object only, no other text, in exactly this shape:
{"is_medical_report": true|false,
 "report_type": "lab"|"ecg"|"imaging"|"prescription"|"other",
 "language": "en"|"ur"|"mixed",
 "tests": [{"name": "...", "value": "...", "unit": "...", "printed_range": "...", "printed_flag": "H"|"L"|"N"|null}],
 "ecg": {"heart_rate_bpm": null, "pr_ms": null, "qrs_ms": null, "qt_ms": null, "qtc_ms": null, "axis_deg": null, "machine_statement": null},
 "other_findings_text": "...",
 "unreadable_parts": ["..."]}
Rules:
1. Copy ONLY what is printed. Never guess, calculate, convert units or fill in typical values.
2. If a number or unit is blurry or cut off, use null and add a short description to "unreadable_parts".
3. Never invent tests that are not on the page. One entry per test row; keep the test name as printed.
4. "printed_range" and "printed_flag" only if they are printed next to that result; otherwise null.
5. ECG: copy only the printed numbers (rate, PR, QRS, QT, QTc, axis) and the printed interpretation sentence. Do not read the tracing.
6. Imaging, prescriptions and other text: put the printed findings or impression in "other_findings_text" (max 800 characters).
7. NEVER copy patient identity: name, CNIC, phone, address, MR/registration numbers, father/husband name, referring doctor.
8. If the image is not a medical report (a selfie, an object, a random photo), set "is_medical_report": false and leave everything else empty.
"""


def read_report(text: str | None = None, images: list[str] | None = None) -> str | None:
    """Ask the AI to transcribe a report into JSON. `images` are data: URLs (vision model), else `text` (text model)."""
    if images:
        content = [{"type": "text", "text": "Transcribe this medical report into the JSON described."}]
        content += [{"type": "image_url", "image_url": {"url": u}} for u in images]
        groq = [m for m in [os.environ.get("GROQ_VISION_MODEL")] if m] + VISION["groq"]
        models = {**VISION, "groq": groq}
    else:
        content, models = f"Transcribe this medical report text into the JSON described.\n\nREPORT TEXT:\n{text}", None
    msgs = [{"role": "system", "content": EXTRACT_RULES}, {"role": "user", "content": content}]
    r = _call(msgs, max_tokens=1800, temperature=0, models=models, extra={"response_format": {"type": "json_object"}},
              timeout=float(os.environ.get("VISION_TIMEOUT", "25")))
    return r[0] if r else None


def _profile_text(p: dict | None) -> str:
    if not p:
        return ""
    bits = [f"{k}: {v}" for k, v in (("age group", p.get("age_group")), ("sex", p.get("sex")),
                                      ("known conditions", p.get("conditions"))) if v]
    return ("USER PROFILE (self-reported): " + ", ".join(bits) + "\n\n") if bits else ""
