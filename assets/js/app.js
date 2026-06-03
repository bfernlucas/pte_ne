/* global CONFIG, DEMO_DATA, Papa, Chart, L */

// ----------------------------------------------------------------------------
// Estado global
// ----------------------------------------------------------------------------
const state = {
  rows: [],
  charts: {},
  map: null,
  markersLayer: null,
};

// ----------------------------------------------------------------------------
// Carregamento de dados
// ----------------------------------------------------------------------------

/** Monta a URL pública (gviz) que devolve a planilha em CSV, em tempo real. */
function buildSheetUrl() {
  const id = encodeURIComponent(CONFIG.SHEET_ID);
  const name = encodeURIComponent(CONFIG.SHEET_NAME);
  // cache-buster para garantir dados frescos a cada atualização
  const t = Date.now();
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${name}&_=${t}`;
}

/** Carrega dados do Google Sheets (ou demo) e devolve uma lista de objetos. */
function loadData() {
  return new Promise((resolve, reject) => {
    if (CONFIG.USE_DEMO_DATA) {
      resolve(DEMO_DATA.slice());
      return;
    }
    Papa.parse(buildSheetUrl(), {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: (err) => reject(err),
    });
  });
}

// ----------------------------------------------------------------------------
// Formatação
// ----------------------------------------------------------------------------
const fmt = {
  int: (n) => new Intl.NumberFormat("pt-BR").format(Math.round(n || 0)),
  money: (n) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0),
  num: (n) => new Intl.NumberFormat("pt-BR").format(n || 0),
};
function formatValue(value, format) {
  return (fmt[format] || fmt.num)(value);
}

function toNumber(v) {
  if (typeof v === "number") return v;
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// ----------------------------------------------------------------------------
// Renderização — KPIs
// ----------------------------------------------------------------------------
function renderKpis(rows) {
  const el = document.getElementById("kpis");
  el.innerHTML = "";
  CONFIG.COLUMNS.metrics.forEach((m) => {
    const total = rows.reduce((acc, r) => acc + toNumber(r[m.key]), 0);
    const isMoney = m.format === "money";
    // para dinheiro mostramos a média; para o resto, o total
    const value = isMoney ? total / (rows.length || 1) : total;
    const label = isMoney ? `${m.label} (média)` : `${m.label} (total)`;
    const card = document.createElement("div");
    card.className = "kpi-card";
    card.innerHTML = `
      <span class="kpi-label">${label}</span>
      <span class="kpi-value">${formatValue(value, m.format)}</span>
    `;
    el.appendChild(card);
  });
}

// ----------------------------------------------------------------------------
// Renderização — Gráficos
// ----------------------------------------------------------------------------
const PALETTE = [
  "#2563eb", "#16a34a", "#ea580c", "#9333ea", "#dc2626",
  "#0891b2", "#ca8a04", "#db2777", "#475569", "#65a30d",
];

function renderBarChart(rows) {
  const metricKey = CONFIG.PRIMARY_METRIC;
  const metric = CONFIG.COLUMNS.metrics.find((m) => m.key === metricKey) || {};
  const sorted = rows
    .slice()
    .sort((a, b) => toNumber(b[metricKey]) - toNumber(a[metricKey]))
    .slice(0, 10);

  const labels = sorted.map((r) => r[CONFIG.COLUMNS.label]);
  const data = sorted.map((r) => toNumber(r[metricKey]));
  const ctx = document.getElementById("barChart");

  if (state.charts.bar) state.charts.bar.destroy();
  state.charts.bar = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: metric.label || metricKey, data, backgroundColor: "#2563eb", borderRadius: 4 }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
    },
  });
}

function renderCategoryChart(rows) {
  const catKey = CONFIG.COLUMNS.category;
  const metricKey = CONFIG.PRIMARY_METRIC;
  const groups = {};
  rows.forEach((r) => {
    const cat = r[catKey] || "—";
    groups[cat] = (groups[cat] || 0) + toNumber(r[metricKey]);
  });
  const labels = Object.keys(groups);
  const data = Object.values(groups);
  const ctx = document.getElementById("pieChart");

  if (state.charts.pie) state.charts.pie.destroy();
  state.charts.pie = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: PALETTE }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    },
  });
}

// ----------------------------------------------------------------------------
// Renderização — Mapa
// ----------------------------------------------------------------------------
function renderMap(rows) {
  const latKey = CONFIG.COLUMNS.lat;
  const lonKey = CONFIG.COLUMNS.lon;
  const metricKey = CONFIG.PRIMARY_METRIC;
  const points = rows.filter((r) => toNumber(r[latKey]) && toNumber(r[lonKey]));

  if (!state.map) {
    state.map = L.map("map");
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(state.map);
    state.markersLayer = L.layerGroup().addTo(state.map);
  }
  state.markersLayer.clearLayers();

  if (!points.length) {
    state.map.setView([-3.73, -38.52], 11); // fallback: Fortaleza
    return;
  }

  const max = Math.max(...points.map((r) => toNumber(r[metricKey]))) || 1;
  const bounds = [];
  points.forEach((r) => {
    const lat = toNumber(r[latKey]);
    const lon = toNumber(r[lonKey]);
    const val = toNumber(r[metricKey]);
    const radius = 6 + (val / max) * 22;
    bounds.push([lat, lon]);
    const metric = CONFIG.COLUMNS.metrics.find((m) => m.key === metricKey) || {};
    L.circleMarker([lat, lon], {
      radius,
      color: "#2563eb",
      fillColor: "#3b82f6",
      fillOpacity: 0.6,
      weight: 1.5,
    })
      .bindPopup(
        `<strong>${r[CONFIG.COLUMNS.label] || ""}</strong><br>` +
          `${r[CONFIG.COLUMNS.category] || ""}<br>` +
          `${metric.label || metricKey}: ${formatValue(val, metric.format)}`
      )
      .addTo(state.markersLayer);
  });
  state.map.fitBounds(bounds, { padding: [30, 30] });
}

// ----------------------------------------------------------------------------
// Renderização — Tabela
// ----------------------------------------------------------------------------
function renderTable(rows) {
  const cols = [
    { key: CONFIG.COLUMNS.label, label: "Item", format: null },
    { key: CONFIG.COLUMNS.category, label: "Categoria", format: null },
    ...CONFIG.COLUMNS.metrics.map((m) => ({ key: m.key, label: m.label, format: m.format })),
  ];
  const thead = `<tr>${cols.map((c) => `<th>${c.label}</th>`).join("")}</tr>`;
  const tbody = rows
    .map(
      (r) =>
        `<tr>${cols
          .map((c) => {
            const v = r[c.key];
            const out = c.format ? formatValue(toNumber(v), c.format) : v ?? "";
            return `<td>${out}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");
  document.getElementById("dataTable").innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody>`;
}

// ----------------------------------------------------------------------------
// Orquestração
// ----------------------------------------------------------------------------
function renderAll(rows) {
  state.rows = rows;
  renderKpis(rows);
  renderBarChart(rows);
  renderCategoryChart(rows);
  renderMap(rows);
  renderTable(rows);
  const stamp = new Date().toLocaleTimeString("pt-BR");
  document.getElementById("lastUpdate").textContent = `Atualizado às ${stamp}`;
  document.getElementById("rowCount").textContent = `${rows.length} registros`;
}

async function refresh() {
  const status = document.getElementById("status");
  try {
    status.textContent = "Carregando…";
    const rows = await loadData();
    renderAll(rows);
    status.textContent = CONFIG.USE_DEMO_DATA ? "Dados de exemplo" : "Conectado ao Google Sheets";
    status.className = "status ok";
  } catch (err) {
    console.error(err);
    status.textContent = "Erro ao carregar dados — confira o ID/aba da planilha";
    status.className = "status error";
  }
}

// ----------------------------------------------------------------------------
// Início
// ----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refreshBtn").addEventListener("click", refresh);
  refresh();
  if (CONFIG.REFRESH_SECONDS > 0) {
    setInterval(refresh, CONFIG.REFRESH_SECONDS * 1000);
  }
});
