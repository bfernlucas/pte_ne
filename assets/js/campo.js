/* PTE Nordeste — módulo "Evidência de campo".
   Consome window.PTE_CAMPO, decifrado por auth.js depois do login.
   Quatro sub-visões: Experiências, Carteira, Prospecção × campo e Gargalos. */
(function () {
  "use strict";

  var raiz = document.getElementById("view-campo");
  if (!raiz) return;

  var dados = window.PTEAuth && window.PTEAuth.dados();
  if (!dados || !dados.experiencias) {
    raiz.innerHTML = '<p class="ec-intro">Não foi possível carregar os dados de campo nesta sessão.</p>';
    return;
  }

  var EIXOS = {
    FSI:  ["Finanças Sustentáveis e Inclusivas", "#24246C"],
    ADT:  ["Adensamento Tecnológico", "#0C549C"],
    BIO:  ["Bioeconomia e Sistemas Agroalimentares Adaptados", "#54B43C"],
    TE:   ["Transição Energética", "#F09C18"],
    EC:   ["Economia Circular e Solidária", "#E42424"],
    NIVA: ["Nova Infraestrutura Verde-Azul e Adaptação Climática", "#0F7D8C"]
  };
  var CLS = { alta: "Alta prioridade", estrategico: "Potencial estratégico", nao: "Não recomendada neste ciclo" };
  /* prontidão: parcela da carteira máxima já na Etapa 1, Estruturação (substitui a postura de apoio) */
  function prontTxt(x) {
    return x.prontidao == null ? "—" : Math.round(x.prontidao * 100) + "% da carteira na Estruturação";
  }
  var DIMS = [
    ["operacao", "Operação", 25], ["investimento", "Investimento", 15],
    ["impacto", "Impacto", 30], ["inovacao", "Inovação", 30]
  ];
  var GARGALOS = dados.meta.gargalos || {};
  var GARG_CURTO = dados.meta.gargalos_curto || {};
  function gargCurto(k) { return GARG_CURTO[k] || GARGALOS[k] || k; }
  var POTENCIAIS = dados.meta.potenciais || {};

  var exp = dados.experiencias.slice().sort(function (a, b) { return b.total - a.total; });

  /* Forma de coleta e data: a tabela de rotas do relatório final (pacote P5)
     é a fonte canônica e prevalece sobre o perfil codificado em montar_campo.py. */
  var P5C = (window.PTEAuth && window.PTEAuth.p5 && window.PTEAuth.p5()) || null;
  if (P5C && P5C.experiencias) {
    var canon = {};
    P5C.experiencias.forEach(function (e) { canon[e.nome] = e; });
    exp.forEach(function (x) {
      var e = canon[x.nome_p5]; if (!e) return;
      x.perfil = x.perfil || {};
      if (e.coleta) x.perfil.modo = e.coleta === "Virtual" ? "virtual" : "presencial";
      if (e.data) x.perfil.data = e.data;
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmt(v) { return v.toFixed(1).replace(".", ","); }
  function reais(v) {
    if (v == null) return "—";
    if (v >= 1e6) return "R$ " + fmt(v / 1e6) + (v < 2e6 ? " milhão" : " milhões");
    return "R$ " + v.toLocaleString("pt-BR");
  }

  /* ------------------------------------------------------------------ casca
     Quatro seções, cada uma respondendo a uma pergunta de decisão. Cada uma
     abre pela leitura — o que o dado quer dizer — e não pela descrição do dado. */
  var nAlta = exp.filter(function (x) { return x.classificacao === "alta"; }).length;
  var codif = exp.filter(function (x) { return x.codificada; });
  var semCod = exp.filter(function (x) { return !x.codificada; });
  var BASE_META = (window.PTE_DATA && window.PTE_DATA.meta) || {};
  var TOTAL_BASE = BASE_META.total || 80;          /* iniciativas distintas da base de prospecção */
  var FUNIL = BASE_META.funil || null;             /* 89 mapeadas, 5 descartadas, 3 repetidas */
  var nuncaVisitadas = TOTAL_BASE - exp.filter(function (x) { return x.ref_id; }).length;
  /* Atuação que vai além do local da visita, registrada pela equipe de campo:
     conta para a leitura de cobertura por estado. */
  var ATUACAO = { "Instituto Caburé": ["PI", "CE", "MA"], "Trilha Caminhos da Ibiapaba": ["CE", "PI"] };
  /* Estados sem incursão: o que a equipe registrou sobre cada um (P3, P4 e revisão de 30/09). */
  var SEM_INCURSAO = {
    SE: "Os parceiros mapeados não tiveram disponibilidade para receber a equipe, embora tenha havido mapeamento e contato.",
    MA: "Nenhuma visita foi programada para o estado."
  };
  var SEM_INCURSAO_CURTO = {
    SE: "Parceiros sem disponibilidade para receber a equipe, apesar do mapeamento e do contato.",
    MA: "Sem visita programada."
  };
  var ARTIGO = { "Instituto Caburé": "o", "Trilha Caminhos da Ibiapaba": "a" };
  var ARTIGO_UF = { MA: "O Maranhão", PI: "O Piauí", CE: "O Ceará", RN: "O Rio Grande do Norte", PB: "A Paraíba",
    PE: "Pernambuco", AL: "Alagoas", SE: "Sergipe", BA: "A Bahia" };
  var EM_UF = { MA: "no Maranhão", PI: "no Piauí", CE: "no Ceará", RN: "no Rio Grande do Norte", PB: "na Paraíba",
    PE: "em Pernambuco", AL: "em Alagoas", SE: "em Sergipe", BA: "na Bahia" };
  function comArtigo(nome, prep) {
    var a = ARTIGO[nome] || "";
    if (prep === "de") return (a === "o" ? "do " : a === "a" ? "da " : "de ") + nome;
    return (a ? a + " " : "") + nome;
  }
  var UF_NE = ["MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA"];
  var NOME_UF = { MA: "Maranhão", PI: "Piauí", CE: "Ceará", RN: "Rio Grande do Norte",
    PB: "Paraíba", PE: "Pernambuco", AL: "Alagoas", SE: "Sergipe", BA: "Bahia" };
  var ufsCampo = {};
  var ufsAtuacao = {};
  exp.forEach(function (x) {
    String(x.estado || "").split(/[,/]/).forEach(function (u) { u = u.trim(); if (u) ufsCampo[u] = 1; });
    (ATUACAO[x.nome_p5] || ATUACAO[x.nome] || []).forEach(function (u) {
      if (!ufsCampo[u]) (ufsAtuacao[u] = ufsAtuacao[u] || []).push(x.nome);
    });
  });
  var ufsSem = UF_NE.filter(function (u) { return !ufsCampo[u]; });
  var ufsSemNada = ufsSem.filter(function (u) { return !ufsAtuacao[u]; });
  function listaUF(us) {
    var n = us.map(function (u) { return NOME_UF[u] || u; });
    return n.length < 2 ? n.join("") : n.slice(0, -1).join(", ") + " e " + n[n.length - 1];
  }
  var notaSemCod = semCod.length
    ? " As " + semCod.length + " organizações visitadas na Bahia em agosto ainda não têm gargalos " +
      "e potencialidades codificados. Elas aparecem nas notas e na captação, mas não nas contagens de frequência."
    : "";

  var SECOES = [
    { id: "experiencias", rot: "Perfis", subs: ["lista"],
      perg: "As " + exp.length + " organizações avaliadas em campo",
      leitura: "<strong>" + nAlta + " das " + exp.length + "</strong> organizações alcançam 80 pontos ou mais. " +
        "Para definir o apoio, o perfil nas quatro dimensões diz mais do que a nota final: duas experiências " +
        "com a mesma pontuação podem precisar de apoios muito diferentes." },
    { id: "evidencia", rot: "Prospecção e gargalos", subs: ["prospeccao", "gargalos"],
      perg: "Comparação com a prospecção e principais gargalos",
      leitura: "A nota da prospecção documental antecipa pouco do resultado de campo. O gargalo mais comum na carteira " +
        "<strong>não é a falta de recursos</strong>, e sim a falta de informação para transformar uma boa experiência " +
        "em um pedido de financiamento viável." +
        notaSemCod },
    { id: "captacao", rot: "Captação", subs: ["captacao"],
      perg: "Mecanismos de captação indicados para cada etapa e condição para contratar",
      leitura: "O instrumento depende da etapa e da condição de cada item, e não da organização. A <strong>Estruturação</strong> " +
        "cabe nos instrumentos hoje acessíveis, como a linha de estruturação de projetos e as pequenas doações; a " +
        "<strong>Escala</strong> só vira pedido dimensionado depois que a condição de cada item se cumpre." },
    { id: "comparar", rot: "Comparação", subs: ["comparar"],
      perg: "Comparação entre experiências",
      leitura: "Compare até quatro experiências pelo <strong>perfil nas quatro dimensões</strong>, " +
        "e não apenas pela nota final. Gargalos compartilhados podem ser tratados em conjunto; os exclusivos " +
        "exigem apoio específico." },
    { id: "campo", rot: "Cobertura", subs: ["cobertura"],
      perg: "Cobertura das incursões e organizações não visitadas",
      leitura: "<strong>" + nuncaVisitadas + " das " + TOTAL_BASE + "</strong> iniciativas da base de prospecção não " +
        "receberam visita nem entrevista." +
        (ufsSemNada.length ? " Só " + listaUF(ufsSemNada) + (ufsSemNada.length > 1 ? " ficaram" : " ficou") +
          " sem nenhuma organização avaliada em campo" +
          (ufsSemNada.length === 1 && SEM_INCURSAO[ufsSemNada[0]] ? ": " + SEM_INCURSAO[ufsSemNada[0]].charAt(0).toLowerCase() +
            SEM_INCURSAO[ufsSemNada[0]].slice(1) : ".")
          : " Todos os nove estados têm ao menos uma organização avaliada em campo.") }
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
      '<input type="search" id="ec-busca" placeholder="Buscar experiência…" aria-label="Buscar experiência" />' +
      '<select id="ec-eixo" aria-label="Eixo"><option value="">Todos os eixos</option></select>' +
      '<select id="ec-cls" aria-label="Classificação"><option value="">Todas as classificações</option>' +
        '<option value="alta">Alta prioridade</option>' +
        '<option value="estrategico">Potencial estratégico</option>' +
        '<option value="nao">Não recomendada neste ciclo</option></select>' +
      '<select id="ec-ev" aria-label="Base informacional"><option value="">Todas as bases informacionais</option>' +
        '<option value="completa">Base completa</option>' +
        '<option value="parcial">Base parcial</option>' +
        '<option value="ausente">Base ausente</option></select>' +
      '<button id="ec-reset">Limpar filtros</button>' +
      '<span class="cnt" id="ec-cnt"></span>' +
    '</div>' +
    '<div class="exp-bar"><span class="exp-lab">Exportar:</span>' +
      '<button class="exp-btn" data-exp="xlsx" data-target="#ec-tabela" data-name="evidencia-campo" ' +
        'data-title="Evidência das incursões de campo" data-sheet="Campo">XLS</button>' +
      '<button class="exp-btn" data-exp="pdf" data-target="#ec-tabela" data-name="evidencia-campo" ' +
        'data-title="Evidência das incursões de campo">PDF</button></div>' +
    '<div class="ec-legenda">' +
      '<span class="lg lg-txt"><b>Barras de dimensão, na ordem:</b>&nbsp;' +
        (function () {
          var t = DIMS.map(function (d) { return d[1].toLowerCase() + " (peso " + d[2] + ")"; });
          return t.slice(0, -1).join(", ") + " e " + t[t.length - 1];
        })() + '</span>' +
      '<span class="lg"><b>Base informacional:</b> ' +
        '<span class="it"><i class="ec-ev completa"></i> completa</span>' +
        '<span class="it"><i class="ec-ev parcial"></i> parcial</span>' +
        '<span class="it"><i class="ec-ev ausente"></i> ausente</span></span>' +
    '</div>' +
    '<div class="ec-tw"><table id="ec-tabela"><thead><tr>' +
      '<th>Experiência</th><th>Eixo</th><th>Dimensões</th>' +
      '<th style="text-align:right">Pontuação</th><th>Classificação</th>' +
      '<th style="text-align:right">Carteira total<small>R$ milhões</small></th><th>Base informacional</th>' +
    '</tr></thead><tbody id="ec-corpo"></tbody></table></div>' +
    '<p class="ec-nota">A <strong>base informacional</strong> indica o que a organização documentou sobre as próprias ' +
      'finanças. <strong>Completa</strong>: documentou o custo de operar e a necessidade de recursos. ' +
      '<strong>Parcial</strong>: documentou só parte dessa informação. <strong>Ausente</strong>: não documentou nenhum dos ' +
      'dois, e a estimativa se apoia em valores de catálogo e em premissas da equipe. A base informacional define a ' +
      'confiança da estimativa (alta, média ou baixa).</p>';

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
      '<div class="ec-kpi b"><div class="v">' + alta + '</div><div class="l">com alta prioridade (80 pontos ou mais)</div></div>' +
      '<div class="ec-kpi c"><div class="v">' + fmt(min) + ' – ' + fmt(max) + '</div><div class="l">milhões de reais na carteira total, em 36 meses</div></div>' +
      '<div class="ec-kpi"><div class="v">' + comp + '</div><div class="l">com base informacional completa</div></div>';
  }

  function detalhe(x) {
    var p = x.perfil || {};
    var barras = DIMS.map(function (d) {
      var n = x.notas[d[0]];
      return '<div class="ec-barra"><span class="t">' + d[1] + '</span>' +
             '<span class="b"><span style="width:' + (n / 5 * 100) + '%"></span></span>' +
             '<span class="v">' + n + '/5 (peso ' + d[2] + ')</span></div>';
    }).join("");
    var temGab = x.gabinete != null;
    var gabNorm = temGab ? Math.round(x.gabinete / 30 * 100) : null;
    var dif = temGab ? (x.total - gabNorm > 0 ? "+" : "") + (x.total - gabNorm) : "—";
    var env = x.envelope.max > 0
      ? "R$ " + fmt(x.envelope.min) + " a " + fmt(x.envelope.max) + " milhões" : "Sem estimativa";
    var gargs = (x.gargalos || []).map(function (g) {
      return '<li>' + esc(GARGALOS[g] || g) + '</li>'; }).join("");
    var pots = (x.potenciais || []).map(function (g) {
      return '<li>' + esc(POTENCIAIS[g] || g) + '</li>'; }).join("");
    return '<tr class="ec-det"><td colspan="7"><div class="grid">' +
      '<div><h4>Avaliação por dimensão</h4>' + barras +
        '<dl style="margin-top:10px"><dt>Prospecção e campo</dt><dd>' +
        (temGab ? 'Prospecção: ' + gabNorm + '/100 (' + x.gabinete + '/30). Campo: ' + x.total + '/100. Diferença: ' + dif + ' pontos'
                : 'Não constava da base de prospecção') + '</dd></dl></div>' +
      '<div><h4>Perfil</h4><dl>' +
        '<dt>Natureza jurídica</dt><dd>' + esc(p.natureza || "—") + '</dd>' +
        '<dt>Ano de criação</dt><dd>' + (p.ano || "—") + '</dd>' +
        '<dt>Equipe</dt><dd>' + (p.equipe != null ? p.equipe + " pessoas" : "—") + '</dd>' +
        '<dt>Alcance</dt><dd>' + esc(p.benef || "—") + '</dd></dl></div>' +
      '<div><h4>Encaminhamento</h4><dl>' +
        '<dt>Carteira total</dt><dd>' + env + '</dd>' +
        '<dt>Prontidão</dt><dd>' + prontTxt(x) + '</dd>' +
        (x.condicao ? '<dt>Condição predominante da Escala</dt><dd>' + esc(x.condicao) + '</dd>' : '') +
        '<dt>Custo operacional</dt><dd>' + reais(p.custo_anual) +
          (p.custo_anual && !p.custo_p5 ? ' <span style="font-weight:400;color:var(--muted)">(não usado na estimativa)</span>' : '') + '</dd>' +
        '<dt>Necessidade declarada</dt><dd>' + reais(p.gap) + '</dd>' +
        '<dt>Visita</dt><dd>' + esc(p.data || "—") + ', ' + esc(p.modo || "—") +
          (p.mun ? ', em ' + esc(p.mun) + (p.uf ? " (" + esc(p.uf) + ")" : "") : "") + '</dd></dl></div>' +
      '<div><h4>Objeto do apoio</h4><p class="apoio">' + esc(x.apoio || "Não codificado.") + '</p>' +
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
        return '<i style="height:' + (x.notas[d[0]] / 5 * 26) + 'px"></i>'; }).join("");
      var env = x.envelope.max > 0 ? fmt(x.envelope.min) + " – " + fmt(x.envelope.max) : "—";
      var base = x.base_informacional || "ausente";
      return '<tr data-n="' + i + '">' +
        '<td class="nome">' + esc(x.nome) + '</td>' +
        '<td>' + (window.PTE_EIXO ? window.PTE_EIXO.tag(x.eixo_cod) :
          '<span class="ec-eixo" style="background:' + e[1] + '" title="' + esc(e[0]) + '">' + esc(x.eixo_cod) + '</span>') + '</td>' +
        '<td><div class="ec-dims" title="Notas em operação, investimento, impacto e inovação">' + dims + '</div></td>' +
        '<td class="n"><strong>' + x.total + '</strong></td>' +
        '<td><span class="cls-cap ' + x.classificacao + '">' + CLS[x.classificacao] + '</span></td>' +
        '<td class="n">' + env + '</td>' +
        '<td><span class="ec-ev ' + base + '" title="Base informacional ' + base + '"></span> <span class="ec-evt">' + base + '</span></td></tr>' +
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

  /* -------------------------------------------------- 3. Prospecção × campo
     Metade gráfico, metade análise. Nenhum rótulo dentro da área de plotagem:
     a identidade fica na lista de desvios, ligada ao gráfico por destaque
     recíproco. Rotular seletivamente é o padrão; 23 rótulos com linha-guia
     dentro do gráfico era o anti-padrão. */
  (function () {
    var TODOS = exp.filter(function (x) { return x.gabinete != null; })
      .map(function (x, i) {
        return { i: i, nome: x.nome, g: x.gabinete / 30 * 100, c: x.total,
                 cls: x.classificacao, d: x.total - x.gabinete / 30 * 100 };
      });
    var ctrl = { cls: "" };
    var EXTREMO = TODOS.slice().sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); })[0] || null;
    var COR = { sobe: "#0F7D8C", desce: "#F09C18", perto: "#6E6E78" };   /* azul-petróleo, laranja e cinza: legíveis sem depender de verde e vermelho */
    function corDe(d) { return d > 12 ? COR.sobe : (d < -12 ? COR.desce : COR.perto); }

    function correl(ps) {
      var n = ps.length;
      if (n < 4) return null;
      var mx = ps.reduce(function (a, p) { return a + p.g; }, 0) / n;
      var my = ps.reduce(function (a, p) { return a + p.c; }, 0) / n;
      var sx = Math.sqrt(ps.reduce(function (a, p) { return a + Math.pow(p.g - mx, 2); }, 0) / n);
      var sy = Math.sqrt(ps.reduce(function (a, p) { return a + Math.pow(p.c - my, 2); }, 0) / n);
      if (!sx || !sy) return null;
      return { r: ps.reduce(function (a, p) { return a + (p.g - mx) * (p.c - my); }, 0) / n / (sx * sy),
               mx: mx, my: my };
    }

    function svg(ps) {
      var W = 620, H = 470, L = 46, R = 16, T = 18, B = 46;
      var x0 = 50, x1 = 100, y0 = 35, y1 = 105;
      var px = function (v) { return L + (v - x0) / (x1 - x0) * (W - L - R); };
      var py = function (v) { return H - B - (v - y0) / (y1 - y0) * (H - T - B); };
      var PL = W - R, PB = H - B;
      var g = "";
      // zonas: sem texto dentro: o significado vai na legenda, fora do gráfico
      g += '<polygon points="' + L + ',' + PB + ' ' + PL + ',' + py(100) + ' ' + L + ',' + T +
           '" fill="' + COR.sobe + '" opacity=".045"/>' +
           '<polygon points="' + L + ',' + PB + ' ' + PL + ',' + py(100) + ' ' + PL + ',' + PB +
           '" fill="' + COR.desce + '" opacity=".045"/>';
      [50, 60, 70, 80, 90, 100].forEach(function (v) {
        g += '<line x1="' + L + '" y1="' + py(v).toFixed(1) + '" x2="' + PL + '" y2="' + py(v).toFixed(1) +
             '" stroke="var(--border-2)"/>' +
             '<text x="' + px(v).toFixed(1) + '" y="' + (PB + 17) + '" text-anchor="middle" font-size="11" fill="var(--muted)">' + v + '</text>' +
             '<text x="' + (L - 7) + '" y="' + (py(v) + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="var(--muted)">' + v + '</text>';
      });
      g += '<line x1="' + px(50).toFixed(1) + '" y1="' + py(50).toFixed(1) + '" x2="' + px(100).toFixed(1) +
           '" y2="' + py(100).toFixed(1) + '" stroke="var(--muted)" stroke-dasharray="5 5" opacity=".55"/>';
      ps.forEach(function (p) {
        g += '<circle class="ec-pt" data-i="' + p.i + '" cx="' + px(p.g).toFixed(1) + '" cy="' + py(p.c).toFixed(1) +
          '" r="6" fill="' + corDe(p.d) + '" opacity=".85" stroke="var(--surface)" stroke-width="2">' +
          '<title>' + esc(p.nome) + ': prospecção ' + Math.round(p.g) + ', campo ' + p.c +
          ' (diferença de ' + (p.d > 0 ? "+" : "") + Math.round(p.d) + ')</title></circle>';
      });
      g += '<line x1="' + L + '" y1="' + PB + '" x2="' + PL + '" y2="' + PB + '" stroke="var(--border)"/>' +
           '<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + PB + '" stroke="var(--border)"/>' +
           '<text x="' + ((PL + L) / 2).toFixed(0) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11.5" fill="var(--muted)">Nota da prospecção (0 a 100)</text>' +
           '<text x="13" y="' + (H / 2) + '" text-anchor="middle" font-size="11.5" fill="var(--muted)" transform="rotate(-90 13 ' + (H / 2) + ')">Nota de campo (0 a 100)</text>';
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Dispersão entre a nota da prospecção e a nota de campo das experiências avaliadas nos dois momentos.">' + g + '</svg>';
    }

    function pinta() {
      var ps = TODOS.filter(function (p) { return !ctrl.cls || p.cls === ctrl.cls; });
      var co = correl(ps);
      var desvios = ps.slice().sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); });

      document.getElementById("ec-disp-svg").innerHTML = svg(ps);
      document.getElementById("ec-disp-sub").textContent =
        ps.length + (ps.length === 1 ? " experiência" : " experiências") + " avaliadas nos dois momentos";

      document.getElementById("ec-disp-metr").innerHTML = co
        ? '<div class="ec-m"><span class="k">Correlação (r)</span><span class="v">' +
            co.r.toFixed(2).replace(".", ",") + '</span></div>' +
          '<div class="ec-m"><span class="k">Média na prospecção</span><span class="v">' + Math.round(co.mx) + '</span></div>' +
          '<div class="ec-m"><span class="k">Média no campo</span><span class="v">' + Math.round(co.my) + '</span></div>'
        : '<p class="ec-mini">Amostra insuficiente para calcular a correlação.</p>';

      document.getElementById("ec-disp-lista").innerHTML = desvios.map(function (p) {
        return '<li class="ec-dv" data-i="' + p.i + '">' +
          '<i style="background:' + corDe(p.d) + '"></i>' +
          '<span class="n">' + esc(p.nome) + '</span>' +
          '<span class="p" title="Prospecção e campo">' + Math.round(p.g) + '<span class="seta"> para </span>' + p.c + '</span>' +
          '<span class="d" style="color:' + (p.d > 12 ? COR.sobe : (p.d < -12 ? "#9A5B00" : "var(--muted)")) + '">' +
          (p.d > 0 ? "+" : "") + Math.round(p.d) + '</span></li>';
      }).join("");

      // destaque recíproco entre a lista e o gráfico
      function realce(i, on) {
        var c = document.querySelector('#ec-disp-svg circle[data-i="' + i + '"]');
        var li = document.querySelector('#ec-disp-lista li[data-i="' + i + '"]');
        if (c) { c.setAttribute("r", on ? 9 : 6); c.setAttribute("opacity", on ? 1 : .85); }
        if (li) li.classList.toggle("on", on);
      }
      Array.prototype.forEach.call(document.querySelectorAll("#ec-disp-lista li"), function (li) {
        var i = li.getAttribute("data-i");
        li.addEventListener("mouseenter", function () { realce(i, true); });
        li.addEventListener("mouseleave", function () { realce(i, false); });
      });
      Array.prototype.forEach.call(document.querySelectorAll("#ec-disp-svg circle"), function (c) {
        var i = c.getAttribute("data-i");
        c.addEventListener("mouseenter", function () { realce(i, true); });
        c.addEventListener("mouseleave", function () { realce(i, false); });
      });
    }

    document.getElementById("sub-prospeccao").innerHTML =
      '<div class="ec-controles">' +
        '<label class="ec-campo-ctrl">Classificação ' +
          '<select id="ec-disp-cls">' +
            '<option value="">Todas</option>' +
            '<option value="alta">Alta prioridade</option>' +
            '<option value="estrategico">Potencial estratégico</option>' +
            '<option value="nao">Não recomendada neste ciclo</option>' +
          '</select></label>' +
        '<button class="ec-ajuda" id="ec-disp-ajuda" aria-expanded="false" aria-controls="ec-disp-expl" ' +
          'title="Como ler este gráfico" aria-label="Como ler este gráfico">?</button>' +
        '<div class="exp-bar"><span class="exp-lab">Exportar:</span>' +
        '<button class="exp-btn" data-exp="png" data-target="#ec-disp" data-name="prospeccao-x-campo">Imagem (PNG)</button></div>' +
      '</div>' +
      '<div class="ec-expl" id="ec-disp-expl" hidden>' +
        '<h4>Como ler este gráfico</h4>' +
        '<ul>' +
          '<li>Cada ponto é uma experiência avaliada <strong>duas vezes</strong>: no levantamento documental (eixo horizontal) e depois da visita de campo (eixo vertical).</li>' +
          '<li>A <strong>linha tracejada</strong> indica notas iguais nos dois momentos. A área verde reúne os casos em que a nota de campo superou a da prospecção; a vermelha, os casos em que ficou abaixo.</li>' +
          '<li>O coeficiente de correlação (<strong>r</strong>) varia de −1 a 1 e mede o quanto uma nota acompanha a outra. Abaixo de 0,3, a prospecção documental explica pouco do resultado de campo.</li>' +
          '<li>Passe o mouse sobre um ponto ou sobre um nome da lista para destacar a experiência nos dois lugares.</li>' +
        '</ul>' +
      '</div>' +
      '<div class="ec-split" id="ec-disp">' +
        '<div class="ec-card ec-graf">' +
          '<h3>Nota da prospecção e nota de campo</h3>' +
          '<p class="sub" id="ec-disp-sub"></p>' +
          '<div id="ec-disp-svg"></div>' +
          '<div class="ec-zleg">' +
            '<span><i style="background:' + COR.sobe + '"></i>Campo mais de 12 pontos acima</span>' +
            '<span><i style="background:' + COR.perto + '"></i>Diferença de até 12 pontos</span>' +
            '<span><i style="background:' + COR.desce + '"></i>Campo mais de 12 pontos abaixo</span>' +
          '</div>' +
        '</div>' +
        '<div class="ec-card ec-analise">' +
          '<h3>Leitura</h3>' +
          '<div class="ec-metr" id="ec-disp-metr"></div>' +
          '<p class="ec-mini ec-concl">As médias da prospecção e do campo são próximas, mas a posição de cada ' +
            'experiência muda bastante. A prospecção documental acerta a média da carteira e erra no caso ' +
            'individual, que é o que importa para a decisão.' + (EXTREMO ? ' O maior desvio é o de <strong>' +
            esc(EXTREMO.nome) + '</strong>: ' + Math.round(EXTREMO.g) + ' pontos na prospecção e ' + EXTREMO.c +
            ' no campo.' : '') + '</p>' +
          '<h4 class="ec-lt">Maiores desvios</h4>' +
          '<ol class="ec-dvlista" id="ec-disp-lista"></ol>' +
        '</div>' +
      '</div>';

    document.getElementById("ec-disp-cls").addEventListener("change", function (e) {
      ctrl.cls = e.target.value; pinta(); });
    var bA = document.getElementById("ec-disp-ajuda");
    bA.addEventListener("click", function () {
      var pn = document.getElementById("ec-disp-expl"), abrir = pn.hidden;
      pn.hidden = !abrir; bA.setAttribute("aria-expanded", String(abrir)); bA.classList.toggle("on", abrir);
    });
    pinta();
  })();

  /* ------------------------------------------------------------ 4. Gargalos */
  (function () {
    function freq(dic, campo, cor) {
      var c = {};
      Object.keys(dic).forEach(function (k) { c[k] = 0; });
      codif.forEach(function (x) { (x[campo] || []).forEach(function (k) { c[k]++; }); });
      var den = codif.length || 1;
      var ord = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
      return { ord: ord, html: '<div class="ec-freq">' + ord.map(function (k) {
        return '<div class="r"><span class="t">' + esc(dic[k]) + '</span>' +
          '<span class="b"><span style="width:' + (c[k] / den * 100) + '%;background:' + cor + ';opacity:.75"></span></span>' +
          '<span class="v">' + c[k] + ' de ' + den + '</span></div>';
      }).join("") + '</div>' };
    }
    var fg = freq(GARGALOS, "gargalos", "#E42424");
    var fp = freq(POTENCIAIS, "potenciais", "#54B43C");

    var ordExp = exp.slice().sort(function (a, b) {
      if (a.codificada !== b.codificada) return a.codificada ? -1 : 1;
      return (b.gargalos || []).length - (a.gargalos || []).length; });
    var cab = fg.ord.map(function (k) {
      return '<th class="vert" title="' + esc(GARGALOS[k]) + '"><div>' +
             esc(gargCurto(k)) + '</div></th>'; }).join("");
    var linhas = ordExp.map(function (x) {
      if (!x.codificada) {
        return '<tr class="ec-semcod"><th class="rot">' + esc(x.nome) + '</th>' +
          '<td colspan="' + (fg.ord.length + 1) + '">Sem leitura qualitativa codificada</td></tr>';
      }
      return '<tr><th class="rot">' + esc(x.nome) + '</th>' +
        fg.ord.map(function (k) {
          var on = (x.gargalos || []).indexOf(k) !== -1;
          return '<td class="' + (on ? "on" : "") + '" title="' + esc(GARGALOS[k]) + '"><i></i></td>';
        }).join("") +
        '<td class="tot">' + (x.gargalos || []).length + '</td></tr>';
    }).join("");

    document.getElementById("sub-gargalos").innerHTML =
      '<div class="ec-card"><h3>Gargalos recorrentes</h3>' +
      '<p class="sub">Frequência entre as ' + codif.length + ' experiências com leitura qualitativa codificada</p>' + fg.html +
      '<p class="ec-nota">A ausência de indicadores sistematizados e a dependência de uma única fonte de ' +
      'financiamento aparecem em quase toda a carteira. Por serem problemas comuns, justificam um ' +
      '<strong>apoio coletivo</strong>, em vez de apoios isolados a cada organização.</p></div>' +
      '<div class="ec-card"><h3>Potencialidades recorrentes</h3>' +
      '<p class="sub">Frequência entre as ' + codif.length + ' experiências com leitura qualitativa codificada</p>' + fp.html + '</div>' +
      '<div class="ec-card"><h3>Gargalos por experiência</h3>' +
      '<p class="sub">Experiências ordenadas pelo número de gargalos registrados</p>' +
      '<div class="exp-bar"><span class="exp-lab">Exportar:</span>' +
      '<button class="exp-btn" data-exp="xlsx" data-target="#ec-matriz" data-name="matriz-gargalos" ' +
        'data-title="Gargalos por experiência" data-sheet="Gargalos">XLS</button></div>' +
      '<div class="ec-mx"><table id="ec-matriz">' +
      '<colgroup><col class="nome"/>' +
        fg.ord.map(function () { return '<col class="g"/>'; }).join("") +
        '<col class="tot"/></colgroup>' +
      '<thead><tr><th class="rot">Experiência</th>' + cab +
      '<th class="vert tot-h"><div>Total</div></th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
      '<p class="ec-nota">Célula vazia significa que o gargalo <strong>não foi mencionado no relatório</strong>, ' +
      'e não que ele inexiste. As organizações visitadas na Bahia em agosto ainda não têm a leitura qualitativa codificada ' +
      'e aparecem ao fim da tabela, sem marcações.</p></div>';
  })();
  /* ----------------------------------------------------------- 5. Cobertura
     Calculada a partir das rotas do relatório final (dados.meta.rotas) e da
     base de prospecção (window.PTE_DATA). Nada de fixo sobre quais estados
     receberam incursão; o que é registro da equipe está em SEM_INCURSAO,
     ATUACAO e NAO_REALIZADAS. */
  (function () {
    var cruzadas = exp.filter(function (x) { return x.ref_id; }).length;
    var novas = exp.filter(function (x) { return !x.ref_id; });
    var virtuais = exp.filter(function (x) { return (x.perfil || {}).modo === "virtual"; });
    var ROTAS = (dados.meta.rotas || []);
    var nomeRota = {}, ordemRota = {};
    ROTAS.forEach(function (r, i) { nomeRota[r.id] = r.nome; ordemRota[r.id] = i; });
    function rotaCurta(id) { return (nomeRota[id] || id).replace(/^Rota extra$/, "rota extra"); }
    function listaRotas(ids) {
      var l = ids.slice().sort(function (a, b) { return (ordemRota[a] || 0) - (ordemRota[b] || 0); }).map(rotaCurta);
      return l.length < 2 ? l.join("") : l.slice(0, -1).join(", ") + " e " + l[l.length - 1];
    }

    /* mapeadas com atuação no estado (base de prospecção; programas em vários
       estados contam em cada um) e avaliadas em campo (local da visita) */
    var BASE = (window.PTE_DATA && window.PTE_DATA.iniciativas) || [];
    function ufsDe(v) {
      return String(v || "").split(/[,/]/).map(function (u) { return u.trim(); }).filter(function (u) { return /^[A-Z]{2}$/.test(u); });
    }
    var mapUF = {};
    BASE.forEach(function (i) { ufsDe(i.estado).forEach(function (u) { mapUF[u] = (mapUF[u] || 0) + 1; }); });
    var porUF = {};
    exp.forEach(function (x) {
      ufsDe(x.estado).forEach(function (u) {
        porUF[u] = porUF[u] || { n: 0, rotas: {} };
        porUF[u].n += 1; porUF[u].rotas[x.rota] = 1;
      });
    });
    var maxUF = Math.max.apply(null, UF_NE.map(function (u) { return Math.max(mapUF[u] || 0, (porUF[u] || {}).n || 0); })) || 1;
    var ufHtml = UF_NE.map(function (u) {
      var v = porUF[u], m = mapUF[u] || 0;
      var det;
      if (v) det = '<b>' + v.n + '</b> avaliada' + (v.n > 1 ? 's' : '') + ' <span class="ec-rot">' + esc(listaRotas(Object.keys(v.rotas))) + '</span>';
      else det = '<span class="ec-sem">Sem incursão</span>';
      var linha2 = "";
      if (!v) {
        var partes = [];
        if (SEM_INCURSAO_CURTO[u]) partes.push(esc(SEM_INCURSAO_CURTO[u]));
        if (ufsAtuacao[u]) partes.push('Atuação ' + ufsAtuacao[u].map(function (n) {
          var o = exp.filter(function (x) { return x.nome === n || x.nome_p5 === n; })[0];
          var onde = o ? ufsDe(o.estado)[0] : null;
          return esc(comArtigo(n, "de")) + (onde ? ', avaliad' + (ARTIGO[n] === "a" ? 'a' : 'o') + ' ' + esc(EM_UF[onde] || onde) : '');
        }).join(" e ") + '.');
        linha2 = partes.join(" ");
      }
      return '<div class="r ec-uf' + (v ? '' : ' sem') + '">' +
        '<span class="t">' + NOME_UF[u] + ' <small>(' + u + ')</small></span>' +
        '<span class="b" title="' + m + ' mapeadas com atuação no estado; ' + (v ? v.n : 0) + ' avaliadas em campo">' +
          '<span class="map" style="width:' + (m / maxUF * 100).toFixed(1) + '%"></span>' +
          (v ? '<span class="aval" style="width:' + (v.n / maxUF * 100).toFixed(1) + '%"></span>' : '') + '</span>' +
        '<span class="v">' + det + '<small>' + m + ' mapeada' + (m > 1 ? 's' : '') + '</small>' +
          (linha2 ? '<em>' + linha2 + '</em>' : '') + '</span></div>';
    }).join("");

    /* visitas previstas que não aconteceram (P3, seção 4.1; P4, seção 2) */
    var NAO_REALIZADAS = [
      { org: "Redeser", local: "Crato (CE)", rota: "Rota 1", st: "nao", situacao: "Não realizada",
        motivo: "A Fundação Araripe não retornou aos contatos." },
      { org: "Hub de Hidrogênio Verde do Pecém", local: "São Gonçalo do Amarante (CE)", rota: "Rota 2", st: "adiada", situacao: "Adiada, sem data",
        motivo: "Prevista como entrevista virtual; a operação só começa em 2029 ou 2030." },
      { org: "7 das 13 organizações previstas", local: "Pernambuco e Alagoas", rota: "Rota 3", st: "nao", situacao: "Sem retorno",
        motivo: "Sem resposta aos contatos por e-mail, telefone, WhatsApp e intermediários. Entre elas: Logística Verde em Suape, " +
          "Grupo EQM/ZEG Biogás, SIMACaatinga, OxeTech, Paisagens Alimentares e EXYGEN/GranBio." }
    ];
    var REPROGRAMADAS = [
      { org: "Rede Xique Xique", de: "Rota 1", para: "rota extra, em 05/08" },
      { org: "Fazenda Tamanduá", de: "Rota 1", para: "rota extra, em 14/08" }
    ];
    var nrHtml = '<table class="ec-nr"><thead><tr><th>Organização</th><th>Rota prevista</th><th>Situação</th><th>Motivo</th></tr></thead><tbody>' +
      NAO_REALIZADAS.map(function (x) {
        return '<tr><td><b>' + esc(x.org) + '</b><small>' + esc(x.local) + '</small></td><td>' + esc(x.rota) + '</td>' +
          '<td><span class="ec-st ' + x.st + '">' + esc(x.situacao) + '</span></td><td>' + esc(x.motivo) + '</td></tr>';
      }).join("") + '</tbody></table>';

    var bahia = porUF.BA ? porUF.BA.n : 0;
    var maisBase = UF_NE.slice().sort(function (a, b) { return (mapUF[b] || 0) - (mapUF[a] || 0); })[0];

    var nEst = exp.filter(function (x) { return x.envelope && x.envelope.max > 0; }).length;
    var mapeadas = FUNIL ? FUNIL.mapeadas : TOTAL_BASE + novas.length;
    /* mesmo funil em cápsulas da aba Carteira: largura proporcional às mapeadas */
    var TONS = ["azul", "vermelho", "laranja", "verde"];
    var capsula = function (i, v, rot) {
      return '<div class="cap-linha" role="listitem" style="--p:' + (v / mapeadas).toFixed(4) + ';--i:' + i + '">' +
        '<b class="cap ' + TONS[i] + '">' + v + '</b><p class="cap-txt"><span>' + rot + '</span></p></div>';
    };
    document.getElementById("sub-cobertura").innerHTML =
      '<div class="ec-card"><h3>Da prospecção à recomendação</h3>' +
      '<p class="sub">Das ' + mapeadas + ' iniciativas mapeadas às ' + nAlta + ' recomendadas com alta prioridade</p>' +
      '<div class="capsulas" role="list">' +
        capsula(0, mapeadas, "iniciativas mapeadas") +
        capsula(1, exp.length, "avaliadas em campo") +
        capsula(2, nEst, "com estimativa de recursos") +
        capsula(3, nAlta, "recomendadas com alta prioridade") +
      '</div>' +
      '<p class="ec-nota">' + (FUNIL
        ? 'Das ' + FUNIL.mapeadas + ' iniciativas mapeadas, ' + FUNIL.descartadas + ' foram descartadas na prospecção, ' +
          'por não terem sido localizadas ou não atuarem no Nordeste, e ' + FUNIL.repetidas + ' repetem organizações já ' +
          'listadas. Restam ' + (TOTAL_BASE + novas.length) + ' distintas: ' + TOTAL_BASE + ' da base de prospecção e ' +
          novas.length + ' identificada' + (novas.length === 1 ? '' : 's') + ' durante as visitas' +
          (novas.length ? ' (' + novas.map(function (x) { return esc(x.nome); }).join(" e ") + ')' : '') + '. '
        : '') +
      'Das ' + TOTAL_BASE + ' iniciativas da base, ' + cruzadas + ' foram avaliadas em campo; as outras ' + nuncaVisitadas +
      ' <strong>não receberam visita nem entrevista</strong> e, por isso, só têm a avaliação da prospecção.</p></div>' +
      '<div class="ec-card"><h3>Cobertura por estado</h3>' +
      '<p class="sub">Iniciativas mapeadas com atuação em cada estado e organizações avaliadas em campo, com as rotas que passaram por ele</p>' +
      '<div class="ec-uf-leg"><span><i class="aval"></i>Avaliadas em campo</span><span><i class="map"></i>Mapeadas com atuação no estado</span></div>' +
      '<div class="ec-freq ec-ufs">' + ufHtml + '</div>' +
      '<p class="ec-nota">' +
        (ufsSemNada.length ? '<strong>Só ' + listaUF(ufsSemNada) + (ufsSemNada.length > 1 ? ' ficaram' : ' ficou') +
          ' sem nenhuma organização avaliada em campo.</strong> ' : '') +
        ufsSemNada.map(function (u) { return SEM_INCURSAO[u] ? SEM_INCURSAO[u] + ' ' : ''; }).join("") +
        Object.keys(ufsAtuacao).map(function (u) {
          return (ARTIGO_UF[u] || u) + ' não recebeu incursão, mas ' +
            ufsAtuacao[u].map(function (n) { return comArtigo(n); }).join(" e ") +
            (ufsAtuacao[u].length > 1 ? ', avaliadas em estados vizinhos, atuam' : ', avaliado em estado vizinho, atua') +
            ' também nele. ';
        }).join("") +
        (bahia && maisBase === "BA" ? 'A Bahia, estado com mais iniciativas mapeadas, entrou na rota extra de agosto, com ' +
          bahia + ' organizações visitadas em Salvador e no Recôncavo. ' : '') +
        'Programas que atuam em vários estados contam como mapeados em cada um deles; as organizações avaliadas contam pelo ' +
        'local da visita ou entrevista, e as que atuam em dois estados, como a Trilha Caminhos da Ibiapaba e o No Clima da Caatinga, contam nos dois.' +
      '</p></div>' +
      '<div class="ec-card"><h3>Visitas previstas e não realizadas</h3>' +
      '<p class="sub">Organizações previstas nas rotas que não puderam ser visitadas nem entrevistadas, segundo os relatórios das incursões</p>' +
      nrHtml +
      '<p class="ec-nota">Duas visitas previstas na Rota 1 foram reprogramadas e realizadas na rota extra: ' +
      REPROGRAMADAS.map(function (x) { return esc(x.org) + ' (' + esc(x.para) + ')'; }).join(" e ") +
      '. Das ' + exp.length + ' avaliações, ' + virtuais.length + ' foram feitas <strong>por videochamada</strong>' +
      (virtuais.length ? ' (' + virtuais.map(function (x) { return esc(x.nome); }).join(", ") + ')' : "") +
      ', no caso do Instituto Caburé e do No Clima da Caatinga por indisponibilidade de agenda das organizações; ' +
      'o relatório registra a videochamada como limitação metodológica.</p></div>';
  })();
  /* ------------------------------------------------------------ 6. Captação */
  (function () {
    var m = dados.meta || {};
    var fams = m.captacao || [], etapas = m.mecanismo_etapa || [],
        agendas = m.agendas || [], escala = m.escala || {};

    var porEtapa = etapas.map(function (x) {
      return '<div class="ec-mec"><h4>' + esc(x.rotulo) + ' <span style="font-weight:400;color:var(--muted)">(' +
        esc(x.numeros || "") + ')</span></h4>' +
        '<p>' + esc(x.familias || "—") + '</p>' +
        (x.obs ? '<p class="at">' + esc(x.obs) + '</p>' : '') + '</div>';
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
        '<div class="ec-kpi c"><div class="v">' + acimaPiso + '</div><div class="l">das ' + recom.length +
          ' organizações de alta prioridade alcançam o porte mínimo do fundo regional, de R$ ' + (escala.piso_padrao || 15) + ' milhões</div></div>' +
        '<div class="ec-kpi"><div class="v">' + abaixoRed +
          '</div><div class="l">das 18 ficam abaixo até do piso reduzido, de R$ ' + (escala.piso_reduzido || 5) + ' milhões</div></div>' +
      '</div>' +
      '<div class="ec-card"><h3>Restrição de escala</h3>' +
      '<p class="sub">O porte de cada organização, isoladamente, não alcança os canais de maior volume</p>' +
      '<p style="font-size:.88rem;line-height:1.6;margin:0">' + esc(escala.nota || "") + '</p>' +
      '<p style="font-size:.95rem;line-height:1.6;margin:10px 0 0;font-weight:600;color:var(--brand)">' +
        'A carteira só alcança esses canais se for apresentada como um programa único, com subprojetos selecionados e ' +
        'supervisionados por um agente credenciado. Apresentada experiência a experiência, a maior parte ficaria de fora.</p></div>' +
      '<div class="ec-card"><h3>Mecanismos por etapa e condição para contratar</h3>' +
      '<p class="sub">A associação é feita por etapa e tipo de condição, e não por iniciativa</p>' +
      porEtapa +
      '<p class="ec-nota">O relatório associa mecanismos à etapa e ao tipo de condição de cada item, em caráter ' +
      'indicativo. Por isso, o painel não apresenta uma relação entre cada iniciativa e um mecanismo específico.</p></div>' +
      '<div class="ec-card"><h3>Famílias de mecanismos</h3>' +
      '<p class="sub">Aderência à carteira e pontos de atenção de cada uma das ' + fams.length + ' famílias</p>' + famHtml + '</div>' +
      '<div class="ec-card"><h3>Agendas coletivas</h3>' +
      '<p class="sub">Temas que envolvem várias famílias de mecanismos e dizem respeito à carteira como um todo</p>' +
      agHtml + '</div>';
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

    var eixosCmp = Object.keys(EIXOS).filter(function (k) {
      return ordenadas.some(function (x) { return x.eixo_cod === k; }); });
    caixa.innerHTML =
      '<div class="ec-controles">' +
        '<label class="ec-campo-ctrl">Eixo ' +
          '<select id="ec-cmp-eixo"><option value="">Todos os eixos</option>' +
            eixosCmp.map(function (k) {
              var n = ordenadas.filter(function (x) { return x.eixo_cod === k; }).length;
              return '<option value="' + k + '">' + esc(EIXOS[k][0]) + ' (' + n + ')</option>'; }).join("") +
          '</select></label>' +
        '<label class="ec-campo-ctrl">Adicionar ' +
          '<select id="ec-cmp-add"></select></label>' +
        '<button class="ec-btn-lim" id="ec-cmp-eixo-todas" hidden></button>' +
        '<button class="ec-btn-lim" id="ec-cmp-lim">Limpar seleção</button>' +
        '<div class="exp-bar"><span class="exp-lab">Exportar:</span>' +
        '<button class="exp-btn" data-exp="png" data-target="#ec-cmp-corpo" data-name="comparacao">Imagem (PNG)</button></div>' +
      '</div>' +
      '<div class="ec-chips" id="ec-cmp-chips"></div>' +
      '<div id="ec-cmp-corpo"></div>';

    function barras(itens) {
      var W = 880, H = 230, L = 130, R = 20, T = 30, B = 34;
      var pw = W - L - R, gw = pw / DIMS.length, bw = Math.min(26, (gw - 18) / itens.length);
      var COR = ["#24246C", "#F09C18", "#54B43C", "#0C549C"];
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
             ' <tspan fill="var(--muted)">(peso ' + d[2] + ')</tspan></text>';
        itens.forEach(function (x, xi) {
          var n = x.notas[d[0]];
          var h = (n / 5) * (H - T - B);
          var bx = x0 + gw / 2 - (itens.length * bw + (itens.length - 1) * 4) / 2 + xi * (bw + 4);
          g += '<rect x="' + bx.toFixed(1) + '" y="' + (H - B - h).toFixed(1) + '" width="' + bw.toFixed(1) +
               '" height="' + h.toFixed(1) + '" fill="' + COR[xi % 4] + '" opacity=".85" rx="2">' +
               '<title>' + esc(x.nome) + ', ' + d[1].toLowerCase() + ': ' + n + ' de 5</title></rect>';
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
        ["Classificação", function (x) { return '<span class="cls-cap ' + x.classificacao + '">' + CLS[x.classificacao] + '</span>'; }],
        ["Eixo", function (x) { return esc((EIXOS[x.eixo_cod] || [x.eixo_cod])[0]); }],
        ["Carteira total", function (x) { return x.envelope.max > 0 ? "R$ " + fmt(x.envelope.min) + " a " + fmt(x.envelope.max) + " milhões" : "Sem estimativa"; }],
        ["Prontidão", function (x) { return prontTxt(x); }],
        ["Base informacional", function (x) { return x.base_informacional ? x.base_informacional.charAt(0).toUpperCase() + x.base_informacional.slice(1) : "—"; }],
        ["Nota da prospecção", function (x) { return x.gabinete != null ? Math.round(x.gabinete / 30 * 100) + "/100" : "Não constava da base"; }],
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

      return '<div class="ec-card"><h3>Diferenças e pontos em comum</h3>' +
        '<p class="sub">Leitura que orienta o tipo de apoio</p>' +
        (maior.amp > 0
          ? '<p class="ec-estrat">A maior diferença está em <strong>' + maior.d[1].toLowerCase() + '</strong> ' +
            '(peso ' + maior.d[2] + '): ' + maior.amp + ' ponto' + (maior.amp > 1 ? "s" : "") +
            ' entre <strong>' + esc(lider.nome) + '</strong> e <strong>' + esc(lanterna.nome) +
            '</strong>. Essa é a dimensão que deve orientar a escolha.</p>'
          : '<p class="ec-estrat">As experiências selecionadas têm <strong>perfil idêntico</strong> nas quatro dimensões. ' +
            'A decisão deve considerar o valor estimado, a prontidão ou a aderência ao eixo.</p>') +
        '<div class="ec-dois">' +
          '<div><h4>Gargalos em comum <span class="ec-cnt">' + comuns.length + '</span></h4>' +
            (comuns.length
              ? '<ul>' + comuns.map(function (g) { return '<li>' + esc(GARGALOS[g]) + '</li>'; }).join("") + '</ul>' +
                '<p class="ec-mini">Podem ser tratados por um <strong>apoio coletivo</strong>, uma única vez para todo o conjunto.</p>'
              : '<p class="ec-mini">Nenhum gargalo é comum a todas.</p>') + '</div>' +
          '<div><h4>Exclusivos de cada uma <span class="ec-cnt">' +
            exclusivos.reduce(function (a, e) { return a + e.gs.length; }, 0) + '</span></h4>' +
            (exclusivos.length
              ? exclusivos.map(function (e) {
                  return '<p class="ec-excl"><b>' + esc(e.nome) + '</b><br>' +
                    e.gs.map(function (g) { return esc(GARGALOS[g]); }).join("; ") + '</p>'; }).join("")
              : '<p class="ec-mini">Nenhum gargalo exclusivo.</p>') +
            '<p class="ec-mini">Exigem <strong>apoio específico</strong> para cada iniciativa.</p></div>' +
        '</div></div>';
    }

    function render() {
      var chips = document.getElementById("ec-cmp-chips");
      chips.innerHTML = sel.length
        ? sel.map(function (i, k) {
            return '<span class="ec-chip" data-k="' + k + '">' + esc(ordenadas[i].nome) +
                   '<button aria-label="Remover da comparação">×</button></span>'; }).join("")
        : '<span class="ec-vazio">Escolha de 2 a ' + MAX + ' experiências para comparar.</span>';
      Array.prototype.forEach.call(chips.querySelectorAll(".ec-chip button"), function (b) {
        b.addEventListener("click", function () {
          sel.splice(Number(b.parentNode.getAttribute("data-k")), 1); render(); });
      });

      var corpo = document.getElementById("ec-cmp-corpo");
      if (sel.length < 2) {
        corpo.innerHTML = '<div class="ec-card ec-placeholder">' +
          '<p>A comparação apresenta o <strong>perfil nas quatro dimensões</strong>, um quadro lado a lado ' +
          'e os gargalos que as experiências têm em comum ou que são exclusivos de cada uma.</p></div>';
        return;
      }
      var itens = sel.map(function (i) { return ordenadas[i]; });
      corpo.innerHTML = barras(itens) + quadro(itens) + estrategia(itens);
    }

    /* comparação por eixo (pedido da equipe): o filtro restringe a lista e um
       botão compara de uma vez as experiências do eixo, até o limite de quatro */
    var eixoCmp = "";
    function opcoes() {
      var sAdd = document.getElementById("ec-cmp-add");
      sAdd.innerHTML = '<option value="">Escolha uma experiência</option>' +
        ordenadas.map(function (x, i) {
          if (eixoCmp && x.eixo_cod !== eixoCmp) return "";
          return '<option value="' + i + '">' + esc(x.nome) + ' (' + x.total + ' pontos)</option>'; }).join("");
      var bt = document.getElementById("ec-cmp-eixo-todas");
      var doEixo = ordenadas.filter(function (x) { return eixoCmp && x.eixo_cod === eixoCmp; });
      bt.hidden = doEixo.length < 2;
      bt.textContent = doEixo.length > MAX ? "Comparar as " + MAX + " de maior pontuação do eixo"
        : "Comparar as " + doEixo.length + " do eixo";
    }
    document.getElementById("ec-cmp-eixo").addEventListener("change", function (e) {
      eixoCmp = e.target.value; opcoes(); });
    document.getElementById("ec-cmp-eixo-todas").addEventListener("click", function () {
      sel = [];
      ordenadas.forEach(function (x, i) { if (x.eixo_cod === eixoCmp && sel.length < MAX) sel.push(i); });
      render();
    });
    opcoes();
    document.getElementById("ec-cmp-add").addEventListener("change", function (e) {
      var i = Number(e.target.value);
      if (e.target.value !== "" && sel.indexOf(i) === -1 && sel.length < MAX) sel.push(i);
      e.target.value = ""; render();
    });
    document.getElementById("ec-cmp-lim").addEventListener("click", function () { sel = []; render(); });
    render();
  })();
})();
