/* Exportação de tabelas (XLSX/PDF) e mapas/gráficos (PNG/PDF).
   Bibliotecas carregadas sob demanda (lazy) a partir de CDN no 1º uso.
   Botões declarativos: <button class="exp-btn" data-exp="xlsx|pdf|png|pdf-el"
     data-target="#sel" data-name="arquivo" data-title="Título" data-sheet="Aba"> */
window.PTE_EXPORT = (function () {
  "use strict";

  const LIB = {
    xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    autotable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
    h2c: "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
  };
  const _loaded = {};
  function loadScript(url) {
    if (_loaded[url]) return _loaded[url];
    _loaded[url] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = url; s.async = true;
      s.onload = () => res();
      s.onerror = () => { delete _loaded[url]; rej(new Error("Falha ao carregar " + url)); };
      document.head.appendChild(s);
    });
    return _loaded[url];
  }
  async function ensureXLSX() { if (!window.XLSX) await loadScript(LIB.xlsx); return window.XLSX; }
  async function ensurePDF() { if (!window.jspdf) await loadScript(LIB.jspdf); await loadScript(LIB.autotable); return window.jspdf; }
  async function ensureH2C() { if (!window.html2canvas) await loadScript(LIB.h2c); return window.html2canvas; }

  // ---------- utilidades ----------
  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function stamp() { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`; }
  function fname(name, ext) { return `PTE-NE_${name || "export"}_${stamp()}.${ext}`; }
  function download(href, file) { const a = document.createElement("a"); a.href = href; a.download = file; document.body.appendChild(a); a.click(); a.remove(); }

  function getTable(sel) {
    const el = document.querySelector(sel);
    if (!el) return null;
    return el.tagName === "TABLE" ? el : el.querySelector("table");
  }
  // texto legível de uma célula (junta nome + subtítulo, ignora dots/barras vazias)
  function cellText(td) {
    const parts = [];
    td.childNodes.forEach(n => {
      if (n.nodeType === 3) { const t = clean(n.textContent); if (t) parts.push(t); }
      else if (n.nodeType === 1) {
        const t = clean(n.textContent); if (!t) return;
        parts.push(n.classList && n.classList.contains("sub") ? "— " + t : t);
      }
    });
    return clean(parts.join(" "));
  }
  // extrai cabeçalhos + linhas, ignorando colunas de ação (âncora / botão remover ao final)
  function extract(table) {
    const headRow = table.querySelector("thead tr");
    const ths = headRow ? [...headRow.children] : [];
    const skip = ths.map((th, i) => /âncora|ancora/i.test(th.textContent) || (clean(th.textContent) === "" && i === ths.length - 1));
    const headers = ths.filter((_, i) => !skip[i]).map(th => clean(th.textContent));
    const rows = [];
    table.querySelectorAll("tbody tr").forEach(tr => {
      const cells = [...tr.children];
      if (cells.length === 1 && cells[0].hasAttribute("colspan")) return; // linha "vazio"
      rows.push(cells.filter((_, i) => !skip[i]).map(cellText));
    });
    return { headers, rows };
  }

  // ---------- XLSX ----------
  async function toXLSX(t) {
    const table = getTable(t.target);
    if (!table) return alert("Nada para exportar ainda nesta tabela.");
    const { headers, rows } = extract(table);
    if (!rows.length) return alert("Nada para exportar ainda nesta tabela.");
    const XLSX = await ensureXLSX();
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = headers.map((h, i) => ({ wch: Math.min(60, Math.max(8, Math.max(h.length, ...rows.map(r => (r[i] || "").length)) + 2)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, clean(t.sheet || t.title || "Dados").slice(0, 31) || "Dados");
    XLSX.writeFile(wb, fname(t.name, "xlsx"));
  }

  // ---------- PDF (cabeçalho da marca) ----------
  function pdfHeader(doc, title) {
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(41, 45, 118); doc.rect(0, 0, pw, 40, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("Plano Brasil Nordeste", 28, 18);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    if (title) doc.text(clean(title), 28, 31);
    doc.setFontSize(8); doc.setTextColor(225, 230, 245);
    doc.text(new Date().toLocaleDateString("pt-BR"), pw - 28, 31, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }
  async function toPDF(t) {
    const table = getTable(t.target);
    if (!table) return alert("Nada para exportar ainda nesta tabela.");
    const { headers, rows } = extract(table);
    if (!rows.length) return alert("Nada para exportar ainda nesta tabela.");
    const { jsPDF } = await ensurePDF();
    const landscape = headers.length > 6;
    const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
    doc.autoTable({
      head: [headers], body: rows, startY: 52, margin: { top: 52, left: 28, right: 28 },
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: [41, 45, 118], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 246, 251] },
      didDrawPage: () => pdfHeader(doc, t.title),
    });
    doc.save(fname(t.name, "pdf"));
  }

  // ---------- PNG (mapa via html2canvas; gráfico via canvas direto) ----------
  function canvasToWhitePNG(canvas) {
    const c = document.createElement("canvas"); c.width = canvas.width; c.height = canvas.height;
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(canvas, 0, 0);
    return c.toDataURL("image/png");
  }
  async function snap(el) {
    if (el.tagName === "CANVAS") return canvasToWhitePNG(el);
    const h2c = await ensureH2C();
    const isMap = el.classList && el.classList.contains("map");
    // reenquadra o mapa nos pontos/rotas e aguarda os tiles antes de capturar
    if (isMap && typeof el._pteFit === "function") { try { el._pteFit(); } catch (e) {} await new Promise(r => setTimeout(r, 950)); }
    const canvas = await h2c(el, {
      useCORS: true, allowTaint: false, backgroundColor: "#ffffff", logging: false,
      scale: isMap ? Math.max(2.5, (window.devicePixelRatio || 1) * 1.5) : 2,
      width: el.offsetWidth, height: el.offsetHeight, scrollX: 0, scrollY: 0, imageTimeout: 20000
    });
    return canvas.toDataURL("image/png");
  }
  async function toPNG(t) {
    const el = document.querySelector(t.target);
    if (!el) return alert("Elemento não encontrado para exportar.");
    download(await snap(el), fname(t.name, "png"));
  }

  // ---------- PDF de um elemento (ex.: roteiro) — paginado com cabeçalho ----------
  async function toPDFel(t) {
    const el = document.querySelector(t.target);
    if (!el || !clean(el.textContent)) return alert("Nada para exportar ainda.");
    const h2c = await ensureH2C();
    const big = await h2c(el, { useCORS: true, allowTaint: false, backgroundColor: "#ffffff", scale: 2, logging: false });
    const { jsPDF } = await ensurePDF();
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    const margin = 28, top = 52, usableW = pw - margin * 2, usableH = ph - top - margin;
    const scale = usableW / big.width;            // px(canvas) -> pt
    const pageCanvasH = Math.max(1, Math.floor(usableH / scale));
    let sy = 0, page = 0;
    while (sy < big.height) {
      if (page > 0) doc.addPage();
      pdfHeader(doc, t.title);
      const sliceH = Math.min(pageCanvasH, big.height - sy);
      const tmp = document.createElement("canvas"); tmp.width = big.width; tmp.height = sliceH;
      tmp.getContext("2d").drawImage(big, 0, sy, big.width, sliceH, 0, 0, big.width, sliceH);
      doc.addImage(tmp.toDataURL("image/png"), "PNG", margin, top, usableW, sliceH * scale);
      sy += sliceH; page++;
    }
    doc.save(fname(t.name, "pdf"));
  }

  const ACTIONS = { xlsx: toXLSX, pdf: toPDF, png: toPNG, "pdf-el": toPDFel };

  async function run(btn) {
    const t = { kind: btn.dataset.exp, target: btn.dataset.target, name: btn.dataset.name, title: btn.dataset.title, sheet: btn.dataset.sheet };
    const fn = ACTIONS[t.kind];
    if (!fn) return;
    const orig = btn.textContent;
    btn.disabled = true; btn.dataset.busy = "1"; btn.textContent = "…";
    try { await fn(t); }
    catch (e) { console.error(e); alert("Não foi possível exportar agora. Verifique a conexão e tente novamente.\n(" + (e && e.message ? e.message : e) + ")"); }
    finally { btn.disabled = false; delete btn.dataset.busy; btn.textContent = orig; }
  }

  document.addEventListener("click", e => {
    const btn = e.target.closest && e.target.closest(".exp-btn");
    if (btn && !btn.dataset.busy) { e.preventDefault(); run(btn); }
  });

  return { toXLSX, toPDF, toPNG, toPDFel, _extract: extract, _cellText: cellText };
})();
