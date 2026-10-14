"""Offline clinical helpers: medicine interaction checker and lab-report reader.
Both work from MediBot's own curated data (no external service)."""
from __future__ import annotations

import json
import re
from itertools import combinations
from pathlib import Path

from . import engine

HERE = Path(__file__).parent
IX = json.loads((HERE / "kb_interactions.json").read_text(encoding="utf-8"))
LABS = json.loads((HERE / "kb_labs.json").read_text(encoding="utf-8"))
LEVEL_ORDER = {"major": 0, "moderate": 1, "minor": 2, "info": 3, "none": 4}
LEVEL_TEXT = {
    "en": {"major": "Avoid combining", "moderate": "Use with caution", "minor": "Minor", "info": "Good to know", "none": "No known problem"},
    "ur": {"major": "ساتھ نہ لیں", "moderate": "احتیاط سے", "minor": "معمولی", "info": "جاننا مفید", "none": "کوئی معلوم مسئلہ نہیں"},
}


def items(lang: str = "en") -> list[dict]:
    meds = [{"id": d["id"], "name": d[lang]["title"], "kind": "medicine"} for d in engine.DOCS if d["type"] == "medicine"]
    subs = [{"id": k, "name": v[lang], "kind": "substance"} for k, v in IX["substances"].items()]
    return meds + subs


def _match(token: str, item: str) -> bool:
    if token.startswith("class:"):
        return IX["classes"].get(item) == token[6:]
    return token == item


def check(ids: list[str], lang: str = "en") -> dict:
    ids = [i for i in dict.fromkeys(ids) if i in engine.BY_ID or i in IX["substances"]][:6]
    names = {i["id"]: i["name"] for i in items(lang)}
    found = []
    for a, b in combinations(ids, 2):
        best = None
        for r in IX["rules"]:
            if (_match(r["a"], a) and _match(r["b"], b)) or (_match(r["a"], b) and _match(r["b"], a)):
                if best is None or LEVEL_ORDER[r["level"]] < LEVEL_ORDER[best["level"]]:
                    best = r
        if best:
            found.append({"pair": [names.get(a, a), names.get(b, b)], "level": best["level"],
                          "label": LEVEL_TEXT[lang][best["level"]], "text": best[lang]})
    found.sort(key=lambda x: LEVEL_ORDER[x["level"]])
    checked = len(ids) * (len(ids) - 1) // 2
    note = ("Only well-known interactions in MediBot's list are checked. Always tell your doctor and pharmacist every medicine, "
            "herbal remedy and supplement you take." if lang == "en" else
            "صرف میڈی بوٹ کی فہرست میں موجود معروف تعاملات چیک ہوتے ہیں۔ اپنی تمام دوائیں، جڑی بوٹیاں اور سپلیمنٹ ڈاکٹر اور فارماسسٹ کو ضرور بتائیں۔")
    return {"checked_pairs": checked, "results": found, "note": note,
            "sources": [{"name": "NHS – Medicines A to Z", "url": "https://www.nhs.uk/medicines/"}]}


# ----------------------------------------------------------------- labs

_NUM = re.compile(r"(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)")
_ALIASES = sorted(((a, t) for t in LABS["tests"] for a in t["names"]), key=lambda x: -len(x[0]))


def _fmt(x: float) -> str:
    return f"{x:g}"


def read_lab(text: str, lang: str = "en", sex: str | None = None) -> dict:
    rows, seen = [], set()
    for line in re.split(r"[\n;]+", text or ""):
        low = line.lower()
        for alias, t in _ALIASES:
            m = re.search(r"(?<![a-z])" + re.escape(alias) + r"(?![a-z])", low)
            if not m or t["id"] in seen:
                continue
            n = _NUM.search(low[m.end():])
            if not n:
                continue
            v = float(n.group(1).replace(",", ""))
            if t["id"] in ("plt", "wbc") and v >= 1000:  # 150,000 /µL style → ×10³
                v = v / 1000
            lo, hi = t["low"], t["high"]
            if sex in ("f", "m") and f"low_{sex}" in t:
                lo, hi = t[f"low_{sex}"], t[f"high_{sex}"]
            status = "low" if v < lo else "high" if v > hi else "normal"
            note = ""
            for b_lo, b_hi, msg in t.get("bands", []):
                if b_lo <= v <= b_hi:
                    note = msg[lang]
            meaning = t["lo" if status == "low" else "hi"][lang] if status != "normal" else ""
            rng = f"{_fmt(lo)}–{_fmt(hi)}" if hi < 1000 else f"> {_fmt(lo)}"
            if lo == 0:
                rng = f"< {_fmt(hi + 1 if hi == int(hi) else hi)}"
            rows.append({"id": t["id"], "name": t[lang], "value": _fmt(v), "unit": t["unit"], "range": rng,
                         "status": status, "meaning": " ".join(x for x in (note, meaning) if x)})
            seen.add(t["id"])
            break
    abnormal = sum(r["status"] != "normal" for r in rows)
    note = ("Reference ranges differ between labs – the range printed on your report comes first. This is not a diagnosis; "
            "show the report to your doctor." if lang == "en" else
            "ہر لیب کی حدیں کچھ مختلف ہوتی ہیں – رپورٹ پر لکھی حد کو ترجیح دیں۔ یہ تشخیص نہیں؛ رپورٹ ڈاکٹر کو ضرور دکھائیں۔")
    return {"rows": rows, "abnormal": abnormal, "note": note,
            "sources": [{"name": n, "url": u} for n, u in LABS["source"]],
            "supported": [t[lang] for t in LABS["tests"]]}
