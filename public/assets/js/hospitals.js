/* Nearby care finder: free OpenStreetMap data (Overpass API) + Leaflet map. Location stays in the browser. */
(() => {
  MB.i18n({
    en: { pageTitle: "Nearby hospitals & pharmacies", eyebrow: "Free · OpenStreetMap", title: "Find care near you", lead: "See hospitals, clinics and pharmacies around you, with distance and directions. Your location is used only in your browser.",
      locate: "Use my location", cityPh: "Or type a city / area, e.g. Gulberg Lahore", search: "Search", hospital: "Hospitals", clinic: "Clinics & doctors", pharmacy: "Pharmacies",
      finding: "Finding places near you…", found: "places found within", none: "Nothing found nearby in OpenStreetMap. Try a larger city name, or call 1122.", denied: "Location permission was denied. Type your city instead.",
      noCity: "Couldn't find that place. Try a nearby city name.", directions: "Directions", call: "Call", km: "km", emTitle: "Emergency?", emText: "Don't search – call an ambulance now.",
      credit: "Map data © OpenStreetMap contributors. Listings may be incomplete; call ahead before visiting.", err: "The map service is busy. Please try again in a minute." },
    ur: { pageTitle: "قریبی ہسپتال اور فارمیسی", eyebrow: "مفت · اوپن اسٹریٹ میپ", title: "اپنے قریب علاج تلاش کریں", lead: "اپنے آس پاس ہسپتال، کلینک اور فارمیسی، فاصلے اور راستے کے ساتھ دیکھیں۔ آپ کی لوکیشن صرف آپ کے براؤزر میں استعمال ہوتی ہے۔",
      locate: "میری لوکیشن استعمال کریں", cityPh: "یا شہر / علاقہ لکھیں، جیسے گلبرگ لاہور", search: "تلاش", hospital: "ہسپتال", clinic: "کلینک اور ڈاکٹر", pharmacy: "فارمیسی",
      finding: "قریبی جگہیں تلاش ہو رہی ہیں…", found: "جگہیں ملیں، فاصلہ", none: "اوپن اسٹریٹ میپ میں قریب کچھ نہیں ملا۔ بڑے شہر کا نام آزمائیں یا 1122 پر کال کریں۔", denied: "لوکیشن کی اجازت نہیں ملی۔ اپنا شہر لکھیں۔",
      noCity: "یہ جگہ نہیں ملی۔ قریبی شہر کا نام آزمائیں۔", directions: "راستہ", call: "کال", km: "کلومیٹر", emTitle: "ایمرجنسی؟", emText: "تلاش نہ کریں – ابھی ایمبولینس بلائیں۔",
      credit: "نقشہ © اوپن اسٹریٹ میپ۔ فہرست نامکمل ہو سکتی ہے؛ جانے سے پہلے فون کر لیں۔", err: "نقشے کی سروس مصروف ہے۔ ایک منٹ بعد دوبارہ کوشش کریں۔" },
  });
  const { $, esc, t, icon, api } = MB;
  const KINDS = { hospital: ["amenity=hospital"], clinic: ["amenity=clinic", "amenity=doctors"], pharmacy: ["amenity=pharmacy"] };
  const COLORS = { hospital: "#c62828", clinic: "#0e7c86", pharmacy: "#2e7d32" };
  let map, layer, center = null, places = [];
  const on = new Set(["hospital", "clinic", "pharmacy"]);

  function initMap() {
    if (map || !window.L) return;
    map = L.map("map", { scrollWheelZoom: false }).setView([30.3753, 69.3451], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }
  const dist = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  async function load(lat, lon, radius = 5000) {
    center = [lat, lon]; initMap();
    $("#status").textContent = t("finding"); $("#places").innerHTML = `<div class="skeleton" style="height:72px"></div><div class="skeleton" style="height:72px"></div>`;
    const parts = Object.values(KINDS).flat().map((f) => { const [k, v] = f.split("="); return `nwr["${k}"="${v}"](around:${radius},${lat},${lon});`; }).join("");
    const q = `[out:json][timeout:25];(${parts});out center 80;`;
    try {
      const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      if (!r.ok) throw new Error();
      const data = await r.json();
      places = data.elements.map((e) => {
        const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon, tg = e.tags || {};
        const kind = tg.amenity === "hospital" ? "hospital" : tg.amenity === "pharmacy" ? "pharmacy" : "clinic";
        return { kind, lat: la, lon: lo, name: tg.name || tg["name:en"] || tg["name:ur"] || t(kind), phone: tg.phone || tg["contact:phone"] || "", addr: [tg["addr:street"], tg["addr:city"]].filter(Boolean).join(", "), d: dist(center, [la, lo]) };
      }).filter((p) => p.lat).sort((a, b) => a.d - b.d);
      if (!places.length && radius < 15000) return load(lat, lon, 15000);
      render(radius);
      api("/api/event", { method: "POST", body: { kind: "hospital_search", detail: { results: places.length } } }).catch(() => {});
    } catch { $("#status").textContent = t("err"); $("#places").innerHTML = ""; }
  }
  function render(radius = 5000) {
    if (!center) return;
    const list = places.filter((p) => on.has(p.kind));
    layer.clearLayers();
    L.circleMarker(center, { radius: 8, color: "#ffb020", fillOpacity: 1 }).addTo(layer);
    list.forEach((p) => L.circleMarker([p.lat, p.lon], { radius: 7, color: COLORS[p.kind], fillOpacity: .85 }).bindPopup(`<b>${esc(p.name)}</b><br>${esc(t(p.kind))} · ${p.d.toFixed(1)} ${t("km")}`).addTo(layer));
    map.setView(center, radius > 5000 ? 12 : 13);
    $("#status").textContent = list.length ? `${list.length} ${t("found")} ${radius / 1000} ${t("km")}` : t("none");
    $("#places").innerHTML = list.slice(0, 40).map((p) => `<div class="place"><span class="ico" style="color:${COLORS[p.kind]}">${icon(p.kind === "pharmacy" ? "pill" : p.kind === "hospital" ? "plus" : "user")}</span>
      <div style="min-width:0;flex:1"><b>${esc(p.name)}</b><div class="small muted">${esc(t(p.kind))} · ${p.d.toFixed(1)} ${esc(t("km"))}${p.addr ? " · " + esc(p.addr) : ""}</div>
      <div class="row" style="margin-top:8px"><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}">${icon("map")}${esc(t("directions"))}</a>
      ${p.phone ? `<a class="btn btn-ghost btn-sm" href="tel:${esc(p.phone.replace(/[^+\d]/g, ""))}">${icon("phone")}${esc(t("call"))}</a>` : ""}</div></div></div>`).join("");
  }
  function locate() {
    if (!navigator.geolocation) return ($("#status").textContent = t("denied"));
    $("#status").textContent = t("finding");
    navigator.geolocation.getCurrentPosition((p) => load(p.coords.latitude, p.coords.longitude), () => ($("#status").textContent = t("denied")), { enableHighAccuracy: true, timeout: 12000 });
  }
  async function city(e) {
    e.preventDefault();
    const q = $("#city").value.trim(); if (!q) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pk&q=${encodeURIComponent(q)}`, { headers: { "Accept-Language": MB.lang } });
      const j = await r.json(); if (!j.length) return ($("#status").textContent = t("noCity"));
      load(+j[0].lat, +j[0].lon);
    } catch { $("#status").textContent = t("err"); }
  }
  function kinds() {
    $("#kinds").innerHTML = Object.keys(KINDS).map((k) => `<label class="opt"><input type="checkbox" value="${k}" ${on.has(k) ? "checked" : ""}><span><i style="width:10px;height:10px;border-radius:50%;background:${COLORS[k]};display:inline-block"></i>${esc(t(k))}</span></label>`).join("");
  }
  MB.onLang(() => { $("#locate").innerHTML = `${icon("map")}<span>${esc(t("locate"))}</span>`; kinds(); if (center) render(); });
  document.addEventListener("DOMContentLoaded", () => {
    initMap();
    $("#locate").addEventListener("click", locate);
    $("#cityForm").addEventListener("submit", city);
    $("#kinds").addEventListener("change", (e) => { e.target.checked ? on.add(e.target.value) : on.delete(e.target.value); render(); });
    const fix = () => { $("#mapGrid").style.gridTemplateColumns = innerWidth < 900 ? "minmax(0,1fr)" : "minmax(0,1.4fr) minmax(0,1fr)"; map && map.invalidateSize(); };
    addEventListener("resize", fix); fix();
  });
})();
