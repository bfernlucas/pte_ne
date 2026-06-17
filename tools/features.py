# -*- coding: utf-8 -*-
"""Trechos de CSS / HTML / JS injetados no index.html (Ranking + Rota de campo)."""

# ---------------------------------------------------------------------------
# Patches em linhas já existentes (substituições únicas e exatas)
# ---------------------------------------------------------------------------
PATCHES = [
    # 1. declara a camada da rota
    ("let map,geoLayer,labelLayer,ptLayer,connLayer,legendCtrl,infoControl,barChart,pieChart;",
     "let map,geoLayer,labelLayer,ptLayer,connLayer,routeLayer,legendCtrl,infoControl,barChart,pieChart;"),
    # 2. cria a camada da rota na inicialização do mapa
    ("    ptLayer=L.layerGroup().addTo(map);\n    addInfoControl();",
     "    ptLayer=L.layerGroup().addTo(map);\n    routeLayer=L.layerGroup().addTo(map);\n    addInfoControl();"),
    # 3. KPIs: pontuação média + nº de avaliadas
    ('const cards=[["Iniciativas",rows.length],["Estados cobertos",cobertos+" / 9"],["Cobertura do NE",Math.round(cobertos/9*100)+"%"],["Regionais (multi-UF)",multi]];',
     'const scAll=rows.map(d=>num(d.pontuacao)).filter(v=>v>0);const scAvg=scAll.length?(scAll.reduce((a,b)=>a+b,0)/scAll.length):0;'
     'const cards=[["Iniciativas",rows.length],["Estados cobertos",cobertos+" / 9"],["Cobertura do NE",Math.round(cobertos/9*100)+"%"],["Regionais (multi-UF)",multi],["Pontuação média",scAll.length?scAvg.toFixed(1):"—"],["Avaliadas",scAll.length+" / "+rows.length]];'),
    # 4. tamanho do marcador proporcional à pontuação
    ("    const cmap=eixoColors();\n    rows.filter(r=>num(r.lat)&&num(r.lon)).forEach(r=>{",
     "    const cmap=eixoColors();const maxSc=Math.max(1,...rows.map(r=>num(r.pontuacao)));\n    rows.filter(r=>num(r.lat)&&num(r.lon)).forEach(r=>{"),
    # 5. raio do marcador por pontuação
    ('const m=L.circleMarker([num(r.lat),num(r.lon)],{radius:6,color:"#fff",weight:1.5,fillColor:cmap[r.eixo]||"#334155",fillOpacity:1});',
     'const m=L.circleMarker([num(r.lat),num(r.lon)],{radius:5+Math.round(num(r.pontuacao)/maxSc*8),color:"#fff",weight:1.5,fillColor:cmap[r.eixo]||"#334155",fillOpacity:.95});'),
    # 6. popup com pontuação + posição no ranking
    ('m.bindPopup(`<b>${r.iniciativa}</b><br>${r.organizacao||""}<br>Sede: ${r.municipio||"?"} — ${ufsOf(r)[0]||""}<br>Alcança: ${ufsOf(r).join(", ")||"—"}<br>Eixo: ${r.eixo||""}`);',
     'm.bindPopup(`<b>${r.iniciativa}</b><br>${r.organizacao||""}<br>Sede: ${r.municipio||"?"} — ${ufsOf(r)[0]||""}<br>Alcança: ${ufsOf(r).join(", ")||"—"}<br>Eixo: ${r.eixo||""}<br>Pontuação: <b>${num(r.pontuacao)||"—"}</b> ${rankBadge(r)}`);'),
    # 7. render(): inclui ranking e estado da rota
    ('function render(){const rows=filtered();renderKpis(rows);renderMap(rows);renderCharts(rows);renderTable(rows);document.getElementById("pill").textContent=`${rows.length} de ${DATA.length} iniciativas`;}',
     'function render(){const rows=filtered();renderKpis(rows);renderMap(rows);renderCharts(rows);renderTable(rows);renderRanking(rows);refreshRouteState(rows);document.getElementById("pill").textContent=`${rows.length} de ${DATA.length} iniciativas`;}'),
    # 8. coluna de pontuação na tabela
    ('const cols=[["id","ID"],["iniciativa","Iniciativa"],["organizacao","Organização"],["estado","Estados (cobertura)"],["municipio","Sede"],["bioma","Bioma"],["eixo","Eixo"],["setor","Setor"],["data_fundacao","Fundação"]];',
     'const cols=[["id","ID"],["iniciativa","Iniciativa"],["organizacao","Organização"],["estado","Estados (cobertura)"],["municipio","Sede"],["bioma","Bioma"],["eixo","Eixo"],["pontuacao","Pontuação"],["setor","Setor"],["data_fundacao","Fundação"]];'),
]

# ---------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------
CSS = r"""
  /* PTE-FEATURES */
  .routebar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:11px 16px;box-shadow:var(--shadow);margin-bottom:16px}
  .routebar .rb-title{font-weight:700;font-size:.9rem;color:#9a3412}
  .routebar .rb-fld,.routebar .rb-chk{font-size:.82rem;color:#334155;display:flex;align-items:center;gap:6px;cursor:pointer}
  .routebar select{font-size:.82rem;padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:var(--card)}
  .routebar .rb-status{font-size:.78rem;color:var(--muted);margin-left:auto}
  .ranklist{max-height:440px;overflow:auto;display:flex;flex-direction:column;gap:5px}
  .rk{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:9px;cursor:pointer}
  .rk:hover{background:#f1f5f9}
  .rk-pos{flex:0 0 26px;text-align:center;font-weight:700;font-size:.95rem;color:#64748b}
  .rk-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .rk-name{font-size:.86rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rk-meta{font-size:.72rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rk-dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:5px}
  .rk-bar{height:6px;background:#eef2f7;border-radius:4px;overflow:hidden;margin-top:2px}
  .rk-fill{display:block;height:100%;border-radius:4px}
  .rk-score{flex:0 0 34px;text-align:right;font-weight:700;font-size:.95rem}
  .rkb{font-size:.72rem;font-weight:600;color:#9a3412;background:#ffedd5;border-radius:6px;padding:1px 6px;margin-left:4px;white-space:nowrap}
  .rkb.na{color:#64748b;background:#f1f5f9}
  .routebox{font-size:.84rem}
  .route-empty{color:var(--muted);font-size:.84rem;line-height:1.55;padding:8px 2px}
  .route-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(86px,1fr));gap:8px;margin-bottom:10px}
  .route-sum>div{background:#f8fafc;border:1px solid var(--border);border-radius:9px;padding:7px 9px;display:flex;flex-direction:column}
  .rs-k{font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:.02em}
  .rs-v{font-size:1.02rem;font-weight:700}
  .rilist{max-height:300px;overflow:auto;display:flex;flex-direction:column}
  .ri{display:flex;align-items:flex-start;gap:9px;padding:7px 4px;border-bottom:1px dashed var(--border)}
  .ri-n{flex:0 0 22px;height:22px;border-radius:50%;background:#ea580c;color:#fff;font-size:.76rem;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px}
  .ri-b{flex:1;min-width:0}
  .ri-loc{font-weight:600;font-size:.82rem}
  .ri-names{font-size:.76rem;color:#475569}
  .ri-sc{color:#9a3412;font-weight:700}
  .ri-km{font-size:.74rem;color:var(--muted);white-space:nowrap}
  .kind{font-size:.68rem;color:#64748b;font-weight:500}
  .route-note{font-size:.72rem;color:var(--muted);line-height:1.5;margin-top:9px;border-top:1px solid var(--border);padding-top:8px}
  .routepin{background:#ea580c;color:#fff;border:2px solid #fff;border-radius:50%;width:26px!important;height:26px!important;display:flex!important;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;box-shadow:0 1px 4px rgba(0,0,0,.45)}"""

# ---------------------------------------------------------------------------
# HTML
# ---------------------------------------------------------------------------
ROUTEBAR_HTML = """  <div class="routebar">
    <span class="rb-title">🧭 Rota de campo</span>
    <label class="rb-fld">Início <select id="route-start"><option value="score">Maior pontuação</option><option value="geo">Extremo norte</option></select></label>
    <label class="rb-chk"><input type="checkbox" id="route-round"/> Circular (volta à origem)</label>
    <label class="rb-chk"><input type="checkbox" id="route-road"/> Traçar por rodovias (OSRM)</label>
    <button class="btn" id="route-btn">Gerar rota</button>
    <button class="btn ghost" id="route-clear-btn">Limpar rota</button>
    <span class="rb-status" id="route-status"></span>
  </div>"""

PANELS_HTML = """  <div class="grid2" style="grid-template-columns:1.05fr .95fr">
    <div class="panel"><h3>🏆 Ranking por pontuação <small id="rank-sub" style="color:var(--muted);font-weight:400"></small></h3><div id="ranklist" class="ranklist"></div></div>
    <div class="panel"><h3>🧭 Itinerário da rota <small id="route-sub" style="color:var(--muted);font-weight:400"></small></h3><div id="routebox" class="routebox"></div></div>
  </div>
"""

# ---------------------------------------------------------------------------
# JavaScript
# ---------------------------------------------------------------------------
FEATURE_JS = r"""
/* PTE-FEATURES — Ranking + Rota de campo ------------------------------------*/

// Ranking global (sobre toda a base; empates compartilham posição). Só conta avaliadas (>0).
const RANK={};
(function(){const ev=DATA.filter(d=>num(d.pontuacao)>0).sort((a,b)=>num(b.pontuacao)-num(a.pontuacao));
  let pos=0,prev=null;ev.forEach((d,i)=>{const p=num(d.pontuacao);if(p!==prev){pos=i+1;prev=p;}RANK[d.id]=pos;});})();
const medalFor=p=>p===1?"🥇":p===2?"🥈":p===3?"🥉":"";
function rankBadge(d){const p=RANK[d.id];return p?`<span class="rkb">#${p} ${medalFor(p)}</span>`:`<span class="rkb na">não avaliada</span>`;}

function renderRanking(rows){
  const list=rows.slice().sort((a,b)=>num(b.pontuacao)-num(a.pontuacao));
  const max=Math.max(1,...list.map(d=>num(d.pontuacao)));
  const cmap=eixoColors();
  document.getElementById("rank-sub").textContent=`(${list.length} iniciativas)`;
  const html=list.map((d,i)=>{const p=num(d.pontuacao);const pct=Math.round(p/max*100);const pos=i+1;const med=(pos<=3&&p>0)?medalFor(pos):pos;
    return `<div class="rk" data-id="${d.id}" title="${d.iniciativa}">
      <span class="rk-pos">${med}</span>
      <span class="rk-main"><span class="rk-name">${d.iniciativa}</span>
        <span class="rk-meta"><i class="rk-dot" style="background:${cmap[d.eixo]||'#94a3b8'}"></i>${d.eixo||""} · ${d.municipio||"?"}</span>
        <span class="rk-bar"><span class="rk-fill" style="width:${Math.max(p>0?6:0,pct)}%;background:${cmap[d.eixo]||'#94a3b8'}"></span></span>
      </span>
      <span class="rk-score">${p>0?p:"—"}</span></div>`;}).join("");
  const box=document.getElementById("ranklist");
  box.innerHTML=html||'<div class="route-empty">Sem iniciativas no filtro atual.</div>';
  box.querySelectorAll(".rk").forEach(el=>el.addEventListener("click",()=>{
    const d=DATA.find(x=>x.id==el.dataset.id);if(!d)return;selectInitiative(d);
    const p=opPoint(d);if(p)map.setView([p.lat,p.lng],6);}));
}

// ----- Geometria / pontos operacionais -----
const NE_BBOX={latMin:-18.5,latMax:-1.0,lonMin:-48.8,lonMax:-34.0};
const inNE=(la,lo)=>la>=NE_BBOX.latMin&&la<=NE_BBOX.latMax&&lo>=NE_BBOX.lonMin&&lo<=NE_BBOX.lonMax;

// Ponto usado na rota de campo:
//  - Iniciativa REGIONAL/FEDERAL (cobre +1 UF): centróide das UFs cobertas no NE
//    (resolve sedes fora da região — Brasília, Rio — que não são ponto de campo).
//  - Iniciativa ESTADUAL (1 UF): a sede, se estiver no Nordeste; senão o centróide da UF.
function opPoint(d){
  const la=num(d.lat),lo=num(d.lon);
  const ufs=ufsOf(d).filter(u=>ufCenter[u]);
  const centroid=()=>{let a=0,b=0;ufs.forEach(u=>{a+=ufCenter[u].lat;b+=ufCenter[u].lng;});
    return {lat:a/ufs.length,lng:b/ufs.length,kind:"operacional",label:ufs.join("/")};};
  if(ufs.length>1)return centroid();
  if(la&&lo&&inNE(la,lo))return {lat:la,lng:lo,kind:"sede",label:d.municipio||"sede"};
  if(ufs.length)return centroid();
  if(la&&lo)return {lat:la,lng:lo,kind:"sede",label:d.municipio||"sede"};
  return null;
}

const R_EARTH=6371;
function haversine(a,b){const dLa=(b.lat-a.lat)*Math.PI/180,dLo=(b.lng-a.lng)*Math.PI/180,
  la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180;
  const h=Math.sin(dLa/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLo/2)**2;
  return 2*R_EARTH*Math.asin(Math.min(1,Math.sqrt(h)));}
function distMatrix(p){const n=p.length,m=Array.from({length:n},()=>new Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const d=haversine(p[i],p[j]);m[i][j]=m[j][i]=d;}return m;}
function nnOrder(m,start){const n=m.length,vis=new Array(n).fill(false),o=[start];vis[start]=true;
  for(let k=1;k<n;k++){const last=o[o.length-1];let best=-1,bd=Infinity;
    for(let j=0;j<n;j++)if(!vis[j]&&m[last][j]<bd){bd=m[last][j];best=j;}o.push(best);vis[best]=true;}return o;}
function tourCost(o,m,round){let s=0;for(let i=0;i<o.length-1;i++)s+=m[o[i]][o[i+1]];
  if(round&&o.length>1)s+=m[o[o.length-1]][o[0]];return s;}
// 2-opt mantendo a origem (índice 0) fixa
function twoOpt(o,m,round){let best=o.slice(),n=o.length,improved=true,guard=0;
  while(improved&&guard++<200){improved=false;
    for(let i=1;i<n-1;i++)for(let k=i+1;k<n;k++){
      const cand=best.slice();const seg=cand.slice(i,k+1).reverse();cand.splice(i,seg.length,...seg);
      if(tourCost(cand,m,round)+1e-9<tourCost(best,m,round)){best=cand;improved=true;}}}
  return best;}

// Agrupa iniciativas que caem no mesmo ponto operacional (ex.: programas federais → mesmo centróide).
function routeStops(rows){const idx={},order=[];
  rows.forEach(d=>{const p=opPoint(d);if(!p)return;const key=p.lat.toFixed(3)+","+p.lng.toFixed(3);
    if(!idx[key]){idx[key]={lat:p.lat,lng:p.lng,kind:p.kind,label:p.label,items:[]};order.push(key);}
    idx[key].items.push(d);});
  return order.map(k=>idx[k]);}

function computeRoute(){
  const rows=filtered(),stops=routeStops(rows);
  if(stops.length<2)return null;
  const startMode=document.getElementById("route-start").value;
  const round=document.getElementById("route-round").checked;
  const m=distMatrix(stops);
  let start=0;
  if(startMode==="score"){let bs=-1;stops.forEach((s,i)=>{const mx=Math.max(...s.items.map(d=>num(d.pontuacao)));if(mx>bs){bs=mx;start=i;}});}
  else{let top=-Infinity;stops.forEach((s,i)=>{if(s.lat>top){top=s.lat;start=i;}});}
  let order=nnOrder(m,start);order=twoOpt(order,m,round);
  const legs=[];let total=0;
  for(let i=0;i<order.length-1;i++){const d=m[order[i]][order[i+1]];legs.push(d);total+=d;}
  if(round){const d=m[order[order.length-1]][order[0]];legs.push(d);total+=d;}
  return {stops,order,legs,total,round};
}

async function drawRoadGeometry(ordered,round){
  const pts=round?ordered.concat([ordered[0]]):ordered;
  const coord=pts.map(p=>`${p.lng},${p.lat}`).join(";");
  const url=`https://router.project-osrm.org/route/v1/driving/${coord}?overview=full&geometries=geojson`;
  const res=await fetch(url);const j=await res.json();
  if(j.code!=="Ok"||!j.routes||!j.routes.length)throw new Error(j.code||"sem rota");
  return {line:j.routes[0].geometry,km:j.routes[0].distance/1000,min:j.routes[0].duration/60};
}

const ROUTE_EMPTY='<div class="route-empty">Filtre por <b>eixo</b> (ou qualquer filtro) e clique em <b>Gerar rota</b>. O algoritmo monta uma rota de campo otimizada entre as iniciativas, agrupando programas regionais por centróide das UFs cobertas.</div>';

function clearRoute(){if(routeLayer)routeLayer.clearLayers();}

function refreshRouteState(rows){
  const n=routeStops(rows).length;
  const st=document.getElementById("route-status");
  if(st)st.textContent=n>=2?`${n} parada(s) elegível(eis) no filtro`:"selecione ≥ 2 iniciativas localizáveis";
  clearRoute();                                   // a rota desenhada acompanha o filtro
  const box=document.getElementById("routebox");
  if(box&&!box.dataset.locked)box.innerHTML=ROUTE_EMPTY;
}

function drawRouteOnMap(ordered,round,road){
  routeLayer.clearLayers();
  const ll=ordered.map(s=>[s.lat,s.lng]);
  if(road&&road.line){L.geoJSON(road.line,{style:{color:"#ea580c",weight:4,opacity:.85}}).addTo(routeLayer);}
  else{const pts=round?ll.concat([ll[0]]):ll;L.polyline(pts,{color:"#ea580c",weight:3,opacity:.85,dashArray:"8,7"}).addTo(routeLayer);}
  ordered.forEach((s,i)=>{
    const icon=L.divIcon({className:"routepin",html:`${i+1}`,iconSize:[26,26]});
    L.marker([s.lat,s.lng],{icon,zIndexOffset:1000}).addTo(routeLayer)
      .bindPopup(`<b>Parada ${i+1}</b> — ${s.label} <span class="kind">(${s.kind})</span><br>`+
        s.items.map(d=>`• ${d.iniciativa} <b>(${num(d.pontuacao)||"—"})</b>`).join("<br>"));
  });
}

function fillRouteBox(ordered,r,road){
  document.getElementById("route-sub").textContent=`(${ordered.length} paradas)`;
  const km=road?road.km:r.total;
  let head=`<div class="route-sum">
    <div><span class="rs-k">Paradas</span><span class="rs-v">${ordered.length}</span></div>
    <div><span class="rs-k">Iniciativas</span><span class="rs-v">${ordered.reduce((a,s)=>a+s.items.length,0)}</span></div>
    <div><span class="rs-k">Distância</span><span class="rs-v">${km.toFixed(0)} km</span></div>`;
  if(road)head+=`<div><span class="rs-k">Tempo (carro)</span><span class="rs-v">${(road.min/60).toFixed(1)} h</span></div>`;
  head+=`<div><span class="rs-k">Modo</span><span class="rs-v">${road?"rodovias":"linha reta"}${r.round?" · circular":""}</span></div></div>`;
  const items=ordered.map((s,i)=>{const leg=i>0?r.legs[i-1]:0;
    const names=s.items.map(d=>`${d.iniciativa} <span class="ri-sc">${num(d.pontuacao)||"—"}</span>`).join("<br>");
    return `<div class="ri"><span class="ri-n">${i+1}</span><div class="ri-b"><div class="ri-loc">${s.label} <span class="kind">${s.kind}</span></div><div class="ri-names">${names}</div></div><span class="ri-km">${i>0?leg.toFixed(0)+" km":"início"}</span></div>`;}).join("");
  const box=document.getElementById("routebox");
  box.dataset.locked="1";
  box.innerHTML=head+`<div class="rilist">${items}</div>`+
    `<div class="route-note"><b>Como a rota é montada:</b> ponto = sede (quando no Nordeste) ou centróide das UFs cobertas (programas regionais/federais). Ordenação por vizinho-mais-próximo + melhoria 2-opt. "Linha reta" usa distância geodésica; "rodovias" consulta o OSRM para distância/tempo reais.</div>`;
}

async function generateRoute(){
  const r=computeRoute();const box=document.getElementById("routebox");
  const st=document.getElementById("route-status");
  if(!r){box.dataset.locked="";box.innerHTML='<div class="route-empty">São necessárias pelo menos 2 iniciativas localizáveis. Ajuste os filtros.</div>';return;}
  const ordered=r.order.map(i=>r.stops[i]);
  let road=null;
  if(document.getElementById("route-road").checked){
    st.textContent="Consultando OSRM…";
    try{road=await drawRoadGeometry(ordered,r.round);}
    catch(e){road=null;st.textContent="OSRM indisponível — usando linha reta";}
  }
  drawRouteOnMap(ordered,r.round,road);
  fillRouteBox(ordered,r,road);
  if(!road)st.textContent=`Rota com ${ordered.length} paradas · ${r.total.toFixed(0)} km (linha reta)`;
  else st.textContent=`Rota com ${ordered.length} paradas · ${road.km.toFixed(0)} km por rodovias`;
  map.fitBounds(ordered.map(s=>[s.lat,s.lng]),{padding:[45,45]});
}

function wireRouteControls(){
  const box=document.getElementById("routebox");if(box&&!box.innerHTML.trim())box.innerHTML=ROUTE_EMPTY;
  document.getElementById("route-btn").addEventListener("click",generateRoute);
  document.getElementById("route-clear-btn").addEventListener("click",()=>{
    clearRoute();const b=document.getElementById("routebox");b.dataset.locked="";b.innerHTML=ROUTE_EMPTY;
    document.getElementById("route-sub").textContent="";document.getElementById("route-status").textContent="";});
}
"""
