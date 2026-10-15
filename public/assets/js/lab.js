/* Lab report explainer: offline parser + reference ranges, optional Groq explanation, and photo/PDF upload. */
(() => {
  MB.i18n({
    en: { pageTitle: "Lab report explainer", eyebrow: "CBC · Sugar · Thyroid · Lipids · Liver · Kidney", title: "Understand your lab report", lead: "Type or paste the results from your report. MediBot shows what's high, low or normal and explains it in plain language.",
      paste: "Your results (one test per line)", ph: "e.g.\nHb 10.5 g/dL\nPlatelets 140,000\nFasting sugar 118 mg/dL\nTSH 5.8", sex: "Sex (for haemoglobin range)", sexAny: "Not specified", female: "Female", male: "Male",
      sample: "Try a sample", explain: "Explain my report", privacyNote: "Don't include your name or CNIC – only the test values.", supported: "Tests MediBot understands",
      test: "Test", value: "Your value", range: "Usual range", status: "Result", low: "Low", high: "High", normal: "Normal", none: "No supported tests found. Write each test with its value, e.g. \"Hb 11.2\".",
      summary: "Summary", abnormal: "result(s) outside the usual range", allNormal: "All recognised results are in the usual range.", aiTitle: "Plain-language explanation", askChat: "Ask about this in chat",
      upTitle: "Or upload your report", upHint: "Drop a photo or PDF of your lab, ECG or other report here. JPG, PNG, WEBP, HEIC or PDF (PDF up to 4 MB).",
      upPick: "Choose file", upCamera: "Take a photo", upRemove: "Remove", upPrivacy: "Your file is not saved. Hide your name/CNIC if possible.",
      readExplain: "Read & explain my report", reading: "Reading your report...", unclear: "Check", info: "Info", fromReport: "From your report",
      unreadableTitle: "We couldn't read:", findingsTitle: "What the report says", criticalTitle: "See a doctor urgently", ecgTitle: "About this ECG",
      errType: "Please choose a photo (JPG, PNG, WEBP, HEIC) or a PDF.", errBig: "This PDF is larger than 4 MB. Please upload a photo or screenshot of the report instead.",
      errHeic: "Your browser can't open this HEIC photo. Please upload a screenshot of it, or set your camera to save JPG photos.",
      errImage: "This photo couldn't be opened. Please try another photo or a screenshot.", errRate: "Too many uploads. Please wait a minute and try again.",
      errBusy: "The reading service is busy or your connection dropped. Please try again in a minute, or type the values." },
    ur: { pageTitle: "لیب رپورٹ کی وضاحت", eyebrow: "سی بی سی · شوگر · تھائرائیڈ · کولیسٹرول · جگر · گردے", title: "اپنی لیب رپورٹ سمجھیں", lead: "رپورٹ کے نتائج لکھیں یا پیسٹ کریں۔ میڈی بوٹ بتائے گا کیا زیادہ، کم یا نارمل ہے اور آسان زبان میں سمجھائے گا۔",
      paste: "آپ کے نتائج (ہر لائن میں ایک ٹیسٹ)", ph: "مثلاً\nHb 10.5 g/dL\nPlatelets 140,000\nFasting sugar 118 mg/dL\nTSH 5.8", sex: "جنس (ہیموگلوبن کی حد کے لیے)", sexAny: "نہیں بتایا", female: "خاتون", male: "مرد",
      sample: "نمونہ آزمائیں", explain: "رپورٹ سمجھائیں", privacyNote: "اپنا نام یا شناختی کارڈ نمبر نہ لکھیں – صرف ٹیسٹ کی ویلیوز۔", supported: "میڈی بوٹ یہ ٹیسٹ سمجھتا ہے",
      test: "ٹیسٹ", value: "آپ کی ویلیو", range: "عام حد", status: "نتیجہ", low: "کم", high: "زیادہ", normal: "نارمل", none: "کوئی معاون ٹیسٹ نہیں ملا۔ ہر ٹیسٹ اس کی ویلیو کے ساتھ لکھیں، جیسے \"Hb 11.2\"۔",
      summary: "خلاصہ", abnormal: "نتائج عام حد سے باہر", allNormal: "تمام پہچانے گئے نتائج عام حد میں ہیں۔", aiTitle: "آسان زبان میں وضاحت", askChat: "چیٹ میں اس بارے میں پوچھیں",
      upTitle: "یا اپنی رپورٹ اپ لوڈ کریں", upHint: "اپنی لیب، ای سی جی یا کسی اور رپورٹ کی تصویر یا پی ڈی ایف یہاں ڈالیں۔ JPG، PNG، WEBP، HEIC یا PDF (پی ڈی ایف 4 ایم بی تک)۔",
      upPick: "فائل منتخب کریں", upCamera: "تصویر کھینچیں", upRemove: "ہٹائیں", upPrivacy: "آپ کی فائل محفوظ نہیں کی جاتی۔ ہو سکے تو اپنا نام اور شناختی کارڈ نمبر چھپا دیں۔",
      readExplain: "رپورٹ پڑھیں اور سمجھائیں", reading: "آپ کی رپورٹ پڑھی جا رہی ہے...", unclear: "دیکھیں", info: "معلومات", fromReport: "آپ کی رپورٹ سے",
      unreadableTitle: "یہ حصے نہیں پڑھے جا سکے:", findingsTitle: "رپورٹ میں کیا لکھا ہے", criticalTitle: "جلد از جلد ڈاکٹر کو دکھائیں", ecgTitle: "اس ای سی جی کے بارے میں",
      errType: "براہ کرم تصویر (JPG، PNG، WEBP، HEIC) یا پی ڈی ایف منتخب کریں۔", errBig: "یہ پی ڈی ایف 4 ایم بی سے بڑی ہے۔ براہ کرم رپورٹ کی تصویر یا اسکرین شاٹ اپ لوڈ کریں۔",
      errHeic: "آپ کا براؤزر یہ HEIC تصویر نہیں کھول سکتا۔ اس کا اسکرین شاٹ اپ لوڈ کریں، یا کیمرے کو JPG میں محفوظ کرنے پر سیٹ کریں۔",
      errImage: "یہ تصویر نہیں کھل سکی۔ کوئی اور تصویر یا اسکرین شاٹ آزمائیں۔", errRate: "بہت زیادہ اپ لوڈز۔ ایک منٹ رک کر دوبارہ کوشش کریں۔",
      errBusy: "پڑھنے کی سروس مصروف ہے یا انٹرنیٹ رک گیا۔ ایک منٹ بعد دوبارہ کوشش کریں، یا ویلیوز لکھ دیں۔" },
  });
  const { $, esc, t, api, md, sourcesHTML, icon } = MB;
  const SAMPLE = "Hb 10.4 g/dL\nWBC 3.2\nPlatelets 95,000\nFasting blood sugar 112 mg/dL\nHbA1c 6.1 %\nTSH 2.1\nALT (SGPT) 72 U/L\nVitamin D 14 ng/mL";
  const MAX_PDF = 4 * 1024 * 1024, MAX_SIDE = 1600;
  let last = null, file = null, thumbUrl = null;
  const skeleton = () => { $("#out").innerHTML = `<div class="card"><div class="skeleton" style="height:22px;width:50%"></div><div class="skeleton" style="height:120px;margin-top:14px"></div></div>`; };
  async function explain(e) {
    e && e.preventDefault();
    if (file) return readFile();
    const text = $("#txt").value.trim(); if (!text) return;
    $("#go").disabled = true;
    skeleton();
    try { last = await api("/api/lab", { method: "POST", body: { text, lang: MB.lang, sex: $("#sex").value } }); show(last); }
    catch (err) { $("#out").innerHTML = `<div class="empty">${esc(err.message)}</div>`; } finally { $("#go").disabled = false; }
  }
  const box = (cls, ic, title, items) => `<div class="triage ${cls}">${icon(ic)}<div>${title ? `<b>${esc(title)}</b>` : ""}${items.map((x) => `<small>${esc(x)}</small>`).join("")}</div></div>`;
  function show(r) {
    let html = "";
    if (r.upload) html += box("doctor", "info", r.confidence_note, r.unreadable_parts.length ? [`${t("unreadableTitle")} ${r.unreadable_parts.join(" · ")}`] : []);
    if (r.critical && r.critical.length) html += box("emergency", "alert", t("criticalTitle"), r.critical);
    if (r.emergency) html += MB.triageHTML({ level: "emergency", reasons: [r.emergency.text] });
    if (!r.rows.length && !r.findings) { $("#out").innerHTML = html + `<div class="empty">${esc(t("none"))}</div>`; return; }
    const pill = (s) => `<span class="pill ${s === "normal" ? "ok" : s === "high" ? "danger" : s === "low" ? "warn" : ""}">${esc(t(s))}</span>`;
    if (r.rows.length) html += `<div class="card"><div class="row spread"><h2 style="margin:0">${esc(t("summary"))}</h2><span class="pill ${r.abnormal ? "warn" : "ok"}">${r.abnormal ? `${r.abnormal} ${esc(t("abnormal"))}` : esc(t("allNormal"))}</span></div>
      <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>${esc(t("test"))}</th><th>${esc(t("value"))}</th><th>${esc(t("range"))}</th><th>${esc(t("status"))}</th></tr></thead><tbody>
      ${r.rows.map((x) => `<tr><td><b>${esc(x.name)}</b>${x.meaning ? `<div class="small muted">${esc(x.meaning)}</div>` : ""}</td><td dir="ltr">${esc(x.value)} ${esc(x.unit)}</td><td dir="ltr">${esc(x.range)}${x.range_src === "report" ? `<div class="small muted" dir="auto">${esc(t("fromReport"))}</div>` : ""}</td><td>${pill(x.status)}</td></tr>`).join("")}
      </tbody></table></div><p class="small muted" style="margin-top:12px">${esc(r.note)}</p>${sourcesHTML(r.sources)}</div>`;
    if (r.warnings && r.warnings.length) html += box("doctor", "heart", t("ecgTitle"), r.warnings);
    if (r.findings) html += `<div class="card"><h3 style="margin:0">${esc(t("findingsTitle"))}</h3><p class="findings" dir="auto" style="margin:10px 0 0">${esc(r.findings)}</p></div>`;
    if (r.ai_text) html += `<div class="card"><div class="row spread"><h3 style="margin:0">${esc(t("aiTitle"))}</h3><span class="pill brand">${icon("spark")} ${esc(t("aiBadge"))}</span></div><div style="margin-top:10px">${md(r.ai_text)}</div></div>`;
    html += `<a class="btn btn-ghost" href="/chat?q=${encodeURIComponent(r.rows.filter((x) => x.status === "high" || x.status === "low").map((x) => `${x.name} is ${x.status}`).join(", ") || "my lab report")}">${icon("chat")}${esc(t("askChat"))}</a>`;
    $("#out").innerHTML = html;
  }
  function supported() { api(`/api/lab/tests?lang=${MB.lang}`).then((r) => { const s = $("#supp"); if (s) s.textContent = r.tests.join(" · "); }).catch(() => {}); }

  /* ---------- upload: one photo (downscaled to JPEG in the browser) or one PDF ---------- */
  function goLabel() { const g = $("#go"); g.dataset.i = file ? "readExplain" : "explain"; g.textContent = t(g.dataset.i); }
  function upErr(key) { $("#upErr").textContent = key ? t(key) : ""; }
  function clearFile() {
    file = null; if (thumbUrl) URL.revokeObjectURL(thumbUrl); thumbUrl = null;
    $("#prev").hidden = true; $("#txt").required = true; upErr(""); goLabel();
  }
  const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  function shrink(f) {
    return new Promise((ok, no) => {
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); c.toBlob((b) => (b ? ok(b) : no()), "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); no(); };
      img.src = url;
    });
  }
  async function pick(f) {
    if (!f) return;
    clearFile();
    const ext = (f.name.split(".").pop() || "").toLowerCase(), pdf = f.type === "application/pdf" || ext === "pdf";
    const heic = /hei[cf]/.test(f.type) || ext === "heic" || ext === "heif";
    if (!pdf && !heic && !/^image\//.test(f.type)) return upErr("errType");
    if (pdf && f.size > MAX_PDF) return upErr("errBig");
    try { file = pdf ? f : await shrink(f); } catch { return upErr(heic ? "errHeic" : "errImage"); }
    if (!pdf) thumbUrl = URL.createObjectURL(file);
    $("#thumb").hidden = pdf; $("#pdfIco").hidden = !pdf; if (thumbUrl) $("#thumb").src = thumbUrl;
    $("#fname").textContent = f.name; $("#fsize").textContent = size(file.size);
    $("#prev").hidden = false; $("#txt").required = false; goLabel();
  }
  async function readFile() {
    const go = $("#go"); go.disabled = true; go.textContent = t("reading"); skeleton();
    const fd = new FormData();
    fd.append("file", file, file.type === "application/pdf" ? "report.pdf" : "report.jpg");
    fd.append("lang", MB.lang); fd.append("sex", $("#sex").value);
    try {
      const r = await fetch("/api/lab/upload", { method: "POST", body: fd, credentials: "same-origin" });
      let d = null; try { d = await r.json(); } catch { /* not JSON (e.g. platform timeout) */ }
      if (!r.ok) throw new Error(r.status === 429 ? t("errRate") : d && typeof d.detail === "string" ? d.detail : r.status === 413 ? t("errBig") : t("errBusy"));
      $("#txt").value = d.extracted_text_lines.join("\n");
      last = d; clearFile(); show(d);
    } catch (err) { $("#out").innerHTML = `<div class="empty">${esc(err instanceof TypeError ? t("errBusy") : err.message)}</div>`; }
    finally { go.disabled = false; goLabel(); }
  }

  MB.onLang(() => { if (last && last.upload) show(last); else if (last) explain(); else supported(); });
  document.addEventListener("DOMContentLoaded", () => {
    $("#labForm").addEventListener("submit", explain);
    $("#sample").addEventListener("click", () => { clearFile(); $("#txt").value = SAMPLE; explain(); });
    const drop = $("#drop");
    ["file", "cam"].forEach((id) => $(`#${id}`).addEventListener("change", (e) => { pick(e.target.files[0]); e.target.value = ""; }));
    $("#pick").addEventListener("click", () => $("#file").click());
    if (matchMedia("(pointer: coarse)").matches) { $("#camBtn").hidden = false; $("#camBtn").addEventListener("click", () => $("#cam").click()); }
    $("#rm").addEventListener("click", clearFile);
    drop.addEventListener("click", (e) => { if (!e.target.closest("button")) $("#file").click(); });
    ["dragenter", "dragover"].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => pick(e.dataTransfer.files[0]));
  });
})();
