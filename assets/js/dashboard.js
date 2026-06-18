/* PTE2026 — Painel de Iniciativas. Carrega window.PTE_DATA (assets/data/iniciativas.js). */
(function () {
  "use strict";
  const D = window.PTE_DATA;
  if (!D) { document.body.innerHTML = "<p style='padding:30px'>Dados não carregados (assets/data/iniciativas.js).</p>"; return; }
  const ITEMS = D.iniciativas;
  const META = D.meta;

  // ---- helpers ----
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const colorByEixo = {}, nameByCod = {};
  META.eixos.forEach(e => { colorByEixo[e.cod] = e.cor; nameByCod[e.cod] = e.nome; });
  const eixoColor = cod => colorByEixo[cod] || "#94a3b8";
  const PMAX = Math.max(...ITEMS.map(i => i.pontuacao || 0));
  const PMIN = Math.min(...ITEMS.map(i => i.pontuacao || 0));
  const ufTokens = s => (s ? String(s).match(/\b[A-Z]{2}\b/g) || [] : []);

  // ---- state ----
  const state = { view: "ranking", sort: { key: "pontuacao", dir: -1 }, selected: new Set() };
  const filters = { busca: "", eixo: "", estado: "", bioma: "", pre: false };

  // ---- filtering ----
  function filtered() {
    const q = filters.busca.trim().toLowerCase();
    return ITEMS.filter(i => {
      if (filters.pre && !i.preselecionada) return false;
      if (filters.eixo && i.eixo_cod !== filters.eixo) return false;
      if (filters.estado && !ufTokens(i.estado).includes(filters.estado)) return false;
      if (filters.bioma && !(i.biomas || "").toLowerCase().includes(filters.bioma.toLowerCase())) return false;
      if (q) {
        const hay = [i.nome, i.org, i.municipio, i.tematica].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  // ---- KPIs ----
  function renderKpis() {
    const ufs = new Set();
    ITEMS.forEach(i => ufTokens(i.estado).forEach(u => ufs.add(u)));
    const avg = (ITEMS.reduce((s, i) => s + (i.pontuacao || 0), 0) / ITEMS.length).toFixed(1);
    const kpis = [
      ["Iniciativas", META.total], ["Pré-selecionadas", META.preselecionadas],
      ["Estados (UF)", ufs.size], ["Nota média", avg], ["Nota máx.", PMAX]
    ];
    $("#kpis").innerHTML = kpis.map(([l, v]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
    $("#foot-meta").textContent = `${META.total} iniciativas · ${META.preselecionadas} pré-selecionadas para incursão de campo`;
  }

  // ---- filter controls ----
  function fillSelect(sel, values) {
    values.sort((a, b) => a.localeCompare(b, "pt"));
    sel.insertAdjacentHTML("beforeend", values.map(v => `<option value="${v}">${v}</option>`).join(""));
  }
  function initFilters() {
    fillSelect($("#f-eixo"), META.eixos.map(e => e.cod));
    // relabel eixo options with full names
    $$("#f-eixo option").forEach(o => { if (o.value) o.textContent = `${o.value} — ${nameByCod[o.value]}`; });
    const ufs = new Set(), biomas = new Set();
    ITEMS.forEach(i => { ufTokens(i.estado).forEach(u => ufs.add(u)); (i.biomas || "").split(/[,/;]+/).forEach(b => { b = b.trim(); if (b) biomas.add(b); }); });
    fillSelect($("#f-estado"), [...ufs]);
    fillSelect($("#f-bioma"), [...biomas]);

    $("#f-busca").addEventListener("input", e => { filters.busca = e.target.value; refresh(); });
    $("#f-eixo").addEventListener("change", e => { filters.eixo = e.target.value; refresh(); });
    $("#f-estado").addEventListener("change", e => { filters.estado = e.target.value; refresh(); });
    $("#f-bioma").addEventListener("change", e => { filters.bioma = e.target.value; refresh(); });
    $("#f-pre").addEventListener("change", e => { filters.pre = e.target.checked; refresh(); });
    $("#f-reset").addEventListener("click", () => {
      Object.assign(filters, { busca: "", eixo: "", estado: "", bioma: "", pre: false });
      $("#f-busca").value = ""; $("#f-eixo").value = ""; $("#f-estado").value = ""; $("#f-bioma").value = ""; $("#f-pre").checked = false;
      refresh();
    });
  }

  // ---- RANKING ----
  function renderRanking(list) {
    const k = state.sort.key, dir = state.sort.dir;
    const sorted = [...list].sort((a, b) => {
      let va = a[k], vb = b[k];
      if (k === "pontuacao") return (((va || 0) - (vb || 0)) * dir);
      va = (va || "").toString().toLowerCase(); vb = (vb || "").toString().toLowerCase();
      return va < vb ? -dir : va > vb ? dir : 0;
    });
    const tb = $("#tbl-ranking tbody");
    tb.innerHTML = sorted.map((i, idx) => {
      const w = Math.round(8 + 52 * ((i.pontuacao - PMIN) / Math.max(1, PMAX - PMIN)));
      return `<tr data-id="${i.id}" class="${state.selected.has(i.id) ? "sel" : ""}">
        <td class="nota-cell"><span class="nota-bar" style="width:${w}px"></span>${i.pontuacao}</td>
        <td><span class="rank-pos">#${idx + 1}</span>${esc(i.nome)}</td>
        <td>${esc(trunc(i.org, 42))}</td>
        <td>${esc(i.municipio || "")}/${esc(i.estado || "")}</td>
        <td><span class="eixo-tag" style="background:${eixoColor(i.eixo_cod)}">${i.eixo_cod || "—"}</span></td>
        <td>${i.preselecionada ? '<span class="pre-badge">★ ' + i.pre_ufs.join(",") + "</span>" : ""}</td>
      </tr>`;
    }).join("");
    $$("#tbl-ranking tbody tr").forEach(tr => tr.addEventListener("click", () => toggleSelect(+tr.dataset.id)));
  }
  $$("#tbl-ranking thead th[data-sort]").forEach(th => th.addEventListener("click", () => {
    const key = th.dataset.sort;
    if (state.sort.key === key) state.sort.dir *= -1;
    else state.sort = { key, dir: key === "pontuacao" ? -1 : 1 };
    refresh();
  }));

  // ---- CARDS ----
  function renderCards(list) {
    $("#cards-grid").innerHTML = list.map(i => `
      <div class="card ${state.selected.has(i.id) ? "sel" : ""}" data-id="${i.id}">
        ${i.preselecionada ? '<span class="pre-flag pre-badge">★ pré-selecionada</span>' : ""}
        <div class="ctop">
          <h3>${esc(i.nome)}</h3>
          <span class="nota" title="Pontuação">${i.pontuacao}</span>
        </div>
        <div class="meta">${esc(trunc(i.org, 60))}</div>
        <div class="meta">📍 ${esc(i.municipio || "—")} / ${esc(i.estado || "")}</div>
        <div class="cfoot">
          <span class="eixo-tag" style="background:${eixoColor(i.eixo_cod)}">${i.eixo_cod || "—"}</span>
          ${i.cnpj && i.cnpj !== "Não localizado" ? `<span class="meta">CNPJ ${esc(i.cnpj)}</span>` : ""}
        </div>
      </div>`).join("");
    $$("#cards-grid .card").forEach(c => c.addEventListener("click", () => toggleSelect(+c.dataset.id)));
  }

  // ---- MAPA GERAL ----
  let mapGeral, layerGeral;
  function ensureMapGeral() {
    if (mapGeral) return;
    mapGeral = L.map("map-geral").setView([-8.5, -39.5], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "© OpenStreetMap", maxZoom: 18 }).addTo(mapGeral);
    layerGeral = L.layerGroup().addTo(mapGeral);
    $("#map-legend").innerHTML = META.eixos.map(e =>
      `<span class="li"><span class="dot" style="background:${e.cor}"></span>${e.cod} — ${e.nome}</span>`).join("") +
      `<span class="li"><span class="dot" style="background:#fff;border:2px solid ${'#b45309'}"></span>★ pré-selecionada (anel dourado)</span>`;
  }
  function renderMapGeral(list) {
    ensureMapGeral();
    layerGeral.clearLayers();
    list.forEach(i => {
      if (i.lat == null || i.lon == null) return;
      const r = 5 + 11 * ((i.pontuacao - PMIN) / Math.max(1, PMAX - PMIN));
      const m = L.circleMarker([i.lat, i.lon], {
        radius: r, fillColor: eixoColor(i.eixo_cod), fillOpacity: .82,
        color: i.preselecionada ? "#b45309" : "#fff", weight: i.preselecionada ? 3 : 1
      });
      m.bindPopup(popupHtml(i));
      m.addTo(layerGeral);
    });
    setTimeout(() => mapGeral.invalidateSize(), 50);
  }
  function popupHtml(i) {
    return `<b>${esc(i.nome)}</b><br>${esc(i.org || "")}<br>
      📍 ${esc(i.municipio || "")}/${esc(i.estado || "")}<br>
      Eixo: ${esc(i.eixo || "")}<br>
      Nota: <b>${i.pontuacao}</b> ${i.preselecionada ? "· ★ pré-selecionada" : ""}`;
  }

  // ---- COMPARAR (radar) ----
  let radarChart;
  function initCompare() {
    const sel = $("#cmp-add");
    fillSelect2(sel, [...ITEMS].sort((a, b) => b.pontuacao - a.pontuacao));
    sel.addEventListener("change", e => { if (e.target.value) { toggleSelect(+e.target.value, true); e.target.value = ""; } });
  }
  function fillSelect2(sel, list) {
    sel.insertAdjacentHTML("beforeend", list.map(i => `<option value="${i.id}">${esc(i.nome)} (${i.pontuacao})</option>`).join(""));
  }
  const RADAR_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#0891b2", "#dc2626"];
  function renderCompare() {
    const ids = [...state.selected];
    $("#cmp-chips").innerHTML = ids.map(id => {
      const i = byId(id);
      return `<span class="chip">${esc(trunc(i.nome, 28))}<button data-id="${id}">✕</button></span>`;
    }).join("") || '<span class="meta">Nenhuma selecionada.</span>';
    $$("#cmp-chips .chip button").forEach(b => b.addEventListener("click", () => toggleSelect(+b.dataset.id)));

    const labels = META.criterios.map(c => c.label);
    const datasets = ids.slice(0, 6).map((id, k) => {
      const i = byId(id);
      return {
        label: trunc(i.nome, 24),
        data: META.criterios.map(c => i.criterios[c.key] || 0),
        borderColor: RADAR_COLORS[k % RADAR_COLORS.length],
        backgroundColor: RADAR_COLORS[k % RADAR_COLORS.length] + "33", borderWidth: 2
      };
    });
    if (radarChart) radarChart.destroy();
    radarChart = new Chart($("#radar"), {
      type: "radar", data: { labels, datasets },
      options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, suggestedMax: 3, ticks: { stepSize: 1 } } } }
    });
  }

  // ---- ANÁLISES (heatmap + gráficos) ----
  const UF_ORDER = ["MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA"];
  let histChart, eixoChart;
  function renderAnalises(list) {
    // heatmap UF x eixo
    const cods = META.eixos.map(e => e.cod);
    const grid = {}, pre = {};
    UF_ORDER.forEach(u => { grid[u] = {}; pre[u] = {}; cods.forEach(c => { grid[u][c] = 0; pre[u][c] = 0; }); });
    let maxc = 1;
    list.forEach(i => {
      const u = (ufTokens(i.estado)[0]) || null;
      if (!u || !grid[u] || !i.eixo_cod) return;
      grid[u][i.eixo_cod]++; if (i.preselecionada) pre[u][i.eixo_cod]++;
      maxc = Math.max(maxc, grid[u][i.eixo_cod]);
    });
    const shade = n => n === 0 ? "#fff" : `rgba(37,99,235,${0.12 + 0.6 * (n / maxc)})`;
    let html = "<table><thead><tr><th>UF</th>" + cods.map(c => `<th title="${nameByCod[c]}">${c}</th>`).join("") + "<th>Σ</th></tr></thead><tbody>";
    UF_ORDER.forEach(u => {
      const tot = cods.reduce((s, c) => s + grid[u][c], 0);
      html += `<tr><td class="uf">${u}</td>` + cods.map(c => {
        const n = grid[u][c], p = pre[u][c];
        return `<td class="cell" style="background:${shade(n)}">${n || ""}${p ? ` <span class="star">★${p}</span>` : ""}</td>`;
      }).join("") + `<td class="cell"><b>${tot}</b></td></tr>`;
    });
    const colTot = cods.map(c => UF_ORDER.reduce((s, u) => s + grid[u][c], 0));
    html += `<tr><td class="uf">Σ</td>` + colTot.map(t => `<td class="cell"><b>${t}</b></td>`).join("") + `<td class="cell"><b>${colTot.reduce((a, b) => a + b, 0)}</b></td></tr>`;
    html += "</tbody></table>";
    $("#heatmap").innerHTML = html;

    // histograma de notas
    const vals = list.map(i => i.pontuacao || 0);
    const lo = Math.min(...vals, 0), hi = Math.max(...vals, 1), W = 2;
    const start = Math.floor(lo / W) * W, bins = [];
    for (let b = start; b <= hi; b += W) bins.push(b);
    const counts = bins.map(b => vals.filter(v => v >= b && v < b + W).length);
    if (histChart) histChart.destroy();
    histChart = new Chart($("#hist-nota"), {
      type: "bar",
      data: { labels: bins.map(b => `${b}–${b + W}`), datasets: [{ label: "iniciativas", data: counts, backgroundColor: "#2563eb" }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { precision: 0 } } } }
    });

    // média por eixo
    const avg = META.eixos.map(e => {
      const g = list.filter(i => i.eixo_cod === e.cod);
      return g.length ? g.reduce((s, i) => s + (i.pontuacao || 0), 0) / g.length : 0;
    });
    if (eixoChart) eixoChart.destroy();
    eixoChart = new Chart($("#bar-eixo"), {
      type: "bar",
      data: { labels: META.eixos.map(e => e.cod), datasets: [{ label: "nota média", data: avg.map(v => +v.toFixed(1)), backgroundColor: META.eixos.map(e => e.cor) }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: c => nameByCod[c[0].label] } } }, scales: { y: { beginAtZero: true } } }
    });
  }

  // ---- selection ----
  function toggleSelect(id, forceAdd) {
    if (forceAdd) state.selected.add(id);
    else if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    refresh();
  }
  const byId = id => ITEMS.find(i => i.id === id);

  // ---- tabs ----
  function setView(v) {
    state.view = v;
    $$("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    $$(".view").forEach(el => el.classList.add("hidden"));
    $("#view-" + v).classList.remove("hidden");
    refresh();
  }
  $$("#tabs button").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));

  // ---- refresh dispatcher ----
  function refresh() {
    const list = filtered();
    $("#f-count").textContent = `${list.length} de ${META.total} iniciativas`;
    if (state.view === "ranking") renderRanking(list);
    else if (state.view === "cards") renderCards(list);
    else if (state.view === "mapa") renderMapGeral(list);
    else if (state.view === "analises") renderAnalises(list);
    else if (state.view === "rotas" && window.PTE_ROTAS) window.PTE_ROTAS.render(list, helpers());
    else if (state.view === "comparar") renderCompare();
  }
  function helpers() { return { ITEMS, META, byId, eixoColor, popupHtml, esc, trunc }; }

  // ---- utils ----
  function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function trunc(s, n) { s = s == null ? "" : String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  // ---- boot ----
  renderKpis(); initFilters(); initCompare();
  window.PTE_DASH = { refresh, helpers, state, filtered };
  setView("ranking");
})();
