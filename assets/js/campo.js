/* PTE Nordeste — módulo "Evidência de campo".
   Consome window.PTE_CAMPO, decifrado por auth.js depois do login.
   Renderiza dentro de #view-campo. */
(function () {
  "use strict";

  var raiz = document.getElementById("view-campo");
  if (!raiz) return;

  var dados = window.PTEAuth && window.PTEAuth.dados();
  if (!dados || !dados.experiencias) {
    raiz.innerHTML = '<p class="cmp-intro">Não foi possível carregar a camada de campo.</p>';
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
  var CLS = {
    alta: "Alta prioridade",
    estrategico: "Potencial estratégico",
    nao: "Não recomendada"
  };
  var POSTURAS = {
    direto: "Apoio direto",
    condicionado: "Apoio direto condicionado",
    quantificacao: "Quantificação prévia",
    preparacao: "Preparação ampla",
    preparatorio: "Apoio preparatório"
  };
  var DIMS = [
    ["operacao", "Operação", 25],
    ["investimento", "Investimento", 15],
    ["impacto", "Impacto", 30],
    ["inovacao", "Inovação", 30]
  ];

  var exp = dados.experiencias.slice().sort(function (a, b) { return b.total - a.total; });
  var estado = { busca: "", eixo: "", cls: "", ev: "" };
  var aberta = null;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmt(v) { return v.toFixed(1).replace(".", ","); }

  raiz.innerHTML =
    '<p class="cmp-intro">Sistematização das três incursões de campo — <strong>Produtos 3, 4 e 5</strong>. ' +
    'Notas de 1 a 5 em quatro dimensões, convertidas em pontuação ponderada de 0 a 100 ' +
    '(Impacto 30 · Inovação 30 · Operação 25 · Investimento 15). Clique numa linha para ver o detalhe.</p>' +
    '<div class="cmp-kpis" id="cmp-kpis"></div>' +
    '<div class="cmp-filtros">' +
      '<input type="search" id="cmp-busca" placeholder="Buscar experiência…" />' +
      '<select id="cmp-eixo"><option value="">Todos os eixos</option></select>' +
      '<select id="cmp-cls"><option value="">Toda a carteira</option>' +
        '<option value="alta">Alta prioridade</option>' +
        '<option value="estrategico">Potencial estratégico</option>' +
        '<option value="nao">Não recomendada</option></select>' +
      '<select id="cmp-ev"><option value="">Qualquer base informacional</option>' +
        '<option value="completa">Base completa</option>' +
        '<option value="parcial">Base parcial</option>' +
        '<option value="ausente">Base ausente</option></select>' +
      '<button id="cmp-reset">Limpar</button>' +
      '<span class="cnt" id="cmp-cnt"></span>' +
    '</div>' +
    '<div class="cmp-tw"><table><thead><tr>' +
      '<th>Experiência</th><th>Eixo</th><th>Dimensões</th>' +
      '<th style="text-align:right">Total</th><th>Classificação</th>' +
      '<th style="text-align:right">Envelope (R$ mi)</th><th>Base</th>' +
    '</tr></thead><tbody id="cmp-corpo"></tbody></table></div>' +
    '<p class="cmp-rodape">Notas conforme o Apêndice 2 do Produto 5 — fonte canônica: o texto corrido dos eixos ' +
    'traz rótulos de classificação divergentes. Valores em R$ milhões correntes de agosto de 2026, horizonte de ' +
    '36 meses, <strong>não auditados</strong> — nenhuma das organizações compartilhou demonstração contábil.</p>';

  var selEixo = document.getElementById("cmp-eixo");
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
    document.getElementById("cmp-kpis").innerHTML =
      '<div class="cmp-kpi a"><div class="v">' + linhas.length + '</div><div class="l">experiências avaliadas</div></div>' +
      '<div class="cmp-kpi b"><div class="v">' + alta + '</div><div class="l">alta prioridade (≥ 80)</div></div>' +
      '<div class="cmp-kpi c"><div class="v">' + fmt(min) + '–' + fmt(max) + '</div><div class="l">envelope R$ mi · 36 meses</div></div>' +
      '<div class="cmp-kpi"><div class="v">' + comp + '</div><div class="l">com base informacional completa</div></div>';
  }

  function detalhe(x) {
    var barras = DIMS.map(function (d) {
      var n = x.notas[d[0]];
      return '<div class="cmp-barra"><span class="t">' + d[1] + '</span>' +
             '<span class="b"><span style="width:' + (n / 5 * 100) + '%"></span></span>' +
             '<span class="v">' + n + '/5 · p' + d[2] + '</span></div>';
    }).join("");
    var temGab = x.gabinete != null;
    var gabNorm = temGab ? Math.round(x.gabinete / 30 * 100) : null;
    var gab = temGab
      ? x.gabinete + "/30 (" + gabNorm + "/100)"
      : '<span style="color:var(--faint)">não estava na base</span>';
    var dif = temGab ? (x.total - gabNorm > 0 ? "+" : "") + (x.total - gabNorm) + " pontos" : "—";
    var env = x.envelope.max > 0
      ? "R$ " + fmt(x.envelope.min) + " a " + fmt(x.envelope.max) + " mi"
      : "sem alocação";
    return '<tr class="cmp-det"><td colspan="7"><div class="grid">' +
      '<div><h4>Avaliação por dimensão</h4>' + barras + '</div>' +
      '<div><h4>Prospecção × campo</h4><dl>' +
        '<dt>Nota de gabinete</dt><dd>' + gab + '</dd>' +
        '<dt>Nota de campo</dt><dd>' + x.total + '/100</dd>' +
        '<dt>Diferença</dt><dd>' + dif + '</dd></dl></div>' +
      '<div><h4>Encaminhamento</h4><dl>' +
        '<dt>Envelope</dt><dd>' + env + '</dd>' +
        '<dt>Postura de apoio</dt><dd>' + (POSTURAS[x.postura] || "—") + '</dd>' +
        '<dt>Base informacional</dt><dd>' + (x.base_informacional || "—") + '</dd>' +
        '<dt>Rota</dt><dd>' + esc(x.rota) +
          (x.municipio ? " · " + esc(x.municipio) + "/" + esc(x.estado) : "") + '</dd></dl></div>' +
      '<div><h4>O que se apoia</h4><p class="apoio">' + esc(x.apoio) + '</p></div>' +
      '</div></td></tr>';
  }

  function render() {
    var linhas = filtrar();
    kpis(linhas);
    document.getElementById("cmp-cnt").textContent =
      linhas.length + " de " + exp.length + " experiências";

    document.getElementById("cmp-corpo").innerHTML = linhas.map(function (x, i) {
      var e = EIXOS[x.eixo_cod] || [x.eixo_cod, "#6b7080"];
      var dims = DIMS.map(function (d) {
        return '<i style="height:' + (x.notas[d[0]] / 5 * 22) + 'px"></i>';
      }).join("");
      var env = x.envelope.max > 0 ? fmt(x.envelope.min) + " – " + fmt(x.envelope.max) : "—";
      var base = x.base_informacional || "ausente";
      var tr =
        '<tr data-n="' + i + '">' +
        '<td class="nome">' + esc(x.nome) + '</td>' +
        '<td><span class="cmp-eixo" style="background:' + e[1] + '" title="' + esc(e[0]) + '">' + esc(x.eixo_cod) + '</span></td>' +
        '<td><div class="cmp-dims" title="Operação, Investimento, Impacto, Inovação">' + dims + '</div></td>' +
        '<td class="n"><strong>' + x.total + '</strong></td>' +
        '<td><span class="cmp-cls ' + x.classificacao + '">' + CLS[x.classificacao] + '</span></td>' +
        '<td class="n">' + env + '</td>' +
        '<td><span class="cmp-ev ' + base + '" title="base ' + base + '"></span></td></tr>';
      return tr + (aberta === x.nome ? detalhe(x) : "");
    }).join("");

    Array.prototype.forEach.call(
      document.querySelectorAll("#cmp-corpo tr[data-n]"),
      function (tr) {
        tr.addEventListener("click", function () {
          var x = linhas[Number(tr.getAttribute("data-n"))];
          aberta = aberta === x.nome ? null : x.nome;
          render();
        });
      }
    );
  }

  document.getElementById("cmp-busca").addEventListener("input", function (e) {
    estado.busca = e.target.value.toLowerCase(); render();
  });
  ["eixo", "cls", "ev"].forEach(function (k) {
    document.getElementById("cmp-" + k).addEventListener("change", function (e) {
      estado[k] = e.target.value; render();
    });
  });
  document.getElementById("cmp-reset").addEventListener("click", function () {
    estado = { busca: "", eixo: "", cls: "", ev: "" };
    document.getElementById("cmp-busca").value = "";
    ["eixo", "cls", "ev"].forEach(function (k) { document.getElementById("cmp-" + k).value = ""; });
    render();
  });

  render();
})();
