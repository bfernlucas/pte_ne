/* PTE Nordeste — módulo "Evidência de campo".
   Consome window.PTE_CAMPO, decifrado por auth.js depois do login.
   Quatro sub-visões: Experiências, Carteira, Prospecção × campo e Gargalos. */
(function () {
  "use strict";

  var raiz = document.getElementById("view-campo");
  if (!raiz) return;

  var dados = window.PTEAuth && window.PTEAuth.dados();
  if (!dados || !dados.experiencias) {
    raiz.innerHTML = '<p class="ec-intro">Não foi possível carregar a camada de campo.</p>';
    return;
  }

  var EIXOS = {
    FSI:  ["Finanças Sustentáveis e Inclusivas", "#1f4da1"],
    ADT:  ["Adensamento Tecnológico", "#7a3fb8"],
    BIO:  ["Bioeconomia e Sist. Agroalimentares", "#43a047"],
    TE:   ["Transição Energética", "#f37520"],
    EC:   ["Economia Circular e Solidária", "#f6a609"],
    NIVA: ["Nova Infraestrutura Verde-Azul", "#0d9488"]
  };
  var CLS = { alta: "Alta prioridade", estrategico: "Potencial estratégico", nao: "Não recomendada" };
  var POSTURAS = {
    direto: "Apoio direto",
    condicionado: "Apoio direto condicionado",
    quantificacao: "Quantificação prévia",
    preparacao: "Preparação ampla",
    preparatorio: "Apoio preparatório"
  };
  var DIMS = [
    ["operacao", "Operação", 25], ["investimento", "Investimento", 15],
    ["impacto", "Impacto", 30], ["inovacao", "Inovação", 30]
  ];
  var GARGALOS = dados.meta.gargalos || {};
  var POTENCIAIS = dados.meta.potenciais || {};

  var exp = dados.experiencias.slice().sort(function (a, b) { return b.total - a.total; });

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmt(v) { return v.toFixed(1).replace(".", ","); }
  function reais(v) {
    if (v == null) return "—";
    if (v >= 1e6) return "R$ " + fmt(v / 1e6) + " mi";
    return "R$ " + v.toLocaleString("pt-BR");
  }

  /* ------------------------------------------------------------------ casca */
  raiz.innerHTML =
    '<p class="ec-intro">Sistematização das três incursões — <strong>Produtos 3, 4 e 5</strong>. ' +
    '24 experiências avaliadas em quatro dimensões, convertidas em pontuação ponderada de 0 a 100 ' +
    '(Impacto 30 · Inovação 30 · Operação 25 · Investimento 15).</p>' +
    '<div class="ec-nav" id="ec-nav">' +
      '<button data-sub="lista" class="on">Experiências</button>' +
      '<button data-sub="carteira">Carteira</button>' +
      '<button data-sub="prospeccao">Prospecção × campo</button>' +
      '<button data-sub="gargalos">Gargalos e potencialidades</button>' +
      '<button data-sub="captacao">Captação</button>' +
      '<button data-sub="cobertura">Cobertura e lacunas</button>' +
      '<button data-sub="incursoes">Incursões</button>' +
    '</div>' +
    '<div class="ec-sub on" id="sub-lista"></div>' +
    '<div class="ec-sub" id="sub-carteira"></div>' +
    '<div class="ec-sub" id="sub-prospeccao"></div>' +
    '<div class="ec-sub" id="sub-gargalos"></div>' +
    '<div class="ec-sub" id="sub-captacao"></div>' +
    '<div class="ec-sub" id="sub-cobertura"></div>' +
    '<div class="ec-sub" id="sub-incursoes"></div>';

  Array.prototype.forEach.call(document.querySelectorAll("#ec-nav button"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll("#ec-nav button"),
        function (o) { o.classList.toggle("on", o === b); });
      Array.prototype.forEach.call(document.querySelectorAll(".ec-sub"),
        function (s) { s.classList.toggle("on", s.id === "sub-" + b.dataset.sub); });
    });
  });

  /* -------------------------------------------------------- 1. Experiências */
  var estado = { busca: "", eixo: "", cls: "", ev: "" }, aberta = null;

  document.getElementById("sub-lista").innerHTML =
    '<div class="ec-kpis" id="ec-kpis"></div>' +
    '<div class="ec-filtros">' +
      '<input type="search" id="ec-busca" placeholder="Buscar experiência…" />' +
      '<select id="ec-eixo"><option value="">Todos os eixos</option></select>' +
      '<select id="ec-cls"><option value="">Toda a carteira</option>' +
        '<option value="alta">Alta prioridade</option>' +
        '<option value="estrategico">Potencial estratégico</option>' +
        '<option value="nao">Não recomendada</option></select>' +
      '<select id="ec-ev"><option value="">Qualquer base informacional</option>' +
        '<option value="completa">Base completa</option>' +
        '<option value="parcial">Base parcial</option>' +
        '<option value="ausente">Base ausente</option></select>' +
      '<button id="ec-reset">Limpar</button>' +
      '<span class="cnt" id="ec-cnt"></span>' +
    '</div>' +
    '<div class="ec-tw"><table><thead><tr>' +
      '<th>Experiência</th><th>Eixo</th><th>Dimensões</th>' +
      '<th style="text-align:right">Total</th><th>Classificação</th>' +
      '<th style="text-align:right">Envelope (R$ mi)</th><th>Base</th>' +
    '</tr></thead><tbody id="ec-corpo"></tbody></table></div>' +
    '<p class="ec-rodape">Notas conforme o Apêndice 2 do Produto 5 — fonte canônica: o texto corrido dos ' +
    'eixos traz rótulos de classificação divergentes. Valores em R$ milhões correntes de agosto de 2026, ' +
    'horizonte de 36 meses, <strong>não auditados</strong>.</p>';

  var selEixo = document.getElementById("ec-eixo");
  Object.keys(EIXOS).forEach(function (k) {
    if (!exp.some(function (x) { return x.eixo_cod === k; })) return;
    var o = document.createElement("option");
    o.value = k; o.textContent = EIXOS[k][0];
    selEixo.appendChild(o);
  });

  function filtrar() {
    return exp.filter(function (x) {
      if (estado.eixo && x.eixo_cod !== estado.eixo) return false;
      if (estado.cls && x.classificacao !== estado.cls) return false;
      if (estado.ev && x.base_informacional !== estado.ev) return false;
      if (estado.busca && x.nome.toLowerCase().indexOf(estado.busca) === -1) return false;
      return true;
    });
  }

  function kpis(linhas) {
    var alta = linhas.filter(function (x) { return x.classificacao === "alta"; }).length;
    var min = linhas.reduce(function (s, x) { return s + x.envelope.min; }, 0);
    var max = linhas.reduce(function (s, x) { return s + x.envelope.max; }, 0);
    var comp = linhas.filter(function (x) { return x.base_informacional === "completa"; }).length;
    document.getElementById("ec-kpis").innerHTML =
      '<div class="ec-kpi a"><div class="v">' + linhas.length + '</div><div class="l">experiências avaliadas</div></div>' +
      '<div class="ec-kpi b"><div class="v">' + alta + '</div><div class="l">alta prioridade (≥ 80)</div></div>' +
      '<div class="ec-kpi c"><div class="v">' + fmt(min) + '–' + fmt(max) + '</div><div class="l">envelope R$ mi · 36 meses</div></div>' +
      '<div class="ec-kpi"><div class="v">' + comp + '</div><div class="l">com base informacional completa</div></div>';
  }

  function detalhe(x) {
    var p = x.perfil || {};
    var barras = DIMS.map(function (d) {
      var n = x.notas[d[0]];
      return '<div class="ec-barra"><span class="t">' + d[1] + '</span>' +
             '<span class="b"><span style="width:' + (n / 5 * 100) + '%"></span></span>' +
             '<span class="v">' + n + '/5 · p' + d[2] + '</span></div>';
    }).join("");
    var temGab = x.gabinete != null;
    var gabNorm = temGab ? Math.round(x.gabinete / 30 * 100) : null;
    var dif = temGab ? (x.total - gabNorm > 0 ? "+" : "") + (x.total - gabNorm) + " pontos" : "—";
    var env = x.envelope.max > 0
      ? "R$ " + fmt(x.envelope.min) + " a " + fmt(x.envelope.max) + " mi" : "sem alocação";
    var gargs = (x.gargalos || []).map(function (g) {
      return '<li>' + esc(GARGALOS[g] || g) + '</li>'; }).join("");
    var pots = (x.potenciais || []).map(function (g) {
      return '<li>' + esc(POTENCIAIS[g] || g) + '</li>'; }).join("");
    return '<tr class="ec-det"><td colspan="7"><div class="grid">' +
      '<div><h4>Avaliação por dimensão</h4>' + barras +
        '<dl style="margin-top:10px"><dt>Prospecção × campo</dt><dd>' +
        (temGab ? x.gabinete + '/30 (' + gabNorm + '/100) → ' + x.total + '/100 · ' + dif
                : 'não estava na base de prospecção') + '</dd></dl></div>' +
      '<div><h4>Perfil</h4><dl>' +
        '<dt>Natureza</dt><dd>' + esc(p.natureza || "—") + '</dd>' +
        '<dt>Criação</dt><dd>' + (p.ano || "—") + '</dd>' +
        '<dt>Equipe</dt><dd>' + (p.equipe != null ? p.equipe + " pessoas" : "—") + '</dd>' +
        '<dt>Alcance</dt><dd>' + esc(p.benef || "—") + '</dd></dl></div>' +
      '<div><h4>Encaminhamento</h4><dl>' +
        '<dt>Envelope</dt><dd>' + env + '</dd>' +
        '<dt>Postura</dt><dd>' + (POSTURAS[x.postura] || "—") + '</dd>' +
        '<dt>Custo operacional</dt><dd>' + reais(p.custo_anual) +
          (p.custo_anual && !p.custo_p5 ? ' <span style="font-weight:400;color:var(--faint)">(não utilizável no P5)</span>' : '') + '</dd>' +
        '<dt>Necessidade declarada</dt><dd>' + reais(p.gap) + '</dd>' +
        '<dt>Visita</dt><dd>' + esc(p.data || "—") + ' · ' + esc(p.modo || "—") +
          (p.mun ? ' · ' + esc(p.mun) + "/" + esc(p.uf) : "") + '</dd></dl></div>' +
      '<div><h4>O que se apoia</h4><p class="apoio">' + esc(x.apoio) + '</p>' +
        (gargs ? '<h4 style="margin-top:12px">Gargalos</h4><ul style="margin:0;padding-left:17px;font-size:.82rem;line-height:1.5">' + gargs + '</ul>' : '') +
        (pots ? '<h4 style="margin-top:10px">Potencialidades</h4><ul style="margin:0;padding-left:17px;font-size:.82rem;line-height:1.5">' + pots + '</ul>' : '') +
      '</div></div></td></tr>';
  }

  function render() {
    var linhas = filtrar();
    kpis(linhas);
    document.getElementById("ec-cnt").textContent = linhas.length + " de " + exp.length + " experiências";
    document.getElementById("ec-corpo").innerHTML = linhas.map(function (x, i) {
      var e = EIXOS[x.eixo_cod] || [x.eixo_cod, "#6b7080"];
      var dims = DIMS.map(function (d) {
        return '<i style="height:' + (x.notas[d[0]] / 5 * 22) + 'px"></i>'; }).join("");
      var env = x.envelope.max > 0 ? fmt(x.envelope.min) + " – " + fmt(x.envelope.max) : "—";
      var base = x.base_informacional || "ausente";
      return '<tr data-n="' + i + '">' +
        '<td class="nome">' + esc(x.nome) + '</td>' +
        '<td><span class="ec-eixo" style="background:' + e[1] + '" title="' + esc(e[0]) + '">' + esc(x.eixo_cod) + '</span></td>' +
        '<td><div class="ec-dims" title="Operação, Investimento, Impacto, Inovação">' + dims + '</div></td>' +
        '<td class="n"><strong>' + x.total + '</strong></td>' +
        '<td><span class="ec-cls ' + x.classificacao + '">' + CLS[x.classificacao] + '</span></td>' +
        '<td class="n">' + env + '</td>' +
        '<td><span class="ec-ev ' + base + '" title="base ' + base + '"></span></td></tr>' +
        (aberta === x.nome ? detalhe(x) : "");
    }).join("");
    Array.prototype.forEach.call(document.querySelectorAll("#ec-corpo tr[data-n]"), function (tr) {
      tr.addEventListener("click", function () {
        var x = linhas[Number(tr.getAttribute("data-n"))];
        aberta = aberta === x.nome ? null : x.nome;
        render();
      });
    });
  }

  document.getElementById("ec-busca").addEventListener("input", function (e) {
    estado.busca = e.target.value.toLowerCase(); render(); });
  ["eixo", "cls", "ev"].forEach(function (k) {
    document.getElementById("ec-" + k).addEventListener("change", function (e) {
      estado[k] = e.target.value; render(); }); });
  document.getElementById("ec-reset").addEventListener("click", function () {
    estado = { busca: "", eixo: "", cls: "", ev: "" };
    document.getElementById("ec-busca").value = "";
    ["eixo", "cls", "ev"].forEach(function (k) { document.getElementById("ec-" + k).value = ""; });
    render(); });
  render();

  /* ------------------------------------------------------------ 2. Carteira */
  function barrasFaixa(grupos, corDe, total) {
    var maxv = Math.max.apply(null, grupos.map(function (g) { return g.max; })) || 1;
    var esc100 = function (v) { return (v / maxv * 100); };
    return '<div class="ec-freq">' + grupos.map(function (g) {
      return '<div class="r"><span class="t">' + esc(g.rot) + ' <span style="color:var(--faint)">· ' +
        g.n + '</span></span><span class="b" title="' + fmt(g.min) + ' a ' + fmt(g.max) + ' mi">' +
        '<span style="width:' + esc100(g.max) + '%;background:' + corDe(g) + ';opacity:.35"></span>' +
        '</span><span class="v">' + (g.max > 0 ? fmt(g.min) + "–" + fmt(g.max) : "—") + '</span></div>';
    }).join("") + '</div>';
  }

  function carteira(semMetro) {
    var base = exp.filter(function (x) {
      return !(semMetro && x.nome.indexOf("Metroviário") !== -1); });
    var porEixo = Object.keys(EIXOS).map(function (k) {
      var l = base.filter(function (x) { return x.eixo_cod === k; });
      return { rot: EIXOS[k][0], cor: EIXOS[k][1], n: l.length,
               min: l.reduce(function (s, x) { return s + x.envelope.min; }, 0),
               max: l.reduce(function (s, x) { return s + x.envelope.max; }, 0) };
    }).sort(function (a, b) { return b.max - a.max; });
    var porPost = Object.keys(POSTURAS).map(function (k) {
      var l = base.filter(function (x) { return x.postura === k; });
      return { rot: POSTURAS[k], cor: "#1f4da1", n: l.length,
               min: l.reduce(function (s, x) { return s + x.envelope.min; }, 0),
               max: l.reduce(function (s, x) { return s + x.envelope.max; }, 0) };
    }).filter(function (g) { return g.n > 0; }).sort(function (a, b) { return b.max - a.max; });
    var tmin = base.reduce(function (s, x) { return s + x.envelope.min; }, 0);
    var tmax = base.reduce(function (s, x) { return s + x.envelope.max; }, 0);

    document.getElementById("ec-carteira-corpo").innerHTML =
      '<div class="ec-kpis">' +
        '<div class="ec-kpi c"><div class="v">' + fmt(tmin) + '–' + fmt(tmax) + '</div><div class="l">envelope total R$ mi</div></div>' +
        '<div class="ec-kpi a"><div class="v">' + base.filter(function (x) { return x.envelope.max > 0; }).length +
          '</div><div class="l">experiências com alocação</div></div>' +
        '<div class="ec-kpi b"><div class="v">' + fmt(tmax / Math.max(1, base.filter(function (x) { return x.envelope.max > 0; }).length)) +
          '</div><div class="l">média por experiência (teto)</div></div>' +
      '</div>' +
      '<div class="ec-card"><h3>Por eixo do PTE-NE</h3>' +
        '<p class="sub">Faixa mínimo–máximo em R$ milhões, horizonte de 36 meses</p>' +
        barrasFaixa(porEixo, function (g) { return g.cor; }) +
        '<p class="ec-nota">Infraestrutura Verde-Azul concentra a carteira. Economia Circular não teve ' +
        'nenhuma experiência na faixa de alta prioridade e ficou <strong>sem alocação</strong> — ' +
        'o Consórcio da Ibiapaba entra pelo envelope preparatório.</p></div>' +
      '<div class="ec-card"><h3>Por postura de apoio</h3>' +
        '<p class="sub">A postura decorre da base informacional e da capacidade de execução</p>' +
        barrasFaixa(porPost, function () { return "#1f4da1"; }) +
        '<p class="ec-nota">Quantificação prévia e Preparação ampla financiam <strong>estudo e ' +
        'fortalecimento</strong>, não a operação. O P5 conclui: “o primeiro movimento é de documentação, ' +
        'e não de desembolso”.</p></div>' +
      '<div class="ec-card"><h3>Quem compõe cada eixo</h3>' +
      '<p class="sub">Experiências ordenadas pela pontuação de campo</p>' +
      '<div class="ec-eixos">' + Object.keys(EIXOS).map(function (k) {
        var l = base.filter(function (x) { return x.eixo_cod === k; })
                    .sort(function (a, b) { return b.total - a.total; });
        var mn = l.reduce(function (s, x) { return s + x.envelope.min; }, 0);
        var mx2 = l.reduce(function (s, x) { return s + x.envelope.max; }, 0);
        return '<div class="ec-ex"><div class="faixa" style="background:' + EIXOS[k][1] + '"></div>' +
          '<h4>' + esc(EIXOS[k][0]) + '</h4>' +
          '<div class="env">' + l.length + ' experiência' + (l.length === 1 ? "" : "s") + ' · ' +
            (mx2 > 0 ? "R$ " + fmt(mn) + "–" + fmt(mx2) + " mi" : "sem alocação") + '</div>' +
          (l.length ? '<ol>' + l.map(function (x) {
            return '<li>' + esc(x.nome) + ' <b>' + x.total + '</b></li>'; }).join("") + '</ol>'
                    : '<p class="vazio">nenhuma experiência</p>') +
        '</div>';
      }).join("") + '</div></div>';
  }

  document.getElementById("sub-carteira").innerHTML =
    '<label class="ec-toggle"><input type="checkbox" id="ec-semmetro" /> ' +
    'Excluir o Sistema Metroviário do Ceará (R$ 40–80 mi distorcem a leitura)</label>' +
    '<div id="ec-carteira-corpo"></div>';
  document.getElementById("ec-semmetro").addEventListener("change", function (e) {
    carteira(e.target.checked); });
  carteira(false);

  /* -------------------------------------------------- 3. Prospecção × campo */
  (function () {
    var pares = exp.filter(function (x) { return x.gabinete != null; })
      .map(function (x) { return { nome: x.nome, g: x.gabinete / 30 * 100, c: x.total }; });
    var n = pares.length;
    var mx = pares.reduce(function (s, p) { return s + p.g; }, 0) / n;
    var my = pares.reduce(function (s, p) { return s + p.c; }, 0) / n;
    var sx = Math.sqrt(pares.reduce(function (s, p) { return s + Math.pow(p.g - mx, 2); }, 0) / n);
    var sy = Math.sqrt(pares.reduce(function (s, p) { return s + Math.pow(p.c - my, 2); }, 0) / n);
    var r = pares.reduce(function (s, p) { return s + (p.g - mx) * (p.c - my); }, 0) / n / (sx * sy);

    // viewBox largo: o SVG ocupa ~900px na tela, então 12px de fonte fica 12px
    var W = 900, H = 520, L = 58, R = 200, T = 20, B = 52;
    var x0 = 40, x1 = 105, y0 = 30, y1 = 108;
    var px = function (v) { return L + (v - x0) / (x1 - x0) * (W - L - R); };
    var py = function (v) { return H - B - (v - y0) / (y1 - y0) * (H - T - B); };

    var eixos = "";
    [40, 55, 70, 85, 100].forEach(function (v) {
      eixos += '<text x="' + px(v).toFixed(1) + '" y="' + (H - B + 18) +
               '" text-anchor="middle" font-size="12" fill="var(--muted)">' + v + '</text>' +
               '<text x="' + (L - 9) + '" y="' + (py(v) + 4).toFixed(1) +
               '" text-anchor="end" font-size="12" fill="var(--muted)">' + v + '</text>' +
               '<line x1="' + L + '" y1="' + py(v).toFixed(1) + '" x2="' + (W - R) +
               '" y2="' + py(v).toFixed(1) + '" stroke="var(--border-2)"/>';
    });

    var pontos = pares.map(function (p) {
      var d = p.c - p.g;
      var cor = d > 12 ? "#43a047" : (d < -12 ? "#e0392b" : "#1f4da1");
      return '<circle cx="' + px(p.g).toFixed(1) + '" cy="' + py(p.c).toFixed(1) +
             '" r="6" fill="' + cor + '" opacity=".88"><title>' + esc(p.nome) + ' — gabinete ' +
             Math.round(p.g) + ', campo ' + p.c + ' (' + (d > 0 ? "+" : "") + Math.round(d) + ')</title></circle>';
    }).join("");

    // rotula os maiores desvios, desviando verticalmente para não colidir
    var marcados = pares.filter(function (p) { return Math.abs(p.c - p.g) >= 15; })
      .sort(function (a, b) { return Math.abs(b.c - b.g) - Math.abs(a.c - a.g); })
      .slice(0, 7)
      .sort(function (a, b) { return py(a.c) - py(b.c); });
    var usados = [], rotulos = "";
    marcados.forEach(function (p) {
      var cx = px(p.g), cy = py(p.c), ly = cy;
      while (usados.some(function (u) { return Math.abs(u - ly) < 17; })) ly += 17;
      usados.push(ly);
      var lx = cx + 13;
      var d = p.c - p.g;
      rotulos += '<line x1="' + (cx + 7).toFixed(1) + '" y1="' + cy.toFixed(1) + '" x2="' +
        (lx - 3).toFixed(1) + '" y2="' + (ly - 4).toFixed(1) + '" stroke="var(--border)"/>' +
        '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) +
        '" font-size="12.5" fill="var(--ink)">' + esc(p.nome) +
        ' <tspan fill="' + (d > 0 ? "#2c6b23" : "#a5241a") + '">' +
        (d > 0 ? "+" : "") + Math.round(d) + '</tspan></text>';
    });

    document.getElementById("sub-prospeccao").innerHTML =
      '<div class="ec-card"><h3>A prospecção de gabinete prevê pouco</h3>' +
      '<p class="sub">' + n + ' experiências avaliadas nos dois momentos · correlação r = ' +
        r.toFixed(2).replace(".", ",") + '</p>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Dispersão entre nota de gabinete e nota de campo. Correlação fraca.">' +
        eixos +
        '<line x1="' + px(40).toFixed(1) + '" y1="' + py(40).toFixed(1) + '" x2="' + px(105).toFixed(1) +
          '" y2="' + py(105).toFixed(1) + '" stroke="var(--faint)" stroke-dasharray="5 5"/>' +
        '<text x="' + px(103).toFixed(1) + '" y="' + (py(105) + 16).toFixed(1) +
          '" text-anchor="end" font-size="11.5" fill="var(--faint)">campo = gabinete</text>' +
        '<line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '" stroke="var(--border)"/>' +
        '<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (H - B) + '" stroke="var(--border)"/>' +
        pontos + rotulos +
        '<text x="' + ((W - R + L) / 2).toFixed(1) + '" y="' + (H - 10) +
          '" text-anchor="middle" font-size="12" fill="var(--muted)">nota de gabinete · 0–30 normalizada para 100</text>' +
        '<text x="16" y="' + (H / 2) + '" text-anchor="middle" font-size="12" fill="var(--muted)" transform="rotate(-90 16 ' + (H / 2) + ')">nota de campo · 0–100</text>' +
      '</svg>' +
      '<p class="ec-nota">As médias quase coincidem — <strong>' + Math.round(mx) + '</strong> no gabinete contra ' +
      '<strong>' + Math.round(my) + '</strong> no campo — mas as posições individuais embaralham. ' +
      'Verde subiu mais de 12 pontos depois da visita; vermelho caiu. O caso extremo é o ' +
      '<strong>Carbono Social do Bioma Caatinga</strong>: 90 no gabinete, <strong>40</strong> no campo — ' +
      'a visita encontrou uma organização sem créditos gerados, sem receita e sem financiamento, ' +
      'nada disso visível no levantamento documental. A prospecção acerta a média da carteira e erra ' +
      'o caso individual, que é a unidade de decisão. É a justificativa quantitativa do trabalho ' +
      'de campo.</p></div>';
  })();

  /* ------------------------------------------------------------ 4. Gargalos */
  (function () {
    function freq(dic, campo, cor) {
      var c = {};
      Object.keys(dic).forEach(function (k) { c[k] = 0; });
      exp.forEach(function (x) { (x[campo] || []).forEach(function (k) { c[k]++; }); });
      var ord = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
      return { ord: ord, html: '<div class="ec-freq">' + ord.map(function (k) {
        return '<div class="r"><span class="t">' + esc(dic[k]) + '</span>' +
          '<span class="b"><span style="width:' + (c[k] / exp.length * 100) + '%;background:' + cor + ';opacity:.75"></span></span>' +
          '<span class="v">' + c[k] + '/' + exp.length + '</span></div>';
      }).join("") + '</div>' };
    }
    var fg = freq(GARGALOS, "gargalos", "#e0392b");
    var fp = freq(POTENCIAIS, "potenciais", "#43a047");

    var ordExp = exp.slice().sort(function (a, b) {
      return (b.gargalos || []).length - (a.gargalos || []).length; });
    var cab = fg.ord.map(function (k) {
      return '<th class="vert"><div>' + esc(GARGALOS[k]) + '</div></th>'; }).join("");
    var linhas = ordExp.map(function (x) {
      return '<tr><th class="rot">' + esc(x.nome) + '</th>' +
        fg.ord.map(function (k) {
          var on = (x.gargalos || []).indexOf(k) !== -1;
          return '<td class="' + (on ? "on" : "") + '" title="' + esc(GARGALOS[k]) + '"><i></i></td>';
        }).join("") +
        '<td class="tot">' + (x.gargalos || []).length + '</td></tr>';
    }).join("");

    document.getElementById("sub-gargalos").innerHTML =
      '<div class="ec-card"><h3>Gargalos recorrentes</h3>' +
      '<p class="sub">Frequência sobre as 24 experiências avaliadas</p>' + fg.html +
      '<p class="ec-nota">A ausência de indicadores sistematizados e a dependência de fonte única de ' +
      'financiamento atravessam quase toda a carteira. São <strong>pauta comum</strong>, não problema ' +
      'individual — e justificam apoio horizontal em vez de 15 apoios isolados.</p></div>' +
      '<div class="ec-card"><h3>Potencialidades recorrentes</h3>' +
      '<p class="sub">Frequência sobre as 24 experiências avaliadas</p>' + fp.html + '</div>' +
      '<div class="ec-card"><h3>Matriz experiência × gargalo</h3>' +
      '<p class="sub">Ordenada por número de gargalos registrados</p>' +
      '<div class="ec-mx"><table><thead><tr><th class="rot"></th>' + cab +
      '<th class="vert"><div>total</div></th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
      '<p class="ec-nota">Ausência de marca significa <strong>não afirmado no relatório</strong>, ' +
      'não “não existe”. As cinco experiências visitadas fora dos roteiros têm ficha menos detalhada ' +
      'e por isso aparecem com menos marcas.</p></div>';
  })();
  /* ----------------------------------------------------------- 5. Cobertura */
  (function () {
    var TOTAL_BASE = (window.PTE_DATA && window.PTE_DATA.meta && window.PTE_DATA.meta.total) || 79;
    var cruzadas = exp.filter(function (x) { return x.ref_id; }).length;
    var novas = exp.filter(function (x) { return !x.ref_id; });
    var nuncaVisitadas = TOTAL_BASE - cruzadas;
    var alta = exp.filter(function (x) { return x.classificacao === "alta"; }).length;
    var virtuais = exp.filter(function (x) { return (x.perfil || {}).modo === "virtual"; });

    var UF = { MA: "Maranhão", PI: "Piauí", CE: "Ceará", RN: "Rio Grande do Norte",
               PB: "Paraíba", PE: "Pernambuco", AL: "Alagoas", SE: "Sergipe", BA: "Bahia" };
    var VISITADOS = { RN: "Rota 1", PB: "Rota 1", CE: "Rota 2", PI: "Rota 2",
                      PE: "Roteiro 3", AL: "Roteiro 3" };

    var ufHtml = Object.keys(UF).map(function (u) {
      var v = VISITADOS[u];
      return '<div class="r"><span class="t">' + u + ' · ' + UF[u] + '</span>' +
        '<span class="b"><span style="width:' + (v ? 100 : 6) + '%;background:' +
        (v ? "#43a047" : "#d9dde6") + ';opacity:' + (v ? ".75" : "1") + '"></span></span>' +
        '<span class="v">' + (v || "sem visita") + '</span></div>';
    }).join("");

    var naoRealizadas = [
      ["Redeser (Crato/CE)", "Não realizada — sem retorno da Fundação Araripe"],
      ["Hub Pecém", "Adiada — operação só começa em 2029/2030"],
      ["Rota 4 — Bahia", "Postergada por dificuldades logísticas"],
      ["7 de 13 organizações do Roteiro 3", "Sem retorno apesar de e-mail, telefone e WhatsApp"]
    ].map(function (x) {
      return '<div class="r"><span class="t">' + esc(x[0]) + '</span>' +
        '<span class="b"><span style="width:100%;background:#e0392b;opacity:.18"></span></span>' +
        '<span class="v" style="flex-basis:230px;text-align:left;color:var(--muted)">' + esc(x[1]) + '</span></div>';
    }).join("");

    document.getElementById("sub-cobertura").innerHTML =
      '<div class="ec-kpis">' +
        '<div class="ec-kpi a"><div class="v">' + TOTAL_BASE + '</div><div class="l">prospectadas em gabinete</div></div>' +
        '<div class="ec-kpi c"><div class="v">' + exp.length + '</div><div class="l">avaliadas em campo</div></div>' +
        '<div class="ec-kpi b"><div class="v">' + alta + '</div><div class="l">recomendadas (≥ 80)</div></div>' +
        '<div class="ec-kpi"><div class="v" style="color:var(--red)">' + nuncaVisitadas + '</div><div class="l">nunca visitadas</div></div>' +
      '</div>' +
      '<div class="ec-card"><h3>O funil, do gabinete à carteira</h3>' +
      '<p class="sub">Das ' + TOTAL_BASE + ' prospectadas, ' + cruzadas + ' foram a campo · ' +
        novas.length + ' experiências foram descobertas na visita</p>' +
      '<div class="ec-freq">' +
        '<div class="r"><span class="t">Prospectadas em gabinete</span><span class="b">' +
          '<span style="width:100%;background:#1f4da1;opacity:.65"></span></span><span class="v">' + TOTAL_BASE + '</span></div>' +
        '<div class="r"><span class="t">Efetivamente visitadas</span><span class="b">' +
          '<span style="width:' + (cruzadas / TOTAL_BASE * 100) + '%;background:#f37520;opacity:.8"></span></span><span class="v">' + cruzadas + '</span></div>' +
        '<div class="r"><span class="t">Recomendadas para apoio</span><span class="b">' +
          '<span style="width:' + (alta / TOTAL_BASE * 100) + '%;background:#43a047;opacity:.8"></span></span><span class="v">' + alta + '</span></div>' +
        '<div class="r"><span class="t">Descobertas em campo</span><span class="b">' +
          '<span style="width:' + (novas.length / TOTAL_BASE * 100) + '%;background:#c026d3;opacity:.8"></span></span><span class="v">+' + novas.length + '</span></div>' +
      '</div>' +
      '<p class="ec-nota">' + nuncaVisitadas + ' das ' + TOTAL_BASE + ' iniciativas mapeadas <strong>nunca receberam ' +
      'visita</strong> — permanecem no painel como hipótese de gabinete. E o campo trouxe ' + novas.length +
      ' experiências que o levantamento prévio não continha' +
      (novas.length ? ': ' + novas.map(function (x) { return esc(x.nome); }).join(" e ") : "") + '.</p></div>' +
      '<div class="ec-card"><h3>Cobertura por estado</h3>' +
      '<p class="sub">Quais dos nove estados do Nordeste receberam incursão</p>' +
      '<div class="ec-freq">' + ufHtml + '</div>' +
      '<p class="ec-nota"><strong>Bahia, Maranhão e Sergipe não receberam nenhuma visita.</strong> ' +
      'A Rota 4, prevista para a Bahia em agosto, foi postergada — e a Bahia é o estado com mais ' +
      'iniciativas na base de prospecção.</p></div>' +
      '<div class="ec-card"><h3>Previsto e não realizado</h3>' +
      '<p class="sub">O que ficou de fora, e por quê</p>' +
      '<div class="ec-freq">' + naoRealizadas + '</div>' +
      '<p class="ec-nota">' + virtuais.length + ' das ' + exp.length + ' avaliações foram feitas ' +
      '<strong>por vídeo</strong>, não presencialmente' +
      (virtuais.length ? ' (' + virtuais.map(function (x) { return esc(x.nome); }).join(", ") + ')' : "") +
      ' — o que o próprio relatório registra como limitação metodológica.</p></div>';
  })();
  /* ------------------------------------------------------------ 6. Captação */
  (function () {
    var m = dados.meta || {};
    var fams = m.captacao || [], mapa = m.postura_mecanismo || {},
        agendas = m.agendas || [], escala = m.escala || {};

    var porPostura = Object.keys(POSTURAS).filter(function (k) {
      return exp.some(function (x) { return x.postura === k; });
    }).map(function (k) {
      var l = exp.filter(function (x) { return x.postura === k; });
      var info = mapa[k] || {};
      return '<div class="ec-mec"><h4>' + esc(POSTURAS[k]) + ' <span style="font-weight:400;color:var(--faint)">· ' +
        l.length + ' experiência' + (l.length === 1 ? "" : "s") + '</span></h4>' +
        '<p>' + esc(info.familias || "—") + '</p>' +
        (info.obs ? '<p class="at">' + esc(info.obs) + '</p>' : '') + '</div>';
    }).join("");

    var famHtml = fams.map(function (f) {
      return '<div class="ec-mec"><h4>' + esc(f.nome) + '</h4>' +
        '<p>' + esc(f.aderencia) + '</p>' +
        '<p class="at"><b>Atenção:</b> ' + esc(f.atencao) + '</p></div>';
    }).join("");

    var agHtml = agendas.map(function (a, i) {
      return '<div class="ec-mec"><h4>' + (i + 1) + '. ' + esc(a.t) + '</h4>' +
        '<p>' + esc(a.d) + '</p></div>';
    }).join("");

    var recom = exp.filter(function (x) { return x.classificacao === "alta"; });
    var acimaPiso = recom.filter(function (x) { return x.envelope.max >= (escala.piso_padrao || 15); }).length;
    var abaixoRed = recom.filter(function (x) { return x.envelope.max < (escala.piso_reduzido || 5); }).length;

    document.getElementById("sub-captacao").innerHTML =
      '<div class="ec-kpis">' +
        '<div class="ec-kpi a"><div class="v">' + fams.length + '</div><div class="l">famílias de mecanismos</div></div>' +
        '<div class="ec-kpi c"><div class="v">' + acimaPiso + '</div><div class="l">de ' + recom.length +
          ' alcançam o porte mínimo do fundo regional</div></div>' +
        '<div class="ec-kpi"><div class="v" style="color:var(--red)">' + abaixoRed +
          '</div><div class="l">abaixo até do piso reduzido</div></div>' +
      '</div>' +
      '<div class="ec-card"><h3>A que porta cada grupo bate</h3>' +
      '<p class="sub">O P5 mapeia mecanismo por postura de apoio, nunca iniciativa a iniciativa</p>' +
      porPostura +
      '<p class="ec-nota">Este é o único mapeamento do documento. Qualquer tabela “iniciativa × mecanismo” ' +
      'seria derivação nossa, não transcrição — e por isso não existe aqui.</p></div>' +
      '<div class="ec-card"><h3>Restrição de escala</h3>' +
      '<p class="sub">O porte individual não alcança os canais de maior volume</p>' +
      '<p style="font-size:.88rem;line-height:1.6;margin:0">' + esc(escala.nota || "") + '</p></div>' +
      '<div class="ec-card"><h3>As oito famílias de mecanismos</h3>' +
      '<p class="sub">Aderência à carteira e pontos de atenção</p>' + famHtml + '</div>' +
      '<div class="ec-card"><h3>Três agendas coletivas</h3>' +
      '<p class="sub">Atravessam várias famílias e são pauta da carteira, não pendência individual</p>' +
      agHtml + '</div>';
  })();

  /* ----------------------------------------------------------- 7. Incursões */
  (function () {
    var ROTAS = {
      R1: ["Rota 1 · Rio Grande do Norte e Paraíba", "16 a 24 de julho · Lucas Fernandes e Bruna Torquato Pinho"],
      R2: ["Rota 2 · Ceará e Piauí", "17 a 29 de julho · Leidiane Farias e Renata Mesquita"],
      R3: ["Roteiro 3 · Pernambuco e Alagoas", "27 a 31 de julho · Sinoel Batista, Tamara Crantschaninov e Luiz Henrique Apollo"],
      Extra: ["Fora dos roteiros", "Agosto · experiências de maturidade elevada e escala sistêmica"]
    };
    function dataNum(d) {
      if (!d) return 9999;
      var q = d.split("/");
      return Number(q[1]) * 100 + Number(q[0]);
    }
    var html = Object.keys(ROTAS).map(function (k) {
      var l = exp.filter(function (x) { return x.rota === k; })
                 .sort(function (a, b) { return dataNum((a.perfil || {}).data) - dataNum((b.perfil || {}).data); });
      if (!l.length) return "";
      var virt = l.filter(function (x) { return (x.perfil || {}).modo === "virtual"; }).length;
      return '<div class="ec-rota"><h4>' + esc(ROTAS[k][0]) + '</h4>' +
        '<p class="meta">' + esc(ROTAS[k][1]) + ' · ' + l.length + ' experiências' +
        (virt ? ' · ' + virt + ' por vídeo' : '') + '</p>' +
        '<div class="ec-tl">' + l.map(function (x) {
          var q = x.perfil || {};
          return '<div class="ev' + (q.modo === "virtual" ? " virtual" : "") + '">' +
            '<div class="d">' + esc(q.data || "data não registrada") +
              (q.modo === "virtual" ? " · por vídeo" : "") + '</div>' +
            '<div class="n">' + esc(x.nome) + ' <span class="sc">' + x.total + '</span></div>' +
            '<div class="l">' + esc(q.mun || x.municipio || "—") +
              (q.uf ? "/" + esc(q.uf) : "") +
              ' · ' + esc((EIXOS[x.eixo_cod] || [x.eixo_cod])[0]) + '</div></div>';
        }).join("") + '</div></div>';
    }).join("");

    var virtuais = exp.filter(function (x) { return (x.perfil || {}).modo === "virtual"; });
    document.getElementById("sub-incursoes").innerHTML =
      '<div class="ec-card"><h3>As incursões, como aconteceram</h3>' +
      '<p class="sub">' + exp.length + ' experiências em quatro roteiros, entre 16 de julho e agosto de 2026</p>' +
      html +
      '<p class="ec-nota">Marcador tracejado em âmbar indica avaliação <strong>feita por vídeo</strong> — ' +
      virtuais.length + ' das ' + exp.length + '. O painel já planeja rotas ótimas na aba Rotas Manuais; ' +
      'esta é a rota que de fato se percorreu.</p></div>';
  })();
  /* --------------------------------------------- 8. Camada de campo em Comparar
     A aba Comparar confronta os dez critérios de gabinete. Aqui se acrescenta,
     para as iniciativas selecionadas, o que a visita de campo encontrou.
     A seleção é lida do DOM (os cartões que o painel já renderiza), para não
     depender do estado interno de dashboard.js. */
  (function () {
    var alvo = document.getElementById("view-comparar");
    var cards = document.getElementById("cmp-cards");
    if (!alvo || !cards) return;

    var porId = {};
    exp.forEach(function (x) { if (x.ref_id) porId[x.ref_id] = x; });

    var caixa = document.createElement("div");
    caixa.className = "ec-cmp";
    caixa.id = "ec-comparar";
    var barra = alvo.querySelector(".exp-bar");
    if (barra) alvo.insertBefore(caixa, barra); else alvo.appendChild(caixa);

    function nomeDoCartao(btn) {
      var c = btn.closest(".cmp-card");
      var h = c && c.querySelector(".cc-h");
      if (!h) return "";
      // a nota vem num <b> dentro do título, sem espaço antes: remover o nó,
      // não recortar por regex, senão o número gruda no nome
      var copia = h.cloneNode(true);
      Array.prototype.forEach.call(copia.querySelectorAll("b"), function (b) { b.remove(); });
      return copia.textContent.trim();
    }

    function render() {
      var botoes = Array.prototype.slice.call(cards.querySelectorAll(".cc-rm[data-id]"));
      if (!botoes.length) { caixa.innerHTML = ""; return; }

      var linhas = botoes.map(function (b) {
        var id = Number(b.getAttribute("data-id"));
        return { id: id, nome: nomeDoCartao(b), c: porId[id] || null };
      });
      var comCampo = linhas.filter(function (l) { return l.c; });

      caixa.innerHTML =
        '<h3>O que o campo encontrou</h3>' +
        '<p class="sub">' + (comCampo.length
          ? comCampo.length + ' de ' + linhas.length + ' selecionadas foram avaliadas nas incursões'
          : 'nenhuma das selecionadas foi avaliada em campo') + '</p>' +
        '<div class="ec-cmp-grid">' + linhas.map(function (l) {
          if (!l.c) {
            return '<div class="ec-cc sem"><h4>' + esc(l.nome) + '</h4>' +
              '<p class="vazio">Não visitada. A pontuação de gabinete não foi verificada em campo.</p></div>';
          }
          var x = l.c, p = x.perfil || {};
          var dims = DIMS.map(function (d) {
            return '<i style="height:' + (x.notas[d[0]] / 5 * 26) + 'px" title="' + d[1] +
                   ': ' + x.notas[d[0]] + '/5"></i>'; }).join("");
          var gabNorm = x.gabinete != null ? Math.round(x.gabinete / 30 * 100) : null;
          var dif = gabNorm != null
            ? (x.total - gabNorm > 0 ? "+" : "") + (x.total - gabNorm) + " pontos vs. gabinete"
            : "não estava na base";
          var env = x.envelope.max > 0
            ? "R$ " + fmt(x.envelope.min) + " a " + fmt(x.envelope.max) + " mi" : "sem alocação";
          return '<div class="ec-cc ' + x.classificacao + '">' +
            '<h4>' + esc(x.nome) + '</h4>' +
            '<div class="tot">' + x.total + '<small>/100</small></div>' +
            '<span class="cls ' + x.classificacao + '">' + CLS[x.classificacao] + '</span>' +
            '<div class="dims" title="Operação, Investimento, Impacto, Inovação">' + dims + '</div>' +
            '<dl><dt>Diferença</dt><dd>' + dif + '</dd>' +
            '<dt>Envelope</dt><dd>' + env + '</dd>' +
            '<dt>Postura</dt><dd>' + (POSTURAS[x.postura] || "—") + '</dd>' +
            '<dt>Base informacional</dt><dd>' + (x.base_informacional || "—") + '</dd></dl></div>';
        }).join("") + '</div>' +
        (comCampo.length
          ? '<p class="ec-cmp-nota">A barra mostra as quatro dimensões na ordem Operação, Investimento, ' +
            'Impacto e Inovação. Duas iniciativas com a mesma nota final podem ter perfis opostos — é o ' +
            'perfil, não o total, que orienta o tipo de apoio.</p>'
          : '');
    }

    new MutationObserver(render).observe(cards, { childList: true, subtree: true });
    render();
  })();
})();
