/* PTE Nordeste — Painel de Iniciativas. Consome window.PTE_DATA. */
(function () {
  "use strict";
  const D = window.PTE_DATA;
  if (!D) { document.body.innerHTML = "<p style='padding:30px'>Dados não carregados (assets/data/iniciativas.js).</p>"; return; }
  const ITEMS = D.iniciativas, META = D.meta;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const colorByCod = {}, nameByCod = {};
  META.eixos.forEach(e => { colorByCod[e.cod] = e.cor; nameByCod[e.cod] = e.nome; });
  const eixoColor = c => colorByCod[c] || "#9aa0b0";
  const PMAX = Math.max(...ITEMS.map(i => i.pontuacao || 0));
  const PMIN = Math.min(...ITEMS.map(i => i.pontuacao || 0));
  const ufTokens = s => (s ? String(s).match(/\b[A-Z]{2}\b/g) || [] : []);
  const UF_ORDER = ["MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA"];
  const UF_NOME = { MA: "Maranhão", PI: "Piauí", CE: "Ceará", RN: "Rio Grande do Norte", PB: "Paraíba", PE: "Pernambuco", AL: "Alagoas", SE: "Sergipe", BA: "Bahia" };

  const state = { view: "ranking", sort: { key: "pontuacao", dir: -1 }, selected: new Set() };
  const filters = { busca: "", eixo: "", estado: "", bioma: "", pre: false };

  // ----- seleção de campo (base para Análises e Rotas): visitas e entrevistas -----
  const SEL = { visita: new Set(), entrevista: new Set() };
  try {
    const sv = JSON.parse((window.localStorage && localStorage.getItem("pte_sel2")) || "{}");
    (sv.visita || []).forEach(id => SEL.visita.add(id));
    (sv.entrevista || []).forEach(id => SEL.entrevista.add(id));
  } catch (e) { /* ignore */ }
  function saveSel() { try { if (window.localStorage) localStorage.setItem("pte_sel2", JSON.stringify({ visita: [...SEL.visita], entrevista: [...SEL.entrevista] })); } catch (e) {} }
  const selUnion = () => new Set([...SEL.visita, ...SEL.entrevista]);
  const selItems = () => [...selUnion()].map(id => byId(id)).filter(Boolean);
  function toggleSel(group, id) { const s = SEL[group]; if (s.has(id)) s.delete(id); else s.add(id); saveSel(); }
  // "pré-selecionada" em todo o painel = escolhida na aba Seleção (visita ou entrevista)
  const isPre = id => SEL.visita.has(id) || SEL.entrevista.has(id);
  const selType = id => SEL.visita.has(id) ? "visita" : SEL.entrevista.has(id) ? "entrevista" : "";
  // rótulo de local: lista os dois pontos quando a iniciativa atua em mais de um lugar
  function locLabel(i) {
    if (i.locais && i.locais.length > 1) return i.locais.map(l => `${l.municipio}/${l.uf}`).join(" · ");
    const uf = ufTokens(i.estado).join(", ");
    return [i.municipio, uf].filter(Boolean).join(" / ") || "Multiestadual";
  }
  const selFilters = { visita: { busca: "", eixo: "", estado: "", bioma: "", natureza: "" }, entrevista: { busca: "", eixo: "", estado: "", bioma: "", natureza: "" } };
  function selFiltered(group) {
    const f = selFilters[group], q = f.busca.trim().toLowerCase();
    return ITEMS.filter(i => {
      if (i.lat == null || i.lon == null) return false;
      if (f.eixo && i.eixo_cod !== f.eixo) return false;
      if (f.estado && !ufTokens(i.estado).includes(f.estado)) return false;
      if (f.bioma && !(i.biomas || "").toLowerCase().includes(f.bioma.toLowerCase())) return false;
      if (f.natureza && i.natureza !== f.natureza) return false;
      if (q) { const hay = [i.nome, i.org, i.municipio, i.tematica].filter(Boolean).join(" ").toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
  }

  function filtered() {
    const q = filters.busca.trim().toLowerCase();
    return ITEMS.filter(i => {
      if (filters.pre && !isPre(i.id)) return false;
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

  // ---------- KPIs ----------
  function renderKpis() {
    const ufs = new Set(); ITEMS.forEach(i => ufTokens(i.estado).forEach(u => ufs.add(u)));
    const avg = (ITEMS.reduce((s, i) => s + (i.pontuacao || 0), 0) / ITEMS.length).toFixed(1);
    const kpis = [["Iniciativas", META.total], ["Pré-selecionadas", selUnion().size],
      ["Estados", ufs.size], ["Nota média", avg], ["Nota máxima", PMAX]];
    $("#kpis").innerHTML = kpis.map(([l, v]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
  }

  // ---------- filtros ----------
  function initFilters() {
    const fe = $("#f-eixo");
    META.eixos.forEach(e => fe.insertAdjacentHTML("beforeend", `<option value="${e.cod}">${e.nome}</option>`));
    const biomas = new Set();
    ITEMS.forEach(i => (i.biomas || "").split(/[,/;]+/).forEach(b => { b = b.trim(); if (b) biomas.add(b); }));
    const fest = $("#f-estado");
    UF_ORDER.forEach(u => fest.insertAdjacentHTML("beforeend", `<option value="${u}">${UF_NOME[u]} (${u})</option>`));
    [...biomas].sort((a, b) => a.localeCompare(b, "pt")).forEach(b => $("#f-bioma").insertAdjacentHTML("beforeend", `<option value="${b}">${b}</option>`));
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

  // ---------- RANKING ----------
  function renderRanking(list) {
    const k = state.sort.key, dir = state.sort.dir;
    const val = (i) => k === "pontuacao" ? (i.pontuacao || 0) : k === "id" ? i.id
      : k === "preselecionada" ? (isPre(i.id) ? 1 : 0) : k === "eixo" ? (i.eixo || "")
      : (i[k] || "");
    const sorted = [...list].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === "number") return (va - vb) * dir;
      return va < vb ? -dir : va > vb ? dir : 0;
    });
    $$("#tbl-ranking thead th").forEach(th => {
      const arr = th.querySelector(".arr");
      if (arr) arr.textContent = th.dataset.sort === k ? (dir < 0 ? "▼" : "▲") : "";
    });
    if (!sorted.length) { $("#tbl-ranking tbody").innerHTML = `<tr><td colspan="8" class="empty-row">Nenhuma iniciativa corresponde aos filtros selecionados.</td></tr>`; return; }
    $("#tbl-ranking tbody").innerHTML = sorted.map(i => {
      const w = Math.round(100 * ((i.pontuacao - PMIN) / Math.max(1, PMAX - PMIN)));
      const uf = ufTokens(i.estado).join(", ") || "—";
      const anc = window.PTE_ROTAS ? window.PTE_ROTAS.isAnchor(i.id) : false;
      const sub = orgSub(i);
      return `<tr data-id="${i.id}" class="${state.selected.has(i.id) ? "sel" : ""}">
        <td class="num t-id">${i.id}</td>
        <td class="t-nome"><span class="nm">${esc(i.nome)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</td>
        <td>${esc(i.municipio || "—")}${i.locais && i.locais.length > 1 ? ` <span class="multi-loc">${i.locais.length} locais</span>` : ""}</td>
        <td>${esc(uf)}</td>
        <td class="t-eixo"><span class="eixo-dot" style="background:${eixoColor(i.eixo_cod)}"></span><span class="eixo-name">${esc(i.eixo || "—")}</span></td>
        <td>${selType(i.id) === "visita" ? '<span class="badge badge-vis">Visita</span>' : selType(i.id) === "entrevista" ? '<span class="badge badge-ent">Entrevista</span>' : '<span class="badge badge-no">—</span>'}</td>
        <td class="t-nota"><span class="nota-track"><span class="nota-fill" style="width:${w}%"></span></span><span class="nota-num">${i.pontuacao}</span></td>
        <td><button class="card-anchor ${anc ? "on" : ""}" data-id="${i.id}" title="Fixar como âncora no planejamento de rotas">${anc ? "Âncora" : "Fixar"}</button></td>
      </tr>`;
    }).join("");
    $$("#tbl-ranking tbody tr").forEach(tr => tr.addEventListener("click", () => toggleSelect(+tr.dataset.id)));
    $$("#tbl-ranking tbody .card-anchor").forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      if (window.PTE_ROTAS) window.PTE_ROTAS.toggleAnchor(+b.dataset.id);
      refresh();
    }));
  }
  $$("#tbl-ranking thead th[data-sort]").forEach(th => th.addEventListener("click", () => {
    const key = th.dataset.sort;
    if (state.sort.key === key) state.sort.dir *= -1;
    else state.sort = { key, dir: (key === "pontuacao" || key === "id") ? -1 : 1 };
    refresh();
  }));

  // ---------- CARTÕES ----------
  function renderCards(list) {
    if (!list.length) { $("#cards-grid").innerHTML = `<div class="empty-state">Nenhuma iniciativa corresponde aos filtros selecionados.</div>`; return; }
    $("#cards-grid").innerHTML = list.map(i => {
      const w = Math.round(100 * ((i.pontuacao - PMIN) / Math.max(1, PMAX - PMIN)));
      const cor = eixoColor(i.eixo_cod);
      const uf = ufTokens(i.estado).join(", ");
      const local = locLabel(i);
      const anc = window.PTE_ROTAS ? window.PTE_ROTAS.isAnchor(i.id) : false;
      const fact = (k, v) => v ? `<div class="f"><span class="k">${k}</span><span>${esc(v)}</span></div>` : "";
      return `<div class="card ${state.selected.has(i.id) ? "sel" : ""}" data-id="${i.id}">
        <div class="strip" style="background:${cor}"></div>
        <div class="pad">
          <div class="row1">
            <span class="eixo-chip" style="background:${cor}">${esc(i.eixo || "—")}</span>
            <span class="idtag">#${i.id}${selType(i.id) === "visita" ? ' · <span style="color:var(--orange)">visita técnica</span>' : selType(i.id) === "entrevista" ? ' · <span style="color:var(--green)">entrevista</span>' : ""}</span>
          </div>
          <h3>${esc(i.nome)}</h3>
          ${orgSub(i) ? `<div class="org">${esc(orgSub(i))}</div>` : ""}
          ${(i.resumo || i.objetivo) ? `<p class="desc">${esc(i.resumo || truncWords(i.objetivo, 160))}</p>` : ""}
          ${i.objetivo && i.objetivo.trim() !== (i.resumo || "").trim() ? `<button class="card-more" data-id="${i.id}" aria-expanded="false">Ver objetivo completo</button><div class="card-full" hidden>${esc(i.objetivo)}</div>` : ""}
          <div class="facts">
            ${fact("Local", local)}
            ${fact("Setor", i.setor)}
            ${fact("Natureza", i.natureza)}
          </div>
          <div class="footer">
            <span class="score"><b>${i.pontuacao}</b><span>de ${PMAX} pts</span></span>
            <span class="scorebar"><i style="width:${w}%"></i></span>
            <button class="card-anchor ${anc ? "on" : ""}" data-id="${i.id}" title="Fixar como âncora no planejamento de rotas">${anc ? "Âncora" : "Fixar âncora"}</button>
          </div>
        </div>
      </div>`;
    }).join("");
    $$("#cards-grid .card").forEach(c => c.addEventListener("click", () => toggleSelect(+c.dataset.id)));
    $$("#cards-grid .card-more").forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      const full = b.nextElementSibling, open = full.hasAttribute("hidden");
      if (open) { full.removeAttribute("hidden"); b.textContent = "Ocultar objetivo"; b.setAttribute("aria-expanded", "true"); }
      else { full.setAttribute("hidden", ""); b.textContent = "Ver objetivo completo"; b.setAttribute("aria-expanded", "false"); }
    }));
    $$("#cards-grid .card-full").forEach(d => d.addEventListener("click", e => e.stopPropagation()));
    $$("#cards-grid .card-anchor").forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      if (window.PTE_ROTAS) window.PTE_ROTAS.toggleAnchor(+b.dataset.id);
      refresh();
    }));
  }

  // ---------- MAPA GERAL ----------
  let mapGeral, layerGeral;
  function ensureMapGeral() {
    if (mapGeral) return;
    mapGeral = L.map("map-geral", { zoomControl: true }).setView([-8.6, -39.5], 5);
    if (window.PTE_MAP) PTE_MAP.setup(mapGeral, { base: "Ruas e estradas", boundaries: true });
    else L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 20 }).addTo(mapGeral);
    layerGeral = L.layerGroup().addTo(mapGeral);
    renderMapLegend();
  }
  function markerR(v) { return 7 + 17 * ((v - PMIN) / Math.max(1, PMAX - PMIN)); }
  function renderMapLegend() {
    const cores = META.eixos.map(e => `<div class="li"><span class="dot" style="background:${e.cor}"></span>${e.nome}</div>`).join("");
    const szs = [PMIN, Math.round((PMIN + PMAX) / 2), PMAX].map(v => {
      const r = markerR(v);
      return `<div class="sz"><span class="szc" style="width:${r * 2}px;height:${r * 2}px"></span>${v}</div>`;
    }).join("");
    $("#map-side").innerHTML = `
      <div class="legend"><h4>Eixo (cor do círculo)</h4>${cores}</div>
      <div class="legend"><h4>Nota (tamanho do círculo)</h4><div class="sizes">${szs}</div>
        <div class="li" style="margin-top:8px"><span class="dot ring-pre"></span>Visita técnica (Seleção)</div>
        <div class="li"><span class="dot ring-ent"></span>Entrevista (Seleção)</div>
        <div class="li"><span class="apt-ico apt-leg">✈</span>Aeroporto</div>
        <div class="li"><span class="uf-leg"></span>Limite estadual</div>
        <div class="note">Os contornos destacam as iniciativas escolhidas na aba <b>Seleção</b>. Use o controle de camadas (↗) para alternar base e ligar/desligar limites e aeroportos.</div></div>`;
  }
  function renderMapGeral(list) {
    ensureMapGeral();
    layerGeral.clearLayers();
    list.forEach(i => {
      const locs = (i.locais && i.locais.length) ? i.locais
        : (i.lat != null && i.lon != null ? [{ lat: i.lat, lon: i.lon, municipio: i.municipio, uf: ufTokens(i.estado).join(", ") }] : []);
      const r = markerR(i.pontuacao);
      locs.forEach((loc, li) => {
        const extra = locs.length > 1 ? `<br><span class="pp-k">Local ${li + 1} de ${locs.length}:</span> ${esc(loc.municipio || "")}${loc.uf ? "/" + esc(loc.uf) : ""}` : "";
        const t = selType(i.id);
        L.circleMarker([loc.lat, loc.lon], {
          radius: r, fillColor: eixoColor(i.eixo_cod), fillOpacity: i.fora_ne ? .5 : .85,
          color: t === "visita" ? "#f37520" : t === "entrevista" ? "#16a34a" : "#fff", weight: t ? 3.4 : 1.4
        }).bindPopup(popupHtml(i) + extra).addTo(layerGeral);
      });
    });
    setTimeout(() => mapGeral.invalidateSize(), 50);
  }
  function popupHtml(i) {
    const uf = ufTokens(i.estado).join(", ");
    const sub = orgSub(i);
    return `<span class="pp-h">${esc(i.nome)}</span>
      ${sub ? esc(sub) + "<br>" : ""}
      <span class="pp-k">Local:</span> ${esc(locLabel(i))}<br>
      <span class="pp-k">Eixo:</span> ${esc(i.eixo || "")}<br>
      <span class="pp-k">Nota:</span> <b>${i.pontuacao}</b>${selType(i.id) === "visita" ? " · visita técnica" : selType(i.id) === "entrevista" ? " · entrevista" : ""}`;
  }

  // ---------- SELEÇÃO ESTRATÉGICA ----------
  let selMap = { visita: null, entrevista: null }, selLayer = { visita: null, entrevista: null };
  function ensureSelMap(group) {
    if (selMap[group]) return;
    const id = group === "visita" ? "map-sel-visita" : "map-sel-entrevista";
    const m = L.map(id, { zoomControl: true }).setView([-8.6, -39.5], 5);
    if (window.PTE_MAP) window.PTE_MAP.setup(m, { base: "Ruas e estradas", boundaries: true });
    else L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 20 }).addTo(m);
    selLayer[group] = L.layerGroup().addTo(m);
    selMap[group] = m;
  }
  function selStyle(i, group) {
    const on = SEL[group].has(i.id);
    const r = 5 + 12 * ((i.pontuacao - PMIN) / Math.max(1, PMAX - PMIN));
    return { radius: r, fillColor: eixoColor(i.eixo_cod), fillOpacity: on ? .9 : .28, color: on ? "#16a34a" : "#fff", weight: on ? 3.5 : 1 };
  }
  function renderSelMap(group) {
    ensureSelMap(group);
    const lay = selLayer[group]; lay.clearLayers();
    selFiltered(group).forEach(i => {
      const locs = (i.locais && i.locais.length) ? i.locais : [{ lat: i.lat, lon: i.lon }];
      locs.forEach(loc => {
        const other = group === "visita" ? "entrevista" : "visita";
        const inOther = SEL[other].has(i.id);
        L.circleMarker([loc.lat, loc.lon], selStyle(i, group))
          .bindTooltip(`${esc(i.nome)} · ${i.pontuacao} pts${SEL[group].has(i.id) ? " ✓" : ""}${inOther ? (group === "visita" ? " (já em entrevistas)" : " (já em visitas)") : ""}`, { direction: "top" })
          .on("click", () => { toggleSel(group, i.id); renderSelecao(); })
          .addTo(lay);
      });
    });
    setTimeout(() => selMap[group].invalidateSize(), 30);
  }
  function renderSelList(group) {
    const box = $(group === "visita" ? "#sel-list-visita" : "#sel-list-entrevista");
    const ids = [...SEL[group]];
    const opts = [...ITEMS].filter(i => i.lat != null).sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
      .map(i => `<option value="${i.id}">${esc(i.nome)}</option>`).join("");
    const chips = ids.length
      ? ids.map(id => { const i = byId(id); return `<span class="selchip"><span class="d" style="background:${eixoColor(i.eixo_cod)}"></span>${esc(trunc(i.nome, 30))}<button data-id="${id}" data-g="${group}" title="remover">×</button></span>`; }).join("")
      : `<span class="sel-empty">Nenhuma selecionada. Clique nos pontos do mapa ou use o seletor abaixo.</span>`;
    box.innerHTML = `<select class="sel-add-sel" data-g="${group}"><option value="">Adicionar pela lista…</option>${opts}</select><div class="selchips">${chips}</div>`;
    box.querySelector(".sel-add-sel").addEventListener("change", e => { if (e.target.value) { SEL[group].add(+e.target.value); saveSel(); renderSelecao(); } });
    box.querySelectorAll(".selchip button").forEach(b => b.addEventListener("click", () => { SEL[b.dataset.g].delete(+b.dataset.id); saveSel(); renderSelecao(); }));
  }
  function renderSelGroup(group) {
    const fl = selFiltered(group);
    const cid = group === "visita" ? "#sfv-count" : "#sfe-count";
    if ($(cid)) $(cid).textContent = `${fl.length} no filtro`;
    renderSelMap(group); renderSelList(group);
  }
  function renderSelTable(group, sel, cnt) {
    const box = $(sel); if (!box) return;
    const ids = [...SEL[group]];
    const cEl = $(cnt); if (cEl) cEl.textContent = ids.length;
    if (!ids.length) { box.innerHTML = `<div class="sel-tbl-empty">Nenhuma iniciativa pré-selecionada para ${group === "visita" ? "visita técnica" : "entrevista em profundidade"}. Marque-as no mapa acima.</div>`; return; }
    const rows = ids.map(id => byId(id)).filter(Boolean).sort((a, b) => (b.pontuacao || 0) - (a.pontuacao || 0));
    const body = rows.map(i => {
      const uf = ufTokens(i.estado).join(", ") || "—", sub = orgSub(i);
      return `<tr>
        <td class="num">${i.id}</td>
        <td class="t-nome"><span class="nm">${esc(i.nome)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</td>
        <td>${esc(locLabel(i))}</td>
        <td>${esc(uf)}</td>
        <td class="t-eixo"><span class="eixo-dot" style="background:${eixoColor(i.eixo_cod)}"></span><span class="eixo-name">${esc(i.eixo || "—")}</span></td>
        <td class="num">${i.pontuacao}</td>
        <td><button class="seltbl-rm" data-g="${group}" data-id="${i.id}" title="remover da seleção">×</button></td>
      </tr>`;
    }).join("");
    box.innerHTML = `<table class="sel-tbl"><thead><tr><th class="num">ID</th><th>Iniciativa / organização</th><th>Local</th><th>UF</th><th>Eixo</th><th class="num">Nota</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
    box.querySelectorAll(".seltbl-rm").forEach(b => b.addEventListener("click", () => { SEL[b.dataset.g].delete(+b.dataset.id); saveSel(); renderSelecao(); }));
  }
  function renderSelTables() {
    renderSelTable("visita", "#tbl-sel-visita", "#seltbl-cv");
    renderSelTable("entrevista", "#tbl-sel-entrevista", "#seltbl-ce");
  }
  function renderSelecao() {
    renderSelGroup("visita"); renderSelGroup("entrevista");
    $("#sel-count-visita").textContent = SEL.visita.size;
    $("#sel-count-entrevista").textContent = SEL.entrevista.size;
    if ($("#sel-summary")) $("#sel-summary").textContent = `${SEL.visita.size} visita(s) · ${SEL.entrevista.size} entrevista(s) · ${selUnion().size} no total`;
    renderSelTables();
    updateTabLinks(); renderKpis();
  }
  function setupSelFilters(group, p) {
    const g = id => document.getElementById(p + "-" + id);
    META.eixos.forEach(e => g("eixo").insertAdjacentHTML("beforeend", `<option value="${e.cod}">${e.nome}</option>`));
    UF_ORDER.forEach(u => g("estado").insertAdjacentHTML("beforeend", `<option value="${u}">${UF_NOME[u]} (${u})</option>`));
    const biomas = new Set(); ITEMS.forEach(i => (i.biomas || "").split(/[,/;]+/).forEach(b => { b = b.trim(); if (b) biomas.add(b); }));
    [...biomas].sort((a, b) => a.localeCompare(b, "pt")).forEach(b => g("bioma").insertAdjacentHTML("beforeend", `<option value="${b}">${b}</option>`));
    const nat = new Set(); ITEMS.forEach(i => { if (i.natureza) nat.add(i.natureza); });
    [...nat].sort((a, b) => a.localeCompare(b, "pt")).forEach(nv => g("nat").insertAdjacentHTML("beforeend", `<option value="${esc(nv)}">${esc(nv)}</option>`));
    g("busca").addEventListener("input", e => { selFilters[group].busca = e.target.value; renderSelGroup(group); });
    g("eixo").addEventListener("change", e => { selFilters[group].eixo = e.target.value; renderSelGroup(group); });
    g("estado").addEventListener("change", e => { selFilters[group].estado = e.target.value; renderSelGroup(group); });
    g("bioma").addEventListener("change", e => { selFilters[group].bioma = e.target.value; renderSelGroup(group); });
    g("nat").addEventListener("change", e => { selFilters[group].natureza = e.target.value; renderSelGroup(group); });
    g("reset").addEventListener("click", () => {
      Object.assign(selFilters[group], { busca: "", eixo: "", estado: "", bioma: "", natureza: "" });
      ["busca", "eixo", "estado", "bioma", "nat"].forEach(s => { g(s).value = ""; });
      renderSelGroup(group);
    });
  }
  function initSelecao() {
    setupSelFilters("visita", "sfv");
    setupSelFilters("entrevista", "sfe");
    $("#sel-clear-visita").addEventListener("click", () => { SEL.visita.clear(); saveSel(); renderSelecao(); });
    $("#sel-clear-entrevista").addEventListener("click", () => { SEL.entrevista.clear(); saveSel(); renderSelecao(); });
    $("#sel-go-analises").addEventListener("click", () => setView("analises"));
    $("#sel-go-rotas").addEventListener("click", () => setView("rotas"));
  }
  function updateTabLinks() {
    const n = selUnion().size;
    $$("#tabs button").forEach(b => {
      const v = b.dataset.view;
      if (v === "selecao" || v === "analises" || v === "rotas") {
        let badge = b.querySelector(".tbadge");
        if (n > 0) {
          if (!badge) { badge = document.createElement("span"); badge.className = "tbadge"; b.appendChild(badge); }
          badge.textContent = n;
          b.title = v === "selecao" ? `${n} iniciativa(s) selecionada(s)` : `Vinculado à seleção (${n})`;
        } else if (badge) { badge.remove(); b.removeAttribute("title"); }
      }
    });
  }

  // ---------- ANÁLISES ----------
  let histChart, eixoChart, anBase = "sel";
  function analiseBase() { const sel = selItems(); const useSel = anBase === "sel" && sel.length > 0; return { list: useSel ? sel : ITEMS, useSel, n: sel.length }; }
  function renderAnBanner(b) {
    const el = $("#an-base"); if (!el) return;
    if (!b.n) { el.innerHTML = `<span class="an-hint">Analisando todas as ${ITEMS.length} iniciativas. Use a aba <b>Seleção</b> para analisar apenas as escolhidas.</span>`; return; }
    el.innerHTML = `<span class="an-lab">Base da análise:</span>
      <button class="an-tg ${b.useSel ? "on" : ""}" data-b="sel">Selecionadas (${b.n})</button>
      <button class="an-tg ${!b.useSel ? "on" : ""}" data-b="todas">Todas (${ITEMS.length})</button>`;
    el.querySelectorAll(".an-tg").forEach(btn => btn.addEventListener("click", () => { anBase = btn.dataset.b; refresh(); }));
  }
  function renderAnalises(list) {
    const cods = META.eixos.map(e => e.cod);
    const COLS = [...UF_ORDER, "NAC"];
    const COL_LABEL = Object.assign({ NAC: "Nac./Multi" }, UF_NOME);
    const grid = {}, pre = {};
    cods.forEach(c => { grid[c] = {}; pre[c] = {}; COLS.forEach(u => { grid[c][u] = 0; pre[c][u] = 0; }); });
    let maxc = 1;
    list.forEach(i => {
      if (!i.eixo_cod) return;
      const u0 = ufTokens(i.estado)[0], col = (u0 && UF_NOME[u0]) ? u0 : "NAC";
      grid[i.eixo_cod][col]++; if (isPre(i.id)) pre[i.eixo_cod][col]++;
      maxc = Math.max(maxc, grid[i.eixo_cod][col]);
    });
    const shade = n => n === 0 ? "#fff" : `rgba(41,45,118,${0.08 + 0.6 * (n / maxc)})`;
    const ink = n => n / maxc > 0.55 ? "#fff" : "var(--ink)";
    let h = "<table><thead><tr><th class='rowh'>Eixo \\ Estado</th>" +
      COLS.map(u => `<th${u === "NAC" ? " class='nac'" : ""}>${COL_LABEL[u]}</th>`).join("") + "<th class='tot'>Total</th></tr></thead><tbody>";
    cods.forEach(c => {
      const tot = COLS.reduce((s, u) => s + grid[c][u], 0);
      h += `<tr><th class="rowh"><span class="eixo-dot" style="background:${eixoColor(c)}"></span>${nameByCod[c]}</th>` +
        COLS.map(u => {
          const n = grid[c][u], p = pre[c][u];
          return `<td class="${u === "NAC" ? "nac" : ""}" style="background:${shade(n)};color:${ink(n)}">${n ? `<span class="v">${n}</span>` : ""}${p ? `<span class="pre">${p} pré</span>` : ""}</td>`;
        }).join("") + `<td class="tot">${tot}</td></tr>`;
    });
    const colTot = COLS.map(u => cods.reduce((s, c) => s + grid[c][u], 0));
    h += `<tr class="tot"><th class="rowh">Total</th>` + colTot.map((t, idx) => `<td${COLS[idx] === "NAC" ? " class='nac'" : ""}>${t}</td>`).join("") +
      `<td>${colTot.reduce((a, b) => a + b, 0)}</td></tr></tbody></table>`;
    $("#heatmap").innerHTML = h;

    // histograma
    const vals = list.map(i => i.pontuacao || 0), W = 2;
    const start = Math.floor(Math.min(...vals, 0) / W) * W, hi = Math.max(...vals, 1), bins = [];
    for (let b = start; b <= hi; b += W) bins.push(b);
    const counts = bins.map(b => vals.filter(v => v >= b && v < b + W).length);
    if (histChart) histChart.destroy();
    histChart = new Chart($("#hist-nota"), {
      type: "bar",
      data: { labels: bins.map(b => `${b} a ${b + W}`), datasets: [{ label: "Iniciativas", data: counts, backgroundColor: "#292d76", borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { ticks: { precision: 0 }, title: { display: true, text: "nº de iniciativas" } }, x: { title: { display: true, text: "faixa de nota" } } } }
    });

    // média por eixo (barra horizontal, nomes completos)
    const rows = META.eixos.map(e => {
      const g = list.filter(i => i.eixo_cod === e.cod);
      return { nome: e.nome, cor: e.cor, media: g.length ? g.reduce((s, i) => s + (i.pontuacao || 0), 0) / g.length : 0 };
    });
    if (eixoChart) eixoChart.destroy();
    eixoChart = new Chart($("#bar-eixo"), {
      type: "bar",
      data: { labels: rows.map(r => r.nome), datasets: [{ label: "Nota média", data: rows.map(r => +r.media.toFixed(1)), backgroundColor: rows.map(r => r.cor), borderRadius: 4 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, suggestedMax: PMAX, title: { display: true, text: "nota média" } }, y: { ticks: { font: { size: 11 } } } } }
    });
  }

  // ---------- COMPARAR ----------
  let radarChart, RANK = {}, AVGCRIT = {}, AVGTOTAL = 0;
  function computeCompareRefs() {
    [...ITEMS].sort((a, b) => (b.pontuacao || 0) - (a.pontuacao || 0)).forEach((i, idx) => { RANK[i.id] = idx + 1; });
    META.criterios.forEach(c => { AVGCRIT[c.key] = ITEMS.reduce((s, i) => s + (i.criterios[c.key] || 0), 0) / ITEMS.length; });
    AVGTOTAL = ITEMS.reduce((s, i) => s + (i.pontuacao || 0), 0) / ITEMS.length;
  }
  function initCompare() {
    computeCompareRefs();
    const sel = $("#cmp-add");
    META.eixos.forEach(e => {
      const opts = [...ITEMS].filter(i => i.eixo_cod === e.cod).sort((a, b) => b.pontuacao - a.pontuacao);
      if (!opts.length) return;
      const og = document.createElement("optgroup"); og.label = e.nome;
      opts.forEach(i => og.insertAdjacentHTML("beforeend", `<option value="${i.id}">${esc(trunc(i.nome, 44))} — ${i.pontuacao} pts</option>`));
      sel.appendChild(og);
    });
    sel.addEventListener("change", e => { if (e.target.value) { toggleSelect(+e.target.value, true); e.target.value = ""; } });
    const setSel = ids => { state.selected.clear(); ids.slice(0, 6).forEach(id => state.selected.add(id)); refresh(); };
    $("#cmp-top5").addEventListener("click", () => setSel([...ITEMS].sort((a, b) => b.pontuacao - a.pontuacao).slice(0, 5).map(i => i.id)));
    $("#cmp-anchors").addEventListener("click", () => setSel(window.PTE_ROTAS ? ITEMS.filter(i => window.PTE_ROTAS.isAnchor(i.id)).map(i => i.id) : []));
    $("#cmp-clear").addEventListener("click", () => { state.selected.clear(); refresh(); });
    $("#cmp-avg").addEventListener("change", renderCompare);
  }
  const RCOL = ["#1f4da1", "#f37520", "#43a047", "#7a3fb8", "#e0392b", "#0d9488"];
  const ordinal = n => n + "º";
  function scoreBg(v) { return v <= 0 ? "#f5f6fa" : `rgba(31,77,161,${(0.16 + 0.26 * v).toFixed(2)})`; }
  function renderCompare() {
    const crits = META.criterios;
    const all = [...state.selected];
    const ids = all.slice(0, 6);
    const showAvg = $("#cmp-avg") ? $("#cmp-avg").checked : true;
    $("#cmp-count").textContent = all.length
      ? `${all.length} selecionada${all.length > 1 ? "s" : ""}${all.length > 6 ? " · comparando as 6 primeiras" : ""}` : "";
    const sel = ids.map((id, k) => ({ i: byId(id), col: RCOL[k % RCOL.length] }));

    if (!sel.length) {
      $("#cmp-insights").innerHTML = emptyInsights();
      $("#cmp-matrix").innerHTML = "";
      $("#cmp-cards").innerHTML = "";
    } else {
      $("#cmp-insights").innerHTML = buildInsights(sel, crits);
      $("#cmp-matrix").innerHTML = buildMatrix(sel, crits, showAvg);
      $("#cmp-cards").innerHTML = buildCmpCards(sel, crits);
      $$("#cmp-cards .cc-rm").forEach(b => b.addEventListener("click", () => toggleSelect(+b.dataset.id)));
    }

    // ---- radar (perfil nos critérios) ----
    const labels = crits.map(c => c.label);
    const datasets = sel.map(s => ({
      label: trunc(s.i.nome, 24), data: crits.map(c => s.i.criterios[c.key] || 0),
      borderColor: s.col, backgroundColor: s.col + "22", borderWidth: 2, pointBackgroundColor: s.col, pointRadius: 3
    }));
    if (showAvg) datasets.push({
      label: `Média geral (${ITEMS.length})`, data: crits.map(c => +AVGCRIT[c.key].toFixed(2)),
      borderColor: "#9aa0b0", backgroundColor: "transparent", borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false
    });
    if (radarChart) radarChart.destroy();
    radarChart = new Chart($("#radar"), {
      type: "radar", data: { labels, datasets },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 12 } } },
        scales: { r: { min: 0, suggestedMax: 3, ticks: { stepSize: 1 }, pointLabels: { font: { size: 10 } } } } }
    });
  }
  function emptyInsights() {
    return `<div class="ci-empty">
      <div class="ci-h">Como usar esta comparação</div>
      <ul>
        <li>Adicione iniciativas pelo seletor ou pelos atalhos acima — ou clicando na tabela e nos cartões.</li>
        <li>O <b>gráfico de teia</b> mostra o perfil nos dez critérios; a linha tracejada é a <b>média das ${ITEMS.length}</b> iniciativas.</li>
        <li>A <b>matriz por critério</b> destaca quem se sai melhor em cada um e compara com a média.</li>
        <li>As <b>maiores diferenças</b> apontam os critérios decisivos entre as escolhidas.</li>
      </ul>
      <div class="ci-tip">Dica: comece por “Top 5 por nota” ou pelas suas “Âncoras”.</div></div>`;
  }
  function buildInsights(sel, crits) {
    if (sel.length === 1) {
      const i = sel[0].i;
      const strong = crits.filter(c => (i.criterios[c.key] || 0) >= 3).map(c => c.label);
      const weak = crits.filter(c => (i.criterios[c.key] || 0) <= 1).map(c => c.label);
      const above = crits.filter(c => (i.criterios[c.key] || 0) > AVGCRIT[c.key]).length;
      return `<div class="ci-h">Perfil da iniciativa</div>
        <div class="ci-rank">Nota <b>${i.pontuacao}</b>/30 · <b>${ordinal(RANK[i.id])}</b> de ${ITEMS.length} no ranking geral</div>
        <div class="ci-line">Acima da média geral em <b>${above}</b> de ${crits.length} critérios.</div>
        ${strong.length ? `<div class="ci-block"><span class="ci-tag good">Pontos fortes</span><ul>${strong.map(l => `<li>${esc(l)}</li>`).join("")}</ul></div>` : ""}
        ${weak.length ? `<div class="ci-block"><span class="ci-tag warn">A desenvolver</span><ul>${weak.map(l => `<li>${esc(l)}</li>`).join("")}</ul></div>` : ""}
        <div class="ci-tip">Adicione outra iniciativa para comparar lado a lado.</div>`;
    }
    const lead = sel.map(() => 0), diffs = [];
    crits.forEach(c => {
      const vals = sel.map(s => s.i.criterios[c.key] || 0);
      const mx = Math.max(...vals), mn = Math.min(...vals);
      if (mx > mn) sel.forEach((s, idx) => { if (vals[idx] === mx) lead[idx]++; });
      diffs.push({ label: c.label, spread: mx - mn, leader: sel[vals.indexOf(mx)] });
    });
    const board = sel.map((s, idx) => `<div class="ci-bar"><span class="ci-dot" style="background:${s.col}"></span>
      <span class="ci-bn" title="${esc(s.i.nome)}">${esc(trunc(s.i.nome, 22))}</span>
      <span class="ci-bt"><i style="width:${lead[idx] / crits.length * 100}%;background:${s.col}"></i></span>
      <span class="ci-bc">${lead[idx]}</span></div>`).join("");
    const top = diffs.filter(d => d.spread > 0).sort((a, b) => b.spread - a.spread).slice(0, 4);
    const diffHtml = top.length ? top.map(d => `<li><span class="ci-cl">${esc(d.label)}</span>
      <span class="ci-cv"><span class="ci-dot" style="background:${d.leader.col}"></span>${esc(trunc(d.leader.i.nome, 18))} <em>+${d.spread}</em></span></li>`).join("")
      : `<li class="ci-none">Desempenho idêntico nos dez critérios.</li>`;
    return `<div class="ci-h">Quem lidera cada critério <small>de ${crits.length}</small></div>
      <div class="ci-board">${board}</div>
      <div class="ci-h" style="margin-top:16px">Maiores diferenças</div>
      <ul class="ci-diffs">${diffHtml}</ul>`;
  }
  function buildMatrix(sel, crits, showAvg) {
    const head = `<th class="mc-crit">Critério</th>` +
      sel.map(s => `<th><span class="mc-dot" style="background:${s.col}"></span><span class="mc-nm" title="${esc(s.i.nome)}">${esc(trunc(s.i.nome, 16))}</span></th>`).join("") +
      (showAvg ? `<th class="mc-avg">Média<br>geral</th>` : "");
    const rows = crits.map(c => {
      const vals = sel.map(s => s.i.criterios[c.key] || 0), mx = Math.max(...vals), mn = Math.min(...vals);
      const cells = sel.map((s, idx) => {
        const v = vals[idx], win = sel.length > 1 && v === mx && mx > mn;
        return `<td class="mc-s${win ? " win" : ""}" style="background:${scoreBg(v)};color:${v >= 2 ? "#fff" : "var(--ink)"}${win ? `;box-shadow:inset 0 0 0 2px ${s.col}` : ""}">${v}</td>`;
      }).join("");
      return `<tr><th class="mc-crit">${esc(c.label)}</th>${cells}${showAvg ? `<td class="mc-avg">${AVGCRIT[c.key].toFixed(1)}</td>` : ""}</tr>`;
    }).join("");
    const tot = sel.map(s => s.i.pontuacao || 0), tmx = Math.max(...tot), tmn = Math.min(...tot);
    const totCells = sel.map((s, idx) => {
      const win = sel.length > 1 && tot[idx] === tmx && tmx > tmn;
      return `<td class="mc-tot${win ? " win" : ""}"${win ? ` style="box-shadow:inset 0 0 0 2px ${s.col}"` : ""}>${tot[idx]}</td>`;
    }).join("");
    return `<div class="mc-title">Comparação por critério <small>nota de 0 a 3 · célula destacada = melhor entre as selecionadas · coluna cinza = média das ${ITEMS.length}</small></div>
      <div class="mc-scroll"><table class="cmp-mtx"><thead><tr>${head}</tr></thead><tbody>${rows}
        <tr class="mc-totrow"><th class="mc-crit">Nota total (0–30)</th>${totCells}${showAvg ? `<td class="mc-avg">${AVGTOTAL.toFixed(1)}</td>` : ""}</tr></tbody></table></div>`;
  }
  function buildCmpCards(sel, crits) {
    return sel.map(s => {
      const i = s.i, uf = ufTokens(i.estado).join(", "), sub = orgSub(i);
      const strong = crits.filter(c => (i.criterios[c.key] || 0) >= 3).map(c => c.label).slice(0, 4);
      const weak = crits.filter(c => (i.criterios[c.key] || 0) <= 1).map(c => c.label).slice(0, 3);
      return `<div class="cmp-card" style="border-top-color:${s.col}">
        <div class="cc-h"><span>${esc(i.nome)}</span><b>${i.pontuacao}</b></div>
        ${sub ? `<div class="cc-sub">${esc(sub)}</div>` : ""}
        <div class="cc-meta"><span class="cc-rk">${ordinal(RANK[i.id])} de ${ITEMS.length}</span> · ${esc(i.eixo || "")} · ${esc(locLabel(i))}${selType(i.id) === "visita" ? ' · <span class="cc-pre">visita técnica</span>' : selType(i.id) === "entrevista" ? ' · <span class="cc-pre">entrevista</span>' : ""}</div>
        ${strong.length ? `<div class="cc-tags"><span class="cc-lab good">Fortes</span>${strong.map(l => `<span class="cc-chip good">${esc(l)}</span>`).join("")}</div>` : ""}
        ${weak.length ? `<div class="cc-tags"><span class="cc-lab warn">A desenvolver</span>${weak.map(l => `<span class="cc-chip warn">${esc(l)}</span>`).join("")}</div>` : ""}
        <button class="cc-rm" data-id="${i.id}">Remover</button>
      </div>`;
    }).join("");
  }

  // ---------- seleção / abas ----------
  function toggleSelect(id, forceAdd) {
    if (forceAdd) state.selected.add(id);
    else if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
    refresh();
  }
  const byId = id => ITEMS.find(i => i.id === id);

  function setView(v) {
    state.view = v;
    $$("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    $$(".view").forEach(el => el.classList.add("hidden"));
    $("#view-" + v).classList.remove("hidden");
    $("#filters").style.display = (v === "rotas" || v === "comparar" || v === "selecao") ? "none" : "";
    refresh();
  }
  $$("#tabs button").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));

  function refresh() {
    updateTabLinks(); renderKpis();
    const list = filtered();
    $("#f-count").textContent = `${list.length} de ${META.total} iniciativas`;
    if (state.view === "ranking") renderRanking(list);
    else if (state.view === "cards") renderCards(list);
    else if (state.view === "mapa") renderMapGeral(list);
    else if (state.view === "selecao") renderSelecao();
    else if (state.view === "analises") { const b = analiseBase(); renderAnBanner(b); renderAnalises(b.list); }
    else if (state.view === "rotas" && window.PTE_ROTAS) window.PTE_ROTAS.render(helpers());
    else if (state.view === "comparar") renderCompare();
  }
  function helpers() { return { ITEMS, META, byId, eixoColor, nameByCod, popupHtml, ufTokens, esc, trunc, orgSub, UF_NOME, selItems, fieldSel: () => ({ visita: new Set(SEL.visita), entrevista: new Set(SEL.entrevista) }) }; }

  function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function trunc(s, n) { s = s == null ? "" : String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  // trunca em limite de palavra (sem cortar no meio da palavra)
  function truncWords(s, n) {
    s = (s == null ? "" : String(s)).trim();
    if (s.length <= n) return s;
    const cut = s.slice(0, n), sp = cut.lastIndexOf(" ");
    return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:–-]+$/, "") + "…";
  }
  // forma normalizada (sem acento/parênteses/pontuação) para comparar nome × organização
  function normName(s) {
    return (s == null ? "" : String(s)).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  }
  // padroniza maiúsculas/minúsculas de textos "gritados" (CAIXA ALTA) com mais de
  // uma palavra; acrônimos de palavra única (UFAL, MMA, SEBRAE) ficam intactos
  const SMALL_WORDS = new Set(["de", "da", "do", "dos", "das", "e", "em", "no", "na", "nos", "nas", "a", "o", "ao", "à", "para", "com", "ou"]);
  function tidyOrg(s) {
    s = String(s);
    const letters = (s.match(/[a-zà-ÿA-ZÀ-Ÿ]/g) || []).length;
    const lowers = (s.match(/[a-zà-ÿ]/g) || []).length;
    if (letters > 3 && /\s/.test(s) && lowers / letters < 0.15) {
      s = s.toLowerCase().replace(/[a-zà-ÿ0-9]+/g, (w, off) =>
        (off > 0 && SMALL_WORDS.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1));
    }
    return s;
  }
  // organização a exibir como subtítulo — só quando difere de fato do nome da iniciativa
  function orgSub(i) {
    const o = (i.org == null ? "" : String(i.org)).trim();
    if (!o) return "";
    const a = normName(i.nome), b = normName(o);
    if (!b || a === b || a.includes(b) || b.includes(a)) return "";
    return tidyOrg(o);
  }

  renderKpis(); initFilters(); initCompare(); initSelecao();
  window.PTE_DASH = { refresh, helpers, state, filtered };
  setView("ranking");
})();
