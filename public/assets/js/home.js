/* Landing page */
(() => {
  const F = [["/chat", "chat", "fChat"], ["/checker", "pulse", "fCheck"], ["/medicines", "pill", "fMeds"], ["/lab", "flask", "fLab"],
    ["/hospitals", "map", "fHosp"], ["/reminders", "bell", "fRem"], ["/topics", "book", "fTopics"], ["/account", "lock", "fPriv"]];
  MB.i18n({
    en: {
      pageTitle: "Trusted health answers in Urdu & English", eyebrow: "Groq-powered · NHS & WHO grounded",
      heroTitle: "Your health questions, answered <span>safely</span>.",
      heroText: "MediBot explains symptoms, medicines, lab reports and warning signs in simple English or Urdu – and tells you when it's time to see a doctor. Free, private and built for Pakistan.",
      ctaChat: "Start a free chat", ctaCheck: "Check my symptoms", mockStatus: "Online · answers with sources",
      mockQ: "Mujhe 3 din se bukhar hai, kya karun?", mockA: "Aaram karein aur pani zyada piyen. Paracetamol le sakte hain (dengue ka shak ho to ibuprofen na lein).<br><b>Doctor ko dikhayein</b> agar bukhar 3 din se zyada rahe.",
      mockQ2: "Can I take Brufen with Ponstan?", mockA2: "<b>Avoid combining.</b> Both are NSAIDs – together they raise the risk of stomach bleeding. Use one, or ask a pharmacist about paracetamol.",
      trust: ["NHS & WHO sources", "English · اردو · Roman Urdu", "No sign-up needed"],
      stQ: "Questions answered", stT: "Safety tests passing", stD: "Trusted documents", stL: "Languages", stA: "Always available",
      featEyebrow: "Everything in one place", featTitle: "Take control of your health",
      featText: "Eight tools that work together – from a quick question to a medicine plan.",
      fChat: ["AI health chat", "Ask anything about symptoms, illnesses and medicines. Groq AI answers from trusted sources."],
      fCheck: ["Symptom checker", "Tap where it hurts on a body map and get a clear self-care / doctor / emergency result."],
      fMeds: ["Medicines & interactions", "Uses, side effects, precautions – and a checker for medicines that shouldn't be mixed."],
      fLab: ["Lab report explainer", "Paste your CBC, sugar, thyroid or lipid results and understand what's high or low."],
      fHosp: ["Nearby hospitals", "Find hospitals, clinics and pharmacies around you on a map, with directions."],
      fRem: ["Medicine reminders", "Never miss a dose – get reminders on your phone or add them to Google Calendar."],
      fTopics: ["Health library", "38 conditions and 18 medicines explained in English and Urdu, with sources."],
      fPriv: ["Private & secure", "Your history is saved securely. Use private mode or delete everything any time."],
      open: "Open",
      howEyebrow: "How it works", howTitle: "From question to the right care in seconds",
      steps: [["Ask in your language", "Type or speak in English, Urdu or Roman Urdu."], ["Safety check first", "Emergency warning signs are detected before anything else."],
        ["Trusted retrieval", "MediBot finds the matching NHS/WHO-based documents."], ["Clear answer", "Groq AI explains it simply, with triage and sources."]],
      safeEyebrow: "Safety by design", safeTitle: "Helpful, but never a replacement for your doctor",
      safeText: "MediBot was built with clear limits so people get reliable information without false reassurance.",
      safePoints: ["Never diagnoses or prescribes personal doses", "Emergency signs always trigger 1122 / 115 guidance", "Answers are grounded in a reviewed knowledge base, with sources",
        "Off-topic questions are politely refused", "64 automated safety and accuracy tests – 100% passing"],
      safeCta: "See how it works", groqTitle: "Powered by Groq, grounded by rules",
      groqText: "Fast open models on Groq write friendly replies, but only from the trusted context MediBot retrieves. If AI is unavailable, the knowledge base still answers.",
      g1t: "Rules first", g1: "Emergency detection and refusals are deterministic.", g2t: "Retrieval (RAG)", g2: "BM25 + synonyms over 58 bilingual documents.",
      g3t: "Groq LLM", g3: "GPT-OSS 120B writes the reply in your language.", g4t: "Database", g4: "Chats, checks and reminders are saved in Postgres.",
      faqTitle: "Frequently asked questions", faqText: "Can't find your answer? Send the team a message.", faqCta: "Contact the team",
      faq: [["Is MediBot a doctor?", "No. MediBot gives general health information from trusted sources. It cannot examine you or diagnose. Always follow your doctor's advice."],
        ["Is my data safe?", "Chats are stored securely so you can see your history. You can turn on private mode for any chat and delete all your data from My account."],
        ["Does it work in Urdu?", "Yes – write in Urdu script, Roman Urdu or English. You can also switch the whole site to Urdu with the اردو button."],
        ["How accurate is it?", "Answers come from a curated knowledge base written from NHS and WHO material. Our automated test suite of 64 cases passes 100%."],
        ["What should I do in an emergency?", "Call 1122 (Rescue) or 115 (Edhi) immediately. The red SOS button is always at the top of every page."]],
      ctaTitle: "Ready to feel more in control of your health?", ctaText: "Ask your first question – it's free and takes seconds.",
    },
    ur: {
      pageTitle: "اردو اور انگریزی میں مستند صحت کے جوابات", eyebrow: "گروق اے آئی · این ایچ ایس اور ڈبلیو ایچ او پر مبنی",
      heroTitle: "آپ کے صحت کے سوالات، <span>محفوظ</span> جوابات۔",
      heroText: "میڈی بوٹ علامات، دواؤں، لیب رپورٹس اور خطرے کی نشانیوں کو آسان اردو یا انگریزی میں سمجھاتا ہے – اور بتاتا ہے کہ کب ڈاکٹر کے پاس جانا ضروری ہے۔ مفت، محفوظ اور پاکستان کے لیے۔",
      ctaChat: "مفت چیٹ شروع کریں", ctaCheck: "اپنی علامات جانچیں", mockStatus: "آن لائن · ذرائع کے ساتھ جواب",
      mockQ: "مجھے 3 دن سے بخار ہے، کیا کروں؟", mockA: "آرام کریں اور پانی زیادہ پئیں۔ پیراسیٹامول لے سکتے ہیں (ڈینگی کا شک ہو تو آئبوپروفین نہ لیں)۔<br><b>ڈاکٹر کو دکھائیں</b> اگر بخار 3 دن سے زیادہ رہے۔",
      mockQ2: "کیا بروفن اور پونسٹان ساتھ لے سکتا ہوں؟", mockA2: "<b>ساتھ نہ لیں۔</b> دونوں این ایس اے آئی ڈی ہیں – ساتھ لینے سے معدے سے خون آنے کا خطرہ بڑھتا ہے۔",
      trust: ["این ایچ ایس اور ڈبلیو ایچ او ذرائع", "English · اردو · Roman Urdu", "سائن اپ ضروری نہیں"],
      stQ: "جوابات دیے گئے", stT: "کامیاب حفاظتی ٹیسٹ", stD: "مستند دستاویزات", stL: "زبانیں", stA: "ہر وقت دستیاب",
      featEyebrow: "سب کچھ ایک جگہ", featTitle: "اپنی صحت اپنے ہاتھ میں", featText: "آٹھ ٹولز جو مل کر کام کرتے ہیں – ایک سوال سے دوا کے پلان تک۔",
      fChat: ["اے آئی ہیلتھ چیٹ", "علامات، بیماریوں اور دواؤں کے بارے میں کچھ بھی پوچھیں۔ گروق اے آئی مستند ذرائع سے جواب دیتا ہے۔"],
      fCheck: ["علامات کی جانچ", "جسم کے نقشے پر درد کی جگہ چنیں اور واضح نتیجہ پائیں: گھر پر خیال / ڈاکٹر / ایمرجنسی۔"],
      fMeds: ["دوائیں اور تعامل", "استعمال، مضر اثرات، احتیاطیں – اور یہ جانچ کہ کون سی دوائیں ساتھ نہیں لینی چاہئیں۔"],
      fLab: ["لیب رپورٹ کی وضاحت", "اپنے سی بی سی، شوگر، تھائرائیڈ یا کولیسٹرول کے نتائج لکھیں اور جانیں کیا زیادہ یا کم ہے۔"],
      fHosp: ["قریبی ہسپتال", "نقشے پر اپنے آس پاس ہسپتال، کلینک اور فارمیسی تلاش کریں، راستے کے ساتھ۔"],
      fRem: ["دوا کی یاد دہانی", "کوئی خوراک نہ چھوٹے – فون پر یاد دہانی یا گوگل کیلنڈر میں شامل کریں۔"],
      fTopics: ["صحت کی لائبریری", "38 بیماریاں اور 18 دوائیں اردو اور انگریزی میں، ذرائع کے ساتھ۔"],
      fPriv: ["محفوظ اور نجی", "آپ کی ہسٹری محفوظ رہتی ہے۔ پرائیویٹ موڈ استعمال کریں یا کسی بھی وقت سب مٹا دیں۔"],
      open: "کھولیں",
      howEyebrow: "یہ کیسے کام کرتا ہے", howTitle: "سوال سے درست علاج کی سمت، سیکنڈوں میں",
      steps: [["اپنی زبان میں پوچھیں", "اردو، رومن اردو یا انگریزی میں لکھیں یا بولیں۔"], ["پہلے حفاظتی جانچ", "سب سے پہلے ایمرجنسی کی علامات پہچانی جاتی ہیں۔"],
        ["مستند معلومات کی تلاش", "میڈی بوٹ متعلقہ این ایچ ایس/ڈبلیو ایچ او دستاویزات ڈھونڈتا ہے۔"], ["واضح جواب", "گروق اے آئی آسان الفاظ میں، ذرائع کے ساتھ سمجھاتا ہے۔"]],
      safeEyebrow: "حفاظت اولین", safeTitle: "مددگار، مگر ڈاکٹر کا متبادل نہیں",
      safeText: "میڈی بوٹ واضح حدود کے ساتھ بنایا گیا ہے تاکہ لوگوں کو قابلِ اعتماد معلومات ملیں، جھوٹی تسلی نہیں۔",
      safePoints: ["کبھی تشخیص نہیں کرتا نہ ذاتی خوراک بتاتا ہے", "ایمرجنسی علامات پر ہمیشہ 1122 / 115 کی رہنمائی", "جوابات جانچی ہوئی معلومات سے، ذرائع کے ساتھ",
        "غیر متعلقہ سوالات سے شائستگی سے انکار", "64 خودکار حفاظتی اور درستگی کے ٹیسٹ – 100 فیصد کامیاب"],
      safeCta: "تفصیل دیکھیں", groqTitle: "گروق کی طاقت، قواعد کی حفاظت",
      groqText: "گروق پر تیز اوپن ماڈلز دوستانہ جواب لکھتے ہیں، مگر صرف میڈی بوٹ کی تلاش کردہ مستند معلومات سے۔ اے آئی دستیاب نہ ہو تو بھی معلوماتی ذخیرہ جواب دیتا ہے۔",
      g1t: "پہلے قواعد", g1: "ایمرجنسی کی پہچان اور انکار طے شدہ قواعد سے۔", g2t: "تلاش (RAG)", g2: "58 دو لسانی دستاویزات پر BM25۔",
      g3t: "گروق ایل ایل ایم", g3: "GPT-OSS 120B آپ کی زبان میں جواب لکھتا ہے۔", g4t: "ڈیٹا بیس", g4: "چیٹس، جانچ اور یاد دہانیاں پوسٹگریس میں محفوظ۔",
      faqTitle: "اکثر پوچھے جانے والے سوالات", faqText: "جواب نہیں ملا؟ ٹیم کو پیغام بھیجیں۔", faqCta: "ٹیم سے رابطہ",
      faq: [["کیا میڈی بوٹ ڈاکٹر ہے؟", "نہیں۔ میڈی بوٹ مستند ذرائع سے عام صحت کی معلومات دیتا ہے۔ یہ معائنہ یا تشخیص نہیں کر سکتا۔ ہمیشہ اپنے ڈاکٹر کی ہدایت پر عمل کریں۔"],
        ["کیا میرا ڈیٹا محفوظ ہے؟", "چیٹس محفوظ طریقے سے رکھی جاتی ہیں تاکہ آپ ہسٹری دیکھ سکیں۔ کسی بھی چیٹ کے لیے پرائیویٹ موڈ آن کریں، اور میرا اکاؤنٹ سے سارا ڈیٹا مٹا سکتے ہیں۔"],
        ["کیا یہ اردو میں کام کرتا ہے؟", "جی ہاں – اردو، رومن اردو یا انگریزی میں لکھیں۔ اردو بٹن سے پوری ویب سائٹ اردو میں ہو جاتی ہے۔"],
        ["یہ کتنا درست ہے؟", "جوابات این ایچ ایس اور ڈبلیو ایچ او کے مواد سے تیار کردہ معلوماتی ذخیرے سے آتے ہیں۔ ہمارے 64 خودکار ٹیسٹ 100 فیصد کامیاب ہیں۔"],
        ["ایمرجنسی میں کیا کروں؟", "فوراً 1122 (ریسکیو) یا 115 (ایدھی) پر کال کریں۔ سرخ SOS بٹن ہر صفحے کے اوپر موجود ہے۔"]],
      ctaTitle: "اپنی صحت کو بہتر سمجھنے کے لیے تیار ہیں؟", ctaText: "اپنا پہلا سوال پوچھیں – مفت ہے اور چند سیکنڈ لیتا ہے۔",
    },
  });
  const ICONS = ["shield", "globe", "lock"];
  function render() {
    const { $, t, icon, esc } = MB;
    $("#mockLogo").innerHTML = icon("logo");
    $("#trust").innerHTML = t("trust").map((x, i) => `<span>${icon(ICONS[i])}${esc(x)}</span>`).join("");
    $("#featGrid").innerHTML = F.map(([href, ic, k]) => { const [h, p] = t(k);
      return `<a class="card feature" href="${href}"><span class="ico">${icon(ic)}</span><h3>${esc(h)}</h3><p>${esc(p)}</p><span class="go">${esc(t("open"))} →</span></a>`; }).join("");
    $("#steps").innerHTML = t("steps").map(([h, p]) => `<li><h3>${esc(h)}</h3><p class="muted">${esc(p)}</p></li>`).join("");
    $("#faqList").innerHTML = t("faq").map(([q, a], i) => `<details${i ? "" : " open"}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
  }
  MB.onLang(render);
  document.addEventListener("DOMContentLoaded", () => {
    MB.api("/api/stats").then((s) => {
      if (s.questions >= 25) MB.$("#sQ").textContent = s.questions.toLocaleString();
      else { MB.$("#sQ").textContent = "64/64"; MB.$("#sQ").nextElementSibling.dataset.i = "stT"; MB.applyLang(); }
      MB.$("#sD").textContent = s.documents;
    }).catch(() => {});
  });
})();
