/* Account: profile used to personalise answers, history overview, export and delete-all. */
(() => {
  MB.i18n({
    en: { pageTitle: "My account", eyebrow: "My account", title: "Your health space", lead: "Your saved chats, symptom checks and reminders in one place.", guestTitle: "You're using MediBot as a guest",
      guestText: "Your history is saved on this browser only. Create a free account to keep it safe and use it on other devices.", profileTitle: "Health profile",
      profileHelp: "Optional. MediBot uses this to add the right cautions (for example in pregnancy or for older adults).", name: "Name", age: "Age group", sex: "Sex", conditions: "Long-term conditions or allergies",
      condPh: "e.g. diabetes, asthma, penicillin allergy", na: "Prefer not to say", child: "Child", teen: "Teenager", adult: "Adult", older: "Older adult (65+)", pregnant: "Pregnant",
      female: "Female", male: "Male", other: "Other", save: "Save profile", saved: "Profile saved.", recent: "Recent chats", none: "No saved chats yet.", chats: "Chats", checks: "Symptom checks", reminders: "Reminders",
      dataTitle: "Your data", dataText: "Download a copy of everything, or permanently delete all your chats, checks, reminders and account.", export: "Download my data", wipe: "Delete all my data",
      wipeQ: "This permanently deletes all your data and account. Continue?", wiped: "All your data has been deleted." },
    ur: { pageTitle: "میرا اکاؤنٹ", eyebrow: "میرا اکاؤنٹ", title: "آپ کی صحت کی جگہ", lead: "آپ کی محفوظ چیٹس، علامات کی جانچ اور یاد دہانیاں ایک جگہ۔", guestTitle: "آپ مہمان کے طور پر استعمال کر رہے ہیں",
      guestText: "آپ کی ہسٹری صرف اسی براؤزر میں ہے۔ اسے محفوظ رکھنے اور دوسرے آلات پر استعمال کے لیے مفت اکاؤنٹ بنائیں۔", profileTitle: "صحت پروفائل",
      profileHelp: "اختیاری۔ میڈی بوٹ اس سے مناسب احتیاطیں شامل کرتا ہے (جیسے حمل یا بزرگوں کے لیے)۔", name: "نام", age: "عمر کا گروپ", sex: "جنس", conditions: "پرانی بیماریاں یا الرجی",
      condPh: "مثلاً ذیابیطس، دمہ، پینسلین الرجی", na: "نہیں بتانا", child: "بچہ", teen: "نوعمر", adult: "بالغ", older: "بزرگ (65+)", pregnant: "حاملہ",
      female: "خاتون", male: "مرد", other: "دیگر", save: "پروفائل محفوظ کریں", saved: "پروفائل محفوظ ہو گیا۔", recent: "حالیہ چیٹس", none: "ابھی کوئی محفوظ چیٹ نہیں۔", chats: "چیٹس", checks: "جانچ", reminders: "یاد دہانیاں",
      dataTitle: "آپ کا ڈیٹا", dataText: "سب کچھ ڈاؤن لوڈ کریں، یا اپنی تمام چیٹس، جانچ، یاد دہانیاں اور اکاؤنٹ ہمیشہ کے لیے مٹا دیں۔", export: "میرا ڈیٹا ڈاؤن لوڈ کریں", wipe: "میرا سارا ڈیٹا مٹائیں",
      wipeQ: "اس سے آپ کا سارا ڈیٹا اور اکاؤنٹ ہمیشہ کے لیے مٹ جائے گا۔ جاری رکھیں؟", wiped: "آپ کا سارا ڈیٹا مٹا دیا گیا۔" },
  });
  const { $, esc, t, api, toast } = MB;
  let data = { conversations: [], checks: [], reminders: [] };
  async function load() {
    const [{ user }, c, k, r] = await Promise.all([MB.me(true), api("/api/conversations"), api("/api/checks"), api("/api/reminders")]);
    data = { user, conversations: c.conversations, checks: k.checks, reminders: r.reminders };
    $("#guestCard").hidden = !!user; $("#profile").hidden = !user;
    if (user) { $("#pName").value = user.name || ""; $("#pAge").value = user.age_group || ""; $("#pSex").value = user.sex || ""; $("#pCond").value = user.conditions || ""; }
    render();
  }
  function render() {
    $("#kpis").innerHTML = [["chats", data.conversations.length, "/chat"], ["checks", data.checks.length, "/checker"], ["reminders", data.reminders.length, "/reminders"]]
      .map(([k, n, h]) => `<a class="card card-flat kpi" href="${h}" style="text-decoration:none"><b>${n}</b><span>${esc(t(k))}</span></a>`).join("");
    $("#convs").innerHTML = data.conversations.length ? `<div class="stack">${data.conversations.slice(0, 8).map((c) => `<a href="/chat?c=${c.id}" class="row spread" style="text-decoration:none;color:inherit"><span>${esc(c.title)}</span><span class="small muted">${esc(new Date(c.updated_at).toLocaleDateString())}</span></a>`).join("")}</div>`
      : `<p class="muted">${esc(t("none"))}</p>`;
  }
  MB.onLang(render);
  document.addEventListener("DOMContentLoaded", () => {
    load().catch(() => {});
    $("#profile").addEventListener("submit", async (e) => { e.preventDefault();
      try { await api("/api/profile", { method: "PUT", body: { name: $("#pName").value.trim() || null, age_group: $("#pAge").value, sex: $("#pSex").value, conditions: $("#pCond").value.trim() } });
        $("#pMsg").className = "form-msg ok"; $("#pMsg").textContent = t("saved"); } catch (err) { $("#pMsg").className = "form-msg err"; $("#pMsg").textContent = err.message; } });
    $("#logout").addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }); location.href = "/"; });
    $("#export").addEventListener("click", async () => {
      const full = { ...data, conversations: await Promise.all(data.conversations.map((c) => api(`/api/conversations/${c.id}`))) };
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(full, null, 2)], { type: "application/json" }));
      a.download = "medibot-my-data.json"; a.click(); URL.revokeObjectURL(a.href);
    });
    $("#wipe").addEventListener("click", async () => { if (!confirm(t("wipeQ"))) return; await api("/api/me/data", { method: "DELETE" });
      try { localStorage.removeItem("mb_rem_cache"); } catch { /* ignore */ } toast(t("wiped")); setTimeout(() => (location.href = "/"), 900); });
  });
})();
