/* PTE2026 — Motor de rota (Team Orienteering, 2 missões de N dias).
   Funções puras testáveis no node; render() no navegador (Leaflet). */
(function () {
  "use strict";

  // ---------- geometria / provedor de distância (plugável) ----------
  function haversineKm(a, b) {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    const la1 = a.lat * toR, la2 = b.lat * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  // Provedor v1: Haversine × fator de desvio rodoviário / velocidade média.
  // Trocar por matriz real de carro mantendo a mesma interface {km, h}.
  function makeProvider(params) {
    const detour = params.detour || 1.3, speed = params.speedKmh || 65;
    return {
      km: (a, b) => haversineKm(a, b) * detour,
      h: (a, b) => (haversineKm(a, b) * detour) / speed
    };
  }
  // Provedor por matriz pré-buscada (ex.: OpenRouteService). durations[s] em
  // segundos, distances[s] em metros; cai no fallback p/ pares fora da matriz.
  function makeMatrixProvider(points, durations, distances, fallback) {
    const key = p => p.lat.toFixed(4) + "," + p.lon.toFixed(4);
    const idx = new Map(); points.forEach((p, i) => idx.set(key(p), i));
    const get = (a, b, mat) => {
      const i = idx.get(key(a)), j = idx.get(key(b));
      if (i == null || j == null || !mat || !mat[i] || mat[i][j] == null) return null;
      return mat[i][j];
    };
    return {
      h: (a, b) => { const s = get(a, b, durations); return s == null ? fallback.h(a, b) : s / 3600; },
      km: (a, b) => { const m = get(a, b, distances); return m == null ? fallback.km(a, b) : m / 1000; }
    };
  }

  // ---------- clusterização em 2 grupos (k-means simples) ----------
  function kmeans2(nodes) {
    if (nodes.length <= 1) return [nodes.slice(), []];
    // sementes = par mais distante
    let s1 = nodes[0], s2 = nodes[1], best = -1;
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const d = haversineKm(nodes[i], nodes[j]);
        if (d > best) { best = d; s1 = nodes[i]; s2 = nodes[j]; }
      }
    let c1 = { lat: s1.lat, lon: s1.lon }, c2 = { lat: s2.lat, lon: s2.lon };
    let g1 = [], g2 = [];
    for (let it = 0; it < 8; it++) {
      g1 = []; g2 = [];
      nodes.forEach(n => (haversineKm(n, c1) <= haversineKm(n, c2) ? g1 : g2).push(n));
      const cen = g => g.length ? { lat: g.reduce((s, n) => s + n.lat, 0) / g.length, lon: g.reduce((s, n) => s + n.lon, 0) / g.length } : null;
      const n1 = cen(g1), n2 = cen(g2);
      if (!n1 || !n2) break;
      if (n1.lat === c1.lat && n1.lon === c1.lon && n2.lat === c2.lat && n2.lon === c2.lon) break;
      c1 = n1; c2 = n2;
    }
    return [g1, g2];
  }

  // k-means para k grupos (init por ponto-mais-distante, determinístico)
  function kmeansK(nodes, k) {
    if (k <= 1) return [nodes.slice()];
    if (nodes.length <= k) return nodes.map(n => [n]).concat(Array.from({ length: k - nodes.length }, () => []));
    let seeds = [nodes.reduce((a, b) => (a.lat >= b.lat ? a : b))]; // começa pelo mais ao norte
    while (seeds.length < k) {
      let best = null, bd = -1;
      nodes.forEach(n => { const d = Math.min(...seeds.map(s => haversineKm(n, s))); if (d > bd) { bd = d; best = n; } });
      seeds.push(best);
    }
    let cents = seeds.map(s => ({ lat: s.lat, lon: s.lon })), groups;
    for (let it = 0; it < 12; it++) {
      groups = cents.map(() => []);
      nodes.forEach(n => {
        let bi = 0, bd = Infinity;
        cents.forEach((c, i) => { const d = haversineKm(n, c); if (d < bd) { bd = d; bi = i; } });
        groups[bi].push(n);
      });
      let moved = false;
      cents = cents.map((c, i) => {
        const g = groups[i]; if (!g.length) return c;
        const nc = { lat: g.reduce((s, n) => s + n.lat, 0) / g.length, lon: g.reduce((s, n) => s + n.lon, 0) / g.length };
        if (nc.lat !== c.lat || nc.lon !== c.lon) moved = true; return nc;
      });
      if (!moved) break;
    }
    return groups.filter(g => g.length);
  }

  // ---------- TSP: vizinho mais próximo + 2-opt (hub fixo nas pontas) ----------
  function nearestNeighbor(hub, nodes, prov) {
    const rem = nodes.slice(), order = [];
    let cur = hub;
    while (rem.length) {
      let bi = 0, bd = Infinity;
      rem.forEach((n, i) => { const d = prov.h(cur, n); if (d < bd) { bd = d; bi = i; } });
      cur = rem.splice(bi, 1)[0]; order.push(cur);
    }
    return order;
  }
  function routeTime(hub, order, prov, roundTrip) {
    let t = 0, prev = hub;
    order.forEach(n => { t += prov.h(prev, n); prev = n; });
    if (roundTrip) t += prov.h(prev, hub);
    return t;
  }
  function twoOpt(hub, order, prov, roundTrip) {
    let best = order.slice(), improved = true;
    const cost = o => routeTime(hub, o, prov, roundTrip);
    let bc = cost(best);
    while (improved) {
      improved = false;
      for (let i = 0; i < best.length - 1; i++)
        for (let k = i + 1; k < best.length; k++) {
          const cand = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
          const cc = cost(cand);
          if (cc + 1e-9 < bc) { best = cand; bc = cc; improved = true; }
        }
    }
    return best;
  }

  // ---------- empacotamento em dias ----------
  function packDays(hub, order, prov, params) {
    const { dias, jornadaH, dirMaxH, visitaH } = params;
    const days = [{ stops: [], driveH: 0, visitH: 0, km: 0 }];
    let prev = hub, di = 0, visited = [], overflow = [];
    const newDay = () => { di++; days.push({ stops: [], driveH: 0, visitH: 0, km: 0 }); };
    for (let idx = 0; idx < order.length; idx++) {
      const n = order[idx];
      const legH = prov.h(prev, n), legKm = prov.km(prev, n);
      // 1) consome o trecho de deslocamento, podendo abranger vários dias (pernoite no caminho)
      let remH = legH, fail = false;
      while (remH > 1e-6) {
        const d = days[di];
        const avail = Math.min(dirMaxH - d.driveH, jornadaH - (d.driveH + d.visitH));
        if (avail <= 0.01) { if (di + 1 >= dias) { fail = true; break; } newDay(); continue; }
        const use = Math.min(remH, avail);
        d.driveH += use; d.km += legKm * (use / legH); remH -= use;
        if (remH > 1e-6) { if (di + 1 >= dias) { fail = true; break; } newDay(); }
      }
      if (fail) { overflow = order.slice(idx); break; }
      // 2) realiza a visita (novo dia se não couber na jornada de hoje)
      let d = days[di];
      if (d.driveH + d.visitH + visitaH > jornadaH) {
        if (di + 1 >= dias) { overflow = order.slice(idx); break; }
        newDay(); d = days[di];
      }
      d.stops.push({ node: n, legH, legKm }); d.visitH += visitaH;
      visited.push(n); prev = n;
    }
    const back = { legH: prov.h(prev, hub), legKm: prov.km(prev, hub) };
    return { days, visited, overflow, back };
  }

  // ---------- monta uma missão (cluster + opcionais) ----------
  function buildMission(core, optionalPool, hubs, params) {
    // hub = capital mais próxima do centroide do cluster
    const cen = core.length ? { lat: core.reduce((s, n) => s + n.lat, 0) / core.length, lon: core.reduce((s, n) => s + n.lon, 0) / core.length } : hubs[0];
    let hub = hubs[0], hd = Infinity;
    hubs.forEach(h => { const d = haversineKm(h, cen); if (d < hd) { hd = d; hub = h; } });

    // ordena o núcleo (NN + 2-opt) e ajusta para caber nos dias.
    // Critério de corte = menor DENSIDADE DE VALOR (nota ÷ tempo marginal):
    // remove primeiro a iniciativa que custa mais deslocamento por ponto de nota.
    let nodes = core.slice().sort((a, b) => b.pontuacao - a.pontuacao);
    let order = twoOpt(hub, nearestNeighbor(hub, nodes, params.prov), params.prov, true);
    let packed = packDays(hub, order, params.prov, params);
    const dropped = [];
    while (packed.overflow.length && nodes.length > 1) {
      let worst = null, worstEff = Infinity;
      for (let idx = 0; idx < order.length; idx++) {
        const n = order[idx];
        const a = idx === 0 ? hub : order[idx - 1];
        const b = idx === order.length - 1 ? hub : order[idx + 1];
        const marg = params.prov.h(a, n) + params.prov.h(n, b) - params.prov.h(a, b) + params.visitaH;
        const eff = (n.pontuacao || 1) / Math.max(0.1, marg); // pontos por hora marginal
        if (eff < worstEff) { worstEff = eff; worst = n; }
      }
      if (!worst) break;
      dropped.push(worst);
      nodes = nodes.filter(n => n.id !== worst.id);
      order = twoOpt(hub, nearestNeighbor(hub, nodes, params.prov), params.prov, true);
      packed = packDays(hub, order, params.prov, params);
    }

    // inserção gulosa de opcionais (melhor custo-benefício nota/Δtempo) enquanto couber
    if (params.incluirOpcionais) {
      let curOrder = order.slice();
      const used = new Set(curOrder.map(n => n.id));
      let pool = optionalPool.filter(n => !used.has(n.id));
      let guard = 0;
      while (guard++ < 60) {
        let bestGain = -Infinity, bestNode = null, bestOrder = null;
        for (const cand of pool) {
          // melhor posição de inserção
          let bpos = -1, bdelta = Infinity;
          for (let p = 0; p <= curOrder.length; p++) {
            const a = p === 0 ? hub : curOrder[p - 1];
            const b = p === curOrder.length ? hub : curOrder[p];
            const delta = params.prov.h(a, cand) + params.prov.h(cand, b) - params.prov.h(a, b) + params.visitaH;
            if (delta < bdelta) { bdelta = delta; bpos = p; }
          }
          const trial = curOrder.slice(0, bpos).concat([cand], curOrder.slice(bpos));
          const tp = packDays(hub, trial, params.prov, params);
          if (tp.overflow.length) continue; // não cabe
          const gain = cand.pontuacao / Math.max(0.25, bdelta); // nota por hora extra
          if (gain > bestGain) { bestGain = gain; bestNode = cand; bestOrder = trial; }
        }
        if (!bestNode) break;
        curOrder = twoOpt(hub, bestOrder, params.prov, true);
        used.add(bestNode.id);
        pool = pool.filter(n => n.id !== bestNode.id);
      }
      order = curOrder;
      packed = packDays(hub, order, params.prov, params);
    }

    const totalKm = packed.days.reduce((s, d) => s + d.km, 0) + packed.back.legKm;
    const totalH = packed.days.reduce((s, d) => s + d.driveH + d.visitH, 0) + packed.back.legH;
    const score = packed.visited.reduce((s, n) => s + (n.pontuacao || 0), 0);
    const preCount = packed.visited.filter(n => n.preselecionada).length;
    return { hub, days: packed.days, back: packed.back, visited: packed.visited, dropped, totalKm, totalH, score, preCount, optCount: packed.visited.length - preCount };
  }

  // ---------- planeja as 2 missões ----------
  function planMissions(candidates, hubs, params) {
    params.prov = params.prov || makeProvider(params);
    const valid = candidates.filter(n => n.lat != null && n.lon != null && !n.fora_ne);
    const preAll = valid.filter(n => n.preselecionada);
    // núcleo das missões: pré-selecionadas; se o filtro não tiver nenhuma, roteia todas as candidatas
    let core = preAll, opt = valid.filter(n => !n.preselecionada);
    if (core.length === 0) { core = valid; opt = []; }
    if (!params.incluirOpcionais) opt = [];
    const k = Math.max(1, params.numMissoes || 2);
    let groups = kmeansK(core, k);
    groups.sort((a, b) => avgLat(b) - avgLat(a)); // missão mais ao norte primeiro
    const pools = groups.map(() => []);
    opt.forEach(n => {
      let bi = 0, bd = Infinity;
      groups.forEach((g, i) => { const d = minDist(n, g); if (d < bd) { bd = d; bi = i; } });
      pools[bi].push(n);
    });
    const missions = groups.map((g, i) => buildMission(g, pools[i], hubs, params));
    const candVis = missions.reduce((s, m) => s + m.visited.length, 0);
    const preVis = missions.reduce((s, m) => s + m.visited.filter(n => n.preselecionada).length, 0);
    const droppedPre = missions.flatMap(m => m.dropped.filter(n => n.preselecionada));
    const totalScore = missions.reduce((s, m) => s + m.score, 0);
    const totalKm = missions.reduce((s, m) => s + m.totalKm, 0);
    const totalDays = missions.reduce((s, m) => s + m.days.length, 0);
    return {
      missions, params,
      cobertura: {
        preTotal: preAll.length, preVis, candTotal: valid.length, candVis,
        optVis: candVis - preVis, totalScore, totalKm: Math.round(totalKm), totalDays, droppedPre
      }
    };
  }
  function avgLat(g) { return g.length ? g.reduce((s, n) => s + n.lat, 0) / g.length : -8; }
  function minDist(n, g) { return g.length ? Math.min(...g.map(m => haversineKm(n, m))) : Infinity; }

  const HUBS = [
    { nome: "São Luís", uf: "MA", lat: -2.5307, lon: -44.3068 },
    { nome: "Teresina", uf: "PI", lat: -5.0892, lon: -42.8019 },
    { nome: "Fortaleza", uf: "CE", lat: -3.7319, lon: -38.5267 },
    { nome: "Natal", uf: "RN", lat: -5.7945, lon: -35.2110 },
    { nome: "João Pessoa", uf: "PB", lat: -7.1195, lon: -34.8450 },
    { nome: "Recife", uf: "PE", lat: -8.0476, lon: -34.8770 },
    { nome: "Maceió", uf: "AL", lat: -9.6498, lon: -35.7089 },
    { nome: "Aracaju", uf: "SE", lat: -10.9472, lon: -37.0731 },
    { nome: "Salvador", uf: "BA", lat: -12.9714, lon: -38.5014 }
  ];

  const API = { haversineKm, makeProvider, makeMatrixProvider, kmeans2, kmeansK, nearestNeighbor, twoOpt, packDays, buildMission, planMissions, HUBS };
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  // ---------- navegador ----------
  if (typeof window === "undefined") return;

  let map, allLayer, routeLayer, lastH, mode = "all";
  const MCOLOR = ["#1f4da1", "#f37520", "#43a047", "#7a3fb8", "#e0392b", "#0d9488"];
  function ensureMap() {
    if (map) return;
    map = L.map("map-rotas").setView([-8.6, -39.5], 5);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 19 }).addTo(map);
    allLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
  }

  function distinct(items, key) {
    const s = new Set();
    items.forEach(i => { const v = i[key]; if (v != null && String(v).trim()) s.add(String(v).trim()); });
    return [...s].sort((a, b) => a.localeCompare(b, "pt"));
  }
  function biomasList(items) {
    const s = new Set();
    items.forEach(i => (i.biomas || "").split(/[,/;]+/).forEach(b => { b = b.trim(); if (b) s.add(b); }));
    return [...s].sort((a, b) => a.localeCompare(b, "pt"));
  }
  function optTags(arr) { return arr.map(v => `<option value="${String(v).replace(/"/g, "&quot;")}">${v}</option>`).join(""); }

  function buildControls(H) {
    const c = document.getElementById("rotas-controls");
    if (c.dataset.init) return;
    c.dataset.init = "1";
    const UFS = ["MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA"];
    c.innerHTML = `
      <div class="rc-group">
        <span class="rc-title">Candidatas — quais iniciativas podem entrar na rota</span>
        <div class="rc-field"><label>Eixo</label><select id="rf-eixo"><option value="">Todos os eixos</option>${H.META.eixos.map(e => `<option value="${e.cod}">${e.nome}</option>`).join("")}</select></div>
        <div class="rc-field"><label>Estado</label><select id="rf-uf"><option value="">Todos os estados</option>${UFS.map(u => `<option value="${u}">${H.UF_NOME[u]}</option>`).join("")}</select></div>
        <div class="rc-field"><label>Natureza jurídica</label><select id="rf-nat"><option value="">Todas</option>${optTags(distinct(H.ITEMS, "natureza"))}</select></div>
        <div class="rc-field"><label>Tipo de organização</label><select id="rf-tipo"><option value="">Todos</option>${optTags(distinct(H.ITEMS, "tipo_inst"))}</select></div>
        <div class="rc-field"><label>Setor</label><select id="rf-setor"><option value="">Todos</option>${optTags(distinct(H.ITEMS, "setor"))}</select></div>
        <div class="rc-field"><label>Bioma</label><select id="rf-bioma"><option value="">Todos</option>${optTags(biomasList(H.ITEMS))}</select></div>
      </div>
      <div class="rc-group">
        <span class="rc-title">Parâmetros da rota</span>
        <div class="rc-field"><label>Nº de incursões</label><input id="r-miss" type="range" min="1" max="6" step="1" value="2"><span class="val" id="r-miss-v">2</span></div>
        <div class="rc-field"><label>Horas por visita</label><input id="r-visita" type="range" min="1" max="4" step="0.5" value="2"><span class="val" id="r-visita-v">2 h</span></div>
        <div class="rc-field"><label>Direção máx. por dia</label><input id="r-dir" type="range" min="6" max="10" step="1" value="8"><span class="val" id="r-dir-v">8 h</span></div>
        <div class="rc-field"><label>Dias por missão</label><input id="r-dias" type="range" min="3" max="7" step="1" value="5"><span class="val" id="r-dias-v">5 dias</span></div>
        <label class="rc-chk"><input type="checkbox" id="r-opt" checked> Incluir outras iniciativas que estejam no caminho</label>
        <label class="rc-chk"><input type="checkbox" id="r-ors"> Usar tempo real de carro (OpenRouteService)</label>
        <div class="rc-field"><label>Chave OpenRouteService (opcional)</label><input id="r-orskey" type="password" placeholder="cole a chave da API"></div>
      </div>
      <div class="rc-actions">
        <button class="btn" id="r-run">Otimizar rotas</button>
        <button class="btn secondary" id="r-clear">Ver todas as iniciativas</button>
        <span class="rc-status" id="r-status"></span>
      </div>`;
    document.getElementById("r-orskey").value = (window.localStorage && localStorage.getItem("ors_key")) || "";
    const sync = () => {
      document.getElementById("r-miss-v").textContent = document.getElementById("r-miss").value;
      document.getElementById("r-visita-v").textContent = document.getElementById("r-visita").value + " h";
      document.getElementById("r-dir-v").textContent = document.getElementById("r-dir").value + " h";
      document.getElementById("r-dias-v").textContent = document.getElementById("r-dias").value + " dias";
    };
    ["r-miss", "r-visita", "r-dir", "r-dias"].forEach(id => document.getElementById(id).addEventListener("input", sync));
    document.getElementById("r-run").addEventListener("click", () => draw(H));
    document.getElementById("r-clear").addEventListener("click", () => showAll(H));
    sync();
  }
  function readParams() {
    return {
      numMissoes: +document.getElementById("r-miss").value,
      dias: +document.getElementById("r-dias").value, jornadaH: 10,
      dirMaxH: +document.getElementById("r-dir").value,
      visitaH: +document.getElementById("r-visita").value,
      incluirOpcionais: document.getElementById("r-opt").checked,
      detour: 1.3, speedKmh: 65
    };
  }
  function readFilters() {
    const v = id => document.getElementById(id).value;
    return { eixo: v("rf-eixo"), uf: v("rf-uf"), nat: v("rf-nat"), tipo: v("rf-tipo"), setor: v("rf-setor"), bioma: v("rf-bioma") };
  }
  function applyFilters(items, f, H) {
    return items.filter(i => {
      if (f.eixo && i.eixo_cod !== f.eixo) return false;
      if (f.uf && !H.ufTokens(i.estado).includes(f.uf)) return false;
      if (f.nat && i.natureza !== f.nat) return false;
      if (f.tipo && i.tipo_inst !== f.tipo) return false;
      if (f.setor && i.setor !== f.setor) return false;
      if (f.bioma && !(i.biomas || "").toLowerCase().includes(f.bioma.toLowerCase())) return false;
      return true;
    });
  }

  function render(H) {
    lastH = H;
    ensureMap();
    buildControls(H);
    setTimeout(() => map.invalidateSize(), 60);
    if (mode === "all") showAll(H);
  }

  function showAll(H) {
    mode = "all";
    routeLayer.clearLayers(); allLayer.clearLayers();
    const ps = H.ITEMS.map(i => i.pontuacao || 0), pmin = Math.min(...ps), pmax = Math.max(...ps);
    const bounds = [];
    let mapped = 0;
    H.ITEMS.forEach(i => {
      if (i.lat == null || i.lon == null) return;
      mapped++; bounds.push([i.lat, i.lon]);
      L.circleMarker([i.lat, i.lon], {
        radius: 5 + 11 * ((i.pontuacao - pmin) / Math.max(1, pmax - pmin)), fillColor: H.eixoColor(i.eixo_cod),
        fillOpacity: i.fora_ne ? .4 : .8, color: i.preselecionada ? "#f37520" : "#fff", weight: i.preselecionada ? 2.5 : 1
      }).bindPopup(H.popupHtml(i)).addTo(allLayer);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
    const s = document.getElementById("r-status");
    if (s) s.textContent = `Mostrando todas as ${mapped} iniciativas mapeadas. Ajuste os filtros e os parâmetros e clique em “Otimizar rotas”.`;
    document.getElementById("rotas-itinerary").innerHTML =
      `<div class="cover empty">Defina os filtros de candidatas e os parâmetros, e clique em <b>Otimizar rotas</b>. O roteiro dia a dia das missões aparece aqui.</div>`;
  }

  async function fetchORSMatrix(points, key) {
    const body = { locations: points.map(p => [p.lon, p.lat]), metrics: ["duration", "distance"], units: "m" };
    const res = await fetch("https://api.openrouteservice.org/v2/matrix/driving-car", {
      method: "POST", headers: { Authorization: key, "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    if (!j.durations) throw new Error("resposta sem matriz");
    return { durations: j.durations, distances: j.distances };
  }

  async function draw(H) {
    mode = "route";
    const params = readParams();
    const f = readFilters();
    const candidates = applyFilters(H.ITEMS, f, H);
    const statusEl = document.getElementById("r-status");
    let prov = makeProvider(params);
    const useORS = document.getElementById("r-ors").checked;
    const key = document.getElementById("r-orskey").value.trim();
    if (useORS && key) {
      statusEl.textContent = "Buscando tempos reais de carro (OpenRouteService)...";
      try {
        if (window.localStorage) localStorage.setItem("ors_key", key);
        const valid = candidates.filter(n => n.lat != null && n.lon != null && !n.fora_ne);
        const pre = valid.filter(n => n.preselecionada);
        const opt = valid.filter(n => !n.preselecionada).sort((a, b) => (b.pontuacao || 0) - (a.pontuacao || 0));
        const cap = Math.max(0, 50 - HUBS.length - pre.length); // limite gratuito ORS (~3500 rotas)
        const pts = [...HUBS, ...pre, ...opt.slice(0, cap)].map(p => ({ lat: p.lat, lon: p.lon }));
        const m = await fetchORSMatrix(pts, key);
        prov = makeMatrixProvider(pts, m.durations, m.distances, makeProvider(params));
        statusEl.textContent = "Distâncias por tempo real de carro (OpenRouteService).";
      } catch (e) {
        statusEl.textContent = "OpenRouteService indisponível (" + e.message + "). Usando distância aproximada.";
      }
    } else {
      statusEl.textContent = "Distâncias aproximadas (linha reta × 1,3). Marque a opção acima para usar o tempo real de carro.";
    }
    params.prov = prov;
    const plan = planMissions(candidates, HUBS, params);
    routeLayer.clearLayers(); allLayer.clearLayers();
    const panel = document.getElementById("rotas-itinerary");
    const cob = plan.cobertura;
    if (cob.candTotal === 0) {
      panel.innerHTML = `<div class="cover warn">Nenhuma iniciativa atende aos filtros escolhidos. Ajuste os filtros e tente novamente.</div>`;
      return;
    }
    const bounds = [];
    const k = plan.missions.length;
    const effKm = cob.totalKm ? (cob.totalScore / cob.totalKm * 100) : 0;
    const pct = cob.preTotal ? Math.round(100 * cob.preVis / cob.preTotal) : 100;
    // ---- cartão de cenário ótimo ----
    let html = `<div class="opt-card">
      <div class="opt-title">Cenário ótimo · ${k} incursão(ões) de ${params.dias} dias</div>
      <div class="opt-grid">
        <div class="opt-m"><b>${cob.preTotal ? cob.preVis + "/" + cob.preTotal : cob.candVis}</b><span>${cob.preTotal ? "pré-selecionadas" : "iniciativas"}</span>${cob.preTotal ? `<div class="opt-bar"><i style="width:${pct}%"></i></div>` : ""}</div>
        <div class="opt-m"><b>+${cob.optVis}</b><span>no caminho</span></div>
        <div class="opt-m"><b>${cob.totalScore}</b><span>valor (pts)</span></div>
        <div class="opt-m"><b>${cob.totalKm}</b><span>km</span></div>
        <div class="opt-m"><b>${cob.totalDays}</b><span>dias úteis</span></div>
        <div class="opt-m"><b>${effKm.toFixed(1)}</b><span>pts / 100 km</span></div>
      </div>
      <div class="opt-help">O ótimo prioriza as pré-selecionadas de maior <b>densidade de valor</b> (nota por tempo de deslocamento) e preenche o tempo restante com as iniciativas <b>no caminho</b> de melhor custo-benefício.</div>
    </div>`;
    // ---- cada incursão ----
    plan.missions.forEach((m, mi) => {
      const color = MCOLOR[mi % MCOLOR.length];
      const pts = [[m.hub.lat, m.hub.lon], ...m.visited.map(n => [n.lat, n.lon]), [m.hub.lat, m.hub.lon]];
      pts.forEach(p => bounds.push(p));
      L.polyline(pts, { color, weight: 3, opacity: .8 }).addTo(routeLayer);
      L.marker([m.hub.lat, m.hub.lon], { icon: hubIcon(color) })
        .bindPopup(`<span class="pp-h">Base da Incursão ${mi + 1}</span>${m.hub.nome} (${m.hub.uf}) — partida e retorno`).addTo(routeLayer);
      let n = 0;
      m.visited.forEach(node => {
        n++;
        const uf = H.ufTokens(node.estado).join(", ");
        L.marker([node.lat, node.lon], { icon: numIcon(n, color, !node.preselecionada) })
          .bindPopup(`<span class="pp-h">Incursão ${mi + 1} · parada ${n}</span>${H.esc(node.nome)}<br><span class="pp-k">Local:</span> ${H.esc([node.municipio, uf].filter(Boolean).join(" / ") || "Multiestadual")}<br><span class="pp-k">Nota:</span> <b>${node.pontuacao}</b> · ${node.preselecionada ? "pré-selecionada" : "no caminho"}`)
          .addTo(routeLayer);
      });
      html += `<div class="incursao">
        <div class="ih" style="background:${color}"><span class="in">Incursão ${mi + 1}</span><span class="imoment">momento ${mi + 1}</span><span class="ihub">base: ${m.hub.nome} (${m.hub.uf})</span></div>
        <div class="isum"><span><b>${m.visited.length}</b> paradas · <b>${m.preCount}</b> pré · ${m.optCount} no caminho</span><span><b>${m.days.length}</b> dias</span><span><b>${Math.round(m.totalKm)}</b> km</span><span><b>${m.score}</b> pts</span></div>`;
      let counter = 0;
      m.days.forEach((d, di) => {
        const jh = d.driveH + d.visitH, fill = Math.min(100, jh / params.jornadaH * 100);
        html += `<div class="day"><div class="dh">Dia ${di + 1}<span>${Math.round(d.km)} km · ${jh.toFixed(1)} h de jornada</span></div>
          <div class="dbar" title="${jh.toFixed(1)} h de ${params.jornadaH} h"><i style="width:${fill}%"></i></div>`;
        d.stops.forEach(s => {
          counter++;
          if (s.legKm > 1) html += `<div class="leg-line">deslocamento: ${Math.round(s.legKm)} km (${s.legH.toFixed(1)} h)</div>`;
          const pre = s.node.preselecionada;
          html += `<div class="stop ${pre ? "pre" : "opt"}"><span class="n" style="background:${pre ? color : "#fff"};color:${pre ? "#fff" : color};border-color:${color}">${counter}</span><span class="nm">${H.esc(s.node.nome)} <span class="tag ${pre ? "tpre" : "topt"}">${pre ? "pré-selecionada" : "no caminho"}</span> <span class="sc">${s.node.pontuacao} pts</span></span></div>`;
        });
        html += `</div>`;
      });
      html += `<div class="leg-line">retorno à base: ${Math.round(m.back.legKm)} km</div></div>`;
    });
    // ---- não cobertas (trade-off do ótimo) ----
    if (cob.droppedPre && cob.droppedPre.length) {
      const wp = cob.droppedPre.reduce((s, n) => s + (n.pontuacao || 0), 0);
      const lis = cob.droppedPre.slice().sort((a, b) => b.pontuacao - a.pontuacao)
        .map(n => `<li>${H.esc(n.nome)} <span>${n.pontuacao} pts · ${H.ufTokens(n.estado).join(", ") || "—"}</span></li>`).join("");
      html += `<div class="uncovered"><div class="uh">Pré-selecionadas fora destas ${k} incursões (${cob.droppedPre.length})</div>
        <div class="usub">Somam ${wp} pts. Para incluí-las, aumente o nº de incursões ou de dias — ou reserve-as para uma incursão futura.</div>
        <ul>${lis}</ul></div>`;
    }
    panel.innerHTML = html;
    if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
  }
  function numIcon(n, color, opt) {
    const bg = opt ? "#fff" : color, fg = opt ? color : "#fff";
    return L.divIcon({
      className: "", html: `<div style="background:${bg};color:${fg};width:${opt ? 19 : 24}px;height:${opt ? 19 : 24}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${opt ? 10 : 12}px;border:2px solid ${opt ? color : "#fff"};box-shadow:0 1px 3px rgba(0,0,0,.4)">${n}</div>`,
      iconSize: [24, 24], iconAnchor: [12, 12]
    });
  }
  function hubIcon(color) {
    return L.divIcon({
      className: "", html: `<div style="background:${color};width:16px;height:16px;border:3px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.45);transform:rotate(45deg)"></div>`,
      iconSize: [22, 22], iconAnchor: [11, 11]
    });
  }

  window.PTE_ROTAS = { render };
})();
