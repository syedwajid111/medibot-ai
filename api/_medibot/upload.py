"""Lab page "Upload your report": read a photo or PDF of a medical report.

The file is handled in memory only and never written to disk, the database or logs.
The AI only transcribes what is printed (strict JSON); the existing lab reader
(tools.read_lab + kb_labs.json) and the rules below decide ranges, flags and safety.
"""
from __future__ import annotations

import base64
import io
import json
import re
from pathlib import Path

from . import engine, llm, tools

HERE = Path(__file__).parent
ECG = json.loads((HERE / "kb_ecg.json").read_text(encoding="utf-8"))
MAX_BYTES = 4 * 1024 * 1024
PDF_PAGES, PDF_IMAGES = 5, 3  # text from the first 5 pages; scanned PDFs: first 3 page images (vision model limit)
MIME = {"image/jpeg": "jpeg", "image/jpg": "jpeg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf"}

MSG = {
    "empty": ("The file is empty. Please choose your report again.", "فائل خالی ہے۔ براہ کرم رپورٹ دوبارہ منتخب کریں۔"),
    "too_big": ("This file is too large. Photos are resized automatically; PDFs must be under 4 MB.",
                "یہ فائل بہت بڑی ہے۔ تصویریں خود چھوٹی ہو جاتی ہیں؛ پی ڈی ایف 4 ایم بی سے کم ہونی چاہیے۔"),
    "bad_type": ("Please upload a photo (JPG, PNG, WEBP) or a PDF of your report.",
                 "براہ کرم اپنی رپورٹ کی تصویر (JPG، PNG، WEBP) یا پی ڈی ایف اپ لوڈ کریں۔"),
    "heic": ("This HEIC photo could not be read. Please upload a screenshot of it, or set your camera to save JPG photos.",
             "یہ HEIC تصویر نہیں پڑھی جا سکی۔ اس کا اسکرین شاٹ اپ لوڈ کریں، یا کیمرے کو JPG میں محفوظ کرنے پر سیٹ کریں۔"),
    "pdf_locked": ("This PDF is password-protected. Please upload a photo or screenshot of the report instead.",
                   "یہ پی ڈی ایف پاس ورڈ سے محفوظ ہے۔ براہ کرم رپورٹ کی تصویر یا اسکرین شاٹ اپ لوڈ کریں۔"),
    "pdf_scan": ("We couldn't read this PDF. Please upload a clear photo or screenshot of the report instead.",
                 "یہ پی ڈی ایف نہیں پڑھی جا سکی۔ براہ کرم رپورٹ کی صاف تصویر یا اسکرین شاٹ اپ لوڈ کریں۔"),
    "unreadable": ("We couldn't read any values from this file. Please upload a clearer photo (good light, taken straight on), or type the values.",
                   "اس فائل سے کوئی ویلیو نہیں پڑھی جا سکی۔ زیادہ صاف تصویر (اچھی روشنی، سیدھی کھینچی ہوئی) اپ لوڈ کریں، یا ویلیوز لکھ دیں۔"),
    "not_medical": ("This doesn't look like a medical report. Please upload a photo or PDF of your lab, ECG or other medical report.",
                    "یہ میڈیکل رپورٹ نہیں لگتی۔ براہ کرم اپنی لیب، ای سی جی یا کسی اور میڈیکل رپورٹ کی تصویر یا پی ڈی ایف اپ لوڈ کریں۔"),
    "ai_off": ("Reading files needs the AI service, which is not available right now. Please type the values from your report instead.",
               "فائل پڑھنے کے لیے اے آئی سروس ضروری ہے جو ابھی دستیاب نہیں۔ براہ کرم رپورٹ کی ویلیوز لکھ دیں۔"),
    "busy": ("The reading service is busy or took too long. Please try again in a minute, or type the values.",
             "پڑھنے کی سروس مصروف ہے یا بہت دیر لگ گئی۔ ایک منٹ بعد دوبارہ کوشش کریں، یا ویلیوز لکھ دیں۔"),
    "server": ("Something went wrong while reading your file. Please try again, or type the values.",
               "فائل پڑھتے ہوئے کچھ غلط ہو گیا۔ دوبارہ کوشش کریں، یا ویلیوز لکھ دیں۔"),
}
TEXT = {
    "check": ("We read these values from your file. Please check them against your report and edit if needed.",
              "یہ ویلیوز آپ کی فائل سے پڑھی گئی ہیں۔ براہ کرم انہیں اپنی رپورٹ سے ملا کر دیکھیں اور ضرورت ہو تو درست کریں۔"),
    "tracing": ("MediBot cannot read the ECG tracing. A doctor must review it.",
                "میڈی بوٹ ای سی جی کی لکیریں (ٹریسنگ) نہیں پڑھ سکتا۔ ڈاکٹر کا اسے دیکھنا ضروری ہے۔"),
    "machine": ("The printed interpretation is made automatically by the ECG machine and must be confirmed by a doctor.",
                "رپورٹ پر لکھی تشریح ای سی جی مشین خود بناتی ہے، ڈاکٹر کا اس کی تصدیق کرنا ضروری ہے۔"),
    "mismatch": ("Some values are outside the usual range even though the report says normal. Please show this to a doctor.",
                 "رپورٹ پر نارمل لکھا ہے لیکن کچھ ویلیوز عام حد سے باہر ہیں۔ براہ کرم یہ ڈاکٹر کو دکھائیں۔"),
    "critical": ("{name} is {value} {unit}. This is far outside the usual range: please see a doctor today, or go to an emergency department if you feel very unwell.",
                 "{name} {value} {unit} ہے۔ یہ عام حد سے بہت باہر ہے: آج ہی ڈاکٹر کو دکھائیں، اور طبیعت زیادہ خراب ہو تو ایمرجنسی جائیں۔"),
    "urgent_ecg": ("The ECG report text mentions \"{what}\". Please show this report to a doctor today. If you have chest pain, breathlessness or fainting, call 1122 or 115 now.",
                   "ای سی جی رپورٹ میں \"{what}\" لکھا ہے۔ یہ رپورٹ آج ہی ڈاکٹر کو دکھائیں۔ سینے میں درد، سانس پھولنا یا بے ہوشی ہو تو ابھی 1122 یا 115 پر کال کریں۔"),
    "emergency": ("Your report mentions symptoms that can be an emergency ({what}). If you have these symptoms now, call 1122 or 115.",
                  "آپ کی رپورٹ میں ایسی علامات لکھی ہیں جو ایمرجنسی ہو سکتی ہیں ({what})۔ اگر ابھی یہ علامات ہیں تو 1122 یا 115 پر کال کریں۔"),
}


def _tr(pair: tuple[str, str], lang: str) -> str:
    return pair[1 if lang == "ur" else 0]


class UploadError(Exception):
    def __init__(self, status: int, key: str):
        super().__init__(key)
        self.status, self.key = status, key

    def text(self, lang: str) -> str:
        return _tr(MSG[self.key], lang)


# ------------------------------------------------------------ 1. validate the file

def sniff(data: bytes) -> str:
    """File type from its magic bytes (never from the name or extension)."""
    if data[:5] == b"%PDF-":
        return "pdf"
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data[4:8] == b"ftyp" and data[8:12] in (b"heic", b"heix", b"hevc", b"heim", b"heis", b"mif1", b"msf1"):
        return "heic"
    return ""


def check_file(data: bytes, mime: str | None) -> str:
    if not data:
        raise UploadError(400, "empty")
    if len(data) > MAX_BYTES:
        raise UploadError(413, "too_big")
    kind = sniff(data)
    if kind == "heic":
        raise UploadError(415, "heic")
    if not kind or MIME.get((mime or "").split(";")[0].strip().lower()) != kind:
        raise UploadError(415, "bad_type")
    return kind


# ------------------------------------------------------------ 2. privacy: strip identity from extracted text

_PII_LINE = re.compile(r"\b(patient|name|mrn?\s*#|mr\s*no|m\.r\.|cnic|nic\s*no|phone|mobile|cell|contact|address|father|husband|"
                       r"guardian|s/o|d/o|w/o|refer+ed\s*by|ref\.?\s*by|consultant|lab\s*(no|#)|reg(istration)?\.?\s*(no|#)|"
                       r"sample\s*(id|no)|visit\s*no|passport)\b", re.I)
_PII_NUM = re.compile(r"\b\d{5}-?\d{7}-?\d\b|(?:\+92|0092|\b0)\s?3\d{2}[\s-]?\d{7}\b")


def scrub(s) -> str:
    """Drop lines that carry identity labels (name, CNIC, phone, MR no...) and mask CNIC/phone numbers."""
    if not isinstance(s, str):
        return ""
    keep = [ln for ln in s.splitlines() if not _PII_LINE.search(ln)]
    return _PII_NUM.sub("[removed]", "\n".join(keep)).strip()


# ------------------------------------------------------------ 3. validate the AI's JSON

_THINK = re.compile(r"<think>.*?</think>", re.S)


def _s(v, n: int = 120) -> str | None:
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        v = f"{v:g}"
    return (v.strip()[:n] or None) if isinstance(v, str) else None


def _num(v) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.fullmatch(r"\s*([-+]?\d+(?:\.\d+)?)\s*(?:bpm|ms|msec|°|deg|degrees)?\s*", str(v), re.I)
    return float(m.group(1)) if m else None


def parse_extraction(raw: str | None) -> dict | None:
    """Strictly validate the transcription JSON. Returns a clean dict, or None if it is not usable."""
    if not raw:
        return None
    raw = _THINK.sub("", raw)
    a, b = raw.find("{"), raw.rfind("}")
    if a < 0 or b < a:
        return None
    try:
        d = json.loads(raw[a:b + 1])
    except ValueError:
        return None
    if not isinstance(d, dict) or not isinstance(d.get("tests") or [], list):
        return None
    tests, unreadable = [], []
    for x in (d.get("tests") or [])[:60]:
        if not isinstance(x, dict):
            continue
        name, value = _s(scrub(x.get("name")), 80), _s(x.get("value"), 40)
        if name and not value:
            unreadable.append(name)
        if not name or not value:
            continue
        flag = str(x.get("printed_flag") or "").strip().upper()[:1]
        tests.append({"name": name.replace(";", ","), "value": value, "unit": _s(x.get("unit"), 30) or "",
                      "printed_range": _s(x.get("printed_range"), 60), "printed_flag": flag if flag in ("H", "L", "N") else None})
    e = d.get("ecg") if isinstance(d.get("ecg"), dict) else {}
    ecg = {p["key"]: _num(e.get(p["key"])) for p in ECG["params"]}
    ecg["machine_statement"] = _s(scrub(e.get("machine_statement")), 300)
    unreadable += [u for u in (_s(scrub(x), 120) for x in (d.get("unreadable_parts") or [])[:20]) if u]
    rt = d.get("report_type")
    return {"is_medical": d.get("is_medical_report") is not False,
            "report_type": rt if rt in ("lab", "ecg", "imaging", "prescription", "other") else "other",
            "tests": tests, "ecg": ecg, "findings": _s(scrub(d.get("other_findings_text")), 800) or "",
            "unreadable": list(dict.fromkeys(unreadable))}


# ------------------------------------------------------------ 4. map printed names and units to MediBot's tests

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[.\-_:]", " ", s.lower())).strip()


_INDEX = {_norm(a): t for t in tools.LABS["tests"] for a in t["names"]}
_BY_ID = {t["id"]: t for t in tools.LABS["tests"]}
# extra printed spellings, used only for uploads (typed input keeps its own parser)
for _a, _id in {"glucose fasting": "fbs", "fasting plasma glucose": "fbs", "fasting blood glucose": "fbs", "blood sugar fasting": "fbs",
                "blood glucose fasting": "fbs", "sugar fasting": "fbs", "glucose random": "rbs", "random plasma glucose": "rbs",
                "blood glucose random": "rbs", "haemoglobin a1c": "hba1c", "hemoglobin a1c": "hba1c", "25 oh vitamin d": "vitd",
                "25(oh) vitamin d": "vitd", "25 hydroxy vitamin d": "vitd", "vitamin d total": "vitd", "alanine transaminase": "alt",
                "total wbc count": "wbc", "wbc count": "wbc", "tlc count": "wbc", "leucocyte count": "wbc", "leukocyte count": "wbc",
                "cholesterol total": "chol", "ldl cholesterol direct": "ldl"}.items():
    _INDEX[_norm(_a)] = _BY_ID[_id]
_PREFIX = re.compile(r"^(serum|s|plasma|blood)\s+")


def match_test(name: str) -> dict | None:
    """Exact match of the printed name (or its bracketed/slash parts) to a supported test. No substring guessing,
    so "Mean corpuscular haemoglobin" is NOT read as haemoglobin."""
    outside = re.sub(r"\(.*?\)", " ", name)
    cands = [name, outside, *re.findall(r"\((.*?)\)", name), *outside.split("/")]
    for c in cands:
        n = _norm(c)
        for k in (n, _PREFIX.sub("", n)):
            if k in _INDEX:
                return _INDEX[k]
    return None


_NUM = re.compile(r"(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)")
_MMOL = {"fbs": 18.0, "rbs": 18.0, "chol": 38.67, "ldl": 38.67, "hdl": 38.67, "tg": 88.57}
_UMOL = {"creat": 88.4, "uric": 59.48}


def _first_num(s: str | None) -> float | None:
    m = _NUM.search(s or "")
    return float(m.group(1).replace(",", "")) if m else None


def canonical(tid: str, value: str, unit: str) -> float | None:
    """Printed value -> the unit MediBot's ranges use (e.g. platelets 95,000/µL or 0.95 lac -> 95 ×10³/µL)."""
    v = _first_num(value)
    if v is None:
        return None
    u = f"{unit} {value}".lower()
    if tid in ("plt", "wbc"):
        if re.search(r"lac|lakh", u):
            v *= 100
        elif v >= 1000:
            v /= 1000
    elif tid == "hb" and re.search(r"g/l\b", u):
        v /= 10
    elif tid == "hba1c" and "mmol" in u:  # IFCC mmol/mol -> NGSP %
        v = v * 0.0915 + 2.15
    elif tid in _MMOL and "mmol" in u:
        v *= _MMOL[tid]
    elif tid in _UMOL and re.search(r"[µμu]mol", u):
        v /= _UMOL[tid]
    elif tid == "vitd" and "nmol" in u:
        v /= 2.496
    return round(v, 2)


_SEXED = re.compile(r"\b(female|women|male|men)\b|\(\s*[mf]\s*\)|\b[mf]\s*[:=]")


def parse_range(s: str | None, sex: str | None = None) -> tuple[float | None, float | None] | None:
    """Printed reference range -> (low, high); None if it can't be read safely."""
    if not s:
        return None
    s = re.sub(r"[x×]\s*10\s*\^?\s*\d+", "", s.lower().replace(",", ""))  # drop "x10^3" so it isn't read as a bound
    if _SEXED.search(s):  # sex-specific: use the matching one, never guess
        want = {"f": ("female", "women", "f"), "m": ("male", "men", "m")}.get(sex or "")
        hit = [r for lab, r in re.findall(r"\b(female|women|f|male|men|m)\s*[:=]?\s*([<>≤≥]?\s*\d[\d.\s\-–to]*)", s)
               if want and lab in want]
        return parse_range(hit[0]) if hit else None
    nums = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", s)]
    if not nums or len(nums) > 2:  # several bands (desirable / borderline / high): too ambiguous, use MediBot's range
        return None
    if re.search(r"<|≤|up ?to|less than|below", s):
        return None, nums[0]
    if re.search(r">|≥|more than|above", s):
        return nums[0], None
    m = re.search(r"(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)", s)
    if m and float(m.group(1)) <= float(m.group(2)):
        return float(m.group(1)), float(m.group(2))
    return None


def _printed_status(x: dict, sex: str | None) -> str | None:
    """The report's own range (or flag) decides, because it always beats MediBot's general range."""
    rng, v = parse_range(x["printed_range"], sex), _first_num(x["value"])
    if rng and v is not None:
        lo, hi = rng
        return "low" if lo is not None and v < lo else "high" if hi is not None and v > hi else "normal"
    return {"H": "high", "L": "low", "N": "normal"}.get(x["printed_flag"])


def _kb_meaning(t: dict, v: float, status: str, lang: str) -> str:
    note = ""
    for b_lo, b_hi, msg in t.get("bands", []):
        if b_lo <= v <= b_hi:
            note = msg[lang]
    meaning = t["lo" if status == "low" else "hi"][lang] if status in ("low", "high") else ""
    return " ".join(x for x in (note, meaning) if x)


def _line_name(x: dict, t: dict, v: float) -> str:
    """A textarea line the typed-input parser reads back as the same test and value."""
    base = t["names"][0]
    for cand in (x["name"], base.upper() if len(base) <= 5 else base.capitalize()):
        r = tools.read_lab(f"{cand} {tools._fmt(v)}")["rows"]
        if len(r) == 1 and r[0]["id"] == t["id"] and r[0]["value"] == tools._fmt(v):
            return cand
    return base


# ------------------------------------------------------------ 5. ECG and safety rules

def ecg_rows(ecg: dict, lang: str, sex: str | None) -> list[dict]:
    rows = []
    for p in ECG["params"]:
        v = ecg.get(p["key"])
        if v is None:
            continue
        lo, hi = p["low"], p.get(f"high_{sex}", p["high"])
        if lo is None:
            st, rng = "info", "-"
        else:
            st = "low" if v < lo else "high" if v > hi else "normal"
            rng = f"< {tools._fmt(hi + 1)}" if lo == 0 else f"{tools._fmt(lo)}–{tools._fmt(hi)}"
            if p["id"] == "qtc" and sex not in ("f", "m"):
                rng = "< 450 (M) / < 460 (F)"
        meaning = " ".join(m for m in (p["about"][lang], p["lo" if st == "low" else "hi"][lang] if st in ("low", "high") else "") if m)
        rows.append({"id": "ecg_" + p["id"], "name": p[lang], "value": tools._fmt(v), "unit": p["unit"], "range": rng,
                     "status": st, "meaning": meaning})
    return rows


def ecg_warnings(rows: list[dict], statement: str | None, lang: str) -> list[str]:
    out = [_tr(TEXT["tracing"], lang)]
    if statement:
        out.append(_tr(TEXT["machine"], lang))
        if any(r["status"] in ("low", "high") for r in rows) and re.search(r"\bnormal\b", statement, re.I) \
                and not re.search(r"abnormal|borderline", statement, re.I):
            out.insert(0, _tr(TEXT["mismatch"], lang))
    return out


# rule-based critical values (canonical units); never left to the AI
CRITICAL = {"hb": lambda v: v < 7, "plt": lambda v: v < 50, "wbc": lambda v: v < 1 or v > 30,
            "fbs": lambda v: v < 54 or v >= 300, "rbs": lambda v: v < 54 or v >= 300,
            "ecg_hr": lambda v: v < 40 or v > 150, "ecg_qtc": lambda v: v >= 500}
CRITICAL_BY_NAME = [(re.compile(r"^(serum )?(potassium|k\+?)( \(k\+?\))?$"), lambda v: v < 3.0 or v > 6.0),
                    (re.compile(r"^(serum )?(sodium|na\+?)( \(na\+?\))?$"), lambda v: v < 125 or v > 155)]
URGENT_ECG = re.compile(r"acute|infarct|stemi|st elevation|ventricular tachycardia|v-?tach|ventricular fibrillation|"
                        r"complete heart block|third degree|3rd degree|asystole", re.I)


def critical_checks(rows: list[dict], lang: str, tests: list[dict] = (), statement: str | None = None) -> list[str]:
    out = []
    for r in rows:
        f, v = CRITICAL.get(r["id"]), _first_num(r["value"])
        if f and v is not None and f(v):
            out.append(_tr(TEXT["critical"], lang).format(name=r["name"], value=r["value"], unit=r["unit"]))
    for x in tests:
        v = _first_num(x["value"])
        for rx, f in CRITICAL_BY_NAME:
            if v is not None and rx.match(_norm(x["name"])) and f(v):
                out.append(_tr(TEXT["critical"], lang).format(name=x["name"], value=x["value"], unit=x["unit"]))
    m = URGENT_ECG.search(statement or "")
    if m:
        out.append(_tr(TEXT["urgent_ecg"], lang).format(what=m.group(0)))
    return out


def emergency(text: str, lang: str) -> dict | None:
    """Reuse the chat's emergency rules on printed symptoms (e.g. "c/o chest pain")."""
    hit = engine.check_emergency(engine.normalise(text), text) if text else None
    if not hit or hit[0] not in ("heart", "stroke", "breathing", "unconscious", "bleeding"):
        return None
    return {"kind": hit[0], "text": _tr(TEXT["emergency"], lang).format(what=hit[1][lang].rstrip("."))}


# ------------------------------------------------------------ 6. build the same result shape as /api/lab

def build(ex: dict, lang: str = "en", sex: str | None = None) -> dict:
    lines, by_id, other, other_lines = [], {}, [], []
    for x in ex["tests"]:
        t = match_test(x["name"])
        v = canonical(t["id"], x["value"], x["unit"]) if t else None
        if t and v is not None and t["id"] not in by_id:
            by_id[t["id"]] = (x, v)
            lines.append(f"{_line_name(x, t, v)} {tools._fmt(v)} {t['unit']}")
            continue
        st = _printed_status(x, sex) or "unclear"
        other.append({"id": "rep_" + str(len(other)), "name": x["name"], "value": x["value"], "unit": x["unit"],
                      "range": x["printed_range"] or "-", "range_src": "report" if x["printed_range"] else "", "status": st, "meaning": ""})
        line = " ".join(p for p in (x["name"], x["value"], x["unit"], f"({x['printed_range']})" if x["printed_range"] else "") if p)
        if not tools.read_lab(line)["rows"]:  # don't feed lines the typed parser would misread
            other_lines.append(line)
    res = tools.read_lab("\n".join(lines), lang, sex)  # exactly the typed-input result for supported tests
    statement = ex["ecg"].get("machine_statement")
    ecg = ecg_rows(ex["ecg"], lang, sex)
    critical = critical_checks(res["rows"] + ecg, lang, ex["tests"], statement)
    for r in res["rows"]:  # then the report's printed range/flag wins
        x, v = by_id[r["id"]]
        st = _printed_status(x, sex)
        if st:
            if parse_range(x["printed_range"], sex):
                r.update(value=x["value"], unit=x["unit"], range=x["printed_range"], range_src="report")
            r.update(status=st, meaning=_kb_meaning(_BY_ID[r["id"]], v, st, lang))
    rows = res["rows"] + other + ecg
    is_ecg = bool(ecg) or ex["report_type"] == "ecg"
    findings = "\n".join(p for p in (statement, ex["findings"]) if p)
    res.update(rows=rows, abnormal=sum(r["status"] in ("low", "high") for r in rows),
               report_type="ecg" if is_ecg and not res["rows"] else ex["report_type"],
               extracted_text_lines=lines + other_lines, unreadable_parts=ex["unreadable"], findings=findings,
               confidence_note=_tr(TEXT["check"], lang), critical=critical,
               warnings=ecg_warnings(ecg, statement, lang) if is_ecg else [],
               emergency=emergency(findings, lang), upload=True)
    if is_ecg:
        res["sources"] = res["sources"] + [{"name": n, "url": u} for n, u in ECG["source"]]
    return res


# ------------------------------------------------------------ 7. extraction pipeline

def _pdf(data: bytes) -> tuple[str, list[bytes]]:
    """(text of the first pages, or [] ) / (scanned pages as JPEG bytes). In memory only."""
    try:
        from pypdf import PdfReader
        rd = PdfReader(io.BytesIO(data))
        if rd.is_encrypted:
            try:
                ok = rd.decrypt("")  # many "protected" PDFs open with an empty password
            except Exception:
                ok = 0
            if not ok:
                raise UploadError(422, "pdf_locked")
        pages = list(rd.pages[:PDF_PAGES])
        text = scrub("\n".join(p.extract_text() or "" for p in pages))[:6000]
        if len(re.sub(r"\s", "", text)) >= 20:
            return text, []
        imgs = []
        for p in pages[:PDF_IMAGES]:  # scans are usually one JPEG per page; DCTDecode data is the JPEG itself
            res = p.get("/Resources")
            xo = res.get_object().get("/XObject") if res is not None else None
            for k in (xo.get_object() if xo is not None else {}):
                o = xo.get_object()[k].get_object()
                if o.get("/Subtype") == "/Image":
                    b = o.get_data()
                    if b[:3] == b"\xff\xd8\xff":
                        imgs.append(b)
                        break
        return "", imgs
    except UploadError:
        raise
    except Exception:
        raise UploadError(422, "pdf_scan")


def _ask(text: str | None = None, images: list[str] | None = None) -> dict | None:
    for _ in range(2):  # one retry if the JSON is invalid
        raw = llm.read_report(text=text, images=images)
        if raw is None:
            return None
        ex = parse_extraction(raw)
        if ex:
            return ex
    return None


def _offline(text: str) -> dict:
    """No AI: run the existing typed-input parser over the PDF's text layer."""
    rows = tools.read_lab(text)["rows"]
    tests = [{"name": _BY_ID[r["id"]]["names"][0], "value": r["value"], "unit": r["unit"], "printed_range": None,
              "printed_flag": None} for r in rows]
    return {"is_medical": True, "report_type": "lab", "tests": tests, "ecg": {}, "findings": "", "unreadable": []}


def extract(data: bytes, kind: str) -> dict:
    images = [data]
    if kind == "pdf":
        text, images = _pdf(data)
        if text:
            ex = _ask(text=text) if llm.enabled() else None
            if ex is None:
                ex = _offline(text)
                if not ex["tests"]:
                    raise UploadError(503, "busy" if llm.enabled() else "ai_off")
            return ex
        if not images:
            raise UploadError(422, "pdf_scan")
        kind = "jpeg"
    if not llm.enabled():
        raise UploadError(503, "ai_off")
    mime = {"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}[kind]
    ex = _ask(images=[f"data:{mime};base64,{base64.b64encode(b).decode()}" for b in images])
    if ex is None:
        raise UploadError(503, "busy")
    return ex


EXPLAIN_RULES = ("The values below were read from an uploaded report by software and may contain reading mistakes; remind the user to "
                 "check them against the paper report. Never add values that are not listed. Rows marked 'unclear' could not be judged: "
                 "ask the user to check them with a doctor. Rows whose range comes from the report use the report's own range. Do not give "
                 "medicine names with doses; for a prescription only say in general what each medicine is commonly used for and to follow "
                 "the doctor and pharmacist. End with a short 'What to do' list. ")
ECG_RULES = ("This is an ECG report. You only see the printed numbers and statement, not the tracing: say clearly that a doctor must "
             "review the tracing and that the machine's printed statement must be confirmed by a doctor. Explain heart rate, PR, QRS, "
             "QT/QTc and axis in simple words, what values outside the usual range can generally be linked to, and when to see a doctor or "
             "cardiologist. Do not name a diagnosis. ")


def process(data: bytes, mime: str | None, lang: str = "en", sex: str | None = None) -> dict:
    kind = check_file(data, mime)
    ex = extract(data, kind)
    if not ex["is_medical"]:
        raise UploadError(422, "not_medical")
    res = build(ex, lang, sex)
    if not res["rows"] and not res["findings"]:
        raise UploadError(422, "unreadable")
    res["engine"] = "rules"
    if llm.enabled():
        raw = "\n".join(res["extracted_text_lines"]) + (f"\nPrinted report text: {res['findings']}" if res["findings"] else "")
        r = llm.explain_lab(res["rows"], raw, "urdu" if lang == "ur" else "en",
                            EXPLAIN_RULES + (ECG_RULES if res["warnings"] else ""))
        if r:
            res["ai_text"], res["engine"] = r[0], r[1]
    return res
