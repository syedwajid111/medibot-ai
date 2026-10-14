/* Medicine reminders: saved in the database, alerts via browser notifications, optional Google Calendar. */
(() => {
  MB.i18n({
    en: { pageTitle: "Medicine reminders", eyebrow: "Never miss a dose", title: "Medicine reminders", lead: "Add your medicines and times. MediBot alerts you while the app is open, and you can add each reminder to Google Calendar for alerts anywhere.",
      addTitle: "Add a reminder", editTitle: "Edit reminder", med: "Medicine", medPh: "e.g. Panadol, Metformin", dose: "Dose (as prescribed)", dosePh: "e.g. 1 tablet after food",
      times: "Times", addTime: "+ Add time", days: "For how many days?", daysPh: "Leave empty if ongoing", notes: "Notes", notesPh: "e.g. with water", save: "Save reminder", cancel: "Cancel",
      saved: "Reminder saved.", notifTitle: "Phone & desktop alerts", notifText: "Allow notifications to get an alert at each time.", enable: "Enable alerts", enabled: "Alerts on",
      blocked: "Notifications are blocked in your browser settings.", today: "Today's schedule", all: "All reminders", none: "No reminders yet. Add your first one.",
      noneToday: "Nothing scheduled for today.", edit: "Edit", del: "Delete", pause: "Pause", resume: "Resume", gcal: "Add to Google Calendar", paused: "Paused",
      daysLeft: "days", ongoing: "Ongoing", morning: "Morning 8:00", noon: "Afternoon 14:00", night: "Night 21:00", needTime: "Add at least one time.", delQ: "Delete this reminder?" },
    ur: { pageTitle: "دوا کی یاد دہانی", eyebrow: "کوئی خوراک نہ چھوٹے", title: "دوا کی یاد دہانی", lead: "اپنی دوائیں اور اوقات شامل کریں۔ ایپ کھلی ہو تو میڈی بوٹ یاد دلائے گا، اور ہر یاد دہانی گوگل کیلنڈر میں بھی شامل کر سکتے ہیں۔",
      addTitle: "یاد دہانی شامل کریں", editTitle: "یاد دہانی میں ترمیم", med: "دوا", medPh: "مثلاً پیناڈول، میٹفارمن", dose: "خوراک (نسخے کے مطابق)", dosePh: "مثلاً کھانے کے بعد ایک گولی",
      times: "اوقات", addTime: "+ وقت شامل کریں", days: "کتنے دن کے لیے؟", daysPh: "جاری ہو تو خالی چھوڑ دیں", notes: "نوٹ", notesPh: "مثلاً پانی کے ساتھ", save: "محفوظ کریں", cancel: "منسوخ",
      saved: "یاد دہانی محفوظ ہو گئی۔", notifTitle: "فون اور کمپیوٹر الرٹ", notifText: "ہر وقت پر الرٹ کے لیے نوٹیفکیشن کی اجازت دیں۔", enable: "الرٹ آن کریں", enabled: "الرٹ آن ہیں",
      blocked: "براؤزر کی سیٹنگ میں نوٹیفکیشن بند ہیں۔", today: "آج کا شیڈول", all: "تمام یاد دہانیاں", none: "ابھی کوئی یاد دہانی نہیں۔ پہلی شامل کریں۔",
      noneToday: "آج کے لیے کچھ نہیں۔", edit: "ترمیم", del: "مٹائیں", pause: "روکیں", resume: "دوبارہ شروع", gcal: "گوگل کیلنڈر میں شامل کریں", paused: "رکی ہوئی",
      daysLeft: "دن", ongoing: "جاری", morning: "صبح 8:00", noon: "دوپہر 14:00", night: "رات 21:00", needTime: "کم از کم ایک وقت شامل کریں۔", delQ: "یہ یاد دہانی مٹا دیں؟" },
  });
  const { $, $$, esc, t, api, icon, toast, store } = MB;
  let items = [], editing = null;
  const timeInput = (v = "") => `<span class="row" style="gap:4px"><input type="time" value="${esc(v)}" required style="width:130px"><button type="button" class="icon-btn" data-rm aria-label="Remove">${icon("close")}</button></span>`;
  function times() { return $$("#timeRow input").map((i) => i.value).filter(Boolean); }
  function resetForm() { editing = null; $("#remForm").reset(); $("#timeRow").innerHTML = timeInput("08:00"); $("#cancel").hidden = true; $("#formTitle").textContent = t("addTitle"); }
  async function load() {
    try { items = (await api("/api/reminders")).reminders; } catch { items = []; }
    store.set("mb_rem_cache", JSON.stringify(items));
    render();
  }
  function gcal(r) {
    const [h, m] = r.times[0].split(":"), d = new Date(); d.setHours(+h, +m, 0, 0);
    const f = (x) => x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const end = new Date(d.getTime() + 10 * 60000);
    const rr = `RRULE:FREQ=DAILY${r.days ? `;COUNT=${r.days}` : ""}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("💊 " + r.medicine + (r.dose ? " – " + r.dose : ""))}&dates=${f(d)}/${f(end)}&recur=${encodeURIComponent(rr)}&details=${encodeURIComponent((r.notes || "") + "\nMediBot reminder")}`;
  }
  function render() {
    $("#list").innerHTML = items.length ? items.map((r) => `<article class="card" data-id="${r.id}"><div class="row spread"><div><h3 style="margin:0">${icon("pill")} ${esc(r.medicine)}</h3>
      <div class="small muted">${esc(r.dose || "")}${r.notes ? " · " + esc(r.notes) : ""}</div></div>${r.active ? "" : `<span class="pill">${esc(t("paused"))}</span>`}</div>
      <div class="opts" style="margin:12px 0">${r.times.map((x) => `<span class="pill brand" dir="ltr">⏰ ${esc(x)}</span>`).join("")}<span class="pill">${r.days ? `${r.days} ${esc(t("daysLeft"))}` : esc(t("ongoing"))}</span></div>
      <div class="row"><button class="btn btn-ghost btn-sm" data-a="edit">${esc(t("edit"))}</button><button class="btn btn-ghost btn-sm" data-a="toggle">${esc(t(r.active ? "pause" : "resume"))}</button>
      <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${gcal(r)}">${icon("bell")}${esc(t("gcal"))}</a><button class="btn btn-ghost btn-sm" data-a="del">${icon("trash")}${esc(t("del"))}</button></div></article>`).join("")
      : `<div class="empty">${esc(t("none"))}</div>`;
    const now = new Date().toTimeString().slice(0, 5);
    const slots = items.filter((r) => r.active).flatMap((r) => r.times.map((x) => ({ x, r }))).sort((a, b) => a.x.localeCompare(b.x));
    $("#today").innerHTML = slots.length ? `<div class="stack">${slots.map(({ x, r }) => `<div class="row" style="opacity:${x < now ? .5 : 1}"><span class="pill ${x < now ? "" : "brand"}" dir="ltr">${esc(x)}</span><span>${esc(r.medicine)}${r.dose ? ` <span class="small muted">· ${esc(r.dose)}</span>` : ""}</span></div>`).join("")}</div>` : `<p class="muted">${esc(t("noneToday"))}</p>`;
    notif();
  }
  function notif() {
    const b = $("#notifBtn");
    if (!("Notification" in window)) { $("#notifCard").hidden = true; return; }
    if (Notification.permission === "granted") { b.textContent = t("enabled"); b.disabled = true; }
    else if (Notification.permission === "denied") { b.hidden = true; $("#notifText").textContent = t("blocked"); }
  }
  async function save(e) {
    e.preventDefault();
    const tm = times(); if (!tm.length) return ($("#msg").textContent = t("needTime"));
    const body = { medicine: $("#med").value.trim(), dose: $("#dose").value.trim() || null, times: tm, days: $("#days").value ? +$("#days").value : null, notes: $("#notes").value.trim() || null,
      active: editing ? items.find((x) => x.id === editing).active : true };
    try {
      await api(editing ? `/api/reminders/${editing}` : "/api/reminders", { method: editing ? "PUT" : "POST", body });
      toast(t("saved")); resetForm(); load();
    } catch (err) { $("#msg").textContent = err.message; $("#msg").className = "form-msg err"; }
  }
  MB.onLang(() => { render(); $("#presets").innerHTML = [["08:00", "morning"], ["14:00", "noon"], ["21:00", "night"]].map(([v, k]) => `<button type="button" class="btn btn-ghost btn-sm" data-t="${v}">${esc(t(k))}</button>`).join("");
    $("#formTitle").textContent = t(editing ? "editTitle" : "addTitle"); });
  document.addEventListener("DOMContentLoaded", async () => {
    resetForm();
    api("/api/medicines?q=&lang=en").then(({ results }) => { $("#medList").innerHTML = results.map((r) => `<option value="${esc(r.title)}">`).join(""); }).catch(() => {});
    $("#remForm").addEventListener("submit", save);
    $("#addTime").addEventListener("click", () => { if ($$("#timeRow input").length < 6) $("#timeRow").insertAdjacentHTML("beforeend", timeInput()); });
    $("#timeRow").addEventListener("click", (e) => { if (e.target.closest("[data-rm]") && $$("#timeRow input").length > 1) e.target.closest("span").remove(); });
    $("#presets").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b || times().includes(b.dataset.t)) return;
      const empty = $$("#timeRow input").find((i) => !i.value); if (empty) empty.value = b.dataset.t; else $("#timeRow").insertAdjacentHTML("beforeend", timeInput(b.dataset.t)); });
    $("#cancel").addEventListener("click", resetForm);
    $("#notifBtn").addEventListener("click", async () => { const p = await Notification.requestPermission(); if (p === "granted") new Notification("MediBot", { body: t("enabled"), icon: "/assets/img/icon-192.png" }); notif(); });
    $("#list").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      const id = b.closest("[data-id]").dataset.id, r = items.find((x) => x.id === id);
      if (b.dataset.a === "del") { if (!confirm(t("delQ"))) return; await api(`/api/reminders/${id}`, { method: "DELETE" }); load(); }
      if (b.dataset.a === "toggle") { await api(`/api/reminders/${id}`, { method: "PUT", body: { ...r, active: !r.active } }); load(); }
      if (b.dataset.a === "edit") { editing = id; $("#med").value = r.medicine; $("#dose").value = r.dose || ""; $("#days").value = r.days || ""; $("#notes").value = r.notes || "";
        $("#timeRow").innerHTML = r.times.map(timeInput).join(""); $("#cancel").hidden = false; $("#formTitle").textContent = t("editTitle"); $("#remForm").scrollIntoView({ behavior: "smooth" }); }
    });
    load();
  });
})();
