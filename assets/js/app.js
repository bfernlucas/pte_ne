/* global CONFIG, DEMO_DATA, Papa, Chart, L */

// ----------------------------------------------------------------------------
// Estado global
// ----------------------------------------------------------------------------
const state = {
  allRows: [], // todos os registros carregados
  rows: [], // registros após filtros
  filters: {}, // { coluna: valor selecionado }
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
  const t = Date.now(); // cache-buster: garante dados frescos
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
// Utilitários
// ----------------------------------------------------------------------------
const fmt = {
  int: (n) => new Intl.NumberFormat("pt-BR").format(Math.round(n || 0)),
  money: (n) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0),
  num: (n) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n || 0),
};
function formatValue(value, format) {
  return format ? (fmt[format] || fmt.num)(value) : value ?? "";
}
function toNumber(v) {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const PALETTE = [
  "#2563eb", "#16a34a", "#ea580c", "#9333ea", "#dc2626",
  "#0891b2", "#ca8a04", "#db2777", "#475569", "#65a30d",
];

/** Conta registros por valor de uma coluna; devolve [labels, valores] ordenado. */
function countBy(rows, key) {
  const groups = {};
  rows.forEach((r) => {
    const v = (r[key] ?? "—").toString().trim() || "—";
    groups[v] = (groups[v] || 0) + 1;
  });
  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  return [entries.map((e) => e[0]), entries.map((e) => e[1])];
}

// ----------------------------------------------------------------------------
// KPIs
// ----------------------------------------------------------------------------
function renderKpis(rows) {
  const el = document.getElementById("kpis");
  el.innerHTML = "";
  CONFIG.KPIS.forEach((k) => {
    let value;
    if (k.type === "count") {
      value = fmt.int(rows.length);
    } else if (k.type === "distinct") {
      const set = new Set(rows.map((r) => (r[k.key] ?? "").toString().trim()).filter(Boolean));
      value = fmt.int(set.size);
    } else if (k.type === "avg") {
      const nums = rows.map((r) => toNumber(r[k.key]));
      const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      value = formatValue(avg, k.format || "num");
    } else if (k.type === "sum") {
      const total = rows.reduce((a, r) => a + toNumber(r[k.key]), 0);
      value = formatValue(total, k.format || "num");
    }
    const card = document.createElement("div");
    card.className = "kpi-card";
    card.innerHTML = `<span class="kpi-label">${k.label}</span><span class="kpi-value">${value}</span>`;
    el.appendChild(card);
  });
}

// ----------------------------------------------------------------------------
// Gráficos
// ----------------------------------------------------------------------------
function renderBarChart(rows) {
  const cfg = CONFIG.CHARTS.bar;
  const [labels, data] = countBy(rows, cfg.key);
  const ctx = document.getElementById("barChart");
  if (state.charts.bar) state.charts.bar.destroy();
  state.charts.bar = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: "#2563eb", borderRadius: 4 }] },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function renderPieChart(rows) {
  const cfg = CONFIG.CHARTS.pie;
  const [labels, data] = countBy(rows, cfg.key);
  const ctx = document.getElementById("pieChart");
  if (state.charts.pie) state.charts.pie.destroy();
  state.charts.pie = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: PALETTE }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 } } } },
    },
  });
}

// ----------------------------------------------------------------------------
// Mapa
// ----------------------------------------------------------------------------
function renderMap(rows) {
  const { lat: latKey, lon: lonKey, label: labelKey, popup } = CONFIG.COLUMNS;
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
    state.map.setView([-8.5, -39], 5); // fallback: Nordeste
    return;
  }
  const bounds = [];
  points.forEach((r) => {
    const lat = toNumber(r[latKey]);
    const lon = toNumber(r[lonKey]);
    bounds.push([lat, lon]);
    const extra = (popup || [])
      .map((k) => (r[k] ? `${r[k]}` : ""))
      .filter(Boolean)
      .join("<br>");
    L.circleMarker([lat, lon], {
      radius: 7,
      color: "#1d4ed8",
      fillColor: "#3b82f6",
      fillOpacity: 0.7,
      weight: 1.5,
    })
      .bindPopup(`<strong>${r[labelKey] || ""}</strong><br>${extra}`)
      .addTo(state.markersLayer);
  });
  state.map.fitBounds(bounds, { padding: [30, 30] });
}

// ----------------------------------------------------------------------------
// Tabela
// ----------------------------------------------------------------------------
function renderTable(rows) {
  const cols = CONFIG.COLUMNS.table;
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
// Filtros
// ----------------------------------------------------------------------------
function buildFilters() {
  const bar = document.getElementById("filters");
  bar.innerHTML = "";
  (CONFIG.FILTERS || []).forEach((f) => {
    const values = Array.from(
      new Set(state.allRows.map((r) => (r[f.key] ?? "").toString().trim()).filter(Boolean))
    ).sort();
    const wrap = document.createElement("label");
    wrap.className = "filter";
    const opts = ['<option value="">Todos</option>']
      .concat(values.map((v) => `<option value="${v}">${v}</option>`))
      .join("");
    wrap.innerHTML = `<span>${f.label}</span><select data-key="${f.key}">${opts}</select>`;
    wrap.querySelector("select").addEventListener("change", (e) => {
      state.filters[f.key] = e.target.value;
      applyFiltersAndRender();
    });
    bar.appendChild(wrap);
  });
}

function applyFiltersAndRender() {
  state.rows = state.allRows.filter((r) =>
    Object.entries(state.filters).every(
      ([k, v]) => !v || (r[k] ?? "").toString().trim() === v
    )
  );
  renderAll(state.rows);
}

// ----------------------------------------------------------------------------
// Orquestração
// ----------------------------------------------------------------------------
function renderAll(rows) {
  renderKpis(rows);
  renderBarChart(rows);
  renderPieChart(rows);
  renderMap(rows);
  renderTable(rows);
  document.getElementById("barTitle").textContent = CONFIG.CHARTS.bar.title;
  document.getElementById("pieTitle").textContent = CONFIG.CHARTS.pie.title;
  document.getElementById("rowCount").textContent = `${rows.length} de ${state.allRows.length} registros`;
  document.getElementById("lastUpdate").textContent =
    `Atualizado às ${new Date().toLocaleTimeString("pt-BR")}`;
}

async function refresh() {
  const status = document.getElementById("status");
  try {
    status.textContent = "Carregando…";
    state.allRows = await loadData();
    buildFilters();
    applyFiltersAndRender();
    status.textContent = CONFIG.USE_DEMO_DATA ? "Dados de exemplo (planilha PTE2026)" : "Conectado ao Google Sheets";
    status.className = "status ok";
  } catch (err) {
    console.error(err);
    status.textContent = "Erro ao carregar — confira o ID/aba da planilha";
    status.className = "status error";
  }
}

// ----------------------------------------------------------------------------
// Início
// ----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refreshBtn").addEventListener("click", refresh);
  refresh();
  if (CONFIG.REFRESH_SECONDS > 0) setInterval(refresh, CONFIG.REFRESH_SECONDS * 1000);
});
