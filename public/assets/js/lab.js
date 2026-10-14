/* Lab report explainer: offline parser + reference ranges, optional Groq explanation. */
(() => {
  MB.i18n({
    en: { pageTitle: "Lab report explainer", eyebrow: "CBC · Sugar · Thyroid · Lipids · Liver · Kidney", title: "Understand your lab report", lead: "Type or paste the results from your report. MediBot shows what's high, low or normal and explains it in plain language.",
      paste: "Your results (one test per line)", ph: "e.g.\nHb 10.5 g/dL\nPlatelets 140,000\nFasting sugar 118 mg/dL\nTSH 5.8", sex: "Sex (for haemoglobin range)", sexAny: "Not specified", female: "Female", male: "Male",
      sample: "Try a sample", explain: "Explain my report", privacyNote: "Don't include your name or CNIC – only the test values.", supported: "Tests MediBot understands",
      test: "Test", value: "Your value", range: "Usual range", status: "Result", low: "Low", high: "High", normal: "Normal", none: "No supported tests found. Write each test with its value, e.g. \"Hb 11.2\".",
      summary: "Summary", abnormal: "result(s) outside the usual range", allNormal: "All recognised results are in the usual range.", aiTitle: "Plain-language explanation", askChat: "Ask about this in chat" },
    ur: { pageTitle: "لیب رپورٹ کی وضاحت", eyebrow: "سی بی سی · شوگر · تھائرائیڈ · کولیسٹرول · جگر · گردے", title: "اپنی لیب رپورٹ سمجھیں", lead: "رپورٹ کے نتائج لکھیں یا پیسٹ کریں۔ میڈی بوٹ بتائے گا کیا زیادہ، کم یا نارمل ہے اور آسان زبان میں سمجھائے گا۔",
      paste: "آپ کے نتائج (ہر لائن میں ایک ٹیسٹ)", ph: "مثلاً\nHb 10.5 g/dL\nPlatelets 140,000\nFasting sugar 118 mg/dL\nTSH 5.8", sex: "جنس (ہیموگلوبن کی حد کے لیے)", sexAny: "نہیں بتایا", female: "خاتون", male: "مرد",
      sample: "نمونہ آزمائیں", explain: "رپورٹ سمجھائیں", privacyNote: "اپنا نام یا شناختی کارڈ نمبر نہ لکھیں – صرف ٹیسٹ کی ویلیوز۔", supported: "میڈی بوٹ یہ ٹیسٹ سمجھتا ہے",
      test: "ٹیسٹ", value: "آپ کی ویلیو", range: "عام حد", status: "نتیجہ", low: "کم", high: "زیادہ", normal: "نارمل", none: "کوئی معاون ٹیسٹ نہیں ملا۔ ہر ٹیسٹ اس کی ویلیو کے ساتھ لکھیں، جیسے \"Hb 11.2\"۔",
      summary: "خلاصہ", abnormal: "نتائج عام حد سے باہر", allNormal: "تمام پہچانے گئے نتائج عام حد میں ہیں۔", aiTitle: "آسان زبان میں وضاحت", askChat: "چیٹ میں اس بارے میں پوچھیں" },
  });
  const { $, esc, t, api, md, sourcesHTML, icon } = MB;
  const SAMPLE = "Hb 10.4 g/dL\nWBC 3.2\nPlatelets 95,000\nFasting blood sugar 112 mg/dL\nHbA1c 6.1 %\nTSH 2.1\nALT (SGPT) 72 U/L\nVitamin D 14 ng/mL";
  let last = null;
  async function explain(e) {
    e && e.preventDefault();
    const text = $("#txt").value.trim(); if (!text) return;
    $("#go").disabled = true;
    $("#out").innerHTML = `<div class="card"><div class="skeleton" style="height:22px;width:50%"></div><div class="skeleton" style="height:120px;margin-top:14px"></div></div>`;
    try { last = await api("/api/lab", { method: "POST", body: { text, lang: MB.lang, sex: $("#sex").value } }); show(last); }
    catch (err) { $("#out").innerHTML = `<div class="empty">${esc(err.message)}</div>`; } finally { $("#go").disabled = false; }
  }
  function show(r) {
    if (!r.rows.length) { $("#out").innerHTML = `<div class="empty">${esc(t("none"))}</div>`; return; }
    const pill = (s) => `<span class="pill ${s === "normal" ? "ok" : s === "high" ? "danger" : "warn"}">${esc(t(s))}</span>`;
    let html = `<div class="card"><div class="row spread"><h2 style="margin:0">${esc(t("summary"))}</h2><span class="pill ${r.abnormal ? "warn" : "ok"}">${r.abnormal ? `${r.abnormal} ${esc(t("abnormal"))}` : esc(t("allNormal"))}</span></div>
      <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>${esc(t("test"))}</th><th>${esc(t("value"))}</th><th>${esc(t("range"))}</th><th>${esc(t("status"))}</th></tr></thead><tbody>
      ${r.rows.map((x) => `<tr><td><b>${esc(x.name)}</b>${x.meaning ? `<div class="small muted">${esc(x.meaning)}</div>` : ""}</td><td dir="ltr">${esc(x.value)} ${esc(x.unit)}</td><td dir="ltr">${esc(x.range)}</td><td>${pill(x.status)}</td></tr>`).join("")}
      </tbody></table></div><p class="small muted" style="margin-top:12px">${esc(r.note)}</p>${sourcesHTML(r.sources)}</div>`;
    if (r.ai_text) html += `<div class="card"><div class="row spread"><h3 style="margin:0">${esc(t("aiTitle"))}</h3><span class="pill brand">${icon("spark")} ${esc(t("aiBadge"))}</span></div><div style="margin-top:10px">${md(r.ai_text)}</div></div>`;
    html += `<a class="btn btn-ghost" href="/chat?q=${encodeURIComponent(r.rows.filter((x) => x.status !== "normal").map((x) => `${x.name} is ${x.status}`).join(", ") || "my lab report")}">${icon("chat")}${esc(t("askChat"))}</a>`;
    $("#out").innerHTML = html;
  }
  function supported() { api(`/api/lab/tests?lang=${MB.lang}`).then((r) => { const s = $("#supp"); if (s) s.textContent = r.tests.join(" · "); }).catch(() => {}); }
  MB.onLang(() => { if (last) explain(); else supported(); });
  document.addEventListener("DOMContentLoaded", () => {
    $("#labForm").addEventListener("submit", explain);
    $("#sample").addEventListener("click", () => { $("#txt").value = SAMPLE; explain(); });
  });
})();
