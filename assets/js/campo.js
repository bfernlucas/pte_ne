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
  var GARG_CURTO = dados.meta.gargalos_curto || {};
  function gargCurto(k) { return GARG_CURTO[k] || GARGALOS[k] || k; }
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

  /* ------------------------------------------------------------------ casca
     Quatro seções, cada uma respondendo a uma pergunta de decisão. Cada uma
     abre pela leitura — o que o dado quer dizer — e não pela descrição do dado. */
  var totMin = exp.reduce(function (s, x) { return s + x.envelope.min; }, 0);
  var totMax = exp.reduce(function (s, x) { return s + x.envelope.max; }, 0);
  var nAlta = exp.filter(function (x) { return x.classificacao === "alta"; }).length;
  var comAloc = exp.filter(function (x) { return x.envelope.max > 0; }).length;
  var metro = exp.filter(function (x) { return x.nome.indexOf("Metroviário") !== -1; })[0];

  var SECOES = [
    { id: "carteira", rot: "Carteira", subs: ["carteira", "captacao"],
      perg: "O que apoiar, com quanto, e por qual porta captar",
      leitura: "<strong>R$ " + fmt(totMin) + " a " + fmt(totMax) + " milhões</strong> em 36 meses para " +
        comAloc + " experiências. Dois terços vão para Infraestrutura Verde-Azul" +
        (metro ? ", e o METROFOR sozinho responde por R$ " + fmt(metro.envelope.min) + "–" +
          fmt(metro.envelope.max) + " mi — um terço do total" : "") + "." },
    { id: "experiencias", rot: "Experiências", subs: ["lista"],
      perg: "Quem são as 24 avaliadas, uma a uma",
      leitura: "<strong>" + nAlta + " das " + exp.length + "</strong> alcançam a faixa de apoio imediato. " +
        "O perfil nas quatro dimensões importa mais que a nota final: duas experiências com 80 pontos " +
        "podem pedir apoios opostos." },
    { id: "evidencia", rot: "Evidência", subs: ["prospeccao", "gargalos"],
      perg: "O que sustenta as notas, e o que as ameaça",
      leitura: "A prospecção de gabinete prevê pouco. E o gargalo que atravessa a carteira " +
        "<strong>não é dinheiro</strong>: é a informação que falta para converter mérito em pedido financiável." },
    { id: "comparar", rot: "Comparar", subs: ["comparar"],
      perg: "Entre estas, qual apoiar primeiro",
      leitura: "Compare até quatro experiências pelo <strong>perfil nas quatro dimensões</strong>, " +
        "não pela nota final. O que elas compartilham pode ser apoiado de uma vez; o que é exclusivo " +
        "exige tratamento próprio." },
    { id: "campo", rot: "Campo", subs: ["cobertura", "incursoes"],
      perg: "De onde vieram os dados, e o que ficou de fora",
      leitura: "<strong>56 das 79</strong> iniciativas mapeadas nunca receberam visita. " +
        "Bahia, Maranhão e Sergipe não tiveram incursão." }
  ];

  raiz.innerHTML =
    '<div class="ec-nav" id="ec-nav">' +
      SECOES.map(function (sec, i) {
        return '<button data-sec="' + sec.id + '"' + (i === 0 ? ' class="on"' : '') + '>' +
               esc(sec.rot) + '</button>';
      }).join("") +
    '</div>' +
    SECOES.map(function (sec, i) {
      return '<section class="ec-secao' + (i === 0 ? " on" : "") + '" id="sec-' + sec.id + '">' +
        '<p class="ec-perg">' + esc(sec.perg) + '</p>' +
        '<p class="ec-leitura">' + sec.leitura + '</p>' +
        sec.subs.map(function (u) { return '<div class="ec-bloco" id="sub-' + u + '"></div>'; }).join("") +
      '</section>';
    }).join("");

  Array.prototype.forEach.call(document.querySelectorAll("#ec-nav button"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll("#ec-nav button"),
        function (o) { o.classList.toggle("on", o === b); });
      Array.prototype.forEach.call(document.querySelectorAll(".ec-secao"),
        function (s) { s.classList.toggle("on", s.id === "sec-" + b.dataset.sec); });
      window.scrollTo({ top: raiz.offsetTop - 80, behavior: "smooth" });
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
    '<div class="exp-bar"><span class="exp-lab">Exportar:</span>' +
      '<button class="exp-btn" data-exp="xlsx" data-target="#ec-tabela" data-name="evidencia-campo" ' +
        'data-title="Evidência das incursões de campo" data-sheet="Campo">XLS</button>' +
      '<button class="exp-btn" data-exp="pdf" data-target="#ec-tabela" data-name="evidencia-campo" ' +
        'data-title="Evidência das incursões de campo">PDF</button></div>' +
    '<div class="ec-legenda">' +
      '<span class="lg"><b>Dimensões</b> na ordem das barras: ' +
        DIMS.map(function (d) { return d[1] + ' <i>p' + d[2] + '</i>'; }).join(" · ") + '</span>' +
      '<span class="lg"><b>Base informacional</b>: ' +
        '<i class="ec-ev completa"></i> completa · ' +
        '<i class="ec-ev parcial"></i> parcial · ' +
        '<i class="ec-ev ausente"></i> ausente</span>' +
    '</div>' +
    '<div class="ec-tw"><table id="ec-tabela"><thead><tr>' +
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
    '<div class="ec-controles">' +
      '<label class="ec-toggle"><input type="checkbox" id="ec-semmetro" /> ' +
      'Excluir o Sistema Metroviário do Ceará, que sozinho distorce a leitura</label>' +
      '<div class="exp-bar"><span class="exp-lab">Exportar:</span>' +
      '<button class="exp-btn" data-exp="png" data-target="#ec-carteira-corpo" data-name="carteira">Imagem (PNG)</button></div>' +
    '</div>' +
    '<div id="ec-carteira-corpo"></div>';
  document.getElementById("ec-semmetro").addEventListener("change", function (e) {
    carteira(e.target.checked); });
  carteira(false);

  /* -------------------------------------------------- 3. Prospecção × campo */
  (function () {
    var TODOS = exp.filter(function (x) { return x.gabinete != null; })
      .map(function (x) {
        return { nome: x.nome, g: x.gabinete / 30 * 100, c: x.total,
                 cls: x.classificacao, eixo: x.eixo_cod };
      });

    var ctrl = { rotulos: "desvios", cls: "" };

    function correl(ps) {
      var n = ps.length;
      if (n < 3) return null;
      var mx = ps.reduce(function (a, p) { return a + p.g; }, 0) / n;
      var my = ps.reduce(function (a, p) { return a + p.c; }, 0) / n;
      var sx = Math.sqrt(ps.reduce(function (a, p) { return a + Math.pow(p.g - mx, 2); }, 0) / n);
      var sy = Math.sqrt(ps.reduce(function (a, p) { return a + Math.pow(p.c - my, 2); }, 0) / n);
      if (!sx || !sy) return null;
      return { r: ps.reduce(function (a, p) { return a + (p.g - mx) * (p.c - my); }, 0) / n / (sx * sy),
               mx: mx, my: my };
    }

    function svg(ps) {
      var todos = ctrl.rotulos === "todos";
      var W = todos ? 1240 : 900, H = 520,
          L = todos ? 250 : 58, R = todos ? 250 : 215, T = 20, B = 52;
      var x0 = 50, x1 = 100, y0 = 35, y1 = 105;
      var px = function (v) { return L + (v - x0) / (x1 - x0) * (W - L - R); };
      var py = function (v) { return H - B - (v - y0) / (y1 - y0) * (H - T - B); };
      var PL = W - R, PB = H - B;

      // zonas de leitura: acima da diagonal o campo superou o gabinete
      var zonas =
        '<polygon points="' + L + ',' + PB + ' ' + PL + ',' + py(100) + ' ' + L + ',' + T +
          '" fill="#43a047" opacity=".05"/>' +
        '<polygon points="' + L + ',' + PB + ' ' + PL + ',' + py(100) + ' ' + PL + ',' + PB +
          '" fill="#e0392b" opacity=".05"/>' +
        '<text x="' + (L + 16) + '" y="' + (T + 26) + '" font-size="11.5" fill="#2c6b23" opacity=".85">' +
          'o campo encontrou mais do que o gabinete previa</text>' +
        '<text x="' + (PL - 10) + '" y="' + (PB - 14) + '" text-anchor="end" font-size="11.5" ' +
          'fill="#a5241a" opacity=".85">o campo encontrou menos</text>';

      var eixos = "";
      [50, 60, 70, 80, 90, 100].forEach(function (v) {
        eixos += '<line x1="' + L + '" y1="' + py(v).toFixed(1) + '" x2="' + PL + '" y2="' + py(v).toFixed(1) +
                 '" stroke="var(--border-2)"/>' +
                 '<text x="' + px(v).toFixed(1) + '" y="' + (PB + 18) + '" text-anchor="middle" font-size="12" fill="var(--muted)">' + v + '</text>' +
                 '<text x="' + (todos ? L + 8 : L - 9) + '" y="' + (py(v) + 4).toFixed(1) +
                 '" text-anchor="' + (todos ? "start" : "end") +
                 '" font-size="12" fill="var(--muted)">' + v + '</text>';
      });

      var pontos = ps.map(function (p) {
        var d = p.c - p.g;
        var cor = d > 12 ? "#43a047" : (d < -12 ? "#e0392b" : "#1f4da1");
        return '<circle cx="' + px(p.g).toFixed(1) + '" cy="' + py(p.c).toFixed(1) +
          '" r="6" fill="' + cor + '" opacity=".88"><title>' + esc(p.nome) + ' — gabinete ' +
          Math.round(p.g) + ', campo ' + p.c + ' (' + (d > 0 ? "+" : "") + Math.round(d) + ')</title></circle>';
      }).join("");

      var marc = ctrl.rotulos === "nenhum" ? []
        : ctrl.rotulos === "todos" ? ps.slice()
        : ps.filter(function (p) { return Math.abs(p.c - p.g) >= 15; });
      marc = marc.sort(function (a, b) { return Math.abs(b.c - b.g) - Math.abs(a.c - a.g); })
                 .slice(0, ctrl.rotulos === "todos" ? 24 : 7)
                 .sort(function (a, b) { return py(a.c) - py(b.c); });

      var usados = { e: [], d: [] }, rotulos = "", meio = L + (PL - L) * 0.5;
      marc.forEach(function (p) {
        var cx = px(p.g), cy = py(p.c);
        var esq = cx > meio;                       // ponto à direita -> rótulo à esquerda
        var lado = esq ? usados.e : usados.d, ly = cy;
        while (lado.some(function (u) { return Math.abs(u - ly) < 16; })) ly += 16;
        // se transbordou embaixo, recomeça acima do gráfico
        if (ly > PB - 6) { ly = T + 12; while (lado.some(function (u) { return Math.abs(u - ly) < 16; })) ly += 16; }
        lado.push(ly);
        var lx = esq ? cx - 13 : cx + 13, d = p.c - p.g;
        if (todos) lx = esq ? L - 12 : PL + 12;   // alinha na margem, em coluna
        rotulos += '<line x1="' + (esq ? cx - 7 : cx + 7).toFixed(1) + '" y1="' + cy.toFixed(1) +
          '" x2="' + (esq ? lx + 3 : lx - 3).toFixed(1) + '" y2="' + (ly - 4).toFixed(1) +
          '" stroke="var(--border)" opacity=".7"/>' +
          '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + (esq ? "end" : "start") +
          '" font-size="' + (todos ? 11 : 12) + '" fill="var(--ink)">' + esc(p.nome) +
          ' <tspan fill="' + (d > 0 ? "#2c6b23" : "#a5241a") + '">' + (d > 0 ? "+" : "") + Math.round(d) + '</tspan></text>';
      });

      return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Dispersão entre a nota de gabinete e a nota de campo.">' +
        zonas + eixos +
        '<line x1="' + px(50).toFixed(1) + '" y1="' + py(50).toFixed(1) + '" x2="' + px(100).toFixed(1) +
          '" y2="' + py(100).toFixed(1) + '" stroke="var(--muted)" stroke-dasharray="5 5" opacity=".6"/>' +
        '<text x="' + px(98).toFixed(1) + '" y="' + (py(100) - 8).toFixed(1) + '" text-anchor="end" ' +
          'font-size="11.5" fill="var(--muted)">as duas notas coincidem</text>' +
        pontos + rotulos +
        '<line x1="' + L + '" y1="' + PB + '" x2="' + PL + '" y2="' + PB + '" stroke="var(--border)"/>' +
        '<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + PB + '" stroke="var(--border)"/>' +
        '<text x="' + ((PL + L) / 2).toFixed(0) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="12" fill="var(--muted)">nota de gabinete · 0–30 normalizada para 100</text>' +
        '<text x="16" y="' + (H / 2) + '" text-anchor="middle" font-size="12" fill="var(--muted)" transform="rotate(-90 16 ' + (H / 2) + ')">nota de campo · 0–100</text>' +
      '</svg>';
    }

    function pinta() {
      var ps = TODOS.filter(function (p) { return !ctrl.cls || p.cls === ctrl.cls; });
      var co = correl(ps);
      document.getElementById("ec-disp-sub").innerHTML =
        ps.length + ' de ' + TODOS.length + ' avaliadas nos dois momentos' +
        (co ? ' · correlação r = ' + co.r.toFixed(2).replace(".", ",") : ' · amostra pequena demais para correlação');
      document.getElementById("ec-disp-svg").innerHTML = svg(ps);
      document.getElementById("ec-disp-nota").innerHTML = co
        ? 'As médias quase coincidem — <strong>' + Math.round(co.mx) + '</strong> no gabinete contra ' +
          '<strong>' + Math.round(co.my) + '</strong> no campo — mas as posições individuais embaralham. ' +
          'O caso extremo é o <strong>Carbono Social do Bioma Caatinga</strong>: 90 no gabinete, ' +
          '<strong>40</strong> no campo. A prospecção acerta a média da carteira e erra o caso individual, ' +
          'que é a unidade de decisão.'
        : 'Selecione uma faixa com mais experiências para que a correlação faça sentido.';
    }

    document.getElementById("sub-prospeccao").innerHTML =
      '<div class="ec-controles">' +
        '<label class="ec-campo-ctrl">Rótulos ' +
          '<select id="ec-disp-rot">' +
            '<option value="desvios">Maiores desvios</option>' +
            '<option value="todos">Todos</option>' +
            '<option value="nenhum">Nenhum</option>' +
          '</select></label>' +
        '<label class="ec-campo-ctrl">Faixa ' +
          '<select id="ec-disp-cls">' +
            '<option value="">Toda a carteira</option>' +
            '<option value="alta">Alta prioridade</option>' +
            '<option value="estrategico">Potencial estratégico</option>' +
            '<option value="nao">Não recomendada</option>' +
          '</select></label>' +
        '<button class="ec-ajuda" id="ec-disp-ajuda" aria-expanded="false" ' +
          'aria-controls="ec-disp-expl" title="Como ler este gráfico">?</button>' +
        '<div class="exp-bar"><span class="exp-lab">Exportar:</span>' +
        '<button class="exp-btn" data-exp="png" data-target="#ec-disp" data-name="prospeccao-x-campo">Gráfico (PNG)</button></div>' +
      '</div>' +
      '<div class="ec-expl" id="ec-disp-expl" hidden>' +
        '<h4>Como ler este gráfico</h4>' +
        '<ul>' +
          '<li>Cada ponto é uma experiência avaliada <strong>duas vezes</strong>: no levantamento ' +
            'documental (eixo horizontal) e depois da visita de campo (eixo vertical).</li>' +
          '<li>A <strong>linha tracejada</strong> é onde as duas notas coincidem. Acima dela, a visita ' +
            'encontrou mais do que o gabinete previa; abaixo, encontrou menos.</li>' +
          '<li>A <strong>cor</strong> marca desvios acima de 12 pontos: verde subiu, vermelho caiu, ' +
            'azul ficou perto do previsto.</li>' +
          '<li>O <strong>r</strong> mede o quanto uma nota prevê a outra. Vai de 0 (nenhuma relação) ' +
            'a 1 (previsão perfeita). Abaixo de 0,3 a prospecção documental explica muito pouco do ' +
            'resultado de campo.</li>' +
          '<li>Passe o mouse sobre um ponto para ver a experiência e as duas notas.</li>' +
        '</ul>' +
      '</div>' +
      '<div class="ec-card" id="ec-disp">' +
        '<h3>Nota de gabinete × nota de campo</h3>' +
        '<p class="sub" id="ec-disp-sub"></p>' +
        '<div id="ec-disp-svg"></div>' +
        '<p class="ec-nota" id="ec-disp-nota"></p>' +
      '</div>';

    document.getElementById("ec-disp-rot").addEventListener("change", function (e) {
      ctrl.rotulos = e.target.value; pinta(); });
    document.getElementById("ec-disp-cls").addEventListener("change", function (e) {
      ctrl.cls = e.target.value; pinta(); });
    var bAjuda = document.getElementById("ec-disp-ajuda");
    bAjuda.addEventListener("click", function () {
      var painel = document.getElementById("ec-disp-expl");
      var abrir = painel.hidden;
      painel.hidden = !abrir;
      bAjuda.setAttribute("aria-expanded", String(abrir));
      bAjuda.classList.toggle("on", abrir);
    });
    pinta();
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
      return '<th class="vert" title="' + esc(GARGALOS[k]) + '"><div>' +
             esc(gargCurto(k)) + '</div></th>'; }).join("");
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
      '<div class="exp-bar"><span class="exp-lab">Exportar:</span>' +
      '<button class="exp-btn" data-exp="xlsx" data-target="#ec-matriz" data-name="matriz-gargalos" ' +
        'data-title="Matriz experiência x gargalo" data-sheet="Gargalos">XLS</button></div>' +
      '<div class="ec-mx"><table id="ec-matriz">' +
      '<colgroup><col class="nome"/>' +
        fg.ord.map(function () { return '<col class="g"/>'; }).join("") +
        '<col class="tot"/></colgroup>' +
      '<thead><tr><th class="rot">Experiência</th>' + cab +
      '<th class="vert tot-h"><div>total</div></th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
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
        novas.length + (novas.length === 1 ? ' experiência foi descoberta' : ' experiências foram descobertas') +
        ' na visita</p>' +
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
      (novas.length === 1 ? ' experiência que o levantamento prévio não continha'
                          : ' experiências que o levantamento prévio não continha') +
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
  /* ----------------------------------------------------------- 9. Comparar
     Estratégia: o que separa e o que aproxima. O perfil nas quatro dimensões
     mostra a diferença de natureza; os gargalos em comum dizem o que pode ser
     apoiado horizontalmente, e os exclusivos, o que exige tratamento próprio. */
  (function () {
    var caixa = document.getElementById("sub-comparar");
    if (!caixa) return;
    var MAX = 4;
    var sel = [];

    var ordenadas = exp.slice().sort(function (a, b) { return b.total - a.total; });

    caixa.innerHTML =
      '<div class="ec-controles">' +
        '<label class="ec-campo-ctrl">Adicionar ' +
          '<select id="ec-cmp-add"><option value="">escolha uma experiência…</option>' +
            ordenadas.map(function (x, i) {
              return '<option value="' + i + '">' + esc(x.nome) + ' · ' + x.total + '</option>'; }).join("") +
          '</select></label>' +
        '<button class="ec-btn-lim" id="ec-cmp-lim">Limpar</button>' +
        '<div class="exp-bar"><span class="exp-lab">Exportar:</span>' +
        '<button class="exp-btn" data-exp="png" data-target="#ec-cmp-corpo" data-name="comparacao">Imagem (PNG)</button></div>' +
      '</div>' +
      '<div class="ec-chips" id="ec-cmp-chips"></div>' +
      '<div id="ec-cmp-corpo"></div>';

    function barras(itens) {
      var W = 880, H = 230, L = 130, R = 20, T = 30, B = 34;
      var pw = W - L - R, gw = pw / DIMS.length, bw = Math.min(26, (gw - 18) / itens.length);
      var COR = ["#1f4da1", "#f37520", "#43a047", "#7a3fb8"];
      var g = "";
      [1, 2, 3, 4, 5].forEach(function (v) {
        var y = H - B - (v / 5) * (H - T - B);
        g += '<line x1="' + L + '" y1="' + y.toFixed(1) + '" x2="' + (W - R) + '" y2="' + y.toFixed(1) +
             '" stroke="var(--border-2)"/>' +
             '<text x="' + (L - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="var(--muted)">' + v + '</text>';
      });
      DIMS.forEach(function (d, di) {
        var x0 = L + di * gw;
        g += '<text x="' + (x0 + gw / 2).toFixed(1) + '" y="' + (H - B + 18) +
             '" text-anchor="middle" font-size="11.5" fill="var(--ink)">' + d[1] +
             ' <tspan fill="var(--muted)">p' + d[2] + '</tspan></text>';
        itens.forEach(function (x, xi) {
          var n = x.notas[d[0]];
          var h = (n / 5) * (H - T - B);
          var bx = x0 + gw / 2 - (itens.length * bw + (itens.length - 1) * 4) / 2 + xi * (bw + 4);
          g += '<rect x="' + bx.toFixed(1) + '" y="' + (H - B - h).toFixed(1) + '" width="' + bw.toFixed(1) +
               '" height="' + h.toFixed(1) + '" fill="' + COR[xi % 4] + '" opacity=".85" rx="2">' +
               '<title>' + esc(x.nome) + ' — ' + d[1] + ': ' + n + '/5</title></rect>';
        });
      });
      var leg = itens.map(function (x, xi) {
        return '<span class="lg"><i style="background:' + COR[xi % 4] + '"></i>' + esc(x.nome) + '</span>';
      }).join("");
      return '<div class="ec-card"><h3>Perfil nas quatro dimensões</h3>' +
        '<p class="sub">Nota de 1 a 5 por dimensão, com o peso de cada uma na pontuação final</p>' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Barras comparando as quatro dimensões">' +
        g + '<line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '" stroke="var(--border)"/>' +
        '</svg><div class="ec-cmp-leg">' + leg + '</div></div>';
    }

    function quadro(itens) {
      var linhas = [
        ["Pontuação de campo", function (x) { return '<b>' + x.total + '</b>/100'; }],
        ["Classificação", function (x) { return '<span class="ec-cls ' + x.classificacao + '">' + CLS[x.classificacao] + '</span>'; }],
        ["Eixo", function (x) { return esc((EIXOS[x.eixo_cod] || [x.eixo_cod])[0]); }],
        ["Envelope", function (x) { return x.envelope.max > 0 ? "R$ " + fmt(x.envelope.min) + "–" + fmt(x.envelope.max) + " mi" : "sem alocação"; }],
        ["Postura de apoio", function (x) { return POSTURAS[x.postura] || "—"; }],
        ["Base informacional", function (x) { return x.base_informacional || "—"; }],
        ["Nota de gabinete", function (x) { return x.gabinete != null ? Math.round(x.gabinete / 30 * 100) + "/100" : "não estava na base"; }],
        ["Gargalos registrados", function (x) { return (x.gargalos || []).length; }]
      ];
      return '<div class="ec-card"><h3>Quadro comparativo</h3>' +
        '<div class="ec-tw"><table id="ec-cmp-tab"><thead><tr><th></th>' +
        itens.map(function (x) { return '<th>' + esc(x.nome) + '</th>'; }).join("") +
        '</tr></thead><tbody>' + linhas.map(function (l) {
          return '<tr><th class="lbl">' + l[0] + '</th>' +
            itens.map(function (x) { return '<td>' + l[1](x) + '</td>'; }).join("") + '</tr>';
        }).join("") + '</tbody></table></div></div>';
    }

    function estrategia(itens) {
      // dimensão que mais separa
      var maior = null;
      DIMS.forEach(function (d) {
        var vs = itens.map(function (x) { return x.notas[d[0]]; });
        var amp = Math.max.apply(null, vs) - Math.min.apply(null, vs);
        if (!maior || amp > maior.amp) maior = { d: d, amp: amp, vs: vs };
      });
      var lider = itens[maior.vs.indexOf(Math.max.apply(null, maior.vs))];
      var lanterna = itens[maior.vs.indexOf(Math.min.apply(null, maior.vs))];

      // gargalos em comum e exclusivos
      var conj = itens.map(function (x) { return x.gargalos || []; });
      var comuns = (conj[0] || []).filter(function (g) {
        return conj.every(function (c) { return c.indexOf(g) !== -1; }); });
      var exclusivos = itens.map(function (x, i) {
        return { nome: x.nome, gs: (x.gargalos || []).filter(function (g) {
          return conj.every(function (c, j) { return j === i || c.indexOf(g) === -1; }); }) };
      }).filter(function (e) { return e.gs.length; });

      return '<div class="ec-card"><h3>O que as separa, e o que têm em comum</h3>' +
        '<p class="sub">A leitura que orienta o tipo de apoio</p>' +
        (maior.amp > 0
          ? '<p class="ec-estrat">A dimensão que mais separa é <strong>' + maior.d[1] + '</strong> ' +
            '(peso ' + maior.d[2] + '), com ' + maior.amp + ' ponto' + (maior.amp > 1 ? "s" : "") +
            ' de diferença entre <strong>' + esc(lider.nome) + '</strong> e <strong>' + esc(lanterna.nome) +
            '</strong>. É aí que a escolha se decide.</p>'
          : '<p class="ec-estrat">As selecionadas têm <strong>perfil idêntico</strong> nas quatro dimensões — ' +
            'a decisão terá de se apoiar em envelope, postura ou aderência ao eixo.</p>') +
        '<div class="ec-dois">' +
          '<div><h4>Gargalos em comum <span class="ec-cnt">' + comuns.length + '</span></h4>' +
            (comuns.length
              ? '<ul>' + comuns.map(function (g) { return '<li>' + esc(GARGALOS[g]) + '</li>'; }).join("") + '</ul>' +
                '<p class="ec-mini">Podem ser tratados por <strong>apoio horizontal</strong>, uma vez só para o conjunto.</p>'
              : '<p class="ec-mini">Nenhum gargalo compartilhado entre todas.</p>') + '</div>' +
          '<div><h4>Exclusivos de cada uma <span class="ec-cnt">' +
            exclusivos.reduce(function (a, e) { return a + e.gs.length; }, 0) + '</span></h4>' +
            (exclusivos.length
              ? exclusivos.map(function (e) {
                  return '<p class="ec-excl"><b>' + esc(e.nome) + '</b><br>' +
                    e.gs.map(function (g) { return esc(GARGALOS[g]); }).join(" · ") + '</p>'; }).join("")
              : '<p class="ec-mini">Nenhum gargalo exclusivo.</p>') +
            '<p class="ec-mini">Exigem <strong>tratamento próprio</strong>, iniciativa a iniciativa.</p></div>' +
        '</div></div>';
    }

    function render() {
      var chips = document.getElementById("ec-cmp-chips");
      chips.innerHTML = sel.length
        ? sel.map(function (i, k) {
            return '<span class="ec-chip" data-k="' + k + '">' + esc(ordenadas[i].nome) +
                   '<button aria-label="remover">×</button></span>'; }).join("")
        : '<span class="ec-vazio">Escolha de 2 a ' + MAX + ' experiências para comparar.</span>';
      Array.prototype.forEach.call(chips.querySelectorAll(".ec-chip button"), function (b) {
        b.addEventListener("click", function () {
          sel.splice(Number(b.parentNode.getAttribute("data-k")), 1); render(); });
      });

      var corpo = document.getElementById("ec-cmp-corpo");
      if (sel.length < 2) {
        corpo.innerHTML = '<div class="ec-card ec-placeholder">' +
          '<p>A comparação mostra o <strong>perfil nas quatro dimensões</strong>, um quadro lado a lado ' +
          'e a leitura do que separa as experiências — incluindo quais gargalos elas compartilham, ' +
          'que podem ser resolvidos de uma vez, e quais são exclusivos.</p></div>';
        return;
      }
      var itens = sel.map(function (i) { return ordenadas[i]; });
      corpo.innerHTML = barras(itens) + quadro(itens) + estrategia(itens);
    }

    document.getElementById("ec-cmp-add").addEventListener("change", function (e) {
      var i = Number(e.target.value);
      if (e.target.value !== "" && sel.indexOf(i) === -1 && sel.length < MAX) sel.push(i);
      e.target.value = ""; render();
    });
    document.getElementById("ec-cmp-lim").addEventListener("click", function () { sel = []; render(); });
    render();
  })();
})();
