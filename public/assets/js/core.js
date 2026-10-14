/* MediBot v3 – shared shell: header, footer, navigation, language, API, auth, cards, toasts, PWA, reminder alerts. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- icons (inline SVG, stroke style) ---------- */
  const P = {
    logo: '<path d="M12 4v16M4 12h16" stroke-width="3.2"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    pill: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.5 8.5l7 7"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/>',
    map: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    bell: '<path d="M18 16V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2zM10 20a2 2 0 0 0 4 0"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M8 7h7M8 11h7"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    phone: '<path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor" stroke="none"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    up: '<path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7"/>',
    down: '<path d="M7 13V4H4v9zM7 13l4 8c1.5 0 2.5-1 2.5-2.5V15H19a2 2 0 0 0 2-2.3l-1.2-7A2 2 0 0 0 17.8 4H7"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-3"/><rect x="7" y="14" width="10" height="7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
    heart: '<path d="M12 20s-7-4.5-9-9.5A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 4.5C19 15.5 12 20 12 20z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  };
  const icon = (n, cls = "") => `<svg class="ic ${cls}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

  /* ---------- language ---------- */
  const T = {
    en: {
      home: "Home", chat: "AI Chat", checker: "Symptom checker", medicines: "Medicines", lab: "Lab reports", hospitals: "Nearby care",
      reminders: "Reminders", topics: "Health topics", team: "Team", about: "How it works", privacy: "Privacy", terms: "Terms",
      account: "My account", signin: "Sign in", signup: "Create account", admin: "Admin", emergency: "Emergency", sos: "SOS", menu: "Menu",
      navCheck: "Check", more: "More", skip: "Skip to content",
      notice: "General health information only – MediBot does not diagnose. In an emergency call 1122.",
      sosTitle: "Emergency help (Pakistan)", sos1122: "Rescue / ambulance (Punjab, KP, other provinces)", sos115: "Edhi ambulance",
      sosUmang: "Umang mental health helpline", sosNote: "Call now for chest pain, stroke signs, severe breathing difficulty, heavy bleeding, fits, unconsciousness or poisoning.",
      close: "Close", consentTitle: "Before you start", agree: "I understand",
      consent: ["MediBot gives general health information. It is not a doctor and cannot diagnose.", "In an emergency, call 1122 straight away.",
        "Your chats are saved so you can see your history. Use Private mode to not save a chat, and delete your data any time.",
        "Don't share your CNIC, address or phone number. Always follow your doctor's advice."],
      footAbout: "A Groq-powered, knowledge-grounded health assistant for Pakistan. Answers come from NHS and WHO-based information, in English and Urdu.",
      product: "Product", tools: "Tools", company: "Project", legal: "Legal", rights: "BSCS final-year project · General information only, not medical advice.",
      api: "API docs", install: "Install app", installed: "MediBot was added to your device.", offline: "You are offline – some features need internet.",
      error: "Something went wrong. Please try again.", signout: "Sign out", copied: "Copied", sources: "Sources", seeDoctor: "See a doctor",
      level: { self_care: "Self-care is usually enough", doctor: "See a doctor", emergency: "Emergency – get help now" },
      levelSub: { self_care: "Watch for the warning signs listed.", doctor: "Book a visit with a doctor or clinic soon.", emergency: "Call 1122 or go to the nearest emergency department." },
      reminderNow: "Medicine reminder", aiBadge: "AI", kbBadge: "Trusted knowledge base",
    },
    ur: {
      home: "ہوم", chat: "اے آئی چیٹ", checker: "علامات کی جانچ", medicines: "دوائیں", lab: "لیب رپورٹ", hospitals: "قریبی ہسپتال",
      reminders: "یاد دہانی", topics: "صحت کے موضوعات", team: "ٹیم", about: "یہ کیسے کام کرتا ہے", privacy: "پرائیویسی", terms: "شرائط",
      account: "میرا اکاؤنٹ", signin: "سائن اِن", signup: "اکاؤنٹ بنائیں", admin: "ایڈمن", emergency: "ایمرجنسی", sos: "SOS", menu: "مینو",
      navCheck: "جانچ", more: "مزید", skip: "مواد پر جائیں",
      notice: "صرف عام صحت کی معلومات – میڈی بوٹ تشخیص نہیں کرتا۔ ایمرجنسی میں 1122 پر کال کریں۔",
      sosTitle: "ایمرجنسی مدد (پاکستان)", sos1122: "ریسکیو / ایمبولینس", sos115: "ایدھی ایمبولینس", sosUmang: "امنگ ذہنی صحت ہیلپ لائن",
      sosNote: "سینے میں درد، فالج کی علامات، سانس میں شدید دشواری، زیادہ خون بہنا، دورے، بے ہوشی یا زہر کی صورت میں ابھی کال کریں۔",
      close: "بند کریں", consentTitle: "شروع کرنے سے پہلے", agree: "میں سمجھ گیا/گئی",
      consent: ["میڈی بوٹ عام صحت کی معلومات دیتا ہے۔ یہ ڈاکٹر نہیں اور تشخیص نہیں کر سکتا۔", "ایمرجنسی میں فوراً 1122 پر کال کریں۔",
        "آپ کی چیٹس محفوظ ہوتی ہیں تاکہ آپ ہسٹری دیکھ سکیں۔ پرائیویٹ موڈ میں چیٹ محفوظ نہیں ہوتی، اور آپ کسی بھی وقت اپنا ڈیٹا مٹا سکتے ہیں۔",
        "اپنا شناختی کارڈ نمبر، پتہ یا فون نمبر نہ لکھیں۔ ہمیشہ اپنے ڈاکٹر کے مشورے پر عمل کریں۔"],
      footAbout: "پاکستان کے لیے گروق سے چلنے والا، مستند معلومات پر مبنی صحت معاون۔ جوابات این ایچ ایس اور عالمی ادارہ صحت کی معلومات سے، اردو اور انگریزی میں۔",
      product: "پروڈکٹ", tools: "ٹولز", company: "پروجیکٹ", legal: "قانونی", rights: "بی ایس سی ایس فائنل ایئر پروجیکٹ · صرف عام معلومات، طبی مشورہ نہیں۔",
      api: "اے پی آئی", install: "ایپ انسٹال کریں", installed: "میڈی بوٹ آپ کے آلے میں شامل ہو گیا۔", offline: "آپ آف لائن ہیں – کچھ فیچرز کے لیے انٹرنیٹ ضروری ہے۔",
      error: "کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔", signout: "سائن آؤٹ", copied: "کاپی ہو گیا", sources: "ذرائع", seeDoctor: "ڈاکٹر کو دکھائیں",
      level: { self_care: "عموماً گھر پر خیال کافی ہے", doctor: "ڈاکٹر کو دکھائیں", emergency: "ایمرجنسی – ابھی مدد لیں" },
      levelSub: { self_care: "دی گئی خطرے کی علامات پر نظر رکھیں۔", doctor: "جلد کسی ڈاکٹر یا کلینک سے رجوع کریں۔", emergency: "1122 پر کال کریں یا قریبی ایمرجنسی جائیں۔" },
      reminderNow: "دوا کی یاد دہانی", aiBadge: "اے آئی", kbBadge: "مستند معلوماتی ذخیرہ",
    },
  };
  let lang = store.get("mb_lang") === "ur" ? "ur" : "en";
  const pageDicts = [];
  const t = (k) => { for (const d of pageDicts) if (d[lang] && d[lang][k] !== undefined) return d[lang][k]; return T[lang][k] ?? T.en[k] ?? k; };
  const listeners = [];

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
    $$("[data-i]").forEach((el) => { const v = t(el.dataset.i); if (typeof v === "string") el.textContent = v; });
    $$("[data-ih]").forEach((el) => { const v = t(el.dataset.ih); if (typeof v === "string") el.innerHTML = v; });
    $$("[data-ph]").forEach((el) => { el.placeholder = t(el.dataset.ph); });
    $$("[data-list]").forEach((el) => { const v = t(el.dataset.list); if (Array.isArray(v)) el.innerHTML = v.map((x) => `<li>${esc(x)}</li>`).join(""); });
    $$(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    const title = t("pageTitle");
    if (title && title !== "pageTitle") document.title = `${title} – MediBot`;
    listeners.forEach((fn) => fn(lang));
  }
  function setLang(l) { lang = l === "ur" ? "ur" : "en"; store.set("mb_lang", lang); applyLang(); }

  /* ---------- API ---------- */
  async function api(path, opts = {}) {
    const o = { credentials: "same-origin", headers: { "Content-Type": "application/json", ...(opts.headers || {}) }, ...opts };
    if (o.body && typeof o.body !== "string") o.body = JSON.stringify(o.body);
    const r = await fetch(path, o);
    let data = null;
    try { data = await r.json(); } catch { /* empty body */ }
    if (!r.ok) {
      let msg = data && (typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(", ") : null);
      const e = new Error(msg || t("error")); e.status = r.status; throw e;
    }
    return data;
  }
  let mePromise = null;
  const me = (fresh) => { if (!mePromise || fresh) mePromise = api("/api/auth/me").catch(() => ({ user: null })); return mePromise; };

  /* ---------- toasts ---------- */
  function toast(msg, kind = "") {
    let z = $(".toast-zone");
    if (!z) { z = document.createElement("div"); z.className = "toast-zone"; z.setAttribute("role", "status"); document.body.append(z); }
    const el = document.createElement("div"); el.className = `toast ${kind}`; el.textContent = msg; z.append(el);
    setTimeout(() => el.remove(), 3800);
  }

  /* ---------- text + card rendering ---------- */
  function md(text) {
    const lines = esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|\s)\*(?!\s)(.+?)\*(?=\s|$|[.,!?])/g, "$1<i>$2</i>").split(/\n/);
    let html = "", inList = false;
    for (const raw of lines) {
      const l = raw.trim();
      const m = l.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
      if (m) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${m[1]}</li>`; continue; }
      if (inList) { html += "</ul>"; inList = false; }
      if (l) html += `<p>${l.replace(/^#{1,4}\s*/, "")}</p>`;
    }
    return html + (inList ? "</ul>" : "");
  }
  function sourcesHTML(src) {
    if (!src || !src.length) return "";
    return `<div class="sources">${src.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${icon("book")}${esc(s.name)}</a>`).join("")}</div>`;
  }
  function cardHTML(c) {
    return `<article class="card kcard"><h3>${esc(c.title)}</h3><p class="sum">${esc(c.summary)}</p>${c.sections.map((s) =>
      `<div class="sec-${s.key}"><h4>${esc(s.heading)}</h4><ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}${sourcesHTML(c.sources)}</article>`;
  }
  function triageHTML(tr) {
    if (!tr) return "";
    const ic = tr.level === "emergency" ? "alert" : tr.level === "doctor" ? "info" : "check";
    return `<div class="triage ${tr.level}">${icon(ic)}<div><b>${esc(T[lang].level[tr.level])}</b><small>${esc(T[lang].levelSub[tr.level])}</small>${
      (tr.reasons || []).length ? `<small>${tr.reasons.map(esc).join(" · ")}</small>` : ""}</div></div>`;
  }

  /* ---------- shell ---------- */
  const NAV = [["/", "home", "home"], ["/chat", "chat", "chat"], ["/checker", "checker", "pulse"], ["/medicines", "medicines", "pill"],
    ["/lab", "lab", "flask"], ["/hospitals", "hospitals", "map"], ["/reminders", "reminders", "bell"], ["/topics", "topics", "book"]];
  const MORE = [["/team", "team", "users"], ["/about", "about", "info"], ["/privacy", "privacy", "shield"], ["/terms", "terms", "book"]];
  const here = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/") || "/";
  const cur = (h) => (h === here ? ' aria-current="page"' : "");

  function header() {
    return `<a class="skip" href="#main" data-i="skip"></a>
<header class="section topbar"><div class="container bar">
  <a class="brand" href="/" aria-label="MediBot"><span class="logo">${icon("logo")}</span><span class="nm">MediBot</span></a>
  <nav class="nav" aria-label="Main">${NAV.slice(1, 7).map(([h, k]) => `<a href="${h}"${cur(h)} data-i="${k}"></a>`).join("")}</nav>
  <div class="bar-actions">
    <div class="lang" role="group" aria-label="Language"><button data-lang="en">EN</button><button data-lang="ur">اردو</button></div>
    <a class="account-link" id="acct" href="/signin"><span class="avatar">${icon("user")}</span><span class="nm" data-i="signin"></span></a>
    <button class="btn btn-danger btn-sm sos-btn" id="sosBtn">${icon("phone")}<span class="sos-long" data-i="emergency"></span><span class="sos-short">SOS</span></button>
    <button class="icon-btn menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false">${icon("menu")}</button>
  </div>
</div></header>
<div class="section notice no-print" role="note"><div class="container">${icon("info")}<span data-i="notice"></span></div></div>
<div class="drawer" id="drawer" aria-hidden="true"><div class="scrim" data-close></div><div class="panel" role="dialog" aria-label="Menu">
  <div class="row spread" style="margin-bottom:12px"><a class="brand" href="/"><span class="logo">${icon("logo")}</span>MediBot</a><button class="icon-btn" data-close aria-label="Close">${icon("close")}</button></div>
  <nav>${[...NAV, ...MORE].map(([h, k, ic]) => `<a href="${h}"${cur(h)}>${icon(ic)}<span data-i="${k}"></span></a>`).join("")}
  <a href="/account" id="drawerAcct">${icon("user")}<span data-i="account"></span></a><a href="#" id="installBtn" hidden>${icon("download")}<span data-i="install"></span></a></nav>
</div></div>`;
  }
  function footer() {
    const col = (title, items) => `<div><h4 data-i="${title}"></h4><ul>${items.map(([h, k]) => `<li><a href="${h}" data-i="${k}"></a></li>`).join("")}</ul></div>`;
    return `<footer class="section footer"><div class="container">
  <div class="foot-grid">
    <div><a class="brand" href="/"><span class="logo">${icon("logo")}</span>MediBot</a><p class="small" style="margin-top:12px;opacity:.85" data-i="footAbout"></p>
      <p class="small"><a href="tel:1122">${icon("phone")} 1122</a> · <a href="tel:115">115</a></p></div>
    ${col("tools", [["/chat", "chat"], ["/checker", "checker"], ["/medicines", "medicines"], ["/lab", "lab"], ["/hospitals", "hospitals"], ["/reminders", "reminders"]])}
    ${col("company", [["/about", "about"], ["/team", "team"], ["/topics", "topics"], ["/api/docs", "api"], ["/admin", "admin"]])}
    ${col("legal", [["/privacy", "privacy"], ["/terms", "terms"], ["/account", "account"]])}
  </div>
  <div class="foot-bottom"><span>© ${new Date().getFullYear()} MediBot · <span data-i="rights"></span></span><span>NHS · WHO · Groq</span></div>
</div></footer>
<nav class="bottom-nav no-print" aria-label="Quick">
  ${[["/", "home", "home"], ["/chat", "chat", "chat"], ["/checker", "navCheck", "pulse"], ["/medicines", "medicines", "pill"]].map(([h, k, ic]) =>
    `<a href="${h}"${cur(h)}>${icon(ic)}<span data-i="${k}"></span></a>`).join("")}
  <a href="#" id="moreBtn">${icon("menu")}<span data-i="more"></span></a>
</nav>
<dialog id="sos" aria-labelledby="sosTitle"><h2 id="sosTitle" tabindex="-1" autofocus data-i="sosTitle"></h2>
  <ul class="sos-list"><li><a href="tel:1122"><b>1122</b><span data-i="sos1122"></span></a></li><li><a href="tel:115"><b>115</b><span data-i="sos115"></span></a></li>
  <li><a href="tel:03117786264"><b>0311-7786264</b><span data-i="sosUmang"></span></a></li></ul>
  <p class="muted small" style="margin-top:14px" data-i="sosNote"></p>
  <p class="small"><a href="/hospitals">${icon("map")} <span data-i="hospitals"></span></a></p>
  <form method="dialog" class="dlg-actions"><button class="btn" data-i="close"></button></form></dialog>
<dialog id="consent" aria-labelledby="consentTitle"><h2 id="consentTitle" tabindex="-1" autofocus data-i="consentTitle"></h2>
  <ul class="ticks" data-list="consent"></ul><form method="dialog" class="dlg-actions"><button class="btn" id="agree" data-i="agree"></button></form></dialog>`;
  }

  function mountShell() {
    const h = $("#site-header"), f = $("#site-footer");
    if (h) h.outerHTML = header();
    if (f) f.outerHTML = footer();
    $$(".lang button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
    $("#sosBtn")?.addEventListener("click", () => $("#sos").showModal());
    const drawer = $("#drawer");
    const open = (v) => { drawer.classList.toggle("open", v); drawer.setAttribute("aria-hidden", String(!v)); $("#menuBtn")?.setAttribute("aria-expanded", String(v)); };
    $("#menuBtn")?.addEventListener("click", () => open(true));
    $("#moreBtn")?.addEventListener("click", (e) => { e.preventDefault(); open(true); });
    $$("[data-close]", drawer).forEach((b) => b.addEventListener("click", () => open(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") open(false); });
    if (!store.get("mb_consent3") && !document.body.dataset.noConsent) {
      $("#consent").showModal();
      $("#agree").addEventListener("click", () => store.set("mb_consent3", "1"));
    }
    me().then(({ user }) => {
      const a = $("#acct");
      if (user && a) {
        a.href = "/account";
        a.querySelector(".avatar").textContent = (user.name || user.email || "?").trim()[0].toUpperCase();
        const nm = a.querySelector(".nm"); nm.removeAttribute("data-i"); nm.textContent = (user.name || "").split(" ")[0];
      }
    });
  }

  /* ---------- PWA ---------- */
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; const b = $("#installBtn"); if (b) b.hidden = false; });
  document.addEventListener("click", async (e) => {
    if (e.target.closest("#installBtn") && deferred) {
      e.preventDefault(); deferred.prompt(); const r = await deferred.userChoice; deferred = null;
      if (r.outcome === "accepted") { toast(t("installed")); api("/api/event", { method: "POST", body: { kind: "install" } }).catch(() => {}); }
    }
  });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
  window.addEventListener("offline", () => toast(t("offline"), "err"));

  /* ---------- medicine reminders (fire while any MediBot page is open) ---------- */
  function reminderTick() {
    let list = [];
    try { list = JSON.parse(store.get("mb_rem_cache") || "[]"); } catch { list = []; }
    if (!list.length) return;
    const now = new Date(), hm = now.toTimeString().slice(0, 5), stamp = now.toISOString().slice(0, 16);
    for (const r of list) {
      if (!r.active || !r.times.includes(hm)) continue;
      const key = `mb_fired_${r.id}_${stamp}`;
      if (store.get(key)) continue;
      store.set(key, "1");
      const body = `${r.medicine}${r.dose ? " – " + r.dose : ""}`;
      if ("Notification" in window && Notification.permission === "granted") {
        try { new Notification(t("reminderNow"), { body, icon: "/assets/img/icon-192.png", tag: key }); } catch { toast(`⏰ ${body}`); }
      } else toast(`⏰ ${t("reminderNow")}: ${body}`);
    }
  }
  setInterval(reminderTick, 20000);

  /* ---------- boot ---------- */
  window.MB = { $, $$, esc, icon, t, api, me, toast, md, cardHTML, triageHTML, sourcesHTML, store,
    get lang() { return lang; }, setLang, onLang: (fn) => listeners.push(fn), i18n: (d) => { pageDicts.push(d); }, applyLang };
  document.addEventListener("DOMContentLoaded", () => { mountShell(); applyLang(); reminderTick(); });
})();
