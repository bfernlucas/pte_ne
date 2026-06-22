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

  // ---------- empacotamento em dias (chegada por startHub, saída por endHub) ----------
  function packDays(startHub, order, prov, params, endHub) {
    endHub = endHub || startHub;
    const { dias, jornadaH, dirMaxH, visitaH } = params;
    const days = [{ stops: [], driveH: 0, visitH: 0, km: 0 }];
    let prev = startHub, di = 0, visited = [], overflow = [];
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
    const back = { legH: prov.h(prev, endHub), legKm: prov.km(prev, endHub) };
    return { days, visited, overflow, back };
  }

  // ---------- aeroportos do NE (candidatos a chegada/saída — capitais + regionais) ----------
  const AIRPORTS_HUB = [
    { nome: "São Luís", iata: "SLZ", uf: "MA", lat: -2.5853, lon: -44.2341 },
    { nome: "Imperatriz", iata: "IMP", uf: "MA", lat: -5.5313, lon: -47.4598 },
    { nome: "Teresina", iata: "THE", uf: "PI", lat: -5.0599, lon: -42.8235 },
    { nome: "Fortaleza", iata: "FOR", uf: "CE", lat: -3.7763, lon: -38.5326 },
    { nome: "Juazeiro do Norte", iata: "JDO", uf: "CE", lat: -7.2188, lon: -39.2701 },
    { nome: "Natal", iata: "NAT", uf: "RN", lat: -5.7681, lon: -35.3766 },
    { nome: "Mossoró", iata: "MVF", uf: "RN", lat: -5.2019, lon: -37.3643 },
    { nome: "João Pessoa", iata: "JPA", uf: "PB", lat: -7.1485, lon: -34.9506 },
    { nome: "Campina Grande", iata: "CPV", uf: "PB", lat: -7.2699, lon: -35.8964 },
    { nome: "Recife", iata: "REC", uf: "PE", lat: -8.1265, lon: -34.9236 },
    { nome: "Petrolina", iata: "PNZ", uf: "PE", lat: -9.3624, lon: -40.5690 },
    { nome: "Maceió", iata: "MCZ", uf: "AL", lat: -9.5108, lon: -35.7917 },
    { nome: "Aracaju", iata: "AJU", uf: "SE", lat: -10.9840, lon: -37.0703 },
    { nome: "Salvador", iata: "SSA", uf: "BA", lat: -12.9086, lon: -38.3225 },
    { nome: "Vitória da Conquista", iata: "VDC", uf: "BA", lat: -14.8628, lon: -40.8631 },
    { nome: "Ilhéus", iata: "IOS", uf: "BA", lat: -14.8160, lon: -39.0335 },
    { nome: "Porto Seguro", iata: "BPS", uf: "BA", lat: -16.4386, lon: -39.0808 },
  ];
  // bases das rotas de carro (restrição por UF) — não são aeroportos
  const CAR_BASE_G1 = { nome: "Tianguá", uf: "CE", lat: -3.7322, lon: -40.9919 }; // Serra da Ibiapaba (PI+CE)
  function nearestHub(pt, hubs) {
    let best = hubs[0], bd = Infinity;
    hubs.forEach(h => { const d = haversineKm(h, pt); if (d < bd) { bd = d; best = h; } });
    return best;
  }

  // ---------- TSP de caminho ABERTO (chegada e saída em aeroportos diferentes) ----------
  // Custo = acesso rodoviário ao aeroporto de chegada + trechos internos + acesso ao de saída.
  function openPathCost(order, prov, hubs) {
    if (!order.length) return 0;
    let c = prov.h(nearestHub(order[0], hubs), order[0]);
    for (let i = 0; i < order.length - 1; i++) c += prov.h(order[i], order[i + 1]);
    c += prov.h(order[order.length - 1], nearestHub(order[order.length - 1], hubs));
    return c;
  }
  function twoOptOpen(order, prov, hubs) {
    let best = order.slice(), improved = true, bc = openPathCost(best, prov, hubs);
    while (improved) {
      improved = false;
      for (let i = 0; i < best.length - 1; i++)
        for (let k = i + 1; k < best.length; k++) {
          const cand = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
          const cc = openPathCost(cand, prov, hubs);
          if (cc + 1e-9 < bc) { best = cand; bc = cc; improved = true; }
        }
    }
    return best;
  }
  // ordena o caminho aberto minimizando o custo total (acesso aeroportos + estrada); orienta norte→sul
  function openPathOptimize(nodes, prov, hubs) {
    if (nodes.length <= 1) return nodes.slice();
    let seeds = nodes;
    if (nodes.length > 8) { seeds = []; const step = nodes.length / 8; for (let i = 0; i < 8; i++) seeds.push(nodes[Math.floor(i * step)]); }
    let best = null, bc = Infinity;
    seeds.forEach(seed => {
      const rem = nodes.filter(n => n !== seed); let cur = seed, order = [seed];
      while (rem.length) { let bi = 0, bd = Infinity; rem.forEach((n, i) => { const d = prov.h(cur, n); if (d < bd) { bd = d; bi = i; } }); cur = rem.splice(bi, 1)[0]; order.push(cur); }
      order = twoOptOpen(order, prov, hubs);
      const c = openPathCost(order, prov, hubs);
      if (c < bc) { bc = c; best = order; }
    });
    if (best.length >= 2 && best[0].lat < best[best.length - 1].lat) best = best.slice().reverse();
    return best;
  }

  // ---------- prioridade composta: diversidade regional + interiorização + nº de iniciativas ----------
  const NE_UF = new Set(["MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA"]);
  // ---- UF a partir da COORDENADA geográfica (point-in-polygon nos contornos estaduais) ----
  // Corrige iniciativas multi-estado cujo campo "estado" lista vários UFs (ex.: Maceió
  // com estado "PI, PE, CE, ...": a rota deve usar a UF real do ponto = AL).
  function pointInRing(x, y, ring) { // x=lon, y=lat
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function pointInPoly(x, y, poly) {
    if (!pointInRing(x, y, poly[0])) return false;
    for (let k = 1; k < poly.length; k++) if (pointInRing(x, y, poly[k])) return false; // buraco
    return true;
  }
  function ufData() {
    if (typeof window !== "undefined" && window.PTE_UF_NE) return window.PTE_UF_NE;
    if (typeof global !== "undefined" && global.PTE_UF_NE) return global.PTE_UF_NE;
    return null;
  }
  const _ufCache = new Map();
  function ufByCoord(lat, lon) {
    const data = ufData();
    if (!data || lat == null || lon == null) return null;
    const key = lat.toFixed(4) + "," + lon.toFixed(4);
    if (_ufCache.has(key)) return _ufCache.get(key);
    let res = null;
    for (const f of data.features) {
      const g = f.geometry; if (!g) continue;
      const polys = g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates] : [];
      if (polys.some(p => pointInPoly(lon, lat, p))) { res = f.properties.sigla; break; }
    }
    _ufCache.set(key, res);
    return res;
  }
  function ufOf(n) {
    // 1º: UF real da coordenada no mapa; 2º (fallback): 1º token do campo "estado"
    const g = ufByCoord(n.lat, n.lon);
    if (g) return g;
    const s = n.estado != null ? String(n.estado) : (n.uf || "");
    const m = s.match(/\b[A-Z]{2}\b/); return m ? m[0] : "";
  }
  function interiorScore(n) { // 0 = litoral/capital ; 1 = interior do NE (≥400 km da capital mais próxima)
    if (!NE_UF.has(ufOf(n))) return 0; // fora do NE não recebe bônus de interiorização
    let d = Infinity; for (const h of HUBS) { const x = haversineKm(h, n); if (x < d) d = x; }
    return Math.min(d, 400) / 400;
  }
  function hasNELoc(n) { // a iniciativa pode ser visitada presencialmente no NE?
    if (n.locais && n.locais.length) return n.locais.some(l => NE_UF.has(l.uf));
    return NE_UF.has(ufOf(n));
  }
  // valor de prioridade (base recompensa o nº; +diversidade de estado do NE; +interior; nota = ajuste fino)
  function nodeValue(n, coveredUFs) {
    const u = ufOf(n);
    const div = (coveredUFs && NE_UF.has(u) && !coveredUFs.has(u)) ? 1 : 0;
    return 1 + 1.2 * div + 0.8 * interiorScore(n) + 0.4 * ((n.pontuacao || 0) / 30);
  }

  // ---------- monta uma missão (rota aberta: chegada e saída em aeroportos distintos) ----------
  function buildMission(core, optionalPool, hubs, params) {
    const prov = params.prov;
    const airports = params.airports || hubs; // candidatos a aeroporto de chegada/saída
    // RESTRIÇÃO: o aeroporto só pode ser usado na CHEGADA e na SAÍDA da incursão.
    // As paradas (core/optionalPool) são exclusivamente iniciativas; nenhum aeroporto
    // entra como parada intermediária, e entre as paradas o trajeto é sempre por estrada.
    const isAirportPt = n => airports.some(a => Math.abs(a.lat - n.lat) < 1e-6 && Math.abs(a.lon - n.lon) < 1e-6);
    core = core.filter(n => !isAirportPt(n));
    optionalPool = optionalPool.filter(n => !isAirportPt(n));
    // refina os multi-locais para o local mais próximo do aeroporto central do cluster
    const cen = core.length ? { lat: core.reduce((s, n) => s + n.lat, 0) / core.length, lon: core.reduce((s, n) => s + n.lon, 0) / core.length } : airports[0];
    const ref = nearestHub(cen, airports);
    [...core, ...optionalPool].forEach(n => { if (n.locais && n.locais.length) applyLoc(n, ref); });
    const ends = order => ({
      entry: order.length ? nearestHub(order[0], airports) : ref,
      exit: order.length ? nearestHub(order[order.length - 1], airports) : ref
    });

    // ordena o núcleo como caminho aberto (otimiza acesso aos aeroportos + estrada) e
    // ajusta para caber nos dias. Corte = menor PRIORIDADE por tempo marginal (diversidade
    // regional, interiorização e nº de iniciativas; nota é ajuste fino).
    let nodes = core.slice();
    let order = openPathOptimize(nodes, prov, airports);
    let { entry, exit } = ends(order);
    let packed = packDays(entry, order, prov, params, exit);
    const anchorSet = params.anchorSet || new Set();
    const dropped = [];
    while (packed.overflow.length && nodes.length > 1) {
      const stCount = {}; order.forEach(n => { const u = ufOf(n); if (u) stCount[u] = (stCount[u] || 0) + 1; });
      let worst = null, worstEff = Infinity;
      for (let idx = 0; idx < order.length; idx++) {
        const n = order[idx];
        if (anchorSet.has(n.id)) continue; // âncora nunca é descartada
        const a = idx === 0 ? entry : order[idx - 1];
        const b = idx === order.length - 1 ? exit : order[idx + 1];
        const marg = prov.h(a, n) + prov.h(n, b) - prov.h(a, b) + params.visitaH;
        const uu = ufOf(n);
        const uniqueUF = (NE_UF.has(uu) && stCount[uu] === 1) ? 1 : 0; // protege o único representante de um estado do NE
        const v = 1 + 1.2 * uniqueUF + 0.8 * interiorScore(n) + 0.4 * ((n.pontuacao || 0) / 30);
        const eff = v / Math.max(0.1, marg); // prioridade por hora marginal
        if (eff < worstEff) { worstEff = eff; worst = n; }
      }
      if (!worst) break; // só restam âncoras: não dá para encurtar mais
      dropped.push(worst);
      nodes = nodes.filter(n => n.id !== worst.id);
      order = openPathOptimize(nodes, prov, airports);
      ({ entry, exit } = ends(order));
      packed = packDays(entry, order, prov, params, exit);
    }

    // inserção gulosa de opcionais: prioriza novos estados (diversidade), interior e
    // inserções baratas (mais iniciativas), enquanto couber no orçamento de dias
    if (params.incluirOpcionais) {
      let curOrder = order.slice();
      const used = new Set(curOrder.map(n => n.id));
      let pool = optionalPool.filter(n => !used.has(n.id));
      let guard = 0;
      while (guard++ < 80) {
        const en = ends(curOrder);
        const covered = new Set(); curOrder.forEach(n => { const u = ufOf(n); if (u) covered.add(u); });
        let bestGain = -Infinity, bestNode = null, bestOrder = null;
        for (const cand of pool) {
          // melhor posição de inserção (extremidades usam os aeroportos de chegada/saída)
          let bpos = -1, bdelta = Infinity;
          for (let p = 0; p <= curOrder.length; p++) {
            const a = p === 0 ? en.entry : curOrder[p - 1];
            const b = p === curOrder.length ? en.exit : curOrder[p];
            const delta = prov.h(a, cand) + prov.h(cand, b) - prov.h(a, b) + params.visitaH;
            if (delta < bdelta) { bdelta = delta; bpos = p; }
          }
          const trial = curOrder.slice(0, bpos).concat([cand], curOrder.slice(bpos));
          const te = ends(trial);
          const tp = packDays(te.entry, trial, prov, params, te.exit);
          if (tp.overflow.length) continue; // não cabe
          const gain = nodeValue(cand, covered) / Math.max(0.25, bdelta); // prioridade por hora extra
          if (gain > bestGain) { bestGain = gain; bestNode = cand; bestOrder = trial; }
        }
        if (!bestNode) break;
        curOrder = openPathOptimize(bestOrder, prov, airports);
        used.add(bestNode.id);
        pool = pool.filter(n => n.id !== bestNode.id);
      }
      order = curOrder;
      ({ entry, exit } = ends(order));
      packed = packDays(entry, order, prov, params, exit);
    }

    const totalKm = packed.days.reduce((s, d) => s + d.km, 0) + packed.back.legKm;
    const totalH = packed.days.reduce((s, d) => s + d.driveH + d.visitH, 0) + packed.back.legH;
    const score = packed.visited.reduce((s, n) => s + (n.pontuacao || 0), 0);
    const preCount = packed.visited.filter(n => n.preselecionada).length;
    return { entryHub: entry, exitHub: exit, hub: entry, carOnly: !!params.carOnly, regionLabel: params.regionLabel || "", days: packed.days, back: packed.back, visited: packed.visited, dropped, totalKm, totalH, score, preCount, optCount: packed.visited.length - preCount };
  }

  // ---------- planeja as 2 missões ----------
  function planMissions(candidates, hubs, params) {
    params.prov = params.prov || makeProvider(params);
    params.airports = params.airports || AIRPORTS_HUB; // chegada/saída entre os aeroportos do NE
    // clona iniciativas com locais alternativos (a rota escolherá a coordenada ótima)
    const valid = candidates.filter(n => n.lat != null && n.lon != null && !n.fora_ne)
      .map(n => (n.locais && n.locais.length) ? Object.assign({}, n) : n);
    const anchorSet = new Set(params.anchors || []);
    params.anchorSet = anchorSet;
    const isAnc = n => anchorSet.has(n.id);
    const preAll = valid.filter(n => n.preselecionada);
    // núcleo = âncoras (obrigatórias) + visitas técnicas; se vazio, roteia todas as candidatas
    let core = valid.filter(n => n.preselecionada || isAnc(n));
    let opt = valid.filter(n => !n.preselecionada && !isAnc(n) && hasNELoc(n)); // opcionais "no caminho" só dentro do NE
    if (core.length === 0) { core = valid; opt = []; }
    if (!params.incluirOpcionais) opt = [];
    // local provisório das iniciativas multi-locais = mais próximo do centroide do núcleo
    if (core.length) {
      const cx = core.reduce((s, n) => s + n.lat, 0) / core.length, cy = core.reduce((s, n) => s + n.lon, 0) / core.length;
      [...core, ...opt].forEach(n => { if (n.locais && n.locais.length) applyLoc(n, { lat: cx, lon: cy }); });
    }
    const distrib = (items, gs) => { const p = gs.map(() => []); items.forEach(n => { let bi = 0, bd = Infinity; gs.forEach((g, i) => { const d = minDist(n, g); if (d < bd) { bd = d; bi = i; } }); p[bi].push(n); }); return p; };
    let missions, restUncovered = [];
    if (params.ufRestrict) {
      // duas incursões obrigatórias de CARRO: Rota 1 = PI+CE (base Fortaleza); Rota 2 = RN+PB (base Natal)
      const G1 = new Set(["PI", "CE"]), G2 = new Set(["RN", "PB"]);
      const homeG1 = CAR_BASE_G1; // Rota 1 (PI+CE): sai e chega por Tianguá (CE)
      const homeG2 = AIRPORTS_HUB.find(a => a.iata === "NAT") || hubs[3];
      const locInUFs = (n, set) => {
        if (n.locais && n.locais.length) { const l = n.locais.find(x => set.has(x.uf)); return l || null; }
        return set.has(ufOf(n)) ? { lat: n.lat, lon: n.lon, uf: ufOf(n), municipio: n.municipio } : null;
      };
      const snap = (n, l) => { n.lat = l.lat; n.lon = l.lon; n.municipio = l.municipio; n.estado = l.uf; };
      const split = arr => { const g1 = [], g2 = [], rest = []; arr.forEach(n => { let l = locInUFs(n, G1); if (l) { snap(n, l); g1.push(n); return; } l = locInUFs(n, G2); if (l) { snap(n, l); g2.push(n); return; } rest.push(n); }); return { g1, g2, rest }; };
      const C = split(core), O = split(opt);
      if (C.rest.length) { const cx = C.rest.reduce((s, n) => s + n.lat, 0) / C.rest.length, cy = C.rest.reduce((s, n) => s + n.lon, 0) / C.rest.length; [...C.rest, ...O.rest].forEach(n => { if (n.locais && n.locais.length) applyLoc(n, { lat: cx, lon: cy }); }); }
      missions = [];
      restUncovered = [];
      const carP = (home, label) => Object.assign({}, params, { airports: [home], carOnly: true, regionLabel: label });
      if (C.g1.length) missions.push(buildMission(C.g1, O.g1, hubs, carP(homeG1, "Rota PI + CE · carro")));
      if (C.g2.length) missions.push(buildMission(C.g2, O.g2, hubs, carP(homeG2, "Rota RN + PB · carro")));
      // o nº de incursões é o TOTAL; as 2 primeiras são as rotas de carro (PI+CE e RN+PB).
      // as livres = nº de incursões − 2 (não força extra). Sem rotas livres, os demais estados ficam fora.
      const freeCount = Math.max(0, (params.numMissoes || 2) - 2);
      if (freeCount > 0 && C.rest.length) {
        let fg = kmeansK(C.rest, freeCount); fg.sort((a, b) => avgLat(b) - avgLat(a));
        const fpools = distrib(O.rest, fg);
        const freeP = Object.assign({}, params, { airports: AIRPORTS_HUB, carOnly: false, regionLabel: "" });
        fg.forEach((g, i) => missions.push(buildMission(g, fpools[i], hubs, freeP)));
      } else {
        restUncovered = C.rest.slice(); // visitas de outros estados ficam fora (aumente o nº de incursões)
      }
    } else {
      const k = Math.max(1, params.numMissoes || 2);
      let groups = kmeansK(core, k);
      groups.sort((a, b) => avgLat(b) - avgLat(a)); // missão mais ao norte primeiro
      const pools = distrib(opt, groups);
      missions = groups.map((g, i) => buildMission(g, pools[i], hubs, params));
    }
    const candVis = missions.reduce((s, m) => s + m.visited.length, 0);
    const preVis = missions.reduce((s, m) => s + m.visited.filter(n => n.preselecionada).length, 0);
    const visitedIds = new Set(missions.flatMap(m => m.visited.map(n => n.id)));
    const droppedPre = missions.flatMap(m => m.dropped.filter(n => n.preselecionada && !isAnc(n)))
      .concat(restUncovered.filter(n => n.preselecionada && !isAnc(n)));
    const ancAll = valid.filter(isAnc);
    const ancMissed = ancAll.filter(a => !visitedIds.has(a.id));
    const totalScore = missions.reduce((s, m) => s + m.score, 0);
    const totalKm = missions.reduce((s, m) => s + m.totalKm, 0);
    const totalDays = missions.reduce((s, m) => s + m.days.length, 0);
    const ufsCob = new Set(); missions.forEach(m => m.visited.forEach(n => { const u = ufOf(n); if (u && NE_UF.has(u)) ufsCob.add(u); }));
    const interiorVis = missions.reduce((s, m) => s + m.visited.filter(n => interiorScore(n) >= 0.4).length, 0);
    return {
      missions, params,
      cobertura: {
        preTotal: preAll.length, preVis, candTotal: valid.length, candVis,
        optVis: candVis - preVis, totalScore, totalKm: Math.round(totalKm), totalDays, droppedPre,
        ancTotal: ancAll.length, ancVis: ancAll.length - ancMissed.length, ancMissed,
        ufsCobertas: ufsCob.size, interiorVis, candVisTotal: candVis, nMiss: missions.length
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

  const API = { haversineKm, chooseLoc, makeProvider, makeMatrixProvider, kmeans2, kmeansK, nearestNeighbor, twoOpt, twoOptOpen, openPathOptimize, openPathCost, nearestHub, packDays, buildMission, planMissions, HUBS, AIRPORTS_HUB };
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  // ---------- navegador ----------
  if (typeof window === "undefined") return;

  let map, allLayer, routeLayer, lastH, mode = "all";
  const anchorIds = new Set();
  // seleção da aba "Seleção": visitas (presenciais → roteiro) e entrevistas (remotas → fora do roteiro)
  let curSel = { visita: new Set(), entrevista: new Set() };
  const isVis = id => curSel.visita.has(id), isEnt = id => curSel.entrevista.has(id);
  const COR_VISITA = "#d4af37"; // arco dourado: pré-selecionada para visita
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
    const anchorOpts = anchorCands.map(i => { const l = H.ufLabel ? H.ufLabel(i) : (i.estado || ""); return `<option value="${i.nome.replace(/"/g, "&quot;")}">${H.esc(i.municipio || "")}${l && l !== "—" ? " · " + H.esc(l) : ""}</option>`; }).join("");
    c.innerHTML = `
      <div class="rc-group rc-ufr">
        <label class="rc-switch"><input type="checkbox" id="r-ufrestrict"> <b>Ativar restrição por UF</b></label>
        <div class="rc-note">Garante <b>2 rotas de carro</b> fixas: <b>Rota 1 — só Piauí + Ceará</b> (base Tianguá/CE) e <b>Rota 2 — só RN + Paraíba</b> (base Natal). O <b>Nº de incursões é o total</b>: com <b>2</b>, saem apenas essas duas rotas; aumente para criar rotas livres (carro/avião) que cobrem os <b>demais estados</b>. As visitas de outros estados sem rota livre aparecem em “fora destas incursões”.</div>
      </div>
      <div class="rc-group">
        <span class="rc-title">Parâmetros da rota</span>
        <div class="rc-field"><label>Nº de incursões</label><input id="r-miss" type="range" min="1" max="6" step="1" value="2"><span class="val" id="r-miss-v">2</span></div>
        <div class="rc-field"><label>Horas por visita</label><input id="r-visita" type="range" min="1" max="4" step="0.5" value="2"><span class="val" id="r-visita-v">2 h</span></div>
        <div class="rc-field"><label>Direção máx. por dia</label><input id="r-dir" type="range" min="6" max="10" step="1" value="8"><span class="val" id="r-dir-v">8 h</span></div>
        <div class="rc-field"><label>Dias por incursão (máx. 7 corridos)</label><input id="r-dias" type="range" min="3" max="7" step="1" value="5"><span class="val" id="r-dias-v">5 dias</span></div>
        <label class="rc-chk"><input type="checkbox" id="r-road" checked> Usar distâncias reais por estrada (recomendado)</label>
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
      <div class="rc-group">
        <span class="rc-title">Distâncias / roteamento</span>
        <div class="rc-note">Com a opção <b>distâncias reais por estrada</b> ligada, o trajeto usa a <b>malha viária real</b> (tempo e km de carro). Padrão: <b>OSRM público</b> (sem chave). Para usar o <b>OpenRouteService</b>, cole sua chave abaixo — fica salva só neste navegador, nunca vai para o repositório. Sem internet ou conjunto muito grande, cai automaticamente para a estimativa (linha reta × 1,3).</div>
        <input id="rf-ors-key" class="rc-orskey" type="text" placeholder="Chave OpenRouteService (opcional)" autocomplete="off">
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
    const orsInput = document.getElementById("rf-ors-key");
    if (orsInput) {
      try { orsInput.value = localStorage.getItem("pte_ors_key") || ""; } catch (e) {}
      orsInput.addEventListener("input", () => {
        const v = orsInput.value.trim();
        try { v ? localStorage.setItem("pte_ors_key", v) : localStorage.removeItem("pte_ors_key"); } catch (e) {}
      });
    }
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
      ufRestrict: document.getElementById("r-ufrestrict") ? document.getElementById("r-ufrestrict").checked : false,
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
      color: anc ? "#f6a609" : vis ? COR_VISITA : ent ? "#16a34a" : "#fff",
      weight: anc ? 3 : vis ? 2.6 : ent ? 2 : 1
    };
  }
  function locsOf(i, H) {
    if (i.locais && i.locais.length) return i.locais;
    if (i.lat == null || i.lon == null) return [];
    const ufl = H.ufLabel ? H.ufLabel(i) : H.ufTokens(i.estado).join(", ");
    return [{ lat: i.lat, lon: i.lon, municipio: i.municipio, uf: ufl === "—" ? "" : ufl }];
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
    if (s) s.textContent = `Mostrando todas as ${mapped} iniciativas. Destacadas: visitas técnicas (dourado) e entrevistas remotas (verde) da aba Seleção. Clique num ponto para fixá-lo como âncora; depois clique em “Otimizar rotas”.`;
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

  // ---------- roteamento real (malha viária) ----------
  async function fetchWithTimeout(url, opt, ms) {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), ms || 15000);
    try { return await fetch(url, Object.assign({ signal: ctrl.signal }, opt || {})); }
    finally { clearTimeout(to); }
  }
  async function fetchORSMatrix(points, key) {
    const body = { locations: points.map(p => [p.lon, p.lat]), metrics: ["duration", "distance"], units: "m" };
    const res = await fetchWithTimeout("https://api.openrouteservice.org/v2/matrix/driving-car", {
      method: "POST", headers: { Authorization: key, "Content-Type": "application/json" }, body: JSON.stringify(body)
    }, 20000);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    if (!j.durations) throw new Error("resposta sem matriz");
    return { durations: j.durations, distances: j.distances, source: "OpenRouteService" };
  }
  async function fetchOSRMMatrix(points) {
    const coords = points.map(p => `${p.lon},${p.lat}`).join(";");
    const url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration,distance`;
    const res = await fetchWithTimeout(url, {}, 18000);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    if (j.code !== "Ok" || !j.durations) throw new Error("resposta inválida do OSRM");
    return { durations: j.durations, distances: j.distances, source: "OSRM (malha pública)" };
  }
  async function fetchRoadMatrix(points) {
    let key = ""; try { key = (localStorage.getItem("pte_ors_key") || "").trim(); } catch (e) {}
    return key ? fetchORSMatrix(points, key) : fetchOSRMMatrix(points);
  }
  // limite de pontos por provedor (ORS grátis ≈ 50; OSRM público ≈ 100)
  function roadMax() {
    let key = ""; try { key = (localStorage.getItem("pte_ors_key") || "").trim(); } catch (e) {}
    return key ? 50 : 95;
  }
  // conjunto de pontos para a matriz = todas as coordenadas das candidatas (inclui multi-locais) + aeroportos
  function roadPoints(cands) {
    const seen = new Set(), pts = [];
    const add = (lat, lon) => { if (lat == null || lon == null) return; const k = lat.toFixed(4) + "," + lon.toFixed(4); if (!seen.has(k)) { seen.add(k); pts.push({ lat, lon }); } };
    cands.forEach(c => { if (c.locais && c.locais.length) c.locais.forEach(l => add(l.lat, l.lon)); else add(c.lat, c.lon); });
    AIRPORTS_HUB.forEach(a => add(a.lat, a.lon));
    add(CAR_BASE_G1.lat, CAR_BASE_G1.lon); // base de carro da Rota 1 (Tianguá) na malha viária
    return pts;
  }
  const roadCache = new Map();
  function ptsHash(points) { return points.length + ":" + points.map(p => p.lat.toFixed(3) + "," + p.lon.toFixed(3)).join("|"); }
  async function getRoadMatrix(points) {
    const h = ptsHash(points);
    if (roadCache.has(h)) return roadCache.get(h);
    try { const ls = JSON.parse(localStorage.getItem("pte_road_cache") || "null"); if (ls && ls.hash === h && ls.durations) { roadCache.set(h, ls); return ls; } } catch (e) {}
    const m = await fetchRoadMatrix(points);
    const rec = { hash: h, durations: m.durations, distances: m.distances, source: m.source };
    roadCache.set(h, rec);
    try { localStorage.setItem("pte_road_cache", JSON.stringify(rec)); } catch (e) {}
    return rec;
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
    const nEnt = curSel.entrevista.size;
    const fallback = makeProvider(params);
    let prov = fallback, distSource = "estimativa (linha reta × 1,3, 65 km/h)";
    const useRoad = document.getElementById("r-road") ? document.getElementById("r-road").checked : true;
    if (useRoad && candidates.length) {
      const max = roadMax();
      let pts = roadPoints(candidates), scope = "todas as paradas e aeroportos";
      if (pts.length > max) { pts = roadPoints(candidates.filter(c => c.preselecionada || anchorIds.has(c.id))); scope = "visitas e aeroportos (opcionais por estimativa)"; }
      if (pts.length <= max) {
        statusEl.textContent = "Calculando deslocamento real por estrada… (pode levar alguns segundos)";
        try {
          const m = await getRoadMatrix(pts);
          prov = makeMatrixProvider(pts, m.durations, m.distances, fallback);
          distSource = `distâncias reais por estrada · ${m.source}${scope.indexOf("opcionais") >= 0 ? " · " + scope : ""}`;
        } catch (e) {
          distSource = "estimativa (sem acesso à malha viária — linha reta × 1,3)";
        }
      } else {
        distSource = "estimativa (conjunto grande demais para a malha viária — linha reta × 1,3)";
      }
    }
    params.prov = prov;
    statusEl.textContent = `Roteiro a partir de ${nVis} visita(s) técnica(s).${nEnt ? ` ${nEnt} entrevista(s) remota(s) fora do roteiro.` : ""} ${params.ufRestrict ? "Restrição por UF ativa: Rota 1 (PI+CE) e Rota 2 (RN+PB) de carro; demais livres." : "Rota aberta: chegada e saída por aeroportos (podem diferir)."} Avião só na chegada/saída — entre as paradas, sempre de carro. Distâncias: ${distSource}.`;
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
    const ufrNote = params.ufRestrict
      ? `<div class="cover ok" style="background:#fff6e9;color:#9a5a00;border-color:#f0d6ad">🚗 <b>Restrição por UF ativa.</b> Rota 1 cobre <b>Piauí + Ceará</b> e Rota 2 cobre <b>RN + Paraíba</b>, ambas <b>de carro</b> (ida e volta de Tianguá/CE e Natal). As demais incursões cobrem os outros estados livremente.</div>` : "";
    const bounds = [];
    const k = plan.missions.length;
    const effKm = cob.totalKm ? (cob.totalScore / cob.totalKm * 100) : 0;
    const pct = cob.preTotal ? Math.round(100 * cob.preVis / cob.preTotal) : 100;
    // ---- cartão de cenário ótimo ----
    const ancMetric = cob.ancTotal ? `<div class="opt-m"><b>${cob.ancVis}/${cob.ancTotal}</b><span>âncoras</span></div>` : "";
    const ancWarn = (cob.ancMissed && cob.ancMissed.length)
      ? `<div class="opt-warn">${cob.ancMissed.length} âncora(s) não couberam no orçamento: ${cob.ancMissed.map(n => H.esc(n.nome)).join("; ")}. Aumente os dias ou o nº de incursões.</div>` : "";
    const showCtx = document.getElementById("r-ctx") ? document.getElementById("r-ctx").checked : true;
    const realDist = distSource.indexOf("reais") >= 0;
    let html = ufrNote + remoteNote + (showCtx ? `<div class="ctx-legend"><span><i class="d-route"></i> paradas da rota</span><span><i class="d-pre"></i> visita técnica fora da rota</span><span><i class="d-other"></i> outras iniciativas</span></div>` : "");
    html += `<div class="opt-card">
      <div class="opt-title">Cenário ótimo · ${k} incursão(ões) de até ${params.dias} dias</div>
      <div class="opt-grid">
        <div class="opt-m"><b>${cob.candVisTotal}</b><span>iniciativas (total)</span></div>
        <div class="opt-m"><b>${cob.preTotal ? cob.preVis + "/" + cob.preTotal : cob.candVis}</b><span>${cob.preTotal ? "visitas técnicas" : "iniciativas"}</span>${cob.preTotal ? `<div class="opt-bar"><i style="width:${pct}%"></i></div>` : ""}</div>
        ${ancMetric}
        <div class="opt-m"><b>+${cob.optVis}</b><span>in loco no caminho</span></div>
        <div class="opt-m"><b>${cob.ufsCobertas}/9</b><span>estados (diversidade)</span></div>
        <div class="opt-m"><b>${cob.interiorVis}</b><span>no interior</span></div>
        <div class="opt-m"><b>${cob.totalScore}</b><span>valor (pts)</span></div>
        <div class="opt-m"><b>${cob.totalKm}</b><span>km</span></div>
        <div class="opt-m"><b>${cob.totalDays}</b><span>dias (total)</span></div>
      </div>
      ${ancWarn}
      <div class="opt-src ${realDist ? "real" : "est"}">${realDist ? "Distâncias reais por estrada" : "Distâncias estimadas"} — ${H.esc(distSource)}</div>
      <div class="opt-help">Cada incursão é uma <b>rota aberta</b>: chega pelo aeroporto mais próximo da 1ª parada e sai pelo mais próximo da última (entre os 17 aeroportos do NE) — <b>chegada e saída podem ser em cidades diferentes</b>. <b>Restrição:</b> o avião é usado <b>apenas na chegada e na saída</b>; entre as paradas o trajeto é <b>100% de carro</b> — nenhum aeroporto é usado no meio da rota. O roteiro prioriza <b>diversidade regional</b> (cobrir mais estados), <b>interiorização</b> (iniciativas longe das capitais) e o <b>maior nº de iniciativas</b>. As <b>âncoras</b> são sempre incluídas; a nota entra como ajuste fino.</div>
    </div>`;
    // ---- comparador de cenários (nº de incursões) ----
    const cmp = []; const seenN = new Set();
    for (let kk = 1; kk <= 7; kk++) {
      const c = planMissions(candidates, HUBS, { ...params, numMissoes: kk }).cobertura;
      if (seenN.has(c.nMiss)) continue; // dedup (com restrição, vários kk dão o mesmo total)
      seenN.add(c.nMiss);
      cmp.push({ k: c.nMiss, pre: c.preTotal ? `${c.preVis}/${c.preTotal}` : "—", opt: c.optVis, score: c.totalScore, km: c.totalKm, dias: c.totalDays });
    }
    html += `<div class="cmp-scen"><div class="cs-h">Comparar cenários — incursões de ${params.dias} dias${params.ufRestrict ? " · com restrição por UF" : ""}</div>
      <table><thead><tr><th>Incursões</th><th>Visitas</th><th>No caminho</th><th>Valor</th><th>Km</th><th>Dias</th></tr></thead><tbody>
      ${cmp.map(r => `<tr class="${r.k === k ? "cur" : ""}"><td>${r.k}</td><td>${r.pre}</td><td>+${r.opt}</td><td>${r.score}</td><td>${r.km}</td><td>${r.dias}</td></tr>`).join("")}
      </tbody></table><div class="cs-note">Linha destacada = cenário atual. ${params.ufRestrict ? "Com restrição: as 2 primeiras são as rotas de carro (PI+CE e RN+PB); as demais cobrem outros estados." : "Mais incursões cobrem mais visitas técnicas, com mais esforço."}</div></div>`;
    // ---- cada incursão ----
    plan.missions.forEach((m, mi) => { html += incursaoBlock(m, mi, MCOLOR[mi % MCOLOR.length], params, H, routeLayer, bounds); });
    // ---- não cobertas (trade-off do ótimo) ----
    if (cob.droppedPre && cob.droppedPre.length) {
      const wp = cob.droppedPre.reduce((s, n) => s + (n.pontuacao || 0), 0);
      const lis = cob.droppedPre.slice().sort((a, b) => b.pontuacao - a.pontuacao).map(n => {
        const ufs = H.ufTokens(n.estado);
        const chips = ufs.length > 1 ? `<i>Nac./Multi</i>` : ufs.length ? `<i>${ufs[0]}</i>` : `<i class="na">—</i>`;
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

  // Renderiza uma incursão (HTML do itinerário + traçado/markers no mapa). Reaproveitado
  // pela aba automática (Rotas de campo) e pela manual (Elaboração manual da rota).
  function incursaoBlock(m, mi, color, params, H, routeLayer, bounds, drawStops) {
    if (drawStops === undefined) drawStops = true;
    const entry = m.entryHub || m.hub, exit = m.exitHub || m.hub;
    const car = !!m.carOnly;
    const ico = car ? "🚗" : "✈";
    const sameAir = car || (entry && exit && entry.iata === exit.iata);
    const airLbl = a => `${a.nome}${a.iata && !car ? " (" + a.iata + ")" : ""}`;
    const title = m.label || ("Incursão " + (mi + 1));
    const pts = [[entry.lat, entry.lon], ...m.visited.map(n => [n.lat, n.lon]), [exit.lat, exit.lon]];
    pts.forEach(p => bounds.push(p));
    L.polyline(pts, { color, weight: 3, opacity: .8 }).addTo(routeLayer);
    L.marker([entry.lat, entry.lon], { icon: hubIcon(color) })
      .bindPopup(`<span class="pp-h">${H.esc(title)} · ${car ? "base de carro (ida e volta)" : sameAir ? "base (chegada e saída)" : "chegada"}</span>${ico} ${airLbl(entry)}`).addTo(routeLayer);
    if (!sameAir) L.marker([exit.lat, exit.lon], { icon: hubIcon(color) })
      .bindPopup(`<span class="pp-h">${H.esc(title)} · saída</span>${ico} ${airLbl(exit)}`).addTo(routeLayer);
    if (drawStops) {
      let n = 0;
      m.visited.forEach(node => {
        n++;
        const ufl = H.ufLabel ? H.ufLabel(node) : H.ufTokens(node.estado).join(", ");
        const uf = ufl === "—" ? "" : ufl;
        const anc = anchorIds.has(node.id);
        L.marker([node.lat, node.lon], { icon: numIcon(n, color, !node.preselecionada, anc) })
          .bindPopup(`<span class="pp-h">${H.esc(title)} · parada ${n}</span>${H.esc(node.nome)}<br><span class="pp-k">Local:</span> ${H.esc([node.municipio, uf].filter(Boolean).join(" / ") || "Multiestadual")}<br><span class="pp-k">Nota:</span> <b>${node.pontuacao}</b> · ${anc ? "âncora" : node.__tipo === "opcional" ? "in loco no caminho" : "visita técnica"}`)
          .addTo(routeLayer);
      });
    }
    const airInfo = car
      ? `${m.regionLabel || "rota de carro"} · ida e volta de ${airLbl(entry)}`
      : sameAir
        ? `chegada e saída: ${airLbl(entry)}`
        : `chegada: ${airLbl(entry)} · saída: ${airLbl(exit)}`;
    let html = `<div class="incursao">
      <div class="ih" style="background:${color}"><span class="in">${H.esc(title)}${car ? " 🚗" : ""}</span>${m.label ? "" : `<span class="imoment">momento ${mi + 1}</span>`}<span class="ihub">${ico} ${airInfo}</span></div>
      <div class="isum"><span><b>${m.visited.length}</b> paradas${m.optCount ? ` · <b>${m.preCount}</b> visitas · ${m.optCount} no caminho` : ""}</span><span><b>${m.days.length}</b> dias</span><span><b>${Math.round(m.totalKm)}</b> km</span><span><b>${m.score}</b> pts</span></div>
      <div class="leg-line air-line">${ico} ${car ? "saída de carro de" : "chegada de avião por"} ${airLbl(entry)}${car ? "" : " — daqui em diante, todo o trajeto é de carro"}</div>`;
    let counter = 0;
    m.days.forEach((d, di) => {
      const jh = d.driveH + d.visitH, fill = Math.min(100, jh / params.jornadaH * 100);
      html += `<div class="day"><div class="dh">Dia ${di + 1}<span>${Math.round(d.km)} km · ${jh.toFixed(1)} h de jornada</span></div>
        <div class="dbar" title="${jh.toFixed(1)} h de ${params.jornadaH} h"><i style="width:${fill}%"></i></div>`;
      d.stops.forEach(s => {
        counter++;
        if (s.legKm > 1) html += `<div class="leg-line">🚗 de carro: ${Math.round(s.legKm)} km (${s.legH.toFixed(1)} h)</div>`;
        const anc = anchorIds.has(s.node.id), pre = s.node.preselecionada, opt = s.node.__tipo === "opcional";
        const tagCls = anc ? "tanc" : opt ? "topt" : "tpre";
        const tagTxt = anc ? "âncora" : opt ? "in loco no caminho" : "visita técnica";
        const nbg = (anc || pre) ? color : "#fff", nfg = (anc || pre) ? "#fff" : color, nbd = anc ? "#f6a609" : color;
        html += `<div class="stop ${(pre || anc) ? "pre" : "opt"}"><span class="n" style="background:${nbg};color:${nfg};border-color:${nbd}">${counter}</span><span class="nm">${H.esc(s.node.nome)} <span class="tag ${tagCls}">${tagTxt}</span> <span class="sc">${s.node.pontuacao} pts</span></span></div>`;
      });
      html += `</div>`;
    });
    html += `<div class="leg-line air-line">🚗 ${car ? "retorno de carro à base" : "de carro até a saída"}: ${Math.round(m.back.legKm)} km · ${ico} ${car ? "" : "saída de avião por "}${airLbl(exit)}</div></div>`;
    return html;
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

  // ======================= Elaboração MANUAL da rota =======================
  let mMap, mAllLayer, mRouteLayer, mLastH, mLoaded = false;
  let mRoutes = [], mActive = 0;
  let mSel = { visita: new Set(), entrevista: new Set() }; // seleção da aba "Seleção"
  function mNewRoute() { const i = mRoutes.length; mRoutes.push({ nome: "Rota " + (i + 1), color: MCOLOR[i % MCOLOR.length], stops: [], carOnly: false }); mActive = mRoutes.length - 1; }
  function mLoad() {
    try { const s = JSON.parse(localStorage.getItem("pte_rota_manual4") || "null"); if (s && Array.isArray(s.routes) && s.routes.length) { mRoutes = s.routes; mActive = Math.min(s.active || 0, s.routes.length - 1); return; } } catch (e) {}
    // rota manual padrão embutida nos dados (independente do cache)
    const d = (mLastH && mLastH.META && mLastH.META.rota_manual_default) || [];
    if (d.length) {
      mRoutes = d.map((r, i) => ({ nome: r.nome || ("Rota " + (i + 1)), color: r.color || MCOLOR[i % MCOLOR.length], carOnly: !!r.carOnly, stops: (r.stops || []).map(s => ({ id: s.id, li: s.li || 0 })) }));
      mActive = 0; mSave(); return;
    }
    mRoutes = []; mActive = 0; mNewRoute();
  }
  function mSave() { try { localStorage.setItem("pte_rota_manual4", JSON.stringify({ routes: mRoutes, active: mActive })); } catch (e) {} }
  function mFindStop(id, li) {
    for (let ri = 0; ri < mRoutes.length; ri++) { const j = mRoutes[ri].stops.findIndex(s => s.id === id && (s.li || 0) === li); if (j >= 0) return { ri, order: j + 1, color: mRoutes[ri].color }; }
    return null;
  }
  function mToggleStop(id, li) {
    const r = mRoutes[mActive]; if (!r) return;
    const j = r.stops.findIndex(s => s.id === id && (s.li || 0) === li);
    if (j >= 0) r.stops.splice(j, 1);
    else { mRoutes.forEach(x => { const k = x.stops.findIndex(s => s.id === id && (s.li || 0) === li); if (k >= 0) x.stops.splice(k, 1); }); r.stops.push({ id, li }); }
    mSave(); mRenderMarkers(mLastH); mRenderPanel(mLastH);
  }
  function mEnsureMap() {
    if (mMap) return;
    mMap = L.map("map-rota-manual", { preferCanvas: true }).setView([-8.6, -39.5], 5);
    if (window.PTE_MAP) PTE_MAP.setup(mMap, { base: "Ruas e estradas", boundaries: true, airports: true });
    else L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 20, crossOrigin: true }).addTo(mMap);
    // agrupa pontos coincidentes (mesmo template do Mapa geral / Seleção)
    mAllLayer = (mLastH && mLastH.makeMarkerLayer ? mLastH.makeMarkerLayer() : L.layerGroup()).addTo(mMap);
    mRouteLayer = L.layerGroup().addTo(mMap);
  }
  function mReadParams() {
    const v = id => { const el = document.getElementById(id); return el ? +el.value : null; };
    return { dias: 60, jornadaH: 10, dirMaxH: v("rm-dir") || 8, visitaH: v("rm-visita") || 4, detour: 1.3, speedKmh: 65 };
  }
  function mSyncParams() {
    const set = (id, suf) => { const a = document.getElementById(id), b = document.getElementById(id + "-v"); if (a && b) b.textContent = a.value + suf; };
    set("rm-visita", " h"); set("rm-dir", " h");
  }
  function mBuildControls(H) {
    const c = document.getElementById("rota-manual-controls");
    if (!c || c.dataset.init) return;
    c.dataset.init = "1";
    c.innerHTML = `
      <div class="rc-group">
        <span class="rc-title">Parâmetros</span>
        <div class="rc-field"><label>Horas por visita</label><input id="rm-visita" type="range" min="1" max="4" step="0.5" value="4"><span class="val" id="rm-visita-v">4 h</span></div>
        <div class="rc-field"><label>Direção máx. por dia</label><input id="rm-dir" type="range" min="6" max="10" step="1" value="8"><span class="val" id="rm-dir-v">8 h</span></div>
        <label class="rc-chk"><input type="checkbox" id="rm-road" checked> Usar distâncias reais por estrada</label>
      </div>
      <div class="rc-group">
        <span class="rc-title">Rotas</span>
        <div class="rc-note">Escolha a <b>rota ativa</b> abaixo e <b>clique nos pontos do mapa</b> na ordem desejada. Clicar de novo remove o ponto. Use ↑ ↓ para reordenar.</div>
        <div class="rm-legend">
          <span><i class="rml rml-vis"></i> pré-selecionada p/ visita</span>
          <span><i class="rml rml-ent"></i> pré-selecionada p/ entrevista</span>
          <span><i class="rml rml-out"></i> demais iniciativas</span>
        </div>
        <div class="rm-routes" id="rm-routes"></div>
        <button class="btn secondary sm" id="rm-new">+ Nova rota</button>
        <div class="rm-add-wrap">
          <input type="search" id="rm-search" placeholder="Filtrar por nome ou organização…" autocomplete="off">
          <select id="rm-add"><option value="">Adicionar iniciativa à rota ativa…</option></select>
        </div>
      </div>
      <div class="rc-group" id="rm-active-box"></div>
      <div class="rc-actions">
        <button class="btn" id="rm-gerar">Gerar roteiro</button>
        <button class="btn secondary" id="rm-clear-all">Limpar tudo</button>
        <span class="rc-status" id="rm-status"></span>
      </div>`;
    ["rm-visita", "rm-dir"].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener("input", mSyncParams); });
    c.addEventListener("click", e => {
      const chip = e.target.closest(".rm-chip"); if (chip) { mActive = +chip.dataset.ri; mSave(); mRenderPanel(H); mRenderMarkers(H); return; }
      const op = e.target.closest("[data-op]"); if (op) {
        const si = +op.dataset.si, r = mRoutes[mActive]; if (!r) return;
        if (op.dataset.op === "up" && si > 0) { const t = r.stops[si - 1]; r.stops[si - 1] = r.stops[si]; r.stops[si] = t; }
        else if (op.dataset.op === "down" && si < r.stops.length - 1) { const t = r.stops[si + 1]; r.stops[si + 1] = r.stops[si]; r.stops[si] = t; }
        else if (op.dataset.op === "rm") r.stops.splice(si, 1);
        mSave(); mRenderPanel(H); mRenderMarkers(H); return;
      }
      const id = e.target.id;
      if (id === "rm-new") { mNewRoute(); mSave(); mRenderPanel(H); mRenderMarkers(H); }
      else if (id === "rm-gerar") mGerar(H);
      else if (id === "rm-clear-all") { mRoutes = []; mActive = 0; mNewRoute(); mSave(); mRenderPanel(H); mRenderMarkers(H); const it = document.getElementById("rota-manual-itinerary"); if (it) it.innerHTML = ""; if (mRouteLayer) mRouteLayer.clearLayers(); }
      else if (id === "rm-opt") mOptimize(H);
      else if (id === "rm-clear") { const r = mRoutes[mActive]; if (r) r.stops = []; mSave(); mRenderPanel(H); mRenderMarkers(H); }
      else if (id === "rm-del") { if (mRoutes.length) { mRoutes.splice(mActive, 1); if (!mRoutes.length) mNewRoute(); mActive = Math.max(0, mActive - 1); mSave(); mRenderPanel(H); mRenderMarkers(H); } }
    });
    c.addEventListener("change", e => {
      if (e.target.id === "rm-car") { const r = mRoutes[mActive]; if (r) { r.carOnly = e.target.checked; mSave(); } }
      else if (e.target.id === "rm-name") { const r = mRoutes[mActive]; if (r) { r.nome = e.target.value.trim() || r.nome; mSave(); mRenderPanel(H); } }
      else if (e.target.id === "rm-add") { if (e.target.value) { mAddStop(+e.target.value, 0); e.target.value = ""; } }
    });
    c.addEventListener("input", e => { if (e.target.id === "rm-search") mFillAddOptions(H, e.target.value); });
    mFillAddOptions(H, "");
  }
  function mAddStop(id, li) {
    li = li || 0;
    const r = mRoutes[mActive]; if (!r) { mNewRoute(); }
    const ra = mRoutes[mActive];
    if (ra.stops.some(s => s.id === id && (s.li || 0) === li)) return; // já está na rota ativa
    mRoutes.forEach(x => { const k = x.stops.findIndex(s => s.id === id && (s.li || 0) === li); if (k >= 0) x.stops.splice(k, 1); });
    ra.stops.push({ id, li });
    mSave(); mRenderMarkers(mLastH); mRenderPanel(mLastH);
  }
  function mFillAddOptions(H, q) {
    const sel = document.getElementById("rm-add"); if (!sel) return;
    q = String(q || "").trim().toLowerCase();
    const nm = s => String(s || "").toLowerCase();
    const list = H.ITEMS.filter(i => i.lat != null)
      .filter(i => !q || nm(i.nome).includes(q) || nm(i.org).includes(q) || nm(i.municipio).includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt")).slice(0, 250);
    sel.innerHTML = `<option value="">Adicionar iniciativa à rota ativa… (${list.length})</option>` + list.map(i => {
      const org = (H.orgSub && H.orgSub(i)) || "";
      return `<option value="${i.id}">${H.esc(i.nome)}${org ? " — " + H.esc(org) : ""}${i.municipio ? " · " + H.esc(i.municipio) : ""}</option>`;
    }).join("");
  }
  function mRenderPanel(H) {
    const box = document.getElementById("rm-routes");
    if (box) box.innerHTML = mRoutes.map((r, ri) => `<button class="rm-chip ${ri === mActive ? "on" : ""}" data-ri="${ri}"><span class="rm-dot" style="background:${r.color}"></span>${H.esc(r.nome)} <b>${r.stops.length}</b></button>`).join("");
    const ed = document.getElementById("rm-active-box");
    if (!ed) return;
    const r = mRoutes[mActive];
    if (!r) { ed.innerHTML = ""; return; }
    const stops = r.stops.map((s, si) => {
      const it = H.byId(s.id); const locs = it ? locsOf(it, H) : []; const loc = locs[s.li] || locs[0] || {};
      const vis = mSel.visita.has(s.id), ent = mSel.entrevista.has(s.id);
      const star = vis ? `<span class="rm-star vis" title="pré-selecionada para visita">★</span>` : ent ? `<span class="rm-star ent" title="pré-selecionada para entrevista">★</span>` : "";
      return `<li${vis ? ' class="pre-vis"' : ent ? ' class="pre-ent"' : ""}><span class="rm-n" style="background:${r.color}">${si + 1}</span><span class="rm-nm">${star}${H.esc(it ? it.nome : "?")}<small>${H.esc(loc.municipio || "")}</small></span><span class="rm-ops"><button data-op="up" data-si="${si}" title="subir">↑</button><button data-op="down" data-si="${si}" title="descer">↓</button><button data-op="rm" data-si="${si}" title="remover">×</button></span></li>`;
    }).join("") || `<li class="rm-empty">Clique nos pontos do mapa para adicionar paradas a esta rota.</li>`;
    ed.innerHTML = `<span class="rc-title">Rota ativa: ${H.esc(r.nome)}</span>
      <input class="rm-name" id="rm-name" value="${H.esc(r.nome)}" aria-label="nome da rota" />
      <label class="rc-chk"><input type="checkbox" id="rm-car" ${r.carOnly ? "checked" : ""}> 🚗 Só de carro (circular, sem avião)</label>
      <ol class="rm-stops">${stops}</ol>
      <div class="rm-row"><button class="btn secondary sm" id="rm-opt">Otimizar ordem</button><button class="btn secondary sm" id="rm-clear">Limpar rota</button><button class="btn secondary sm" id="rm-del">Remover rota</button></div>`;
  }
  function mRenderMarkers(H) {
    if (!mAllLayer) return;
    mAllLayer.clearLayers();
    const markers = [];
    H.ITEMS.forEach(it => {
      const vis = mSel.visita.has(it.id), ent = mSel.entrevista.has(it.id);
      const locs = locsOf(it, H);
      locs.forEach((loc, li) => {
        if (loc.lat == null || loc.lon == null) return;
        const found = mFindStop(it.id, li);
        let mk;
        if (found) {
          mk = L.marker([loc.lat, loc.lon], { icon: numIcon(found.order, found.color, false, false) });
        } else {
          // destaca as pré-selecionadas: visita = anel dourado, entrevista = anel verde
          mk = L.circleMarker([loc.lat, loc.lon], {
            radius: vis ? 8 : ent ? 7 : 6,
            fillColor: H.eixoColor(it.eixo_cod),
            fillOpacity: it.fora_ne ? .35 : (vis || ent ? .92 : .7),
            color: vis ? COR_VISITA : ent ? "#16a34a" : "#fff",
            weight: vis ? 3.4 : ent ? 2.6 : 1.5
          });
        }
        const tag = vis ? " · pré-selecionada p/ visita" : ent ? " · pré-selecionada p/ entrevista" : "";
        mk.bindTooltip(`${H.esc(it.nome)} · ${it.pontuacao} pts${tag}${found ? " — " + H.esc(mRoutes[found.ri].nome) + " #" + found.order : ""}`, { direction: "top", offset: [0, -6] });
        mk.on("click", () => mToggleStop(it.id, li));
        markers.push(mk);
      });
    });
    if (H.addMarkers) H.addMarkers(mAllLayer, markers);
    else markers.forEach(m => m.addTo(mAllLayer));
  }
  function mBuildNodes(r, H) {
    return r.stops.map(s => {
      const it = H.byId(s.id); if (!it || it.lat == null) return null;
      const locs = locsOf(it, H), loc = locs[s.li] || locs[0] || { lat: it.lat, lon: it.lon, municipio: it.municipio };
      return Object.assign({}, it, { lat: loc.lat, lon: loc.lon, municipio: loc.municipio, estado: loc.uf || it.estado, preselecionada: true, __tipo: "visita" });
    }).filter(Boolean);
  }
  function mOptimize(H) {
    const r = mRoutes[mActive]; if (!r || r.stops.length < 3) return;
    const nodes = mBuildNodes(r, H).map((n, i) => Object.assign({}, n, { __k: r.stops[i] }));
    const ordered = openPathOptimize(nodes, makeProvider(mReadParams()), AIRPORTS_HUB);
    r.stops = ordered.map(n => n.__k);
    mSave(); mRenderPanel(H); mRenderMarkers(H);
  }
  async function mGerar(H) {
    const panel = document.getElementById("rota-manual-itinerary"), statusEl = document.getElementById("rm-status");
    const routes = mRoutes.filter(r => r.stops.length);
    if (!routes.length) { if (panel) panel.innerHTML = `<div class="cover empty">Monte ao menos uma rota: escolha a rota ativa e clique nos pontos do mapa na ordem desejada.</div>`; if (mRouteLayer) mRouteLayer.clearLayers(); return; }
    const params = mReadParams();
    const routeNodes = routes.map(r => mBuildNodes(r, H));
    const allNodes = routeNodes.flat();
    const useRoad = document.getElementById("rm-road") ? document.getElementById("rm-road").checked : true;
    const fallback = makeProvider(params);
    let prov = fallback, distSource = "estimativa (linha reta × 1,3, 65 km/h)";
    if (useRoad && allNodes.length) {
      const max = roadMax(), pts = roadPoints(allNodes);
      if (pts.length <= max) {
        if (statusEl) statusEl.textContent = "Calculando deslocamento real por estrada…";
        try { const mtx = await getRoadMatrix(pts); prov = makeMatrixProvider(pts, mtx.durations, mtx.distances, fallback); distSource = "distâncias reais por estrada · " + mtx.source; }
        catch (e) { distSource = "estimativa (sem acesso à malha viária)"; }
      } else distSource = "estimativa (conjunto grande demais para a malha viária)";
    }
    params.prov = prov;
    mRouteLayer.clearLayers();
    const bounds = [];
    const real = distSource.indexOf("reais") >= 0;
    const totStops = routeNodes.reduce((s, n) => s + n.length, 0);
    let totKm = 0, totDays = 0;
    let blocks = "";
    routeNodes.forEach((nodes, ri) => {
      const r = routes[ri];
      let entry, exit;
      if (r.carOnly) { const base = { nome: nodes[0].municipio || "início", lat: nodes[0].lat, lon: nodes[0].lon }; entry = base; exit = base; }
      else { entry = nearestHub(nodes[0], AIRPORTS_HUB); exit = nearestHub(nodes[nodes.length - 1], AIRPORTS_HUB); }
      const packed = packDays(entry, nodes, prov, params, exit);
      const km = packed.days.reduce((s, d) => s + d.km, 0) + packed.back.legKm;
      totKm += km; totDays += packed.days.length;
      const m = { label: r.nome, entryHub: entry, exitHub: exit, carOnly: !!r.carOnly, regionLabel: r.carOnly ? r.nome + " · carro" : "", visited: packed.visited, days: packed.days, back: packed.back, totalKm: km, score: nodes.reduce((s, n) => s + (n.pontuacao || 0), 0), preCount: packed.visited.length, optCount: 0 };
      blocks += incursaoBlock(m, ri, r.color, params, H, mRouteLayer, bounds, false);
    });
    let html = `<div class="opt-card">
      <div class="opt-title">Roteiro manual · ${routes.length} rota(s)</div>
      <div class="opt-grid">
        <div class="opt-m"><b>${routes.length}</b><span>rotas</span></div>
        <div class="opt-m"><b>${totStops}</b><span>paradas</span></div>
        <div class="opt-m"><b>${Math.round(totKm)}</b><span>km</span></div>
        <div class="opt-m"><b>${totDays}</b><span>dias (total)</span></div>
      </div>
      <div class="opt-src ${real ? "real" : "est"}">${real ? "Distâncias reais por estrada" : "Distâncias estimadas"} — ${H.esc(distSource)}</div>
      <div class="opt-help">Cada rota foi montada por você. O avião é usado só na <b>chegada/saída</b> (rotas com avião); entre as paradas o trajeto é <b>de carro</b>. Marque “Só de carro” para uma rota circular sem avião.</div>
    </div>` + blocks;
    // ---- visitas técnicas pré-selecionadas que ficaram fora de todas as rotas ----
    const routed = new Set(); mRoutes.forEach(r => r.stops.forEach(s => routed.add(s.id)));
    const fora = H.ITEMS.filter(it => mSel.visita.has(it.id) && !routed.has(it.id));
    if (fora.length) {
      const wp = fora.reduce((s, n) => s + (n.pontuacao || 0), 0);
      const lis = fora.slice().sort((a, b) => (b.pontuacao || 0) - (a.pontuacao || 0)).map(n => {
        const ufs = H.ufTokens(n.estado);
        const chips = ufs.length > 1 ? `<i>Nac./Multi</i>` : ufs.length ? `<i>${ufs[0]}</i>` : `<i class="na">—</i>`;
        return `<li title="${H.esc(n.eixo || "")}"><span class="u-dot" style="background:${H.eixoColor(n.eixo_cod)}"></span><span class="u-name">${H.esc(n.nome)}</span><span class="u-ufs">${chips}</span><span class="u-score">${n.pontuacao}<small>pts</small></span></li>`;
      }).join("");
      html += `<div class="uncovered">
        <div class="uh"><span>Visitas técnicas fora destas ${routes.length} rota(s)</span><span class="ucount">${fora.length}</span></div>
        <div class="usub">Somam <b>${wp} pts</b>. Para incluí-las, selecione a rota desejada e clique nos pontos <b>dourados</b> no mapa — ou crie uma nova rota.</div>
        <ul class="ulist">${lis}</ul></div>`;
    }
    if (panel) panel.innerHTML = html;
    if (statusEl) statusEl.textContent = `${routes.length} rota(s) · ${totStops} paradas · ${Math.round(totKm)} km · ${totDays} dias.`;
    if (bounds.length) mMap.fitBounds(bounds, { padding: [30, 30] });
  }
  function renderManual(H) {
    mLastH = H;
    mSel = H.fieldSel ? H.fieldSel() : { visita: new Set(), entrevista: new Set() };
    if (!mLoaded) { mLoad(); mLoaded = true; }
    mEnsureMap();
    mBuildControls(H);
    setTimeout(() => mMap.invalidateSize(), 60);
    mSyncParams();
    mRenderMarkers(H);
    mRenderPanel(H);
  }

  window.PTE_ROTAS = { render, toggleAnchor, isAnchor, renderManual };
})();
