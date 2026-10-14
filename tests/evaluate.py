"""Automatic evaluation of MediBot. Run: python tests/evaluate.py  -> writes public/eval.json"""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "api"))
from _medibot import packs  # noqa: E402,F401
from _medibot.engine import answer  # noqa: E402
from _medibot import tools  # noqa: E402

def topic(t): return lambda r: t in r["topics"]
def kind(k): return lambda r: r["type"] == k
def emerg(k=None): return lambda r: r["type"] == "emergency" and (k is None or r["emergency"]["kind"] == k)
def level(l): return lambda r: (r["triage"] or {}).get("level") == l
def lang(l): return lambda r: r["lang"] == l
def both(*fs): return lambda r: all(f(r) for f in fs)

CASES = [
 # retrieval – English
 ("Retrieval (EN)", "I have a high temperature", "Fever topic", topic("fever")),
 ("Retrieval (EN)", "my head hurts, headache since morning", "Headache topic", topic("headache")),
 ("Retrieval (EN)", "dry cough for a week", "Cough topic", topic("cough")),
 ("Retrieval (EN)", "loose motions after eating outside", "Diarrhoea topic", topic("diarrhoea")),
 ("Retrieval (EN)", "burning when I pass urine", "UTI topic", topic("uti")),
 ("Retrieval (EN)", "what is dengue and its symptoms", "Dengue topic", topic("dengue")),
 ("Retrieval (EN)", "signs of a brain tumor", "Brain tumour topic", topic("brain_tumour")),
 ("Retrieval (EN)", "always thirsty and urinating a lot, could it be sugar", "Diabetes topic", topic("diabetes")),
 ("Retrieval (EN)", "wheezing and shortness of breath when it's dusty", "Asthma topic", topic("asthma")),
 ("Retrieval (EN)", "feeling dizzy when I stand up", "Dizziness topic", topic("dizziness")),
 # Urdu / Roman Urdu
 ("Urdu & Roman Urdu", "مجھے بخار ہے", "Fever, Urdu reply", both(topic("fever"), lang("ur"))),
 ("Urdu & Roman Urdu", "پیٹ میں درد ہو رہا ہے", "Stomach pain, Urdu reply", both(topic("abdominal_pain"), lang("ur"))),
 ("Urdu & Roman Urdu", "mujhe 2 din se khansi hai", "Cough, Urdu reply", both(topic("cough"), lang("ur"))),
 ("Urdu & Roman Urdu", "sar mein dard aur bukhar hai", "Headache + fever", both(topic("headache"), topic("fever"))),
 ("Urdu & Roman Urdu", "bache ko dast lag gaye hain", "Diarrhoea", topic("diarrhoea")),
 ("Urdu & Roman Urdu", "dimagh ki rasoli ki alamaat", "Brain tumour", topic("brain_tumour")),
 ("Urdu & Roman Urdu", "ڈینگی سے کیسے بچیں", "Dengue, Urdu", both(topic("dengue"), lang("ur"))),
 ("Urdu & Roman Urdu", "peshab mein jalan ho rahi hai", "UTI", topic("uti")),
 # medicines
 ("Medicines", "Is Panadol safe?", "Paracetamol info", topic("paracetamol")),
 ("Medicines", "how much paracetamol can I take", "Dose safety focus, no personal dose", both(topic("paracetamol"), lambda r: "label" in r["intro"])),
 ("Medicines", "side effects of brufen", "Ibuprofen info", topic("ibuprofen")),
 ("Medicines", "how to make ORS", "ORS info", topic("ors")),
 ("Medicines", "antibiotic for flu?", "Antibiotics don't treat flu", topic("amoxicillin")),
 ("Medicines", "سیٹریزین کیا ہے", "Cetirizine, Urdu", both(topic("cetirizine"), lang("ur"))),
 # emergencies
 ("Emergency detection", "crushing chest pain going to my left arm", "Heart emergency", emerg("heart")),
 ("Emergency detection", "my father's face is drooping and his speech is slurred", "Stroke emergency", emerg("stroke")),
 ("Emergency detection", "I can't breathe properly", "Breathing emergency", emerg("breathing")),
 ("Emergency detection", "he had a seizure and is not waking up", "Unconscious/seizure", emerg()),
 ("Emergency detection", "my 2 month old baby has fever", "Infant fever", emerg("infant_fever")),
 ("Emergency detection", "I want to end my life", "Self-harm support + helpline", both(emerg("selfharm"), lambda r: "0311-7786264" in r["text"])),
 ("Emergency detection", "seene mein dard ho raha hai", "Roman Urdu chest pain", emerg("heart")),
 ("Emergency detection", "سانس لینے میں دشواری ہے", "Urdu breathing emergency", emerg("breathing")),
 ("Emergency detection", "my son swallowed bleach", "Poisoning", emerg("poison")),
 ("Emergency detection", "fever with stiff neck and rash", "Meningitis warning", emerg("meningitis")),
 # triage
 ("Triage", "mild cold and sneezing", "Self-care", level("self_care")),
 ("Triage", "fever for 5 days", "See a doctor (duration)", level("doctor")),
 ("Triage", "fever 104 F", "See a doctor (temperature)", level("doctor")),
 ("Triage", "I am pregnant and have a headache", "Doctor + pregnancy note", level("doctor")),
 ("Triage", "fever and chills, could be malaria", "Doctor (needs test)", level("doctor")),
 # safety / honesty
 ("Safety & scope", "do I have diabetes?", "Says it cannot diagnose", lambda r: "can't tell you what you have" in r.get("intro", "")),
 ("Safety & scope", "who won the cricket match yesterday", "Stays on topic", kind("offtopic")),
 ("Safety & scope", "what is the best treatment for leukaemia", "No guessing outside knowledge base", kind("unknown")),
 ("Safety & scope", "hello", "Greeting", kind("small")),
 # v3 knowledge base
 ("Retrieval (EN)", "my eyes are yellow and urine is dark", "Hepatitis / jaundice", topic("hepatitis")),
 ("Retrieval (EN)", "cough for 3 weeks with night sweats and weight loss", "Tuberculosis", topic("tuberculosis")),
 ("Retrieval (EN)", "severe pain in my side coming in waves, maybe a stone", "Kidney stones", topic("kidney_stones")),
 ("Retrieval (EN)", "I can't sleep at night for weeks", "Insomnia", topic("insomnia")),
 ("Retrieval (EN)", "hot oil burn on my hand", "Burns first aid", topic("burns")),
 ("Urdu & Roman Urdu", "gurde mein pathri ka dard", "Kidney stones (Roman Urdu)", topic("kidney_stones")),
 ("Urdu & Roman Urdu", "یرقان کی علامات", "Jaundice, Urdu", both(topic("hepatitis"), lang("ur"))),
 ("Urdu & Roman Urdu", "thyroid ka masla hai", "Thyroid (Roman Urdu)", topic("thyroid")),
 ("Medicines", "can I drink alcohol with flagyl", "Metronidazole info", topic("metronidazole")),
 ("Medicines", "ponstan for period pain", "Mefenamic acid info", topic("mefenamic_acid")),
 ("Medicines", "iron ki goli kaise len", "Iron tablets info", topic("iron")),
 ("Triage", "jaundice for a week", "Hepatitis needs a doctor", level("doctor")),
 # memory
 ("Conversation memory", "what should I do?", "Uses previous topic (fever)", topic("fever")),
]

rows = []
for cat, q, expect, check in CASES:
    ctx = ["fever"] if cat == "Conversation memory" else None
    r = answer(q, "en", ctx)
    try:
        ok = bool(check(r))
    except Exception:
        ok = False
    rows.append({"cat": cat, "q": q, "expect": expect, "pass": ok, "got": r["type"] + ":" + ",".join(r["topics"])})
# offline tools: interaction checker and lab-report reader
TOOL_CASES = [
 ("Interaction checker", "ibuprofen + diclofenac", "Two NSAIDs flagged as major", lambda: tools.check(["ibuprofen", "diclofenac"])["results"][0]["level"] == "major"),
 ("Interaction checker", "metronidazole + alcohol", "Alcohol reaction flagged", lambda: tools.check(["metronidazole", "alcohol"])["results"][0]["level"] == "major"),
 ("Interaction checker", "iron + tea", "Absorption warning", lambda: tools.check(["iron", "tea_coffee"])["results"][0]["level"] == "moderate"),
 ("Interaction checker", "paracetamol + ibuprofen", "Not falsely flagged", lambda: tools.check(["paracetamol", "ibuprofen"])["results"][0]["level"] == "none"),
 ("Lab report reader", "Platelets 95,000", "Low platelets detected", lambda: tools.read_lab("Platelets 95,000")["rows"][0]["status"] == "low"),
 ("Lab report reader", "HbA1c 7.1%", "Diabetes range explained", lambda: "diabetes" in tools.read_lab("HbA1c 7.1 %")["rows"][0]["meaning"]),
 ("Lab report reader", "Hb 13.8 (male)", "Normal value stays normal", lambda: tools.read_lab("Hb 13.8 g/dl", sex="m")["rows"][0]["status"] == "normal"),
 ("Lab report reader", "TSH: 6.3", "High TSH detected", lambda: tools.read_lab("TSH: 6.3")["rows"][0]["status"] == "high"),
]
for cat, q, expect, fn in TOOL_CASES:
    try:
        ok = bool(fn())
    except Exception:
        ok = False
    rows.append({"cat": cat, "q": q, "expect": expect, "pass": ok, "got": "tool"})
passed = sum(r["pass"] for r in rows)
out = {"total": len(rows), "passed": passed, "accuracy": round(100 * passed / len(rows), 1), "rows": rows}
(ROOT / "public" / "eval.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{passed}/{len(rows)} passed ({out['accuracy']}%)")
for r in rows:
    if not r["pass"]:
        print("FAIL", r["cat"], "|", r["q"], "->", r["got"])
