/* How it works: pipeline, safety limits, tech stack and the live evaluation results (eval.json). */
(() => {
  MB.i18n({
    en: { pageTitle: "How MediBot works", eyebrow: "Architecture & safety", title: "How MediBot works", lead: "MediBot is a retrieval-augmented assistant: trusted documents are found first, then Groq AI explains them. Safety rules always run before the AI.",
      pipeTitle: "The answer pipeline",
      pipe: [["1 · Understand", "Normalise text, detect English, Urdu script or Roman Urdu."], ["2 · Safety first", "Regex rules catch 13 emergency types (heart, stroke, breathing, poisoning, self-harm…) before anything else."],
        ["3 · Retrieve", "BM25 + synonym matching over 58 bilingual NHS/WHO-based documents; conversation memory for follow-ups."], ["4 · Triage", "Self-care / doctor / emergency from symptoms, age, pregnancy, days and temperature."],
        ["5 · Generate", "Groq (GPT-OSS 120B) writes a short reply in the user's language using only the retrieved text. Falls back to the knowledge base if AI is unavailable."]],
      safetyTitle: "Safety & privacy limits",
      safety: ["Never diagnoses – \"do I have X?\" gets information and a doctor referral", "No personal doses – only label-level safety facts", "Emergencies are rule-based and always show 1122 / 115 / Umang",
        "Off-topic questions are refused; unknown topics are labelled as general AI guidance", "Passwords hashed with PBKDF2-SHA256; sessions in HttpOnly cookies", "Private mode, and one-click deletion of all your data", "Rate limiting on every endpoint"],
      stackTitle: "Technology", apiLink: "Open the interactive API documentation →", evalTitle: "Automatic evaluation", evalLead: "Every case below is run by tests/evaluate.py against the live engine logic.",
      cat: "Category", q: "Input", exp: "Expected", res: "Result", pass: "Pass", fail: "Fail" },
    ur: { pageTitle: "میڈی بوٹ کیسے کام کرتا ہے", eyebrow: "ساخت اور حفاظت", title: "میڈی بوٹ کیسے کام کرتا ہے", lead: "میڈی بوٹ ریٹریول پر مبنی معاون ہے: پہلے مستند دستاویزات تلاش ہوتی ہیں، پھر گروق اے آئی انہیں سمجھاتا ہے۔ حفاظتی قواعد ہمیشہ اے آئی سے پہلے چلتے ہیں۔",
      pipeTitle: "جواب کا طریقہ کار",
      pipe: [["1 · سمجھنا", "متن کو درست کرنا، اردو، رومن اردو یا انگریزی پہچاننا۔"], ["2 · پہلے حفاظت", "قواعد 13 قسم کی ایمرجنسی (دل، فالج، سانس، زہر، خود کو نقصان…) سب سے پہلے پکڑتے ہیں۔"],
        ["3 · تلاش", "58 دو لسانی دستاویزات پر BM25 اور مترادفات؛ اگلے سوالات کے لیے گفتگو کی یاد۔"], ["4 · درجہ بندی", "علامات، عمر، حمل، دن اور بخار سے: گھر پر خیال / ڈاکٹر / ایمرجنسی۔"],
        ["5 · جواب", "گروق (GPT-OSS 120B) صرف تلاش شدہ معلومات سے صارف کی زبان میں مختصر جواب لکھتا ہے۔ اے آئی نہ ہو تو معلوماتی ذخیرہ جواب دیتا ہے۔"]],
      safetyTitle: "حفاظت اور پرائیویسی کی حدود",
      safety: ["کبھی تشخیص نہیں – \"کیا مجھے X ہے؟\" پر معلومات اور ڈاکٹر کا مشورہ", "ذاتی خوراک نہیں – صرف پیکٹ کی سطح کی حفاظتی معلومات", "ایمرجنسی قواعد پر مبنی، ہمیشہ 1122 / 115 / امنگ",
        "غیر متعلقہ سوالات سے انکار؛ نامعلوم موضوعات پر 'عام اے آئی رہنمائی' کا لیبل", "پاس ورڈ PBKDF2-SHA256 سے محفوظ؛ سیشن HttpOnly کوکیز میں", "پرائیویٹ موڈ، اور ایک کلک میں سارا ڈیٹا مٹانا", "ہر اینڈ پوائنٹ پر ریٹ لمٹ"],
      stackTitle: "ٹیکنالوجی", apiLink: "اے پی آئی دستاویزات کھولیں ←", evalTitle: "خودکار جانچ", evalLead: "نیچے ہر کیس tests/evaluate.py کے ذریعے انجن پر چلایا جاتا ہے۔",
      cat: "زمرہ", q: "سوال", exp: "متوقع", res: "نتیجہ", pass: "کامیاب", fail: "ناکام" },
  });
  const { $, esc, t } = MB;
  const STACK = [["Backend", "Python 3.12 · FastAPI · Vercel serverless function"], ["AI", "Groq API · openai/gpt-oss-120b (fallback gpt-oss-20b) · optional Gemini backup"], ["Retrieval", "BM25 + keyword/synonym index (pure Python)"],
    ["Database", "PostgreSQL on Neon (pg8000 driver) · SQLite for local dev"], ["Frontend", "HTML, CSS, vanilla JS · PWA (offline page, installable)"], ["Maps", "Leaflet + OpenStreetMap Overpass & Nominatim"], ["Voice", "Web Speech API (speech-to-text, text-to-speech)"]];
  let ev = null;
  function render() {
    $("#pipe").innerHTML = t("pipe").map(([h, p]) => `<div><b>${esc(h)}</b>${esc(p)}</div>`).join("");
    $("#stackTable").innerHTML = STACK.map(([a, b]) => `<tr><th style="width:120px">${esc(a)}</th><td>${esc(b)}</td></tr>`).join("");
    if (!ev) return;
    $("#evalScore").textContent = `${ev.passed}/${ev.total} · ${ev.accuracy}%`;
    const cats = {}; ev.rows.forEach((r) => { cats[r.cat] = cats[r.cat] || [0, 0]; cats[r.cat][1]++; if (r.pass) cats[r.cat][0]++; });
    $("#evalCats").innerHTML = Object.entries(cats).map(([c, [p, n]]) => `<div class="card card-flat kpi"><b>${p}/${n}</b><span>${esc(c)}</span></div>`).join("");
    $("#evalRows").innerHTML = ev.rows.map((r) => `<tr><td>${esc(r.cat)}</td><td dir="auto">${esc(r.q)}</td><td>${esc(r.expect)}</td><td><span class="pill ${r.pass ? "ok" : "danger"}">${esc(t(r.pass ? "pass" : "fail"))}</span></td></tr>`).join("");
  }
  MB.onLang(render);
  document.addEventListener("DOMContentLoaded", () => fetch("/eval.json").then((r) => r.json()).then((j) => { ev = j; render(); }).catch(() => {}));
})();
