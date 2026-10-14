/* Health library: every document in the knowledge base, grouped and searchable. */
(() => {
  MB.i18n({
    en: { pageTitle: "Health topics", eyebrow: "Health library", title: "Health topics", lead: "Every topic MediBot knows – written from NHS and WHO material, in English and Urdu.", searchPh: "Search topics…",
      symptom: "Symptoms", condition: "Conditions", medicine: "Medicines", prevention: "Prevention", back: "← All topics", ask: "Ask MediBot about this", none: "No topic matches your search." },
    ur: { pageTitle: "صحت کے موضوعات", eyebrow: "صحت کی لائبریری", title: "صحت کے موضوعات", lead: "میڈی بوٹ کے تمام موضوعات – این ایچ ایس اور ڈبلیو ایچ او کے مواد سے، اردو اور انگریزی میں۔", searchPh: "موضوع تلاش کریں…",
      symptom: "علامات", condition: "بیماریاں", medicine: "دوائیں", prevention: "بچاؤ", back: "← تمام موضوعات", ask: "میڈی بوٹ سے اس بارے میں پوچھیں", none: "کوئی موضوع نہیں ملا۔" },
  });
  const { $, esc, t, api, cardHTML, icon } = MB;
  let all = [];
  const IC = { symptom: "pulse", condition: "heart", medicine: "pill", prevention: "shield" };
  function groups() {
    const q = $("#q").value.trim().toLowerCase();
    const list = all.filter((x) => !q || x.title.toLowerCase().includes(q) || x.id.includes(q));
    $("#groups").innerHTML = list.length ? ["symptom", "condition", "medicine", "prevention"].map((k) => { const g = list.filter((x) => x.type === k); if (!g.length) return "";
      return `<div><h2 style="font-size:1.3rem">${icon(IC[k])} ${esc(t(k))} <span class="pill">${g.length}</span></h2><div class="grid g4">${g.map((x) =>
        `<a class="card feature" href="/topics?id=${x.id}" data-id="${x.id}" style="padding:16px"><b>${esc(x.title)}</b></a>`).join("")}</div></div>`; }).join("") : `<div class="empty">${esc(t("none"))}</div>`;
  }
  async function view(id) {
    if (!id) { $("#view").innerHTML = ""; $("#groups").hidden = false; return; }
    const c = await api(`/api/topic/${encodeURIComponent(id)}?lang=${MB.lang}`);
    $("#groups").hidden = true;
    $("#view").innerHTML = `<div class="stack" style="max-width:820px"><a href="/topics" id="backLink">${esc(t("back"))}</a>${cardHTML(c)}<a class="btn" href="/chat?q=${encodeURIComponent(c.title)}">${icon("chat")}${esc(t("ask"))}</a></div>`;
    window.scrollTo({ top: 0 });
  }
  async function load() { all = (await api(`/api/topics?lang=${MB.lang}`)).topics; groups(); const id = new URLSearchParams(location.search).get("id"); if (id) view(id).catch(() => view(null)); }
  MB.onLang(() => load().catch(() => {}));
  document.addEventListener("DOMContentLoaded", () => {
    $("#q").addEventListener("input", () => { view(null); groups(); });
    document.addEventListener("click", (e) => { const a = e.target.closest("a[data-id], #backLink"); if (!a) return; e.preventDefault();
      history.pushState(null, "", a.getAttribute("href")); view(a.dataset.id || null); });
    addEventListener("popstate", () => view(new URLSearchParams(location.search).get("id")));
  });
})();
