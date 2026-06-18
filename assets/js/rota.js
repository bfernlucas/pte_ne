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

    // ordena núcleo (NN + 2opt) e ajusta para caber nos dias (descarta menor nota se estourar)
    let nodes = core.slice().sort((a, b) => b.pontuacao - a.pontuacao);
    let order = twoOpt(hub, nearestNeighbor(hub, nodes, params.prov), params.prov, true);
    let packed = packDays(hub, order, params.prov, params);
    const dropped = [];
    while (packed.overflow.length && nodes.length) {
      // remove a de menor nota entre as não visitadas (overflow)
      const ovIds = new Set(packed.overflow.map(n => n.id));
      let worst = null;
      nodes.forEach(n => { if (ovIds.has(n.id) && (!worst || n.pontuacao < worst.pontuacao)) worst = n; });
      if (!worst) worst = nodes[nodes.length - 1];
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
    return { hub, days: packed.days, back: packed.back, visited: packed.visited, dropped, totalKm, totalH, score };
  }

  // ---------- planeja as 2 missões ----------
  function planMissions(candidates, hubs, params) {
    params.prov = params.prov || makeProvider(params);
    const valid = candidates.filter(n => n.lat != null && n.lon != null && !n.fora_ne);
    const pre = valid.filter(n => n.preselecionada);
    const opt = valid.filter(n => !n.preselecionada);
    const k = Math.max(1, params.numMissoes || 2);
    let groups = kmeansK(pre, k);
    // missão "norte" primeiro (maior latitude = mais ao norte)
    groups.sort((a, b) => avgLat(b) - avgLat(a));
    // distribui opcionais para a missão de núcleo mais próximo
    const pools = groups.map(() => []);
    opt.forEach(n => {
      let bi = 0, bd = Infinity;
      groups.forEach((g, i) => { const d = minDist(n, g); if (d < bd) { bd = d; bi = i; } });
      pools[bi].push(n);
    });
    const missions = groups.map((g, i) => buildMission(g, pools[i], hubs, params));
    const preTotal = pre.length, preVis = missions.reduce((s, m) => s + m.visited.filter(n => n.preselecionada).length, 0);
    return { missions, params, cobertura: { preTotal, preVis } };
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

  const API = { haversineKm, makeProvider, kmeans2, kmeansK, nearestNeighbor, twoOpt, packDays, buildMission, planMissions, HUBS };
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  // ---------- navegador ----------
  if (typeof window === "undefined") return;

  let map, layer, lastList;
  const MCOLOR = ["#2563eb", "#ea580c", "#16a34a", "#7c3aed", "#dc2626", "#0891b2"];
  function ensureMap() {
    if (map) return;
    map = L.map("map-rotas").setView([-8.5, -39.5], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 18 }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }
  function controls(run) {
    const c = document.getElementById("rotas-controls");
    if (c.dataset.init) return;
    c.dataset.init = "1";
    c.innerHTML = `
      <div class="grp"><label>Nº de missões</label><input id="r-miss" type="range" min="1" max="6" step="1" value="3"><small id="r-miss-v">3</small></div>
      <div class="grp"><label>Horas/visita</label><input id="r-visita" type="range" min="1" max="4" step="0.5" value="2"><small id="r-visita-v">2 h</small></div>
      <div class="grp"><label>Direção máx/dia</label><input id="r-dir" type="range" min="6" max="10" step="1" value="8"><small id="r-dir-v">8 h</small></div>
      <div class="grp"><label>Dias/missão</label><input id="r-dias" type="range" min="3" max="7" step="1" value="5"><small id="r-dias-v">5 dias</small></div>
      <label class="chk"><input type="checkbox" id="r-opt" checked> incluir outras da base</label>
      <button class="btn" id="r-run">🧭 Otimizar rotas</button>
      <small style="color:#64748b">distâncias: Haversine×1,3 (aprox.) — trocável por tempo real de carro</small>`;
    const sync = () => {
      document.getElementById("r-miss-v").textContent = document.getElementById("r-miss").value;
      document.getElementById("r-visita-v").textContent = document.getElementById("r-visita").value + " h";
      document.getElementById("r-dir-v").textContent = document.getElementById("r-dir").value + " h";
      document.getElementById("r-dias-v").textContent = document.getElementById("r-dias").value + " dias";
    };
    ["r-miss", "r-visita", "r-dir", "r-dias"].forEach(id => document.getElementById(id).addEventListener("input", sync));
    document.getElementById("r-run").addEventListener("click", run);
    sync();
  }
  function readParams() {
    return {
      numMissoes: +document.getElementById("r-miss").value,
      dias: +document.getElementById("r-dias").value,
      jornadaH: 10,
      dirMaxH: +document.getElementById("r-dir").value,
      visitaH: +document.getElementById("r-visita").value,
      incluirOpcionais: document.getElementById("r-opt").checked,
      detour: 1.3, speedKmh: 65
    };
  }

  function render(list, H) {
    lastList = H.ITEMS; // rota opera sobre a base inteira (não os filtros do topo)
    ensureMap();
    controls(() => draw(H));
    setTimeout(() => map.invalidateSize(), 60);
    if (!layer.getLayers().length) draw(H);
  }

  function draw(H) {
    const params = readParams();
    const plan = planMissions(lastList, HUBS, params);
    layer.clearLayers();
    const bounds = [];
    const panel = document.getElementById("rotas-itinerary");
    const cob = plan.cobertura, full = cob.preVis >= cob.preTotal;
    let html = `<div class="summary" style="font-size:.9rem;margin-bottom:12px;padding:8px 10px;border-radius:8px;background:${full ? "#dcfce7" : "#fef3c7"};color:${full ? "#166534" : "#92400e"}">
      <b>Cobertura das pré-selecionadas: ${cob.preVis}/${cob.preTotal}</b>${full ? " ✓ todas cobertas" : ` — aumente o nº de missões para cobrir todas`}</div>`;
    plan.missions.forEach((m, mi) => {
      const color = MCOLOR[mi % MCOLOR.length];
      // polilinha hub -> visitados -> hub
      const pts = [[m.hub.lat, m.hub.lon], ...m.visited.map(n => [n.lat, n.lon]), [m.hub.lat, m.hub.lon]];
      pts.forEach(p => bounds.push(p));
      L.polyline(pts, { color, weight: 3, opacity: .75 }).addTo(layer);
      // hub
      L.marker([m.hub.lat, m.hub.lon], { icon: divIcon("✈", "#111") }).bindPopup(`<b>Hub ${mi + 1}:</b> ${m.hub.nome}/${m.hub.uf}`).addTo(layer);
      // paradas numeradas
      let n = 0;
      m.visited.forEach(node => {
        n++;
        L.marker([node.lat, node.lon], { icon: divIcon(String(n), color) })
          .bindPopup(`<b>Missão ${mi + 1} · parada ${n}</b><br>${H.esc(node.nome)}<br>📍 ${H.esc(node.municipio || "")}/${H.esc(node.estado || "")}<br>Nota: <b>${node.pontuacao}</b>${node.preselecionada ? " · ★" : ""}`)
          .addTo(layer);
      });
      // itinerário
      html += `<div class="mission"><h3 style="color:${color}">Missão ${mi + 1} — base ${m.hub.nome}/${m.hub.uf}</h3>
        <div class="summary">${m.visited.length} paradas · ${m.days.length} dia(s) · ${Math.round(m.totalKm)} km · ${m.totalH.toFixed(1)} h · nota somada <b>${m.score}</b></div>`;
      let counter = 0;
      m.days.forEach((d, di) => {
        html += `<div class="day"><div class="dh">Dia ${di + 1} — ${Math.round(d.km)} km · ${(d.driveH + d.visitH).toFixed(1)} h</div>`;
        d.stops.forEach(s => {
          counter++;
          html += `<div class="leg">↳ ${Math.round(s.legKm)} km (${s.legH.toFixed(1)} h)</div>
            <div class="stop"><span class="n">${counter}.</span> ${H.esc(s.node.nome)} <span style="color:#64748b">(${s.node.pontuacao}${s.node.preselecionada ? "★" : ""})</span></div>`;
        });
        html += `</div>`;
      });
      html += `<div class="leg">↳ retorno ao hub: ${Math.round(m.back.legKm)} km</div>`;
      if (m.dropped.length) html += `<div class="summary" style="color:#b45309">Fora do orçamento: ${m.dropped.map(n => H.esc(n.nome)).join("; ")}</div>`;
      html += `</div>`;
    });
    panel.innerHTML = html;
    if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
  }
  function divIcon(txt, color) {
    return L.divIcon({
      className: "", html: `<div style="background:${color};color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">${txt}</div>`,
      iconSize: [24, 24], iconAnchor: [12, 12]
    });
  }

  window.PTE_ROTAS = { render };
})();
