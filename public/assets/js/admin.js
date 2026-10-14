/* Staff panel. ADMIN_PASSWORD = full access (backup, export, delete). STAFF_PASSWORD = view only. */
(() => {
  const { $, $$, esc, toast } = MB;
  let key = "", role = "", page = 0, q = "";
  const get = (p) => MB.api(p, { headers: { "x-admin-key": key } });
  const date = (s) => (s ? new Date(s).toLocaleString() : "");
  const bars = (rows, label, val = "n") => { const max = Math.max(1, ...rows.map((r) => +r[val] || 0));
    return rows.length ? rows.map((r) => `<div class="bar-row"><span title="${esc(r[label])}">${esc(r[label] ?? "–")}</span><div class="track"><div class="fill" style="width:${(100 * (+r[val] || 0)) / max}%"></div></div><span>${esc(r[val])}</span></div>`).join("") : `<p class="small muted">No data yet.</p>`; };
  const pill = (lv) => `<span class="pill ${lv === "emergency" ? "danger" : lv === "doctor" ? "warn" : "ok"}">${esc(lv)}</span>`;

  async function overview() {
    const d = await get("/api/admin/overview");
    $("#dbPill").textContent = `DB: ${d.database.kind}${d.database.persistent ? "" : " (temporary – connect Neon!)"} · AI: ${d.ai || "off (knowledge base only)"}`;
    $("#dbPill").className = `pill ${d.database.persistent && d.ai ? "ok" : "warn"}`;
    $("#tot").innerHTML = Object.entries(d.totals).map(([k, v]) => `<div class="card card-flat kpi"><b>${v}</b><span>${esc(k.replace("_", " "))}</span></div>`).join("");
    const days = []; for (let i = 13; i >= 0; i--) { const x = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push({ day: x, n: +(d.daily.find((r) => r.day === x) || { n: 0 }).n }); }
    const mx = Math.max(1, ...days.map((x) => x.n));
    $("#daily").innerHTML = days.map((x) => `<div style="height:${(100 * x.n) / mx}%" title="${x.day}: ${x.n}"><span>${x.n || ""}</span></div>`).join("");
    $("#topics").innerHTML = bars(d.top_topics, "title"); $("#types").innerHTML = bars(d.reply_types, "type"); $("#engines").innerHTML = bars(d.engines, "engine");
    $("#levels").innerHTML = bars(d.check_levels, "level"); $("#events").innerHTML = bars(d.events, "kind");
    $("#unans").innerHTML = d.unanswered.map((u) => `<tr><td>${esc(u.q)}</td><td class="small muted">${esc(u.at.slice(0, 10))}</td></tr>`).join("") || `<tr><td class="muted">None yet.</td></tr>`;
  }
  async function convs() {
    const d = await get(`/api/admin/conversations?q=${encodeURIComponent(q)}&page=${page}`);
    $("#convList").innerHTML = d.rows.map((c) => `<a href="#" data-c="${c.id}" class="place" style="text-decoration:none;color:inherit;display:block"><b>${esc(c.title || "…")}</b>
      <div class="small muted">${esc(c.who)} · ${c.n} messages · ${esc(c.lang || "")} · ${esc(date(c.updated_at))}</div></a>`).join("") || `<div class="empty">No conversations found.</div>`;
    $("#prev").disabled = page === 0; $("#next").disabled = !d.more;
  }
  async function openConv(id) {
    const c = await get(`/api/admin/conversations/${id}`);
    $("#convView").innerHTML = `<div class="row spread"><div><h3 style="margin:0">${esc(c.title)}</h3><div class="small muted">${esc(c.who)} · started ${esc(date(c.created_at))}</div></div>
      ${role === "admin" ? `<button class="btn btn-danger btn-sm" data-del="${c.id}">Delete</button>` : ""}</div><div class="stack" style="margin-top:16px">${c.messages.map((m) =>
      `<div class="msg ${m.role === "user" ? "user" : "bot"}" style="max-width:100%"><div class="bubble">${m.role === "user" ? esc(m.content) : MB.md(m.content)}
       ${m.role !== "user" ? `<div class="meta"><span class="pill">${esc(m.type)}</span><span class="pill">${esc(m.engine || "")}</span>${m.rating ? `<span class="pill ${m.rating > 0 ? "ok" : "danger"}">${m.rating > 0 ? "👍" : "👎"}</span>` : ""}<span class="small muted">${esc(date(m.created_at))}</span></div>` : ""}</div></div>`).join("")}</div>`;
  }
  async function users() { const d = await get("/api/admin/users");
    $("#usersT").innerHTML = d.rows.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td class="small">${esc([u.age_group, u.sex, u.conditions].filter(Boolean).join(" · "))}</td><td>${u.chats}</td><td class="small muted">${esc(date(u.created_at))}</td></tr>`).join("") || `<tr><td class="muted">No users yet.</td></tr>`; }
  async function checks() { const d = await get("/api/admin/checks");
    $("#checksT").innerHTML = d.rows.map((c) => `<tr><td class="small muted">${esc(date(c.created_at))}</td><td class="small">${esc(c.who)}</td><td>${esc(c.payload.who)}</td><td>${esc((c.payload.symptoms || []).join(", "))}${c.payload.days ? ` · ${c.payload.days}d` : ""}${c.payload.temp_f ? ` · ${c.payload.temp_f}°F` : ""}</td>
      <td class="small">${esc((c.payload.redflags || []).join("; "))}</td><td>${pill(c.level)}</td></tr>`).join("") || `<tr><td class="muted">No checks yet.</td></tr>`; }
  async function rems() { const d = await get("/api/admin/reminders");
    $("#remsT").innerHTML = d.rows.map((r) => `<tr><td><b>${esc(r.medicine)}</b></td><td>${esc(r.dose || "")}</td><td dir="ltr">${esc(r.times.join(", "))}</td><td>${esc(r.days || "ongoing")}</td><td class="small">${esc(r.who)}</td><td>${r.active ? '<span class="pill ok">active</span>' : '<span class="pill">paused</span>'}</td></tr>`).join("") || `<tr><td class="muted">No reminders yet.</td></tr>`; }
  async function contacts() { const d = await get("/api/admin/contacts");
    $("#contactsT").innerHTML = d.rows.map((c) => `<tr><td><b>${esc(c.name)}</b><br><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></td><td>${esc(c.message)}</td><td class="small muted">${esc(date(c.created_at))}</td></tr>`).join("") || `<tr><td class="muted">No messages yet.</td></tr>`; }
  async function download(path, fallback) {
    const r = await fetch(path, { headers: { "x-admin-key": key } });
    if (!r.ok) return toast((await r.json().catch(() => ({}))).detail || "Download failed", "err");
    const name = (r.headers.get("content-disposition") || "").match(/filename="(.+?)"/)?.[1] || fallback;
    const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  const LOAD = { overview, convs, users, checks, rems, contacts, backup: async () => {} };
  function tab(t) {
    $$("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.t === t)));
    $$("[data-p]").forEach((p) => (p.hidden = p.dataset.p !== t));
    LOAD[t]().catch((e) => toast(e.message, "err"));
  }
  async function open(k) {
    key = k; role = (await get("/api/admin/whoami")).role;
    sessionStorage.setItem("mb_admin", k);
    $("#login").hidden = true; $("#dash").hidden = false; $("#logoutBtn").hidden = false;
    $("#roleTag").textContent = role === "admin" ? "Admin · full access" : "Staff · view only";
    $$(".adm").forEach((b) => (b.hidden = role !== "admin"));
    tab("overview");
  }
  document.addEventListener("DOMContentLoaded", () => {
    const fit = () => { const g = $("#convGrid"); if (g) g.style.gridTemplateColumns = innerWidth < 900 ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1.3fr)"; };
    addEventListener("resize", fit); fit();
    const saved = sessionStorage.getItem("mb_admin"); if (saved) open(saved).catch(() => sessionStorage.removeItem("mb_admin"));
    $("#login").addEventListener("submit", (e) => { e.preventDefault(); $("#lMsg").textContent = ""; open($("#key").value).catch((err) => ($("#lMsg").textContent = err.message)); });
    $("#logoutBtn").addEventListener("click", () => { sessionStorage.removeItem("mb_admin"); location.reload(); });
    $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) tab(b.dataset.t); });
    $("#convSearch").addEventListener("submit", (e) => { e.preventDefault(); q = $("#cq").value; page = 0; convs(); });
    $("#prev").addEventListener("click", () => { page = Math.max(0, page - 1); convs(); });
    $("#next").addEventListener("click", () => { page++; convs(); });
    $("#convList").addEventListener("click", (e) => { const a = e.target.closest("[data-c]"); if (a) { e.preventDefault(); openConv(a.dataset.c); } });
    $("#convView").addEventListener("click", async (e) => { const b = e.target.closest("[data-del]"); if (!b || !confirm("Delete this conversation permanently?")) return;
      await MB.api(`/api/admin/conversations/${b.dataset.del}`, { method: "DELETE", headers: { "x-admin-key": key } }); $("#convView").innerHTML = '<p class="muted">Deleted.</p>'; convs(); });
    $("#backupBtn").addEventListener("click", () => download("/api/admin/backup", "medibot-backup.json"));
    $("#csvBtns").innerHTML = ["users", "conversations", "messages", "checks", "reminders", "events", "contacts"].map((t) => `<button class="btn btn-ghost btn-sm" data-csv="${t}">${t}.csv</button>`).join("");
    $("#csvBtns").addEventListener("click", (e) => { const b = e.target.closest("[data-csv]"); if (b) download(`/api/admin/export/${b.dataset.csv}`, `${b.dataset.csv}.csv`); });
  });
})();
