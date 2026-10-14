/* Symptom checker with a tappable body map. The answer comes from the rule engine (deterministic triage) and is saved. */
(() => {
  const SYM = {
    head: [["headache", "headache", "سر درد"], ["migraine", "migraine", "آدھے سر کا درد"], ["dizzy", "dizziness", "چکر"], ["eyes", "red itchy eyes", "سرخ آنکھیں"], ["cold", "runny nose and sneezing", "نزلہ زکام"], ["yellow", "yellow eyes (jaundice)", "آنکھیں پیلی"]],
    throat: [["sore", "sore throat", "گلا خراب"], ["cough", "cough", "کھانسی"], ["neck", "swelling in the neck", "گردن میں سوجن"]],
    chest: [["chestpain", "chest pain", "سینے میں درد"], ["wheeze", "wheezing and short of breath", "سانس پھولنا"], ["heartburn", "heartburn and acidity", "سینے میں جلن"], ["cough2", "cough with phlegm", "بلغم والی کھانسی"]],
    abdomen: [["stomach", "stomach pain", "پیٹ درد"], ["diarrhoea", "diarrhoea", "دست"], ["vomit", "vomiting", "الٹی"], ["constipation", "constipation", "قبض"]],
    pelvis: [["urine", "burning when passing urine", "پیشاب میں جلن"], ["stone", "pain in side or back coming in waves", "پہلو میں لہر دار درد"], ["thirst", "very thirsty and urinating a lot", "زیادہ پیاس اور پیشاب"]],
    limbs: [["back", "back pain", "کمر درد"], ["rash", "skin rash", "جلد پر دانے"], ["burn", "a burn", "جل جانا"], ["itch", "itching and allergy", "خارش اور الرجی"]],
    general: [["fever", "fever", "بخار"], ["tired", "tiredness and weakness", "تھکاوٹ اور کمزوری"], ["sweats", "night sweats and weight loss", "رات کو پسینہ اور وزن کم"], ["sleep", "cannot sleep", "نیند نہیں آتی"], ["anxiety", "stress and anxiety", "ذہنی دباؤ اور گھبراہٹ"], ["heat", "heat exhaustion", "گرمی لگنا"]],
  };
  const AREAS = { head: ["Head & face", "سر اور چہرہ"], throat: ["Throat & neck", "گلا اور گردن"], chest: ["Chest & breathing", "سینہ اور سانس"], abdomen: ["Stomach", "پیٹ"],
    pelvis: ["Urine & lower belly", "پیشاب اور پیٹ کا نچلا حصہ"], limbs: ["Back, skin, arms & legs", "کمر، جلد، بازو اور ٹانگیں"], general: ["Whole body", "پورا جسم"] };
  const WHO = [["adult", "Adult", "بالغ", "I"], ["child", "Child", "بچہ", "My child"], ["baby", "Baby under 3 months", "3 ماہ سے کم عمر بچہ", "My 2 month old baby"],
    ["pregnant", "Pregnant", "حاملہ", "I am pregnant and I"], ["older", "Older adult (65+)", "بزرگ (65+)", "My elderly grandmother"]];
  const RED = [["Chest pain or pressure spreading to arm or jaw", "سینے میں دباؤ جو بازو یا جبڑے تک جائے"], ["Severe difficulty breathing", "سانس لینے میں شدید دشواری"],
    ["Face drooping, weak arm or slurred speech", "چہرہ لٹکنا، بازو کمزور یا زبان لڑکھڑانا"], ["Fainted, fits or very drowsy", "بے ہوشی، دورے یا شدید غنودگی"],
    ["Heavy bleeding or vomiting blood", "زیادہ خون بہنا یا خون کی الٹی"], ["Stiff neck with a rash that doesn't fade", "گردن اکڑنا اور نہ مٹنے والے دانے"],
    ["Bleeding gums or black stools with fever", "بخار کے ساتھ مسوڑھوں سے خون یا سیاہ پاخانہ"], ["Thoughts of harming myself", "خود کو نقصان پہنچانے کے خیالات"]];
  MB.i18n({
    en: { pageTitle: "Symptom checker", eyebrow: "Free · 1 minute", title: "Symptom checker", lead: "Answer four quick questions. MediBot tells you how urgent it looks and what to do next. It cannot diagnose.",
      qWho: "Who is this for?", qWhere: "Where is the problem? Tap the body or choose an area", pickHint: "Choose up to 3 symptoms:", qRed: "Any of these right now?",
      qMore: "A little more detail (optional)", qDays: "For how many days?", qTemp: "Temperature (°F), if fever", check: "Check my symptoms",
      needSym: "Please choose at least one symptom.", tooMany: "Choose up to 3 symptoms.", printBtn: "Print / save PDF for your doctor", shareBtn: "Share on WhatsApp", chatBtn: "Ask a follow-up in chat",
      summary: "Your summary", past: "Your recent checks", when: "When", what: "Symptoms", result: "Result", redTitle: "These are emergency warning signs.",
      callNow: "Call 1122 now" },
    ur: { pageTitle: "علامات کی جانچ", eyebrow: "مفت · ایک منٹ", title: "علامات کی جانچ", lead: "چار آسان سوالوں کے جواب دیں۔ میڈی بوٹ بتائے گا کہ معاملہ کتنا فوری ہے اور آگے کیا کریں۔ یہ تشخیص نہیں کر سکتا۔",
      qWho: "یہ کس کے لیے ہے؟", qWhere: "مسئلہ کہاں ہے؟ جسم پر ٹیپ کریں یا حصہ چنیں", pickHint: "زیادہ سے زیادہ 3 علامات چنیں:", qRed: "کیا ابھی ان میں سے کچھ ہے؟",
      qMore: "تھوڑی مزید تفصیل (اختیاری)", qDays: "کتنے دن سے؟", qTemp: "بخار ہو تو درجہ حرارت (°F)", check: "میری علامات جانچیں",
      needSym: "کم از کم ایک علامت چنیں۔", tooMany: "زیادہ سے زیادہ 3 علامات چنیں۔", printBtn: "ڈاکٹر کے لیے پرنٹ / پی ڈی ایف", shareBtn: "واٹس ایپ پر شیئر", chatBtn: "چیٹ میں مزید پوچھیں",
      summary: "آپ کا خلاصہ", past: "آپ کی حالیہ جانچ", when: "کب", what: "علامات", result: "نتیجہ", redTitle: "یہ ایمرجنسی کی علامات ہیں۔", callNow: "ابھی 1122 پر کال کریں" },
  });
  const { $, $$, esc, t, api, icon, cardHTML, triageHTML, toast } = MB;
  const L = () => (MB.lang === "ur" ? 1 : 0);
  let area = "general";
  const chosen = new Set();

  function render() {
    const l = L();
    $("#who").innerHTML = WHO.map(([v, en, ur], i) => `<label class="opt"><input type="radio" name="who" value="${v}" ${i === 0 ? "checked" : ""}><span>${esc(l ? ur : en)}</span></label>`).join("");
    $("#areas").innerHTML = Object.entries(AREAS).map(([k, n]) => `<label class="opt"><input type="radio" name="area" value="${k}" ${k === area ? "checked" : ""}><span>${esc(n[l])}</span></label>`).join("");
    $("#redflags").innerHTML = RED.map((r, i) => `<label class="opt"><input type="checkbox" value="${i}"><span>${esc(r[l])}</span></label>`).join("");
    renderSymptoms();
  }
  function renderSymptoms() {
    const l = L(), list = SYM[area];
    $("#symptoms").innerHTML = list.map(([id, en, ur]) => `<label class="opt"><input type="checkbox" value="${id}" ${chosen.has(id) ? "checked" : ""}><span>${esc(l ? ur : en)}</span></label>`).join("");
    $$(".bodymap .part").forEach((p) => p.classList.toggle("on", p.dataset.area === area));
  }
  const find = (id) => Object.values(SYM).flat().find((s) => s[0] === id);
  function pick(a) { area = a; const r = $(`#areas input[value="${a}"]`); if (r) r.checked = true; renderSymptoms(); }

  async function submit(e) {
    e.preventDefault();
    $("#err").textContent = "";
    if (!chosen.size) { $("#err").textContent = t("needSym"); return; }
    const who = $("#who input:checked").value, whoRow = WHO.find((w) => w[0] === who);
    const syms = [...chosen].map(find), days = $("#days").value, temp = $("#temp").value;
    const red = $$("#redflags input:checked").map((x) => RED[+x.value]);
    let msg = `${whoRow[3]} ${who === "adult" || who === "pregnant" ? "have" : "has"} ${syms.map((s) => s[1]).join(" and ")}`;
    if (temp) msg += ` with temperature ${temp} F`;
    if (days) msg += ` for ${days} days`;
    if (red.length) msg += `. Also: ${red.map((r) => r[0]).join(", ")}`;
    $("#go").disabled = true;
    try {
      const r = await api("/api/checker", { method: "POST", body: { who, areas: [area], symptoms: [...chosen], redflags: red.map((x) => x[L()]),
        days: days ? +days : null, temp_f: temp ? +temp : null, lang: MB.lang, message: msg } });
      showResult(r, syms, who, days, temp, red);
      loadPast();
    } catch (err) { $("#err").textContent = err.message; } finally { $("#go").disabled = false; }
  }
  function showResult(r, syms, who, days, temp, red) {
    const l = L(), whoName = WHO.find((w) => w[0] === who)[l ? 2 : 1];
    const tri = r.triage || { level: r.level, reasons: [] };
    let html = `<div class="card stack" id="summaryCard"><div class="row spread"><h2 style="margin:0">${esc(t("summary"))}</h2><span class="small muted">${new Date().toLocaleString()}</span></div>`;
    html += `<p><b>${esc(whoName)}</b> · ${syms.map((s) => esc(s[l ? 2 : 1])).join(", ")}${days ? ` · ${esc(days)} ${l ? "دن" : "days"}` : ""}${temp ? ` · ${esc(temp)}°F` : ""}</p>`;
    html += triageHTML(tri);
    if (r.type === "emergency") {
      const em = r.emergency;
      html += `<div class="emergency-box"><b>${esc(em ? em.message : t("redTitle"))}</b>${em ? `<ul>${em.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
        <div class="row"><a class="btn btn-danger btn-sm" href="tel:1122">${icon("phone")}${esc(t("callNow"))}</a><a class="btn btn-ghost btn-sm" href="/hospitals">${icon("map")}${esc(t("hospitals"))}</a></div></div>`;
    }
    if (r.intro) html += `<p class="muted">${esc(r.intro)}</p>`;
    html += (r.cards || []).map(cardHTML).join("");
    if (!(r.cards || []).length && r.text && r.type !== "emergency") html += `<p>${esc(r.text)}</p>`;
    html += `<p class="small muted">${esc(r.disclaimer || "")}</p><div class="row no-print"><button class="btn btn-ghost btn-sm" id="printBtn">${icon("print")}${esc(t("printBtn"))}</button>
      <button class="btn btn-ghost btn-sm" id="waBtn">${icon("share")}${esc(t("shareBtn"))}</button><a class="btn btn-sm" href="/chat?q=${encodeURIComponent(syms.map((s) => s[1]).join(", "))}">${icon("chat")}${esc(t("chatBtn"))}</a></div></div>`;
    $("#result").innerHTML = html;
    $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
    if (r.type === "emergency") $("#sos").showModal();
    $("#printBtn").onclick = () => window.print();
    $("#waBtn").onclick = () => { const text = $("#summaryCard").innerText.slice(0, 1200) + "\n– MediBot"; window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener"); };
  }
  async function loadPast() {
    try {
      const { checks } = await api("/api/checks");
      $("#pastWrap").hidden = !checks.length;
      const l = L();
      $("#past").innerHTML = checks.slice(0, 10).map((c) => `<tr><td>${esc(new Date(c.created_at).toLocaleDateString())}</td><td>${c.payload.symptoms.map((s) => esc((find(s) || [s, s, s])[l ? 2 : 1])).join(", ")}</td>
        <td><span class="pill ${c.level === "emergency" ? "danger" : c.level === "doctor" ? "warn" : "ok"}">${esc(T(c.level))}</span></td></tr>`).join("");
    } catch { /* ignore */ }
  }
  const T = (lv) => ({ self_care: L() ? "گھر پر خیال" : "Self-care", doctor: L() ? "ڈاکٹر" : "Doctor", emergency: L() ? "ایمرجنسی" : "Emergency" }[lv] || lv);

  MB.onLang(() => { render(); loadPast(); });
  document.addEventListener("DOMContentLoaded", () => {
    $("#checker").addEventListener("submit", submit);
    $("#areas").addEventListener("change", (e) => pick(e.target.value));
    $("#symptoms").addEventListener("change", (e) => {
      const id = e.target.value;
      if (e.target.checked) { if (chosen.size >= 3) { e.target.checked = false; toast(t("tooMany")); return; } chosen.add(id); } else chosen.delete(id);
    });
    $$(".bodymap .part").forEach((p) => {
      p.addEventListener("click", () => pick(p.dataset.area));
      p.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(p.dataset.area); } });
    });
  });
})();
