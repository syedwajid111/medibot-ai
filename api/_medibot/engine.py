"""
MediBot engine: a self-contained Retrieval-Augmented assistant.

No external AI service is required. The pipeline is:
  1. normalise + language detection (English, Urdu script, Roman Urdu)
  2. safety layer: emergency red-flag rules (runs before anything else)
  3. retrieval: keyword/synonym matching + BM25 over a curated knowledge base
     written from trusted sources (NHS, WHO)
  4. triage: self-care / see a doctor / urgent, from symptoms + modifiers
     (age, pregnancy, duration, temperature)
  5. grounded answer composition: every sentence comes from the knowledge
     base, with its source links. If nothing relevant is found, MediBot says
     so instead of guessing.
An optional LLM (free Groq tier) can rephrase the grounded answer, but it is
off unless GROQ_API_KEY is set.
"""
from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent
DOCS: list[dict] = []
for name in ("kb_conditions.json", "kb_medicines.json", "kb_prevention.json"):
    DOCS.extend(json.loads((HERE / name).read_text(encoding="utf-8")))
BY_ID = {d["id"]: d for d in DOCS}

URDU = re.compile(r"[؀-ۿ]")
DISCLAIMER = {
    "en": "MediBot gives general health information, not a diagnosis. For personal advice, see a qualified doctor.",
    "ur": "میڈی بوٹ عام صحت کی معلومات دیتا ہے، تشخیص نہیں کرتا۔ ذاتی مشورے کے لیے مستند ڈاکٹر سے رجوع کریں۔",
}

# --------------------------------------------------------------- normalising

def normalise(text: str) -> str:
    t = text.lower()
    t = t.translate(str.maketrans({"ي": "ی", "ك": "ک", "ۀ": "ہ", "ة": "ہ", "ٰ": ""}))
    t = t.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))
    t = re.sub(r"[ً-ْ]", "", t)  # Arabic diacritics
    t = re.sub(r"[^\w\s؀-ۿ°.]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


ROMAN = re.compile(
    r"\b(hai|hain|mujhe|muje|mjhe|mera|meri|kya|kia|ka|ki|ke|ko|se|mein|main|nahi|nai|bhi|aur|kaise|kesay|"
    r"dard|bukhar|bukhaar|khansi|ulti|dast|pet|sar|gala|kamar|seene|saans|chakkar|kamzori|dawai|dawa|goli|"
    r"bacha|bachay|bachi|din|hafte|raat|bohat|bahut|zyada|kam|ho|raha|rahi|gaya|gayi|kar|karo|batao|bataen)\b"
)
EN_HINT = re.compile(r"\b(the|is|are|i|my|have|has|what|how|should|can|do|does|for|with|and|it|of|a|an)\b")


def detect_lang(text: str, ui_lang: str = "en") -> str:
    """Return 'en' or 'ur'. Urdu script and Roman Urdu get Urdu replies."""
    if URDU.search(text):
        return "ur"
    t = text.lower()
    roman = len(ROMAN.findall(t))
    english = len(EN_HINT.findall(t))
    if roman >= 2 and roman > english:
        return "ur"
    if roman >= 1 and english == 0 and ui_lang == "ur":
        return "ur"
    if english == 0 and roman == 0:
        return ui_lang if ui_lang in ("en", "ur") else "en"
    return "en"


# ------------------------------------------------------------ safety layer

EMERGENCIES = [
    ("heart", r"chest pain|chest tightness|heart attack|seene (mein|main|me) (dard|dabao|bojh)|dil (ka|ke) dora|dil mein dard"
              r"|سینے میں (درد|دباؤ)|دل کا دورہ",
     {"en": "Chest pain can be a heart attack.", "ur": "سینے کا درد دل کا دورہ ہو سکتا ہے۔"}),
    ("stroke", r"face.{0,15}droop|droop\w* face|slurred|slurring|one side (of my|of the|of his|of her)? ?body|weakness on one side|"
               r"(can'?t|cannot|unable to) (speak|talk)|(arm|leg|side) (is |feels |went )?(suddenly )?(weak|numb)|stroke|falij|faalij|munh tehra|chehra tehra|zaban (larkhara|ruk)|فالج|چہرہ ٹیڑھا|زبان لڑکھڑا",
     {"en": "These can be signs of a stroke (FAST: Face, Arms, Speech, Time).", "ur": "یہ فالج کی علامات ہو سکتی ہیں (چہرہ، بازو، بولنا، وقت)۔"}),
    ("breathing", r"can'?t breathe|cannot breathe|unable to breathe|difficulty breathing|struggling to breathe|choking|"
                  r"blue lips|lips (are |turning )?blue|saans nahi|saans nai|saans (lene|lainay) mein (mushkil|taklif)|dam ghut|"
                  r"سانس نہیں|سانس لینے میں (مشکل|دشواری|تکلیف)|دم گھٹ",
     {"en": "Severe difficulty breathing is an emergency.", "ur": "سانس لینے میں شدید دشواری ایمرجنسی ہے۔"}),
    ("unconscious", r"unconscious|not waking|unresponsive|fainted and|passed out|seizure|fits?\b|convulsion|behosh|be hosh|"
                    r"dora para|dora pada|mirgi|بے ہوش|بیہوش|دورہ پڑ|مرگی",
     {"en": "Loss of consciousness or a seizure needs emergency help.", "ur": "بے ہوشی یا دورہ پڑنا ایمرجنسی ہے۔"}),
    ("bleeding", r"heavy bleeding|bleeding (a lot|heavily|won'?t stop|will not stop)|vomiting blood|blood in vomit|coughing (up )?blood|"
                 r"khoon (ruk nahi|band nahi|ki ulti)|خون (رک نہیں|بند نہیں)|خون کی الٹی",
     {"en": "Heavy bleeding or vomiting blood is an emergency.", "ur": "زیادہ خون بہنا یا خون کی الٹی ایمرجنسی ہے۔"}),
    ("anaphylaxis", r"(throat|tongue|lips?|face) (is )?(swelling|swollen)|anaphyla|severe allergic|"
                    r"(gala|zaban|honth) sooj|گلا سوج|زبان سوج|ہونٹ سوج",
     {"en": "Swelling of the face, lips or throat can be a severe allergic reaction.", "ur": "چہرے، ہونٹ یا گلے کی سوجن شدید الرجی ہو سکتی ہے۔"}),
    ("poison", r"overdose|over dose|poison|swallowed (bleach|chemical|pills)|took too many (pills|tablets)|zeher|zehar|"
               r"bohat (sari|zyada) goliyan|زہر|بہت ساری گولیاں",
     {"en": "Possible poisoning or overdose needs urgent help, even if the person seems fine.", "ur": "زہر یا دوا کی زیادہ مقدار کی صورت میں فوراً مدد لیں، چاہے طبیعت ٹھیک لگے۔"}),
    ("selfharm", r"suicid|kill myself|end my life|want to die|self.?harm|hurt myself|khudkushi|khud kushi|mar jana chahta|mar jana chahti|"
                 r"marna chahta|marna chahti|zindagi khatam|خودکشی|مرنا چاہت|زندگی ختم",
     {"en": "You don't have to go through this alone.", "ur": "آپ اکیلے نہیں ہیں۔"}),
    ("head_injury", r"head injury.*(vomit|sleepy|confus)|hit (my|his|her) head.*(vomit|sleepy|confus|bleed)",
     {"en": "A head injury with vomiting, drowsiness or confusion needs urgent care.", "ur": "سر کی چوٹ کے بعد الٹی، غنودگی یا الجھن ہو تو فوراً ہسپتال جائیں۔"}),
    ("snake", r"snake ?bite|saanp ne kaat|sanp ne kat|سانپ نے کاٹ",
     {"en": "A snake bite needs emergency treatment.", "ur": "سانپ کا کاٹنا ایمرجنسی ہے۔"}),
    ("infant_fever", r"(baby|infant|newborn|naumolood|nomolood|\b[1-2] (month|months|mahine|mahina)).{0,40}(fever|bukhar|temperature)|"
                     r"(fever|bukhar).{0,40}(newborn|[1-2] (month|months|mahine|mahina) (old|ka|ki))|نومولود.{0,30}بخار",
     {"en": "Fever in a baby under 3 months needs urgent medical assessment.", "ur": "3 ماہ سے کم عمر بچے کو بخار ہو تو فوراً ڈاکٹر کو دکھائیں۔"}),
    ("meningitis", r"stiff neck.{0,60}(fever|rash)|(fever|rash).{0,60}stiff neck|rash (that )?(does not|doesn'?t|won'?t) fade|"
                   r"gardan akar.{0,40}bukhar|گردن اکڑ.{0,30}بخار",
     {"en": "Fever with a stiff neck or a rash that does not fade can be meningitis.", "ur": "بخار کے ساتھ گردن اکڑنا یا نہ مٹنے والے دانے گردن توڑ بخار ہو سکتے ہیں۔"}),
    ("dengue_warning", r"(dengue|dengi|ڈینگی).{0,80}(bleed|blood|khoon|خون|severe (stomach|tummy|abdominal) pain|vomiting)|"
                       r"(bleeding gums|masoor?h?on se khoon|مسوڑھوں سے خون)",
     {"en": "These are warning signs of severe dengue.", "ur": "یہ شدید ڈینگی کی خطرے کی علامات ہیں۔"}),
]
EMERGENCY_RE = [(k, re.compile(p, re.I), msg) for k, p, msg in EMERGENCIES]

HELP = {
    "en": [
        "Call **1122** (Rescue, Punjab/KP/other provinces) or **115** (Edhi ambulance) now, or go to the nearest emergency department.",
        "Do not drive yourself. Stay with the person and keep the phone line open.",
    ],
    "ur": [
        "ابھی **1122** (ریسکیو) یا **115** (ایدھی ایمبولینس) پر کال کریں، یا قریبی ہسپتال کی ایمرجنسی جائیں۔",
        "خود گاڑی نہ چلائیں۔ مریض کے ساتھ رہیں۔",
    ],
}
FIRST_AID = {
    "heart": {"en": "Sit the person down and keep them calm. If they are not allergic and a doctor hasn't said otherwise, chewing one 300 mg aspirin may help while waiting.",
              "ur": "مریض کو بٹھا دیں اور پرسکون رکھیں۔ اگر الرجی نہ ہو تو انتظار کے دوران 300 ملی گرام اسپرین چبانا مددگار ہو سکتا ہے۔"},
    "stroke": {"en": "Note the time symptoms started. Do not give food or drink.", "ur": "علامات شروع ہونے کا وقت نوٹ کریں۔ کھانے پینے کو کچھ نہ دیں۔"},
    "breathing": {"en": "Sit upright and loosen tight clothing. If they have a reliever inhaler, use it.", "ur": "سیدھا بٹھائیں اور تنگ کپڑے ڈھیلے کریں۔ اگر ان ہیلر ہو تو استعمال کریں۔"},
    "unconscious": {"en": "If breathing, place them on their side (recovery position). During a seizure, protect the head and do not put anything in the mouth.",
                    "ur": "اگر سانس چل رہی ہو تو کروٹ کے بل لٹا دیں۔ دورے کے دوران سر کو بچائیں اور منہ میں کچھ نہ ڈالیں۔"},
    "bleeding": {"en": "Press firmly on the wound with a clean cloth and keep pressing.", "ur": "صاف کپڑے سے زخم کو مضبوطی سے دبا کر رکھیں۔"},
    "anaphylaxis": {"en": "If they have an adrenaline auto-injector, use it. Lie them down with legs raised (sit up if breathing is hard).",
                    "ur": "اگر ایڈرینالین انجیکشن ہو تو لگائیں۔ لٹا کر ٹانگیں اونچی کریں (سانس میں مشکل ہو تو بٹھا دیں)۔"},
    "poison": {"en": "Do not make them vomit. Keep the medicine or chemical packet to show the doctor.", "ur": "الٹی نہ کروائیں۔ دوا یا کیمیکل کا ڈبہ ڈاکٹر کو دکھانے کے لیے ساتھ رکھیں۔"},
    "snake": {"en": "Keep the person still and the bitten limb below heart level. Do not cut, suck or tie the wound.", "ur": "مریض کو ساکت رکھیں اور متاثرہ حصہ دل سے نیچے رکھیں۔ زخم کو نہ کاٹیں، نہ چوسیں، نہ باندھیں۔"},
}
SELF_HARM = {
    "en": ["If you are in immediate danger, call **1122** now.",
           "Talk to someone today: **Umang mental health helpline 0311-7786264** (Pakistan, free, confidential).",
           "If you can, stay with someone you trust and tell them how you feel."],
    "ur": ["اگر فوری خطرہ ہو تو ابھی **1122** پر کال کریں۔",
           "آج ہی کسی سے بات کریں: **امنگ ہیلپ لائن 0311-7786264** (مفت اور رازدارانہ)۔",
           "ممکن ہو تو کسی بھروسے والے شخص کے ساتھ رہیں اور اسے اپنی کیفیت بتائیں۔"],
}


def check_emergency(norm: str, raw: str):
    text = f"{norm} {raw.lower()}"
    for key, rx, msg in EMERGENCY_RE:
        if rx.search(text):
            return key, msg
    return None


# --------------------------------------------------------------- retrieval

TOKEN = re.compile(r"[a-z0-9]+|[؀-ۿ]+")
STOP = set("a an the is are am i my me you your it its of to in on for with and or be have has had do does what how why when should can could "
           "will would please tell about this that there was were from at by as if so hai hain ka ki ke ko se mein main me ho kya kia".split())


def tokens(text: str) -> list[str]:
    out = []
    for w in TOKEN.findall(text):
        if w in STOP:
            continue
        if len(w) > 4 and w.endswith("ing"):
            w = w[:-3]
        elif len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return out


def _doc_text(d: dict) -> str:
    parts = [d["en"]["title"], d["en"]["summary"], d["ur"]["title"], " ".join(d["kw"])]
    for k in ("causes", "uses", "tips"):
        parts += d["en"].get(k, [])
    return normalise(" ".join(parts))


class BM25:
    def __init__(self, docs: list[str], k1: float = 1.4, b: float = 0.75):
        self.toks = [tokens(t) for t in docs]
        self.k1, self.b = k1, b
        self.avg = sum(map(len, self.toks)) / len(self.toks)
        df = Counter(w for t in self.toks for w in set(t))
        n = len(self.toks)
        self.idf = {w: math.log(1 + (n - f + 0.5) / (f + 0.5)) for w, f in df.items()}
        self.tf = [Counter(t) for t in self.toks]

    def scores(self, q: list[str]) -> list[float]:
        res = []
        for tf, t in zip(self.tf, self.toks):
            s = 0.0
            for w in q:
                if w in tf:
                    f = tf[w]
                    s += self.idf[w] * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * len(t) / self.avg))
            res.append(s)
        return res


INDEX = BM25([_doc_text(d) for d in DOCS])
KW = [[normalise(k) for k in d["kw"]] for d in DOCS]


def _kw_hit(q: str, kw: str) -> bool:
    if URDU.search(kw):
        return kw in q
    return re.search(rf"(?<![a-z]){re.escape(kw)}(?![a-z])", q) is not None


def retrieve(norm: str, k: int = 3) -> list[tuple[dict, float, int]]:
    """Return [(doc, score, keyword_hits)] best first."""
    bm = INDEX.scores(tokens(norm))
    ranked = []
    for d, kws, s in zip(DOCS, KW, bm):
        hits = [kw for kw in kws if _kw_hit(norm, kw)]
        # longer phrases are stronger evidence ("chest pain" beats "pain")
        kscore = sum(1.0 + 0.5 * kw.count(" ") for kw in hits)
        ranked.append((d, 3.0 * kscore + s, len(hits)))
    ranked.sort(key=lambda x: x[1], reverse=True)
    return [r for r in ranked[:k] if r[1] > 0]


# ------------------------------------------------------------------ triage

URGENT_TYPES = {"dengue", "malaria", "typhoid", "uti", "diabetes", "brain_tumour"}


def parse_modifiers(norm: str) -> dict:
    m: dict = {}
    if re.search(r"\b(baby|infant|newborn|toddler|child|kid|son|daughter|bacha|bachay|bache|bachi|beta|beti|munna|munni)\b|بچہ|بچے|بچی|بیٹا|بیٹی", norm):
        m["child"] = True
    if re.search(r"\b(pregnan|expecting|hamla|hamal|umeed se)\w*|حاملہ|حمل|امید سے", norm):
        m["pregnant"] = True
    if re.search(r"\b(elderly|old (man|woman|person)|grand(mother|father|ma|pa)|dada|dadi|nana|nani|buzurg)\b|بزرگ|دادا|دادی|نانا|نانی", norm):
        m["elderly"] = True
    d = re.search(r"(\d+)\s*(day|days|din|دن|week|weeks|hafte|hafta|ہفت\w*|month|months|mahine|mahina|مہین\w*)", norm)
    if d:
        n, u = int(d.group(1)), d.group(2)
        m["days"] = n * (7 if re.match(r"week|haft|ہفت", u) else 30 if re.match(r"month|mahin|مہین", u) else 1)
    t = re.search(r"(\d{2,3}(?:\.\d)?)\s*(°|deg|degree|f\b|c\b)?", norm)
    if t and re.search(r"fever|bukhar|bukhaar|temperature|temp|بخار|°", norm):
        v = float(t.group(1))
        if 34 <= v <= 43:
            m["temp_c"] = v
        elif 93 <= v <= 110:
            m["temp_c"] = round((v - 32) * 5 / 9, 1)
    return m


def triage(docs: list[dict], mods: dict, lang: str) -> dict:
    level = "self_care"
    reasons: list[str] = []
    ids = {d["id"] for d in docs}
    T = {
        "en": {"type": "This condition usually needs a doctor's assessment and tests.",
               "temp": "Temperature of 39.4°C (103°F) or more.", "days": "Symptoms have lasted more than 3 days.",
               "child": "Symptoms in a child need closer watching.", "preg": "Pregnancy: check with your doctor before taking medicines.",
               "old": "Older adults can become unwell faster."},
        "ur": {"type": "اس بیماری میں عموماً ڈاکٹر کا معائنہ اور ٹیسٹ ضروری ہوتے ہیں۔",
               "temp": "درجہ حرارت 39.4°C (103°F) یا زیادہ۔", "days": "علامات 3 دن سے زیادہ سے ہیں۔",
               "child": "بچے کی علامات پر زیادہ دھیان دیں۔", "preg": "حمل: کوئی دوا لینے سے پہلے ڈاکٹر سے پوچھیں۔",
               "old": "بزرگوں کی طبیعت جلد بگڑ سکتی ہے۔"},
    }[lang]
    if ids & URGENT_TYPES:
        level, _ = "doctor", reasons.append(T["type"])
    if mods.get("temp_c", 0) >= 39.4:
        level = "doctor"; reasons.append(T["temp"])
    if mods.get("days", 0) > 3 and any(d["type"] in ("symptom", "condition") for d in docs):
        level = "doctor"; reasons.append(T["days"])
    if mods.get("child"):
        reasons.append(T["child"])
    if mods.get("pregnant"):
        level = "doctor" if docs else level; reasons.append(T["preg"])
    if mods.get("elderly"):
        reasons.append(T["old"])
    return {"level": level, "reasons": reasons}


# --------------------------------------------------------------- composing

LABELS = {
    "en": {"causes": "Common causes", "care": "What you can do at home", "doctor": "See a doctor if",
           "red": "Get emergency help if", "uses": "Used for", "side": "Possible side effects",
           "precautions": "Important precautions", "tips": "Tips", "nodx": "I can't tell you what you have, but here is trusted information that may help."},
    "ur": {"causes": "عام وجوہات", "care": "گھر پر کیا کریں", "doctor": "ڈاکٹر کو دکھائیں اگر",
           "red": "فوراً ایمرجنسی جائیں اگر", "uses": "استعمال", "side": "ممکنہ مضر اثرات",
           "precautions": "اہم احتیاطیں", "tips": "مشورے", "nodx": "میں آپ کی بیماری کی تشخیص نہیں کر سکتا، لیکن یہ مستند معلومات مدد دے سکتی ہیں۔"},
}


def card(d: dict, lang: str, focus: str | None = None) -> dict:
    c = d[lang]
    L = LABELS[lang]
    order = {"medicine": ["uses", "precautions", "side"], "prevention": ["tips"]}.get(d["type"], ["causes", "care", "doctor", "red"])
    if focus == "care" and "care" in order:
        order = ["care", "doctor", "red"]
    if focus == "dose" and d["type"] == "medicine":
        order = ["precautions", "uses", "side"]
    sections = [{"key": k, "heading": L[k], "items": c[k]} for k in order if c.get(k)]
    return {"id": d["id"], "type": d["type"], "title": c["title"], "summary": c["summary"], "sections": sections,
            "sources": [{"name": n, "url": u} for n, u in d["src"]]}


def card_text(cd: dict) -> str:
    lines = [f"**{cd['title']}**", cd["summary"]]
    for s in cd["sections"]:
        lines.append(f"\n**{s['heading']}:**")
        lines += [f"• {i}" for i in s["items"]]
    return "\n".join(lines)


GREET = re.compile(r"^(hi|hello|hey|salam|assalam|aoa|asalam|السلام|سلام|ہیلو)\b")
THANKS = re.compile(r"^(thanks|thank you|thx|shukriya|shukria|jazak|شکریہ)")
DIAG = re.compile(r"\b(do i have|have i got|is it|diagnos|kya mujhe .* hai|mujhe .* to nahi)\b|کیا مجھے")
DOSE = re.compile(r"\b(dose|dosage|how much|how many|mg|kitni|kitna|kitne) ?(goli|goliyan|tablet|dawa|mg)?\b|خوراک|کتنی گولی")
CARE_Q = re.compile(r"\b(treatment|treat|cure|remedy|ilaj|ilaaj|kya karun|kya karen|what should i do|medicine for|dawa)\b|علاج|کیا کروں|دوا")
FOLLOW = re.compile(r"^(and |what about |is (k|ka|ki)|it|its|that|this|uska|iska|us ka|is ka|aur)\b|اس کا|اس کی|اور")
HEALTH_HINT = re.compile(r"pain|dard|ache|sick|ill|disease|symptom|medicine|tablet|doctor|health|hospital|bimar|bimari|dawa|sehat|"
                         r"treat|cancer|tumou?r|infection|virus|vaccin|blood|kidney|liver|heart|lung|skin|eye|ear|tooth|teeth|surgery|pregnan|"
                         r"دوا|بیمار|درد|صحت|ڈاکٹر|علامت")

SMALL = {
    "greet": {"en": "Hello! I'm MediBot. Ask me about a symptom, a common illness, a medicine or how to stay healthy. In an emergency, call 1122.",
              "ur": "السلام علیکم! میں میڈی بوٹ ہوں۔ مجھ سے کسی علامت، عام بیماری، دوا یا صحت مند رہنے کے بارے میں پوچھیں۔ ایمرجنسی میں 1122 پر کال کریں۔"},
    "thanks": {"en": "You're welcome. Take care, and see a doctor if things get worse.", "ur": "خوش رہیں۔ اپنا خیال رکھیں، اور حالت بگڑے تو ڈاکٹر سے ضرور ملیں۔"},
    "offtopic": {"en": "I can only help with health questions: symptoms, common illnesses, medicines and prevention. What health question can I help with?",
                 "ur": "میں صرف صحت سے متعلق سوالات میں مدد کر سکتا ہوں: علامات، عام بیماریاں، دوائیں اور بچاؤ۔ صحت کا کون سا سوال ہے؟"},
    "unknown": {"en": "I don't have trusted information on that in my knowledge base, so I won't guess. Please ask a doctor or pharmacist. You can also try describing the main symptom (for example: fever, cough, stomach pain).",
                "ur": "اس بارے میں میرے پاس مستند معلومات نہیں، اس لیے میں اندازہ نہیں لگاؤں گا۔ براہِ کرم ڈاکٹر یا فارماسسٹ سے پوچھیں۔ آپ بنیادی علامت لکھ کر بھی دیکھ سکتے ہیں (جیسے بخار، کھانسی، پیٹ درد)۔"},
}

SUGGEST = {
    "en": ["What can I do at home?", "When should I see a doctor?", "Is paracetamol safe?", "How to prevent dengue?"],
    "ur": ["گھر پر کیا کروں؟", "ڈاکٹر کو کب دکھاؤں؟", "پیراسیٹامول محفوظ ہے؟", "ڈینگی سے کیسے بچیں؟"],
}


def answer(message: str, ui_lang: str = "en", context: list[str] | None = None, lock: bool = False) -> dict:
    raw = (message or "").strip()[:1000]
    lang = ui_lang if lock and ui_lang in ("en", "ur") else detect_lang(raw, ui_lang)
    norm = normalise(raw)
    base = {"lang": lang, "disclaimer": DISCLAIMER[lang], "cards": [], "triage": None, "emergency": None,
            "suggestions": SUGGEST[lang], "topics": []}

    if not norm:
        return {**base, "type": "small", "text": SMALL["greet"][lang]}

    # 1) safety first
    em = check_emergency(norm, raw)
    if em:
        key, msg = em
        steps = SELF_HARM[lang] if key == "selfharm" else HELP[lang] + ([FIRST_AID[key][lang]] if key in FIRST_AID else [])
        related = retrieve(norm, 1)
        cards = [card(related[0][0], lang)] if related and related[0][2] else []
        return {**base, "type": "emergency", "emergency": {"kind": key, "message": msg[lang], "steps": steps},
                "triage": {"level": "emergency", "reasons": [msg[lang]]}, "cards": cards,
                "text": msg[lang] + "\n" + "\n".join(f"• {s}" for s in steps), "topics": [c["id"] for c in cards]}

    if GREET.search(norm) and len(norm.split()) <= 4:
        return {**base, "type": "small", "text": SMALL["greet"][lang]}
    if THANKS.search(norm) and len(norm.split()) <= 5:
        return {**base, "type": "small", "text": SMALL["thanks"][lang]}

    # 2) retrieval (+ conversation memory for follow-ups)
    hits = retrieve(norm, 3)
    strong = [h for h in hits if h[2] > 0]
    focus = "dose" if DOSE.search(norm) else "care" if CARE_Q.search(norm) else None
    if not strong and context:
        prev = [BY_ID[c] for c in context if c in BY_ID]
        if prev and (focus or FOLLOW.search(norm) or len(norm.split()) <= 6):
            strong = [(prev[0], 1.0, 1)]
    if not strong:
        if hits and hits[0][1] >= 4.0:
            strong = [hits[0]]
        elif HEALTH_HINT.search(norm):
            return {**base, "type": "unknown", "text": SMALL["unknown"][lang]}
        else:
            return {**base, "type": "offtopic", "text": SMALL["offtopic"][lang]}

    top = strong[0][1]
    chosen = [h[0] for h in strong if h[1] >= top * 0.4][:2]
    cards = [card(d, lang, focus) for d in chosen]
    mods = parse_modifiers(norm)
    tri = triage(chosen, mods, lang) if any(d["type"] in ("symptom", "condition") for d in chosen) else None

    intro = LABELS[lang]["nodx"] if DIAG.search(norm) else ""
    if focus == "dose":
        intro = ("Exact doses depend on age, weight and health, so follow the label or a pharmacist. Key safety points:"
                 if lang == "en" else "صحیح مقدار عمر، وزن اور صحت پر منحصر ہے، اس لیے پیکٹ کی ہدایت یا فارماسسٹ کے مشورے پر عمل کریں۔ اہم احتیاطیں:")
    text = "\n\n".join(([intro] if intro else []) + [card_text(c) for c in cards])
    out = {**base, "type": "answer", "intro": intro, "cards": cards, "triage": tri, "text": text,
           "topics": [c["id"] for c in cards], "modifiers": mods}
    return polish(out, raw)


# ------------------------------------------------ optional LLM rephrasing

def polish(out: dict, question: str) -> dict:
    """If GROQ_API_KEY is set, ask a free-tier model to rephrase the grounded
    answer in a friendlier way. It may only use the retrieved text."""
    key = os.environ.get("GROQ_API_KEY")
    if not key or out.get("type") != "answer":
        return out
    import urllib.request
    lang = "Urdu" if out["lang"] == "ur" else "English"
    prompt = (f"Rewrite this health information as a short, friendly reply in {lang} to the question: {question!r}. "
              "Use ONLY the facts below. Do not add facts, doses or diagnoses. Keep 'see a doctor' and emergency advice.\n\n" + out["text"])
    body = json.dumps({"model": os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant"), "temperature": 0.2,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions", data=body,
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            out["summary_ai"] = json.loads(r.read())["choices"][0]["message"]["content"]
    except Exception:
        pass
    return out


def search_medicines(q: str, lang: str = "en") -> list[dict]:
    meds = [d for d in DOCS if d["type"] == "medicine"]
    if not q.strip():
        return [card(d, lang) for d in meds]
    n = normalise(q)
    return [card(d, lang) for d in meds if any(n in normalise(k) or normalise(k) in n for k in d["kw"] + [d["en"]["title"], d["ur"]["title"]])]


def topics(lang: str = "en") -> list[dict]:
    return [{"id": d["id"], "type": d["type"], "title": d[lang]["title"]} for d in DOCS]
