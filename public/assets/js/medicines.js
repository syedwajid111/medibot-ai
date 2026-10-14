/* Medicine library + offline interaction checker. */
(() => {
  MB.i18n({
    en: { pageTitle: "Medicines & interactions", eyebrow: "18 common medicines", title: "Medicines & interactions", lead: "Uses, side effects and precautions of common medicines in Pakistan – and a checker for combinations to avoid. Always follow the label and your doctor.",
      tabInfo: "Medicine info", tabIx: "Interaction checker", searchPh: "Search e.g. Panadol, Flagyl, Ponstan, ORS…", none: "No medicine found. Try another name, or ask in the chat.",
      ixTitle: "Can I take these together?", ixLead: "Select 2 to 6 medicines (and food or drinks) to check for well-known interactions.", pickMeds: "Medicines", pickSubs: "Food, drinks & others",
      ixCheck: "Check interactions", clear: "Clear", needTwo: "Select at least 2 items.", selected: "selected", noIx: "No known interactions between these items in MediBot's list.", checked: "pairs checked" },
    ur: { pageTitle: "دوائیں اور تعامل", eyebrow: "18 عام دوائیں", title: "دوائیں اور تعامل", lead: "پاکستان میں عام دواؤں کے استعمال، مضر اثرات اور احتیاطیں – اور یہ جانچ کہ کون سی دوائیں ساتھ نہ لیں۔ ہمیشہ پیکٹ کی ہدایت اور ڈاکٹر کے مشورے پر عمل کریں۔",
      tabInfo: "دوا کی معلومات", tabIx: "تعامل کی جانچ", searchPh: "تلاش کریں جیسے پیناڈول، فلیجل، پونسٹان، او آر ایس…", none: "کوئی دوا نہیں ملی۔ دوسرا نام آزمائیں یا چیٹ میں پوچھیں۔",
      ixTitle: "کیا یہ ساتھ لے سکتا ہوں؟", ixLead: "معروف تعامل جانچنے کے لیے 2 سے 6 دوائیں (اور کھانے پینے کی چیزیں) چنیں۔", pickMeds: "دوائیں", pickSubs: "کھانا، مشروبات اور دیگر",
      ixCheck: "تعامل جانچیں", clear: "صاف کریں", needTwo: "کم از کم 2 چیزیں چنیں۔", selected: "منتخب", noIx: "میڈی بوٹ کی فہرست میں ان کے درمیان کوئی معلوم تعامل نہیں۔", checked: "جوڑے جانچے گئے" },
  });
  const { $, $$, esc, t, api, cardHTML, sourcesHTML, toast, icon } = MB;
  const sel = new Set();
  let timer;
  async function search() {
    const q = $("#q").value.trim();
    try {
      const { results } = await api(`/api/medicines?q=${encodeURIComponent(q)}&lang=${MB.lang}`);
      $("#list").innerHTML = results.length ? results.map(cardHTML).join("") : `<div class="empty">${esc(t("none"))}</div>`;
    } catch (e) { $("#list").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  async function items() {
    const { items } = await api(`/api/interactions/items?lang=${MB.lang}`);
    const opt = (i) => `<label class="opt"><input type="checkbox" value="${esc(i.id)}" ${sel.has(i.id) ? "checked" : ""}><span>${esc(i.name)}</span></label>`;
    $("#ixMeds").innerHTML = items.filter((i) => i.kind === "medicine").map(opt).join("");
    $("#ixSubs").innerHTML = items.filter((i) => i.kind === "substance").map(opt).join("");
    count();
  }
  const count = () => { $("#ixCount").textContent = sel.size ? `${sel.size} ${t("selected")}` : ""; };
  async function check() {
    if (sel.size < 2) return toast(t("needTwo"), "err");
    const r = await api(`/api/interactions?ids=${[...sel].join(",")}&lang=${MB.lang}`);
    const cls = { major: "danger", moderate: "warn", minor: "brand", info: "brand", none: "ok" };
    $("#ixOut").innerHTML = (r.results.length ? r.results.map((x) => `<article class="card"><div class="row spread"><h3 style="margin:0">${x.pair.map(esc).join(" + ")}</h3>
      <span class="pill ${cls[x.level]}">${icon(x.level === "major" ? "alert" : x.level === "none" ? "check" : "info")} ${esc(x.label)}</span></div><p style="margin:10px 0 0">${esc(x.text)}</p></article>`).join("")
      : `<div class="empty">${icon("check")} ${esc(t("noIx"))}</div>`) + `<p class="small muted">${r.checked_pairs} ${esc(t("checked"))} · ${esc(r.note)}</p>${sourcesHTML(r.sources)}`;
    $("#ixOut").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function tab(name) {
    $$(".seg button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
    $("#tab-info").hidden = name !== "info"; $("#tab-ix").hidden = name !== "ix";
    history.replaceState(null, "", name === "ix" ? "#interactions" : location.pathname);
  }
  MB.onLang(() => { search(); items().catch(() => {}); if ($("#ixOut").innerHTML && sel.size > 1) check(); });
  document.addEventListener("DOMContentLoaded", () => {
    $("#q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(search, 200); });
    $$(".seg button").forEach((b) => b.addEventListener("click", () => tab(b.dataset.tab)));
    $("#tab-ix").addEventListener("change", (e) => { if (e.target.type !== "checkbox") return;
      if (e.target.checked) { if (sel.size >= 6) { e.target.checked = false; return; } sel.add(e.target.value); } else sel.delete(e.target.value); count(); });
    $("#ixGo").addEventListener("click", () => check().catch((e) => toast(e.message, "err")));
    $("#ixClear").addEventListener("click", () => { sel.clear(); $$("#tab-ix input").forEach((i) => (i.checked = false)); $("#ixOut").innerHTML = ""; count(); });
    const q = new URLSearchParams(location.search).get("q"); if (q) $("#q").value = q;
    if (location.hash === "#interactions") tab("ix");
  });
})();
