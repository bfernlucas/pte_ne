/* Camadas compartilhadas dos mapas (base, limites estaduais, aeroportos).
   Usado por dashboard.js (Mapa geral) e rota.js (Rotas de campo). */
window.PTE_MAP = (function () {
  "use strict";

  // ---------- camadas de base ----------
  function bases() {
    const ruas = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 20 });
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "&copy; OpenStreetMap", maxZoom: 19 });
    const claro = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 20 });
    const relevo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      { attribution: "&copy; OpenTopoMap (CC-BY-SA)", maxZoom: 17 });
    const satelite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "&copy; Esri, Maxar, Earthstar Geographics", maxZoom: 19 });
    return {
      "Ruas e estradas": ruas,
      "Mapa OSM (detalhado)": osm,
      "Claro (mínimo)": claro,
      "Relevo": relevo,
      "Satélite": satelite,
    };
  }

  // ---------- aeroportos do Nordeste ----------
  const AIRPORTS = [
    { iata: "SLZ", cidade: "São Luís", uf: "MA", lat: -2.5853, lon: -44.2341 },
    { iata: "IMP", cidade: "Imperatriz", uf: "MA", lat: -5.5313, lon: -47.4598 },
    { iata: "THE", cidade: "Teresina", uf: "PI", lat: -5.0599, lon: -42.8235 },
    { iata: "FOR", cidade: "Fortaleza", uf: "CE", lat: -3.7763, lon: -38.5326 },
    { iata: "JDO", cidade: "Juazeiro do Norte", uf: "CE", lat: -7.2188, lon: -39.2701 },
    { iata: "NAT", cidade: "Natal", uf: "RN", lat: -5.7681, lon: -35.3766 },
    { iata: "MVF", cidade: "Mossoró", uf: "RN", lat: -5.2019, lon: -37.3643 },
    { iata: "JPA", cidade: "João Pessoa", uf: "PB", lat: -7.1485, lon: -34.9506 },
    { iata: "CPV", cidade: "Campina Grande", uf: "PB", lat: -7.2699, lon: -35.8964 },
    { iata: "REC", cidade: "Recife", uf: "PE", lat: -8.1265, lon: -34.9236 },
    { iata: "PNZ", cidade: "Petrolina", uf: "PE", lat: -9.3624, lon: -40.5690 },
    { iata: "MCZ", cidade: "Maceió", uf: "AL", lat: -9.5108, lon: -35.7917 },
    { iata: "AJU", cidade: "Aracaju", uf: "SE", lat: -10.9840, lon: -37.0703 },
    { iata: "SSA", cidade: "Salvador", uf: "BA", lat: -12.9086, lon: -38.3225 },
    { iata: "VDC", cidade: "Vitória da Conquista", uf: "BA", lat: -14.8628, lon: -40.8631 },
    { iata: "IOS", cidade: "Ilhéus", uf: "BA", lat: -14.8160, lon: -39.0335 },
    { iata: "BPS", cidade: "Porto Seguro", uf: "BA", lat: -16.4386, lon: -39.0808 },
  ];
  function airportIcon() {
    return L.divIcon({ className: "apt-wrap", html: `<span class="apt-ico">✈</span>`, iconSize: [22, 22], iconAnchor: [11, 11] });
  }
  function airportLayer() {
    const g = L.layerGroup();
    AIRPORTS.forEach(a => {
      L.marker([a.lat, a.lon], { icon: airportIcon(), keyboard: false })
        .bindPopup(`<span class="pp-h">Aeroporto · ${a.iata}</span>${a.cidade} / ${a.uf}`)
        .bindTooltip(a.iata, { direction: "top", offset: [0, -8], className: "apt-tip" })
        .addTo(g);
    });
    return g;
  }

  // ---------- limites estaduais (contornos do NE) ----------
  function ufLayer() {
    const g = L.layerGroup();
    const data = window.PTE_UF_NE;
    if (!data) return g;
    L.geoJSON(data, {
      interactive: false,
      style: { color: "#292d76", weight: 1.4, opacity: .6, fill: true, fillColor: "#292d76", fillOpacity: .03 },
    }).addTo(g);
    // rótulos (sigla) no centro aproximado de cada estado
    data.features.forEach(f => {
      const xs = [], ys = [];
      const walk = a => { if (typeof a[0] === "number") { xs.push(a[0]); ys.push(a[1]); } else a.forEach(walk); };
      walk(f.geometry.coordinates);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      L.marker([cy, cx], {
        interactive: false, keyboard: false,
        icon: L.divIcon({ className: "uf-label", html: f.properties.sigla, iconSize: [26, 16], iconAnchor: [13, 8] }),
      }).addTo(g);
    });
    return g;
  }

  // ---------- montagem ----------
  // opts: { base: nome da base padrão, boundaries: bool, airports: bool }
  function setup(map, opts) {
    opts = opts || {};
    const b = bases();
    const def = b[opts.base] ? opts.base : "Ruas e estradas";
    b[def].addTo(map);
    const overlays = { "Limites estaduais": ufLayer() };
    if (!opts.noAirports) overlays["Aeroportos"] = airportLayer();
    if (opts.boundaries !== false) overlays["Limites estaduais"].addTo(map);
    if (opts.airports && overlays["Aeroportos"]) overlays["Aeroportos"].addTo(map);
    L.control.layers(b, overlays, { position: "topright", collapsed: true }).addTo(map);
    return overlays;
  }

  return { bases, overlays: () => ({ "Limites estaduais": ufLayer(), "Aeroportos": airportLayer() }), setup, AIRPORTS };
})();
