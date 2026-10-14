/* Team page. ✏️ Edit TEAM and SUPERVISOR below with your real names, roles, photos and links. */
(() => {
  const TEAM = [
    { name: "Shahbaz", role: ["Team Lead · Backend & AI", "ٹیم لیڈ · بیک اینڈ اور اے آئی"], photo: "", github: "", linkedin: "", email: "",
      bio: ["FastAPI backend, Groq AI integration, retrieval engine, safety rules, database and the staff panel API.", "فاسٹ اے پی آئی بیک اینڈ، گروق اے آئی، ریٹریول انجن، حفاظتی قواعد، ڈیٹا بیس اور اسٹاف پینل۔"] },
    { name: "Muizz", role: ["Frontend & UX", "فرنٹ اینڈ اور یو ایکس"], photo: "", github: "", linkedin: "", email: "",
      bio: ["Responsive bilingual interface, symptom body map, hospital map, reminders, voice and PWA.", "دو لسانی ریسپانسیو انٹرفیس، باڈی میپ، ہسپتال نقشہ، یاد دہانیاں، آواز اور پی ڈبلیو اے۔"] },
    { name: "Suleman", role: ["Medical content, Tools & Testing", "طبی مواد، ٹولز اور ٹیسٹنگ"], photo: "", github: "", linkedin: "", email: "",
      bio: ["NHS/WHO-based knowledge base, medicine interaction checker, lab report explainer and the evaluation suite.", "این ایچ ایس/ڈبلیو ایچ او پر مبنی معلومات، دواؤں کا تعامل، لیب رپورٹ اور جانچ کا نظام۔"] },
  ];
  const SUPERVISOR = { name: "Supervisor Name", role: ["Project Supervisor · Department of Computer Science", "پروجیکٹ سپروائزر · شعبہ کمپیوٹر سائنس"] };
  MB.i18n({
    en: { pageTitle: "Our team", eyebrow: "Meet the creators", title: "The team behind MediBot", lead: "A BSCS final-year project to make trusted health information easy to reach for everyone in Pakistan – in their own language.",
      s1: "Team members", s2: "Trusted documents", s3: "Tests passing", s4: "Languages", missionEyebrow: "Our mission", missionTitle: "Reliable health information for everyone",
      mission: "Millions of people search symptoms online and find confusing or unsafe advice. MediBot combines a reviewed knowledge base with fast AI so anyone can understand their health, spot emergencies early and know when to see a doctor.",
      stack: ["Python · FastAPI on Vercel serverless", "Retrieval-augmented generation (BM25) + Groq GPT-OSS 120B", "PostgreSQL (Neon) database", "Vanilla JS PWA · English & Urdu (RTL)", "OpenStreetMap + Leaflet for nearby care"],
      contactTitle: "Get in touch", name: "Your name", email: "Email", message: "Message", send: "Send message", sent: "Thanks! Your message has been sent to the team." },
    ur: { pageTitle: "ہماری ٹیم", eyebrow: "بنانے والوں سے ملیں", title: "میڈی بوٹ کے پیچھے ٹیم", lead: "بی ایس سی ایس فائنل ایئر پروجیکٹ، تاکہ پاکستان میں ہر کوئی اپنی زبان میں مستند صحت کی معلومات آسانی سے حاصل کر سکے۔",
      s1: "ٹیم ممبرز", s2: "مستند دستاویزات", s3: "کامیاب ٹیسٹ", s4: "زبانیں", missionEyebrow: "ہمارا مقصد", missionTitle: "سب کے لیے قابلِ اعتماد صحت کی معلومات",
      mission: "لاکھوں لوگ آن لائن علامات تلاش کرتے ہیں اور الجھی ہوئی یا غیر محفوظ معلومات پاتے ہیں۔ میڈی بوٹ جانچی ہوئی معلومات کو تیز اے آئی کے ساتھ جوڑتا ہے تاکہ ہر کوئی اپنی صحت سمجھے، ایمرجنسی جلد پہچانے اور جانے کہ ڈاکٹر کے پاس کب جانا ہے۔",
      stack: ["پائتھن · فاسٹ اے پی آئی، ورسل سرور لیس", "ریٹریول اگمینٹڈ جنریشن (BM25) + گروق GPT-OSS 120B", "پوسٹگریس (نیون) ڈیٹا بیس", "ونیلا جاوا اسکرپٹ پی ڈبلیو اے · اردو اور انگریزی", "قریبی علاج کے لیے اوپن اسٹریٹ میپ"],
      contactTitle: "رابطہ کریں", name: "آپ کا نام", email: "ای میل", message: "پیغام", send: "پیغام بھیجیں", sent: "شکریہ! آپ کا پیغام ٹیم کو بھیج دیا گیا۔" },
  });
  const { $, esc, t, api, icon } = MB;
  const initials = (n) => n.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  function render() {
    const l = MB.lang === "ur" ? 1 : 0;
    $("#members").innerHTML = TEAM.map((m) => `<article class="card member">${m.photo ? `<img class="photo" src="${esc(m.photo)}" alt="${esc(m.name)}">` : `<div class="photo" aria-hidden="true">${esc(initials(m.name))}</div>`}
      <h3 style="margin-bottom:2px">${esc(m.name)}</h3><div class="role">${esc(m.role[l])}</div><p class="muted small" style="margin-top:10px">${esc(m.bio[l])}</p>
      <div class="links">${m.github ? `<a class="icon-btn" href="${esc(m.github)}" target="_blank" rel="noopener" aria-label="GitHub">${icon("globe")}</a>` : ""}${m.linkedin ? `<a class="icon-btn" href="${esc(m.linkedin)}" target="_blank" rel="noopener" aria-label="LinkedIn">${icon("users")}</a>` : ""}${m.email ? `<a class="icon-btn" href="mailto:${esc(m.email)}" aria-label="Email">${icon("send")}</a>` : ""}</div></article>`).join("");
    $("#supervisor").innerHTML = `<b>${esc(SUPERVISOR.name)}</b><div class="muted small">${esc(SUPERVISOR.role[l])}</div>`;
  }
  MB.onLang(render);
  document.addEventListener("DOMContentLoaded", () => {
    if (location.hash === "#contact") setTimeout(() => $("#contact").scrollIntoView({ behavior: "smooth" }), 300);
    $("#contact").addEventListener("submit", async (e) => {
      e.preventDefault(); const out = $("#cOut");
      try { await api("/api/contact", { method: "POST", body: { name: $("#cName").value, email: $("#cEmail").value, message: $("#cMsg").value } });
        out.className = "form-msg ok"; out.textContent = t("sent"); e.target.reset(); } catch (err) { out.className = "form-msg err"; out.textContent = err.message; }
    });
  });
})();
