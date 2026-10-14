/* Sign in / create account. Guest history is moved into the account automatically. */
(() => {
  MB.i18n({
    en: { pageTitle: "Account", h_signin: "Welcome back", sub_signin: "Sign in to see your chats, checks and reminders on any device.", h_signup: "Create your free account",
      sub_signup: "Save your health history and reminders securely. Your chats so far will be kept.", name: "Name", email: "Email", password: "Password (min. 8 characters)",
      btn_signin: "Sign in", btn_signup: "Create account", alt_signin: "New to MediBot?", altLink_signin: "Create an account", alt_signup: "Already have an account?", altLink_signup: "Sign in",
      guest: "You can also use MediBot without an account." },
    ur: { pageTitle: "اکاؤنٹ", h_signin: "خوش آمدید", sub_signin: "کسی بھی آلے پر اپنی چیٹس، جانچ اور یاد دہانیاں دیکھنے کے لیے سائن اِن کریں۔", h_signup: "مفت اکاؤنٹ بنائیں",
      sub_signup: "اپنی صحت کی ہسٹری اور یاد دہانیاں محفوظ رکھیں۔ اب تک کی چیٹس بھی ساتھ رہیں گی۔", name: "نام", email: "ای میل", password: "پاس ورڈ (کم از کم 8 حروف)",
      btn_signin: "سائن اِن", btn_signup: "اکاؤنٹ بنائیں", alt_signin: "میڈی بوٹ پر نئے ہیں؟", altLink_signin: "اکاؤنٹ بنائیں", alt_signup: "پہلے سے اکاؤنٹ ہے؟", altLink_signup: "سائن اِن",
      guest: "آپ اکاؤنٹ کے بغیر بھی میڈی بوٹ استعمال کر سکتے ہیں۔" },
  });
  const { $, api, icon } = MB;
  document.addEventListener("DOMContentLoaded", () => {
    $("#authLogo").innerHTML = icon("logo");
    const f = $("#authForm"), mode = f.dataset.mode;
    MB.me().then(({ user }) => { if (user) location.replace("/account"); });
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); const btn = f.querySelector("button"); btn.disabled = true; $("#authMsg").textContent = "";
      const body = { email: $("#email").value.trim(), password: $("#pw").value };
      if (mode === "signup") body.name = $("#name").value.trim();
      try { await api(`/api/auth/${mode === "signup" ? "signup" : "login"}`, { method: "POST", body }); location.href = new URLSearchParams(location.search).get("next") || "/account"; }
      catch (err) { $("#authMsg").textContent = err.message; btn.disabled = false; }
    });
  });
})();
