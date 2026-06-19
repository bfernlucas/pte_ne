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
  // escolhe, entre os locais alternativos de uma iniciativa, o mais próximo de "ref"
  function chooseLoc(n, ref) {
    if (!n.locais || !n.locais.length) return null;
    let best = n.locais[0], bd = Infinity;
    n.locais.forEach(L => { const d = haversineKm({ lat: L.lat, lon: L.lon }, ref); if (d < bd) { bd = d; best = L; } });
    return best;
  }
  function applyLoc(n, ref) {
    const L = chooseLoc(n, ref);
    if (L) { n.lat = L.lat; n.lon = L.lon; n.municipio = L.municipio; n.estado = L.uf; }
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
    // refina os multi-locais para o local mais próximo do hub desta incursão
    [...core, ...optionalPool].forEach(n => { if (n.locais && n.locais.length) applyLoc(n, hub); });

    // ordena o núcleo (NN + 2-opt) e ajusta para caber nos dias.
    // Critério de corte = menor DENSIDADE DE VALOR (nota ÷ tempo marginal):
    // remove primeiro a iniciativa que custa mais deslocamento por ponto de nota.
    let nodes = core.slice().sort((a, b) => b.pontuacao - a.pontuacao);
    let order = twoOpt(hub, nearestNeighbor(hub, nodes, params.prov), params.prov, true);
    let packed = packDays(hub, order, params.prov, params);
    const anchorSet = params.anchorSet || new Set();
    const dropped = [];
    while (packed.overflow.length && nodes.length > 1) {
      let worst = null, worstEff = Infinity;
      for (let idx = 0; idx < order.length; idx++) {
        const n = order[idx];
        if (anchorSet.has(n.id)) continue; // âncora nunca é descartada
        const a = idx === 0 ? hub : order[idx - 1];
        const b = idx === order.length - 1 ? hub : order[idx + 1];
        const marg = params.prov.h(a, n) + params.prov.h(n, b) - params.prov.h(a, b) + params.visitaH;
        const eff = (n.pontuacao || 1) / Math.max(0.1, marg); // pontos por hora marginal
        if (eff < worstEff) { worstEff = eff; worst = n; }
      }
      if (!worst) break; // só restam âncoras: não dá para encurtar mais
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
    // clona iniciativas com locais alternativos (a rota escolherá a coordenada ótima)
    const valid = candidates.filter(n => n.lat != null && n.lon != null && !n.fora_ne)
      .map(n => (n.locais && n.locais.length) ? Object.assign({}, n) : n);
    const anchorSet = new Set(params.anchors || []);
    params.anchorSet = anchorSet;
    const isAnc = n => anchorSet.has(n.id);
    const preAll = valid.filter(n => n.preselecionada);
    // núcleo = âncoras (obrigatórias) + visitas técnicas; se vazio, roteia todas as candidatas
    let core = valid.filter(n => n.preselecionada || isAnc(n));
    let opt = valid.filter(n => !n.preselecionada && !isAnc(n));
    if (core.length === 0) { core = valid; opt = []; }
    if (!params.incluirOpcionais) opt = [];
    // local provisório das iniciativas multi-locais = mais próximo do centroide do núcleo
    if (core.length) {
      const cx = core.reduce((s, n) => s + n.lat, 0) / core.length, cy = core.reduce((s, n) => s + n.lon, 0) / core.length;
      [...core, ...opt].forEach(n => { if (n.locais && n.locais.length) applyLoc(n, { lat: cx, lon: cy }); });
    }
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
    const visitedIds = new Set(missions.flatMap(m => m.visited.map(n => n.id)));
    const droppedPre = missions.flatMap(m => m.dropped.filter(n => n.preselecionada && !isAnc(n)));
    const ancAll = valid.filter(isAnc);
    const ancMissed = ancAll.filter(a => !visitedIds.has(a.id));
    const totalScore = missions.reduce((s, m) => s + m.score, 0);
    const totalKm = missions.reduce((s, m) => s + m.totalKm, 0);
    const totalDays = missions.reduce((s, m) => s + m.days.length, 0);
    return {
      missions, params,
      cobertura: {
        preTotal: preAll.length, preVis, candTotal: valid.length, candVis,
        optVis: candVis - preVis, totalScore, totalKm: Math.round(totalKm), totalDays, droppedPre,
        ancTotal: ancAll.length, ancVis: ancAll.length - ancMissed.length, ancMissed
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

  const API = { haversineKm, chooseLoc, makeProvider, makeMatrixProvider, kmeans2, kmeansK, nearestNeighbor, twoOpt, packDays, buildMission, planMissions, HUBS };
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  // ---------- navegador ----------
  if (typeof window === "undefined") return;

  let map, allLayer, routeLayer, lastH, mode = "all";
  const anchorIds = new Set();
  // seleção da aba "Seleção": visitas (presenciais → roteiro) e entrevistas (remotas → fora do roteiro)
  let curSel = { visita: new Set(), entrevista: new Set() };
  const isVis = id => curSel.visita.has(id), isEnt = id => curSel.entrevista.has(id);
  const MCOLOR = ["#1f4da1", "#f37520", "#43a047", "#7a3fb8", "#e0392b", "#0d9488"];
  function ensureMap() {
    if (map) return;
    map = L.map("map-rotas").setView([-8.6, -39.5], 5);
    if (window.PTE_MAP) PTE_MAP.setup(map, { base: "Ruas e estradas", boundaries: true, airports: true });
    else L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 20 }).addTo(map);
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
    const anchorCands = [...H.ITEMS].filter(i => i.lat != null && !i.fora_ne).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
    const anchorOpts = anchorCands.map(i => `<option value="${i.nome.replace(/"/g, "&quot;")}">${H.esc(i.municipio || "")}${i.estado ? " · " + H.esc(i.estado) : ""}</option>`).join("");
    c.innerHTML = `
      <div class="rc-group">
        <span class="rc-title">Parâmetros da rota</span>
        <div class="rc-field"><label>Nº de incursões</label><input id="r-miss" type="range" min="1" max="6" step="1" value="2"><span class="val" id="r-miss-v">2</span></div>
        <div class="rc-field"><label>Horas por visita</label><input id="r-visita" type="range" min="1" max="4" step="0.5" value="2"><span class="val" id="r-visita-v">2 h</span></div>
        <div class="rc-field"><label>Direção máx. por dia</label><input id="r-dir" type="range" min="6" max="10" step="1" value="8"><span class="val" id="r-dir-v">8 h</span></div>
        <div class="rc-field"><label>Dias por incursão (máx. 7 corridos)</label><input id="r-dias" type="range" min="3" max="7" step="1" value="5"><span class="val" id="r-dias-v">5 dias</span></div>
        <label class="rc-chk"><input type="checkbox" id="r-opt" checked> Incluir visitas in loco de outras iniciativas no caminho</label>
        <label class="rc-chk"><input type="checkbox" id="r-ctx" checked> Mostrar demais iniciativas (em cinza)</label>
      </div>
      <div class="rc-group">
        <span class="rc-title">Âncoras — obrigatórias na rota</span>
        <div class="rc-field rc-anchorfield">
          <input id="rf-anchor-add" type="text" list="rf-anchor-list" placeholder="Buscar ou escolher na lista..." autocomplete="off">
          <datalist id="rf-anchor-list">${anchorOpts}</datalist>
          <div class="rc-anchors" id="rf-anchors"></div></div>
      </div>
      <div class="rc-group">
        <span class="rc-title">Candidatas</span>
        <div class="rc-note">O roteiro é definido pelas <b>visitas técnicas</b> (mapa 1 da aba Seleção). As <b>entrevistas</b> (mapa 2) são remotas e não entram no roteiro. Marque a opção acima para encaixar visitas in loco de outras iniciativas que fiquem no caminho.</div>
      </div>
      <div class="rc-actions">
        <button class="btn" id="r-run">Otimizar rotas</button>
        <button class="btn secondary" id="r-clear">Ver todas as iniciativas</button>
        <button class="btn secondary" id="r-clear-anchors">Limpar âncoras</button>
        <span class="rc-status" id="r-status"></span>
      </div>`;
    const sync = () => {
      document.getElementById("r-miss-v").textContent = document.getElementById("r-miss").value;
      document.getElementById("r-visita-v").textContent = document.getElementById("r-visita").value + " h";
      document.getElementById("r-dir-v").textContent = document.getElementById("r-dir").value + " h";
      document.getElementById("r-dias-v").textContent = document.getElementById("r-dias").value + " dias";
    };
    ["r-miss", "r-visita", "r-dir", "r-dias"].forEach(id => document.getElementById(id).addEventListener("input", sync));
    document.getElementById("r-run").addEventListener("click", () => draw(H));
    document.getElementById("r-clear").addEventListener("click", () => showAll(H));
    document.getElementById("r-clear-anchors").addEventListener("click", () => clearAnchors());
    const addInput = document.getElementById("rf-anchor-add");
    const tryAddAnchor = () => {
      const val = addInput.value.trim();
      if (!val) return;
      const it = anchorCands.find(i => i.nome === val) || anchorCands.find(i => i.nome.toLowerCase() === val.toLowerCase());
      if (it) { anchorIds.add(it.id); addInput.value = ""; renderAnchors(H); syncAnchorMarkers(); }
    };
    addInput.addEventListener("input", tryAddAnchor);
    addInput.addEventListener("change", tryAddAnchor);
    renderAnchors(H);
    sync();
  }
  function syncAnchorMarkers() {
    if (!lastH) return;
    Object.keys(allMarkers).forEach(id => {
      const i = lastH.byId(+id);
      if (i) allMarkers[id].forEach(mk => { mk.setStyle(ovStyle(i)); mk.setPopupContent(overviewPopup(i, lastH, mk._ctx.locs, mk._ctx.li)); });
    });
  }
  function clearAnchors() {
    if (!anchorIds.size) return;
    anchorIds.clear();
    if (lastH) { renderAnchors(lastH); syncAnchorMarkers(); if (window.PTE_DASH) window.PTE_DASH.refresh(); }
  }
  function renderAnchors(H) {
    const box = document.getElementById("rf-anchors");
    if (!box) return;
    if (!anchorIds.size) { box.innerHTML = `<span class="rc-anchors-empty">Nenhuma âncora — a rota é definida só pela otimização.</span>`; return; }
    box.innerHTML = [...anchorIds].map(id => {
      const i = H.byId(id);
      return `<span class="achip">${H.esc(H.trunc(i.nome, 24))}<button data-id="${id}" title="remover âncora">×</button></span>`;
    }).join("");
    box.querySelectorAll(".achip button").forEach(b => b.addEventListener("click", () => { anchorIds.delete(+b.dataset.id); renderAnchors(H); }));
  }
  function readParams() {
    return {
      numMissoes: +document.getElementById("r-miss").value,
      dias: +document.getElementById("r-dias").value, jornadaH: 10,
      dirMaxH: +document.getElementById("r-dir").value,
      visitaH: +document.getElementById("r-visita").value,
      incluirOpcionais: document.getElementById("r-opt").checked,
      anchors: [...anchorIds],
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
    curSel = H.fieldSel ? H.fieldSel() : { visita: new Set(), entrevista: new Set() };
    ensureMap();
    buildControls(H);
    setTimeout(() => map.invalidateSize(), 60);
    if (mode === "all") showAll(H);
  }

  let allMarkers = {}, ovPmin = 10, ovPmax = 30;
  function ovStyle(i) {
    const anc = anchorIds.has(i.id), vis = isVis(i.id), ent = isEnt(i.id);
    return {
      radius: 3 + 6 * ((i.pontuacao - ovPmin) / Math.max(1, ovPmax - ovPmin)),
      fillColor: lastH.eixoColor(i.eixo_cod), fillOpacity: (vis || ent) ? .9 : (i.fora_ne ? .35 : .55),
      color: anc ? "#f6a609" : vis ? "#f37520" : ent ? "#16a34a" : "#fff",
      weight: anc ? 3 : vis ? 2.6 : ent ? 2 : 1
    };
  }
  function locsOf(i, H) {
    if (i.locais && i.locais.length) return i.locais;
    if (i.lat == null || i.lon == null) return [];
    return [{ lat: i.lat, lon: i.lon, municipio: i.municipio, uf: H.ufTokens(i.estado).join(", ") }];
  }
  function overviewPopup(i, H, locs, li) {
    const anc = anchorIds.has(i.id), multi = locs.length > 1, cur = locs[li] || {};
    const locLine = `<br><span class="pp-k">Local:</span> ${H.esc(cur.municipio || "Multiestadual")}${cur.uf ? "/" + H.esc(cur.uf) : ""}${multi ? ` (${li + 1} de ${locs.length} — a rota escolhe o melhor)` : ""}`;
    const sub = H.orgSub ? H.orgSub(i) : "";
    const status = isVis(i.id) ? " · visita técnica (presencial)" : isEnt(i.id) ? " · entrevista (remota)" : "";
    return `<span class="pp-h">${H.esc(i.nome)}</span>${sub ? H.esc(sub) + "<br>" : ""}
      <span class="pp-k">Eixo:</span> ${H.esc(i.eixo || "")}<br>
      <span class="pp-k">Nota:</span> <b>${i.pontuacao}</b>${status}${locLine}<br>
      <button class="pp-anchor ${anc ? "on" : ""}" onclick="window.PTE_ROTAS.toggleAnchor(${i.id})">${anc ? "Remover âncora" : "Fixar como âncora"}</button>`;
  }
  function showAll(H) {
    mode = "all"; lastH = H;
    routeLayer.clearLayers(); allLayer.clearLayers(); allMarkers = {};
    const ps = H.ITEMS.map(i => i.pontuacao || 0); ovPmin = Math.min(...ps); ovPmax = Math.max(...ps);
    const bounds = []; let mapped = 0;
    H.ITEMS.forEach(i => {
      const locs = locsOf(i, H);
      if (!locs.length) return;
      mapped++; allMarkers[i.id] = [];
      locs.forEach((loc, li) => {
        bounds.push([loc.lat, loc.lon]);
        const mk = L.circleMarker([loc.lat, loc.lon], ovStyle(i)).bindPopup(overviewPopup(i, H, locs, li)).addTo(allLayer);
        mk._ctx = { locs, li };
        allMarkers[i.id].push(mk);
      });
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
    const s = document.getElementById("r-status");
    if (s) s.textContent = `Mostrando todas as ${mapped} iniciativas. Destacadas: visitas técnicas (laranja) e entrevistas remotas (verde) da aba Seleção. Clique num ponto para fixá-lo como âncora; depois clique em “Otimizar rotas”.`;
    document.getElementById("rotas-itinerary").innerHTML =
      `<div class="cover empty">O roteiro é montado a partir das <b>visitas técnicas</b> escolhidas na aba <b>Seleção</b> (mapa 1). Defina os parâmetros e clique em <b>Otimizar rotas</b>. As entrevistas (mapa 2) são remotas e não entram no roteiro.</div>`;
  }
  function toggleAnchor(id) {
    id = +id;
    if (anchorIds.has(id)) anchorIds.delete(id); else anchorIds.add(id);
    if (lastH) renderAnchors(lastH);
    const mks = allMarkers[id];
    if (mks && lastH) { const i = lastH.byId(id); mks.forEach(mk => { mk.setStyle(ovStyle(i)); mk.setPopupContent(overviewPopup(i, lastH, mk._ctx.locs, mk._ctx.li)); }); }
    if (window.PTE_DASH && window.PTE_DASH.state && window.PTE_DASH.state.view === "cards") window.PTE_DASH.refresh();
  }
  function isAnchor(id) { return anchorIds.has(+id); }

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
    const params = readParams(); // params.incluirOpcionais = visitas in loco no caminho
    const statusEl = document.getElementById("r-status");
    // backbone do roteiro = visitas técnicas (presenciais) selecionadas no mapa 1 da aba Seleção
    let candidates = H.ITEMS.filter(i => isVis(i.id) && i.lat != null && !i.fora_ne)
      .map(i => Object.assign({}, i, { preselecionada: true, __tipo: "visita" }));
    const nVis = candidates.length;
    // opcionais "in loco no caminho" = demais iniciativas presenciais (não selecionadas); entrevistas (remotas) ficam de fora
    if (params.incluirOpcionais) {
      H.ITEMS.forEach(i => {
        if (i.lat != null && !i.fora_ne && !isVis(i.id) && !isEnt(i.id))
          candidates.push(Object.assign({}, i, { preselecionada: false, __tipo: "opcional" }));
      });
    }
    // âncoras entram sempre (presença forçada), mesmo fora da seleção
    const cidset = new Set(candidates.map(c => c.id));
    H.ITEMS.forEach(i => { if (anchorIds.has(i.id) && i.lat != null && !i.fora_ne && !cidset.has(i.id)) candidates.push(Object.assign({}, i, { preselecionada: true, __tipo: "visita" })); });
    const prov = makeProvider(params);
    const nEnt = curSel.entrevista.size;
    statusEl.textContent = `Roteiro a partir de ${nVis} visita(s) técnica(s).${nEnt ? ` ${nEnt} entrevista(s) remota(s) fora do roteiro.` : ""} Distâncias estimadas (linha reta × 1,3).`;
    params.prov = prov;
    const plan = planMissions(candidates, HUBS, params);
    routeLayer.clearLayers(); allLayer.clearLayers();
    const panel = document.getElementById("rotas-itinerary");
    const cob = plan.cobertura;
    if (cob.candTotal === 0) {
      panel.innerHTML = `<div class="cover warn">Nenhuma <b>visita técnica</b> selecionada. Vá à aba <b>Seleção</b> e escolha as iniciativas a visitar presencialmente no <b>mapa 1</b> (as entrevistas do mapa 2 são remotas e não entram no roteiro).</div>`;
      return;
    }
    const remoteNote = curSel.entrevista.size
      ? `<div class="cover ok" style="background:#eef2fb;color:var(--brand);border-color:#cdd7f0">${curSel.entrevista.size} entrevista(s) em profundidade serão <b>remotas</b> — conduzidas à distância, fora do roteiro de campo.</div>` : "";
    const bounds = [];
    const k = plan.missions.length;
    const effKm = cob.totalKm ? (cob.totalScore / cob.totalKm * 100) : 0;
    const pct = cob.preTotal ? Math.round(100 * cob.preVis / cob.preTotal) : 100;
    // ---- cartão de cenário ótimo ----
    const ancMetric = cob.ancTotal ? `<div class="opt-m"><b>${cob.ancVis}/${cob.ancTotal}</b><span>âncoras</span></div>` : "";
    const ancWarn = (cob.ancMissed && cob.ancMissed.length)
      ? `<div class="opt-warn">${cob.ancMissed.length} âncora(s) não couberam no orçamento: ${cob.ancMissed.map(n => H.esc(n.nome)).join("; ")}. Aumente os dias ou o nº de incursões.</div>` : "";
    const showCtx = document.getElementById("r-ctx") ? document.getElementById("r-ctx").checked : true;
    let html = remoteNote + (showCtx ? `<div class="ctx-legend"><span><i class="d-route"></i> paradas da rota</span><span><i class="d-pre"></i> visita técnica fora da rota</span><span><i class="d-other"></i> outras iniciativas</span></div>` : "");
    html += `<div class="opt-card">
      <div class="opt-title">Cenário ótimo · ${k} incursão(ões) de até ${params.dias} dias</div>
      <div class="opt-grid">
        <div class="opt-m"><b>${cob.preTotal ? cob.preVis + "/" + cob.preTotal : cob.candVis}</b><span>${cob.preTotal ? "visitas técnicas" : "iniciativas"}</span>${cob.preTotal ? `<div class="opt-bar"><i style="width:${pct}%"></i></div>` : ""}</div>
        ${ancMetric}
        <div class="opt-m"><b>+${cob.optVis}</b><span>in loco no caminho</span></div>
        <div class="opt-m"><b>${cob.totalScore}</b><span>valor (pts)</span></div>
        <div class="opt-m"><b>${cob.totalKm}</b><span>km</span></div>
        <div class="opt-m"><b>${cob.totalDays}</b><span>dias (total)</span></div>
        <div class="opt-m"><b>${effKm.toFixed(1)}</b><span>pts / 100 km</span></div>
      </div>
      ${ancWarn}
      <div class="opt-help">O roteiro cobre as <b>visitas técnicas</b> (presenciais) selecionadas; as <b>âncoras</b> são sempre incluídas e, em volta delas, o ótimo encaixa visitas de maior <b>densidade de valor</b> (nota por tempo) e as <b>in loco no caminho</b> de melhor custo-benefício.</div>
    </div>`;
    // ---- comparador de cenários (nº de incursões) ----
    const cmp = [];
    for (let kk = 1; kk <= 6; kk++) {
      const c = planMissions(candidates, HUBS, { ...params, numMissoes: kk }).cobertura;
      cmp.push({ k: kk, pre: c.preTotal ? `${c.preVis}/${c.preTotal}` : "—", opt: c.optVis, score: c.totalScore, km: c.totalKm, dias: c.totalDays });
    }
    html += `<div class="cmp-scen"><div class="cs-h">Comparar cenários — incursões de ${params.dias} dias</div>
      <table><thead><tr><th>Incursões</th><th>Visitas</th><th>No caminho</th><th>Valor</th><th>Km</th><th>Dias</th></tr></thead><tbody>
      ${cmp.map(r => `<tr class="${r.k === k ? "cur" : ""}"><td>${r.k}</td><td>${r.pre}</td><td>+${r.opt}</td><td>${r.score}</td><td>${r.km}</td><td>${r.dias}</td></tr>`).join("")}
      </tbody></table><div class="cs-note">Linha destacada = cenário atual (ajuste pelo controle “Nº de incursões”). Mais incursões cobrem mais visitas técnicas, com mais esforço.</div></div>`;
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
        const anc = anchorIds.has(node.id);
        L.marker([node.lat, node.lon], { icon: numIcon(n, color, !node.preselecionada, anc) })
          .bindPopup(`<span class="pp-h">Incursão ${mi + 1} · parada ${n}</span>${H.esc(node.nome)}<br><span class="pp-k">Local:</span> ${H.esc([node.municipio, uf].filter(Boolean).join(" / ") || "Multiestadual")}<br><span class="pp-k">Nota:</span> <b>${node.pontuacao}</b> · ${anc ? "âncora" : node.__tipo === "opcional" ? "in loco no caminho" : "visita técnica"}`)
          .addTo(routeLayer);
      });
      html += `<div class="incursao">
        <div class="ih" style="background:${color}"><span class="in">Incursão ${mi + 1}</span><span class="imoment">momento ${mi + 1}</span><span class="ihub">base: ${m.hub.nome} (${m.hub.uf})</span></div>
        <div class="isum"><span><b>${m.visited.length}</b> paradas · <b>${m.preCount}</b> visitas · ${m.optCount} no caminho</span><span><b>${m.days.length}</b> dias</span><span><b>${Math.round(m.totalKm)}</b> km</span><span><b>${m.score}</b> pts</span></div>`;
      let counter = 0;
      m.days.forEach((d, di) => {
        const jh = d.driveH + d.visitH, fill = Math.min(100, jh / params.jornadaH * 100);
        html += `<div class="day"><div class="dh">Dia ${di + 1}<span>${Math.round(d.km)} km · ${jh.toFixed(1)} h de jornada</span></div>
          <div class="dbar" title="${jh.toFixed(1)} h de ${params.jornadaH} h"><i style="width:${fill}%"></i></div>`;
        d.stops.forEach(s => {
          counter++;
          if (s.legKm > 1) html += `<div class="leg-line">deslocamento: ${Math.round(s.legKm)} km (${s.legH.toFixed(1)} h)</div>`;
          const anc = anchorIds.has(s.node.id), pre = s.node.preselecionada, opt = s.node.__tipo === "opcional";
          const tagCls = anc ? "tanc" : opt ? "topt" : "tpre";
          const tagTxt = anc ? "âncora" : opt ? "in loco no caminho" : "visita técnica";
          const nbg = (anc || pre) ? color : "#fff", nfg = (anc || pre) ? "#fff" : color, nbd = anc ? "#f6a609" : color;
          html += `<div class="stop ${(pre || anc) ? "pre" : "opt"}"><span class="n" style="background:${nbg};color:${nfg};border-color:${nbd}">${counter}</span><span class="nm">${H.esc(s.node.nome)} <span class="tag ${tagCls}">${tagTxt}</span> <span class="sc">${s.node.pontuacao} pts</span></span></div>`;
        });
        html += `</div>`;
      });
      html += `<div class="leg-line">retorno à base: ${Math.round(m.back.legKm)} km</div></div>`;
    });
    // ---- não cobertas (trade-off do ótimo) ----
    if (cob.droppedPre && cob.droppedPre.length) {
      const wp = cob.droppedPre.reduce((s, n) => s + (n.pontuacao || 0), 0);
      const lis = cob.droppedPre.slice().sort((a, b) => b.pontuacao - a.pontuacao).map(n => {
        const ufs = H.ufTokens(n.estado);
        const chips = ufs.length ? ufs.map(u => `<i>${u}</i>`).join("") : `<i class="na">—</i>`;
        return `<li title="${H.esc(n.eixo || "")}">
          <span class="u-dot" style="background:${H.eixoColor(n.eixo_cod)}"></span>
          <span class="u-name">${H.esc(n.nome)}</span>
          <span class="u-ufs">${chips}</span>
          <span class="u-score">${n.pontuacao}<small>pts</small></span></li>`;
      }).join("");
      html += `<div class="uncovered">
        <div class="uh"><span>Visitas técnicas fora destas ${k} incursões</span><span class="ucount">${cob.droppedPre.length}</span></div>
        <div class="usub">Somam <b>${wp} pts</b>. Para incluí-las, aumente o nº de incursões ou de dias — ou reserve-as para uma incursão futura.</div>
        <ul class="ulist">${lis}</ul></div>`;
    }
    // camada de contexto: demais iniciativas em escala de cinza (2 tons)
    if (showCtx) {
      const visitedIds = new Set(plan.missions.flatMap(m => m.visited.map(n => n.id)));
      H.ITEMS.forEach(i => {
        if (visitedIds.has(i.id)) return;
        const vis = isVis(i.id), ent = isEnt(i.id), sel = vis || ent;
        const label = vis ? "Visita técnica · fora da rota" : ent ? "Entrevista remota · fora do roteiro" : "Não selecionada";
        locsOf(i, H).forEach(loc => {
          L.circleMarker([loc.lat, loc.lon], {
            radius: sel ? 5.5 : 4, fillColor: sel ? "#7d8290" : "#c5c8d2",
            fillOpacity: sel ? .85 : .55, color: "#fff", weight: 1
          }).bindPopup(`<span class="pp-h">${H.esc(i.nome)}</span>${label}<br><span class="pp-k">Nota:</span> <b>${i.pontuacao}</b>`).addTo(allLayer);
        });
      });
    }
    panel.innerHTML = html;
    if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
  }
  function numIcon(n, color, opt, anchor) {
    if (anchor) {
      return L.divIcon({
        className: "", html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:3px solid #f6a609;box-shadow:0 1px 4px rgba(0,0,0,.5)">${n}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13]
      });
    }
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

  window.PTE_ROTAS = { render, toggleAnchor, isAnchor };
})();
