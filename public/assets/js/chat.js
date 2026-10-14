/* AI chat: Groq-powered replies grounded in the knowledge base, saved conversations, voice in/out, feedback. */
(() => {
  MB.i18n({
    en: { pageTitle: "AI Health Chat", newChat: "New chat", new: "New", private: "Private mode", recent: "Recent chats",
      privateHelp: "When on, this chat is not saved to your history.", engineLine: "AI assistant · answers from NHS & WHO-based sources",
      placeholder: "Describe a symptom or ask about a medicine…", noHistory: "Your saved chats will appear here.",
      hello: "Assalam-o-Alaikum! I'm **MediBot**. Tell me what's bothering you – for example \"fever for 3 days\" – or ask about a medicine. I give general information, not a diagnosis.",
      starters: ["I have a fever and headache", "Mujhe 3 din se khansi hai", "Is Panadol safe in pregnancy?", "Signs of dengue", "Can I take Brufen with Ponstan?", "How to lower blood pressure?"],
      details: "Trusted source details", listen: "Listen", stop: "Stop", helpful: "Helpful", notHelpful: "Not helpful", copy: "Copy", share: "Share",
      thanks: "Thanks for the feedback!", aiGeneral: "General AI guidance – not from MediBot's verified library. Please confirm with a doctor.",
      call: "Call 1122", findHosp: "Nearby hospitals", deleteQ: "Delete this chat?", noVoice: "Voice for this language isn't available on this device.",
      listening: "Listening… speak now", privateOn: "Private mode is on – this chat won't be saved." },
    ur: { pageTitle: "اے آئی ہیلتھ چیٹ", newChat: "نئی چیٹ", new: "نئی", private: "پرائیویٹ موڈ", recent: "حالیہ چیٹس",
      privateHelp: "آن ہونے پر یہ چیٹ ہسٹری میں محفوظ نہیں ہوگی۔", engineLine: "اے آئی معاون · این ایچ ایس اور ڈبلیو ایچ او پر مبنی جوابات",
      placeholder: "علامت بتائیں یا کسی دوا کے بارے میں پوچھیں…", noHistory: "آپ کی محفوظ چیٹس یہاں نظر آئیں گی۔",
      hello: "السلام علیکم! میں **میڈی بوٹ** ہوں۔ بتائیں کیا تکلیف ہے – جیسے \"3 دن سے بخار\" – یا کسی دوا کے بارے میں پوچھیں۔ میں عام معلومات دیتا ہوں، تشخیص نہیں۔",
      starters: ["مجھے بخار اور سر درد ہے", "Mujhe 3 din se khansi hai", "کیا حمل میں پیناڈول محفوظ ہے؟", "ڈینگی کی علامات", "بروفن اور پونسٹان ساتھ لے سکتا ہوں؟", "بلڈ پریشر کیسے کم کریں؟"],
      details: "مستند ذرائع کی تفصیل", listen: "سنیں", stop: "روکیں", helpful: "مفید", notHelpful: "مفید نہیں", copy: "کاپی", share: "شیئر",
      thanks: "رائے کا شکریہ!", aiGeneral: "عام اے آئی رہنمائی – میڈی بوٹ کی تصدیق شدہ لائبریری سے نہیں۔ ڈاکٹر سے تصدیق کریں۔",
      call: "1122 پر کال کریں", findHosp: "قریبی ہسپتال", deleteQ: "یہ چیٹ مٹا دیں؟", noVoice: "اس آلے پر اس زبان کی آواز دستیاب نہیں۔",
      listening: "سن رہا ہوں… بولیں", privateOn: "پرائیویٹ موڈ آن ہے – یہ چیٹ محفوظ نہیں ہوگی۔" },
  });
  const { $, esc, icon, t, api, md, cardHTML, triageHTML, toast, store } = MB;
  let convId = null, busy = false, context = [];
  const params = new URLSearchParams(location.search);

  function scroll() { const l = $("#log"); l.scrollTop = l.scrollHeight; }
  function addUser(text) {
    $("#log").insertAdjacentHTML("beforeend", `<div class="msg user"><div class="bubble">${esc(text)}</div></div>`); scroll();
  }
  function botHTML(r, mid) {
    const shown = r.ai_text || r.text || "";
    let html = md(shown);
    if (r.type === "general") html = `<p class="pill warn">${icon("alert")} ${esc(t("aiGeneral"))}</p>` + html;
    if (r.type === "emergency" && r.emergency) {
      html = `<div class="emergency-box"><b>${esc(r.emergency.message)}</b><ul>${r.emergency.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
        <div class="row"><a class="btn btn-danger btn-sm" href="tel:1122">${icon("phone")}${esc(t("call"))}</a><a class="btn btn-ghost btn-sm" href="/hospitals">${icon("map")}${esc(t("findHosp"))}</a></div></div>`;
    }
    if (r.triage && r.type !== "emergency") html += triageHTML(r.triage);
    if (r.cards && r.cards.length && r.type !== "emergency") html += `<details><summary>${esc(t("details"))}</summary>${r.cards.map(cardHTML).join("")}</details>`;
    else if (r.cards && r.cards.length) html += `<details open><summary>${esc(t("details"))}</summary>${r.cards.map(cardHTML).join("")}</details>`;
    const prov = { groq: "Groq", gemini: "Gemini", openrouter: "OpenRouter" }[(r.engine || "").split(":")[0]];
    const eng = prov ? `<span class="pill brand">${icon("spark")} ${esc(t("aiBadge"))} · ${prov}</span>` : `<span class="pill">${icon("book")} ${esc(t("kbBadge"))}</span>`;
    const disc = r.disclaimer ? `<span class="small muted">${esc(r.disclaimer)}</span>` : "";
    const acts = `<div class="msg-actions">
      <button data-act="tts">${icon("speaker")}<span>${esc(t("listen"))}</span></button>
      ${mid ? `<button data-act="up" aria-label="${esc(t("helpful"))}">${icon("up")}</button><button data-act="down" aria-label="${esc(t("notHelpful"))}">${icon("down")}</button>` : ""}
      <button data-act="copy">${icon("copy")}<span>${esc(t("copy"))}</span></button><button data-act="share">${icon("share")}<span>${esc(t("share"))}</span></button></div>`;
    return `<div class="msg bot" data-mid="${esc(mid || "")}" data-lang="${esc(r.lang || MB.lang)}"><div class="bubble"><div class="body">${html}</div><div class="meta">${eng}${disc}</div>${acts}</div></div>`;
  }
  function addBot(r, mid) {
    $("#log").insertAdjacentHTML("beforeend", botHTML(r, mid)); scroll();
    if (r.suggestions) chips(r.suggestions);
  }
  function hello() { $("#log").innerHTML = `<div class="msg bot"><div class="bubble">${md(t("hello"))}</div></div>`; chips(t("starters")); }
  function chips(list) { $("#chips").innerHTML = (list || []).slice(0, 6).map((s) => `<button type="button">${esc(s)}</button>`).join(""); }

  async function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true; $("#sendBtn").disabled = true; $("#msg").value = ""; $("#chips").innerHTML = "";
    addUser(text);
    $("#log").insertAdjacentHTML("beforeend", `<div class="msg bot" id="typing"><div class="bubble typing"><span></span><span></span><span></span></div></div>`); scroll();
    try {
      const r = await api("/api/chat", { method: "POST", body: { message: text, lang: MB.lang, conversation_id: convId, context, private: $("#private").checked } });
      $("#typing")?.remove();
      context = r.topics && r.topics.length ? r.topics : context;
      if (r.conversation_id && r.conversation_id !== convId) { convId = r.conversation_id; history.replaceState(null, "", `/chat?c=${convId}`); loadHistory(); }
      addBot(r, r.message_id);
      if (r.type === "emergency") $("#sos").showModal();
    } catch (e) {
      $("#typing")?.remove();
      $("#log").insertAdjacentHTML("beforeend", `<div class="msg bot"><div class="bubble">${esc(e.message)}</div></div>`);
    } finally { busy = false; $("#sendBtn").disabled = false; $("#msg").focus({ preventScroll: true }); }
  }

  async function loadHistory() {
    try {
      const { conversations } = await api("/api/conversations");
      $("#history").innerHTML = conversations.length ? conversations.map((c) => `<div class="history-item"><a href="/chat?c=${c.id}" data-id="${c.id}" ${c.id === convId ? 'aria-current="true"' : ""}>${esc(c.title || "…")}</a>
        <button data-del="${c.id}" aria-label="Delete">${icon("trash")}</button></div>`).join("") : `<p class="small muted">${esc(t("noHistory"))}</p>`;
    } catch { /* offline */ }
  }
  async function openConv(id) {
    try {
      const c = await api(`/api/conversations/${id}`);
      convId = id; $("#log").innerHTML = "";
      for (const m of c.messages) {
        if (m.role === "user") addUser(m.content);
        else { const meta = m.meta || {}; addBot({ ...meta, ai_text: m.content, type: m.type, engine: m.engine }, m.id);
          const el = $(`[data-mid="${m.id}"]`); if (m.rating && el) el.querySelector(`[data-act="${m.rating > 0 ? "up" : "down"}"]`)?.setAttribute("aria-pressed", "true");
          if (m.topics && m.topics.length) context = m.topics; }
      }
      loadHistory(); $("#chatPage").classList.remove("show-history");
    } catch { hello(); convId = null; }
  }
  function newChat() { convId = null; context = []; history.replaceState(null, "", "/chat"); hello(); loadHistory(); $("#chatPage").classList.remove("show-history"); $("#msg").focus(); }

  /* voice output (Web Speech API, free, on-device) */
  let speaking = null;
  function speak(btn) {
    const synth = window.speechSynthesis;
    if (!synth) return toast(t("noVoice"), "err");
    if (speaking === btn) { synth.cancel(); speaking = null; btn.querySelector("span").textContent = t("listen"); return; }
    synth.cancel();
    const msg = btn.closest(".msg"), text = msg.querySelector(".body").innerText, lg = msg.dataset.lang === "ur" ? "ur" : "en";
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const v = voices.find((x) => x.lang.toLowerCase().startsWith(lg === "ur" ? "ur" : "en")) || (lg === "ur" ? voices.find((x) => x.lang.toLowerCase().startsWith("hi")) : null);
    if (lg === "ur" && !v) toast(t("noVoice"));
    if (v) u.voice = v; u.lang = v ? v.lang : (lg === "ur" ? "ur-PK" : "en-GB"); u.rate = .95;
    u.onend = () => { speaking = null; btn.querySelector("span").textContent = t("listen"); };
    speaking = btn; btn.querySelector("span").textContent = t("stop"); synth.speak(u);
    api("/api/event", { method: "POST", body: { kind: "tts", detail: { lang: lg } } }).catch(() => {});
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("page-chat");
    $("#chatLogo").innerHTML = icon("logo"); $("#histBtn").innerHTML = icon("history"); $("#sendBtn").innerHTML = icon("send"); $("#micBtn").innerHTML = icon("mic");
    $("#private").checked = store.get("mb_private") === "1";
    $("#private").addEventListener("change", (e) => { store.set("mb_private", e.target.checked ? "1" : "0"); if (e.target.checked) toast(t("privateOn")); });
    $("#composer").addEventListener("submit", (e) => { e.preventDefault(); send($("#msg").value); });
    $("#chips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) send(b.textContent); });
    $("#newChat").addEventListener("click", newChat); $("#newChat2").addEventListener("click", newChat);
    $("#histBtn").addEventListener("click", () => $("#chatPage").classList.toggle("show-history"));
    $("#history").addEventListener("click", async (e) => {
      const del = e.target.closest("[data-del]");
      if (del) { if (confirm(t("deleteQ"))) { await api(`/api/conversations/${del.dataset.del}`, { method: "DELETE" }); if (del.dataset.del === convId) newChat(); else loadHistory(); } return; }
      const a = e.target.closest("a[data-id]"); if (a) { e.preventDefault(); history.replaceState(null, "", a.href); openConv(a.dataset.id); }
    });
    $("#log").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const msg = b.closest(".msg"), act = b.dataset.act;
      if (act === "tts") speak(b);
      if (act === "copy") { try { await navigator.clipboard.writeText(msg.querySelector(".body").innerText); toast(t("copied")); } catch { /* blocked */ } }
      if (act === "share") { const text = msg.querySelector(".body").innerText.slice(0, 900) + "\n\n– MediBot " + location.origin;
        if (navigator.share) navigator.share({ text }).catch(() => {}); else window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
        api("/api/event", { method: "POST", body: { kind: "share", detail: { from: "chat" } } }).catch(() => {}); }
      if (act === "up" || act === "down") {
        try { await api("/api/feedback", { method: "POST", body: { message_id: msg.dataset.mid, rating: act === "up" ? 1 : -1 } });
          msg.querySelectorAll("[data-act=up],[data-act=down]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); toast(t("thanks")); } catch (err) { toast(err.message, "err"); }
      }
    });
    /* voice input */
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const mic = $("#micBtn"); mic.hidden = false; let rec = null;
      mic.addEventListener("click", () => {
        if (rec) { rec.stop(); return; }
        rec = new SR(); rec.lang = MB.lang === "ur" ? "ur-PK" : "en-US"; rec.interimResults = true;
        mic.classList.add("rec"); toast(t("listening"));
        rec.onresult = (ev) => { $("#msg").value = [...ev.results].map((x) => x[0].transcript).join(" "); };
        rec.onend = () => { mic.classList.remove("rec"); rec = null; if ($("#msg").value.trim()) send($("#msg").value); };
        rec.onerror = () => { mic.classList.remove("rec"); rec = null; };
        rec.start();
      });
    }
    MB.onLang(() => { if (!convId && $("#log").children.length <= 1) hello(); });
    const c = params.get("c"), q = params.get("q");
    if (c) openConv(c); else hello();
    loadHistory();
    if (q) send(q);
  });
})();
