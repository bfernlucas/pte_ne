/* ==========================================================================
   Painel PTE-NE — módulo principal.

   Consome:
     window.PTE_DATA  (assets/data/iniciativas.js)  — base de prospecção
     window.PTE_P5    (decifrado por auth.js)       — camada do relatório final
   O módulo "Evidência de campo" (campo.js) continua responsável pela
   leitura qualitativa das incursões.
   ========================================================================== */
(function () {
  "use strict";

  var DADOS = window.PTE_DATA || { meta: {}, iniciativas: [] };
  var P5 = (window.PTEAuth && window.PTEAuth.p5()) || window.PTE_P5 || null;
  var INI = DADOS.iniciativas || [];
  var META = DADOS.meta || {};
  var CRIT = META.criterios || [];

  /* Cores dos eixos na paleta do documento PTE. Sobrepõem as da base, que
     vêm da identidade antiga do painel. */
  var COR_EIXO = {
    FSI: "#24246C", ADT: "#0C549C", BIO: "#54B43C",
    TE: "#F09C18", EC: "#E42424", NIVA: "#0F7D8C"
  };
  var COR_ROTA = { R1: "#0C549C", R2: "#54B43C", R3: "#F09C18", RX: "#24246C" };
  var CINZA = "#8A8A94";

  /* ---------------------------------------------------------------- utils */
  function $(s, ctx) { return (ctx || document).querySelector(s); }
  function $$(s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function num(v, c) {
    if (v == null || isNaN(v)) return "—";
    return Number(v).toLocaleString("pt-BR", {
      minimumFractionDigits: c == null ? 1 : c, maximumFractionDigits: c == null ? 1 : c
    });
  }
  function faixa(a, b) {
    if (a == null && b == null) return '<span class="vazio">—</span>';
    if (!a && !b) return '<span class="vazio">—</span>';
    return num(a) + " – " + num(b);
  }
  /* faixa para texto corrido: "0,9 a 2,8" (o traço fica só nas tabelas e destaques) */
  function faixaTxt(a, b) {
    if (!a && !b) return "—";
    return num(a) + " a " + num(b);
  }
  function maiusc(t) { t = String(t == null ? "" : t); return t.charAt(0).toUpperCase() + t.slice(1); }
  function corEixo(cod) { return COR_EIXO[cod] || CINZA; }
  /* texto anil sobre o verde e o laranja: branco não atinge contraste 4,5:1 */
  function tintaEixo(cod) { return cod === "BIO" || cod === "TE" ? "#24246C" : "#fff"; }
  function estiloEixo(cod) { return "background:" + corEixo(cod) + ";color:" + tintaEixo(cod); }
  function varsEixo(cod) { return "--e:" + corEixo(cod) + ";--ei:" + tintaEixo(cod); }
  var NOME_EIXO = {}; (META.eixos || []).forEach(function (e) { NOME_EIXO[e.cod] = e.nome; });
  var CURTO_EIXO = { FSI: "Finanças Sustentáveis", ADT: "Adensamento Tecnológico",
    BIO: "Bioeconomia", TE: "Transição Energética", EC: "Economia Circular", NIVA: "Infraestrutura Verde-Azul" };
  /* ícones dos eixos: <symbol> no index.html, redesenhados do índice de propostas do livro */
  function icoEixo(cod) {
    return COR_EIXO[cod] ? '<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-' + cod + '"/></svg>' : "";
  }
  function tagEixo(cod) {
    if (!cod) return '<span class="vazio">—</span>';
    return '<span class="eixo-tag" style="' + varsEixo(cod) + '" title="' + esc(NOME_EIXO[cod] || cod) + '">' +
      icoEixo(cod) + esc(cod) + "</span>";
  }
  /* barra de pontuação final (0 a 100) com as marcas de 60 e 80, os limites da classificação */
  function barraPont(v, cls) {
    if (v == null) return "";
    return '<span class="bp' + (cls ? " " + cls : "") + '" aria-hidden="true"><i style="width:' +
      Math.max(0, Math.min(100, v)) + '%"></i><b style="left:60%"></b><b style="left:80%"></b></span>';
  }
  function capClasse(c, curta) {
    if (!c) return "";
    var t = curta ? { alta: "Alta prioridade", estrategico: "Potencial estratégico", nao: "Não recomendada" }[c] : CLASSE[c];
    return '<span class="cls-cap ' + c + '">' + esc(t || c) + "</span>";
  }
  /* nomes de componentes vêm em caixa alta da planilha: na tela, caixa normal */
  function caixaNormal(t) {
    t = String(t || "");
    return t === t.toUpperCase() ? maiusc(t.toLowerCase()) : t;
  }
  /* nome curto da planilha às vezes vem em caixa alta ("AMAREZ"): usa o nome, se for o mesmo */
  function nomeCurto(e) {
    var c = String(e.curto || ""), n = String(e.nome || "");
    if (c && c === c.toUpperCase() && n && n.toLowerCase().indexOf(c.toLowerCase()) === 0 && n.length <= c.length + 2) return n;
    return c || n;
  }
  window.PTE_EIXO = { tag: tagEixo, ico: icoEixo, cor: corEixo, tinta: tintaEixo, vars: varsEixo };

  /* filtro por eixo em botões com o ícone; o <select> fica oculto e guarda o valor */
  function chipsEixo(alvo, sel, contar) {
    if (!alvo || !sel) return;
    sel.hidden = true;
    var eixos = (META.eixos || []).map(function (e) { return e.cod; });
    function pinta() {
      var n = contar ? contar() : null, v = sel.value;
      alvo.innerHTML = '<button type="button" data-e=""' + (v ? "" : ' aria-pressed="true"') + ">Todos os eixos" +
        (n ? ' <span class="n">' + n._total + "</span>" : "") + "</button>" +
        eixos.map(function (k) {
          return '<button type="button" data-e="' + k + '" style="' + varsEixo(k) + '" title="' + esc(NOME_EIXO[k] || k) + '"' +
            ' aria-pressed="' + (v === k) + '"><span class="q">' + icoEixo(k) + "</span>" + esc(CURTO_EIXO[k] || k) +
            (n ? ' <span class="n">' + (n[k] || 0) + "</span>" : "") + "</button>";
        }).join("");
      $$("button", alvo).forEach(function (b) {
        b.addEventListener("click", function () {
          sel.value = b.dataset.e;
          sel.dispatchEvent(new Event("change"));
        });
      });
    }
    sel.addEventListener("change", pinta);
    alvo.atualiza = pinta;
    pinta();
  }
  function ufsDe(s) {
    return String(s || "").split(/[,/]/).map(function (x) { return x.trim(); })
      .filter(function (x) { return /^[A-Z]{2}$/.test(x); });
  }
  function ordena(arr, chave, dir, tipo) {
    var s = arr.slice();
    s.sort(function (a, b) {
      var x = chave(a), y = chave(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;   /* vazios sempre no fim */
      if (y == null) return -1;
      var r = tipo === "txt"
        ? String(x).localeCompare(String(y), "pt-BR")
        : (Number(x) - Number(y));
      return dir === "desc" ? -r : r;
    });
    return s;
  }
  function preencheSelect(el, valores, rotulo) {
    if (!el) return;
    valores.forEach(function (v) {
      var o = document.createElement("option");
      o.value = typeof v === "object" ? v.v : v;
      o.textContent = rotulo ? rotulo(v) : (typeof v === "object" ? v.t : v);
      el.appendChild(o);
    });
  }

  /* ----------------------------------------------- junção prospecção × P5 */
  var EXP = (P5 && P5.experiencias) || [];
  var ROTAS = (P5 && P5.rotas) || [];
  var QUADROS = (P5 && P5.quadros) || null;
  var PMETA = (P5 && P5.meta) || {};
  /* Etapa 1, Estruturação (chave interna "A"), e Etapa 2, Escala ("B").
     A classificação do ranking substitui a antiga postura de apoio. */
  var CLASSE = PMETA.classes || { alta: "Alta prioridade", estrategico: "Potencial estratégico",
    nao: "Não recomendada neste ciclo" };
  var CLASSE_ORDEM = ["alta", "estrategico", "nao"];
  function pctTxt(v) { return v == null ? "—" : num(v * 100, 0) + "%"; }
  function classeDe(e) { return e && e.estimada === false ? "nao" : (e ? e.classificacao || "" : ""); }

  function nEstimadas() { return EXP.filter(function (e) { return e.estimada; }).length; }

  var porRef = {};
  EXP.forEach(function (e) { if (e.ref_id != null) porRef[e.ref_id] = e; });

  /* Linhas do ranking: toda a base, mais as visitadas que não constam dela. */
  var LINHAS = INI.map(function (i) {
    var e = porRef[i.id] || null;
    return {
      id: i.id, ini: i, exp: e,
      nome: i.nome, org: i.org || "",
      municipio: i.municipio || "", uf: i.estado || "",
      eixo: i.eixo_cod || "", eixo_nome: i.eixo || "",
      natureza: i.natureza || "", biomas: i.biomas || "",
      matriz: i.pontuacao == null ? null : Number(i.pontuacao),
      campo: e ? (e.coleta === "Virtual" ? "Entrevista" : "Visita") : "",
      p5: e && e.pontuacao != null ? Number(e.pontuacao) : null,
      classe: e ? classeDe(e) : "",
      amin: e && e.bloco_a ? e.bloco_a.min : null,
      amax: e && e.bloco_a ? e.bloco_a.max : null,
      bmin: e && e.bloco_b ? e.bloco_b.min : null,
      bmax: e && e.bloco_b ? e.bloco_b.max : null,
      lat: i.lat, lon: i.lon, criterios: i.criterios || {}
    };
  });
  EXP.filter(function (e) { return e.ref_id == null; }).forEach(function (e) {
    LINHAS.push({
      id: "p5-" + e.aba, ini: null, exp: e,
      nome: e.nome, org: "", municipio: e.municipio || "", uf: e.uf || "",
      eixo: e.eixo_cod || "", eixo_nome: "", natureza: "", biomas: "",
      matriz: null, campo: e.coleta === "Virtual" ? "Entrevista" : "Visita",
      p5: e.pontuacao == null ? null : Number(e.pontuacao),
      classe: classeDe(e),
      amin: e.bloco_a ? e.bloco_a.min : null, amax: e.bloco_a ? e.bloco_a.max : null,
      bmin: e.bloco_b ? e.bloco_b.min : null, bmax: e.bloco_b ? e.bloco_b.max : null,
      lat: e.lat, lon: e.lon, criterios: null
    });
  });

  window.PTE_PAINEL = { linhas: LINHAS, exp: EXP, rotas: ROTAS, quadros: QUADROS };

  /* -------------------------------------------------------------- seções */
  var pronto = {};
  function mostrar(v) {
    $$(".view").forEach(function (s) { s.classList.toggle("hidden", s.id !== "view-" + v); });
    $$("#secnav button").forEach(function (b) { b.classList.toggle("active", b.dataset.view === v); });
    if (!pronto[v] && INICIA[v]) { pronto[v] = true; INICIA[v](); }
    else if (RETOMA[v]) RETOMA[v]();
    if (location.hash !== "#" + v) history.replaceState(null, "", "#" + v);
    window.scrollTo({ top: 0 });
  }
  $$("#secnav button").forEach(function (b) {
    b.addEventListener("click", function () { mostrar(b.dataset.view); });
  });

  var INICIA = {}, RETOMA = {};

  /* ====================================================== 1. CARTEIRA === */
  INICIA.carteira = function () {
    var comFicha = LINHAS.filter(function (l) { return l.exp; }).length;
    var novas = LINHAS.length - INI.length;   /* visitadas que a prospecção não continha */
    var estimadas = EXP.filter(function (e) { return e.estimada; }).length;
    var nAlta = EXP.filter(function (e) { return e.estimada && e.classificacao === "alta"; }).length;
    var nEstr = EXP.filter(function (e) { return e.estimada && e.classificacao === "estrategico"; }).length;
    var cart = QUADROS && QUADROS.carteira;
    var virtuais = EXP.filter(function (e) { return e.coleta === "Virtual"; }).length;
    var semEst = comFicha - estimadas;
    var funil = META.funil || null;
    var mapeadas = funil ? funil.mapeadas : LINHAS.length;
    var blocos = [
      ["" + mapeadas, "iniciativas mapeadas", (funil
        ? LINHAS.length + " distintas no mapa e no ranking: " + INI.length + " da prospecção" +
          (novas ? " e " + novas + " encontrada" + (novas > 1 ? "s" : "") + " em campo" : "")
        : INI.length + " identificadas na prospecção")],
      ["" + comFicha, "avaliadas em campo", (comFicha - virtuais) + " por visita técnica e " + virtuais +
        " por entrevista virtual"]
    ];
    if (EXP.length) {
      blocos.push(["" + estimadas, "com estimativa de recursos", semEst > 0
        ? "As outras " + semEst + " avaliadas não foram recomendadas neste ciclo" : "Todas as avaliadas em campo"]);
      blocos.push(["" + nAlta, "recomendadas com alta prioridade", "80 pontos ou mais na matriz de avaliação; " + nEstr +
        " são de potencial estratégico (60 a 79 pontos)"]);
    }
    /* funil em cápsulas, como "Metodologia em números" do impresso: a largura
       de cada cápsula é proporcional à primeira etapa (as iniciativas mapeadas) */
    var base = +blocos[0][0] || 1, TONS = ["azul", "vermelho", "laranja", "verde"];
    var cx = $("#carteira-numeros");
    cx.setAttribute("role", "list");
    cx.innerHTML = blocos.map(function (b, i) {
      var p = Math.max(0, Math.min(1, (+b[0] || 0) / base));
      return '<div class="cap-linha" role="listitem" style="--p:' + p.toFixed(4) + ';--i:' + i + '">' +
        '<b class="cap ' + TONS[i % TONS.length] + '">' + esc(b[0]) + "</b>" +
        '<p class="cap-txt"><span>' + esc(b[1]) + "</span><small>" + esc(b[2]) + "</small></p></div>";
    }).join("");
    if (funil) {
      $("#carteira-funil").innerHTML = "Das " + funil.mapeadas + " iniciativas mapeadas, " + funil.descartadas +
        " foram descartadas na prospecção, por não terem sido localizadas ou não atuarem no Nordeste, e " +
        funil.repetidas + " repetem organizações já listadas. O mapa e o ranking mostram as " + LINHAS.length + " distintas.";
    }
    destaqueCarteira();

    desenhaAluvial($("#fig-aluvial"));
    $$("#aluvial-cor button").forEach(function (b) {
      b.addEventListener("click", function () {
        aluCor = b.dataset.cor;
        $$("#aluvial-cor button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
        desenhaAluvial($("#fig-aluvial"));
      });
    });
    $("#aluvial-leitura").innerHTML = leituraAluvial();

    if (!P5) {
      $("#carteira-lead").insertAdjacentHTML("afterend",
        '<div class="aviso">Não foi possível carregar as estimativas nesta sessão. ' +
        'O ranking mostra apenas a nota da matriz.</div>');
    }
    montaRanking();
  };


  /* ---- leitura de abertura da carteira (pedido da equipe: dar destaque à
     proposta de programa único). Números do pacote cifrado, nunca do HTML. */
  function destaqueCarteira() {
    var alvo = $("#carteira-destaque");
    if (!alvo || !QUADROS || !QUADROS.carteira) { if (alvo) alvo.classList.add("hidden"); return; }
    var qa = QUADROS.contratavel.total, qb = QUADROS.referencia.total, qc = QUADROS.carteira.reais;
    var est = EXP.filter(function (e) { return e.estimada; });
    var esc_ = P5.escala || {};
    var pA = qc.max ? qa.max / qc.max : 0, pB = 1 - pA;
    alvo.innerHTML =
      '<div class="cd-fig">' +
        '<span class="cd-lab">Carteira total estimada</span>' +
        '<b class="cd-num">R$ ' + num(qc.min, 1) + ' – ' + num(qc.max, 1) + ' <small>milhões</small></b>' +
        '<span class="cd-sub">' + est.length + ' experiências, em 36 meses. Valores mínimo e máximo, Classe 5.</span>' +
        '<div class="cd-bar" role="img" aria-label="Estruturação ' + num(pA * 100, 0) + '% e Escala ' + num(pB * 100, 0) + '% do valor máximo">' +
          '<i class="a" style="width:' + (pA * 100).toFixed(1) + '%"></i><i class="b" style="width:' + (pB * 100).toFixed(1) + '%"></i></div>' +
        '<dl class="cd-etapas">' +
          '<div><dt><i class="sw a"></i>Etapa 1 — Estruturação</dt><dd>R$ ' + faixaTxt(qa.min, qa.max) + ' mi <span>' + num(pA * 100, 0) + '% do máximo</span></dd>' +
            '<small>Contratável agora: estudos, formalizações, sistemas e itens com custo definido</small></div>' +
          '<div><dt><i class="sw b"></i>Etapa 2 — Escala</dt><dd>R$ ' + faixaTxt(qb.min, qb.max) + ' mi <span>' + num(pB * 100, 0) + '% do máximo</span></dd>' +
            '<small>Após a condição de cada item; é o que a Estruturação vai dimensionar</small></div>' +
        '</dl>' +
      '</div>' +
      '<div class="cd-txt">' +
        '<h3>Leitura da carteira</h3>' +
        '<p>Da carteira máxima, ' + num(pA * 100, 0) + '% correspondem a itens que já podem ser contratados. O restante espera ' +
          'a conclusão de um estudo, uma formalização, uma decisão externa ou uma verificação, e é a Estruturação que paga ' +
          'esses passos. Por isso a ordem em que o apoio é liberado pesa mais do que o valor total.</p>' +
        (esc_.acima_padrao != null ? '<p>Tomadas uma a uma, ' + esc_.acima_padrao + ' das ' + est.length + ' experiências alcançam ' +
          'o porte mínimo dos canais de maior volume, de R$ ' + num(esc_.piso_padrao, 0) + ' milhões; ' + esc_.abaixo_reduzido +
          ' ficam abaixo do piso reduzido, de R$ ' + num(esc_.piso_reduzido, 0) + ' milhões.</p>' : '') +
        '<blockquote class="proposta">A carteira só alcança esses canais se for apresentada como um programa único, com ' +
          'subprojetos selecionados e supervisionados por um agente credenciado. Apresentada experiência a experiência, ' +
          'a maior parte ficaria de fora.</blockquote>' +
      '</div>';
  }

  /* ---- aluvial da trajetória do valor (Figura 7.10), desenhado em SVG a
     partir de P5.fluxos; ordem das colunas por tamanho e, a partir da
     terceira, pelo baricentro da anterior. ---- */
  var NOMES_ALU = [
    { A: ["Etapa 1", "Estruturação"], B: ["Etapa 2", "Escala"] },
    { NIVA: ["Nova Infraestrutura Verde-Azul", "e Adaptação Climática"], ADT: ["Adensamento Tecnológico"],
      EC: ["Economia Circular", "e Solidária"], TE: ["Transição Energética"],
      FSI: ["Finanças Sustentáveis", "e Inclusivas"], BIO: ["Bioeconomia e Sistemas", "Agroalimentares Adaptados"] },
    { alta: ["Alta prioridade"], estrategico: ["Potencial", "estratégico"] },
    { C0: ["Estudo de", "dimensionamento"], C1: ["Desenvolvimento", "institucional"],
      C2: ["Investimento em", "ativos e fundos"], C3: ["Assistência técnica", "e capacidades"],
      C4: ["Monitoramento", "e avaliação"] }
  ];
  var CAB_ALU = ["Etapa", "Eixo do plano", "Classificação", "Componente do apoio"];
  var DIM_ALU = ["bloco", "eixo", "classe", "comp"];
  /* cores por dimensão: etapa como no relatório, eixo nas cores do livro,
     classificação e componente em tons de anil (só no painel da seleção) */
  var COR_DIM = {
    bloco: { A: "#1d5fb0", B: "#a3b3c6" },
    eixo: COR_EIXO,
    classe: { alta: "#24246C", estrategico: "#8C8CC4" },
    comp: { C2: "#24246C", C3: "#4F4F99", C0: "#7C7CBE", C1: "#A9A9D6", C4: "#D3D3EC" }
  };
  var aluCor = "eixo", aluFixo = null, aluR = null, aluOrd = null;

  /* ícone do eixo copiado do <symbol> para dentro do SVG: a exportação em PNG
     não resolve <use> que aponta para fora do desenho */
  var ICO_INLINE = {};
  function icoInline(cod, x, y, s, cor) {
    if (!(cod in ICO_INLINE)) { var sym = document.getElementById("i-" + cod); ICO_INLINE[cod] = sym ? sym.innerHTML : ""; }
    return '<svg x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" color="' + cor +
      '" aria-hidden="true">' + ICO_INLINE[cod] + "</svg>";
  }
  function rotAlu(st, k) { return (NOMES_ALU[st][k] || [k]).join(" "); }

  /* ---- aluvial interativo (parallel sets): cada fluxo de P5.fluxos é um fio
     contínuo da etapa ao componente. A cor vem da dimensão escolhida; passar o
     mouse numa categoria acende os fios que passam por ela, e o clique fixa a
     seleção e abre a composição dela nas outras três colunas. ---- */
  function desenhaAluvial(alvo) {
    var F = (P5 && P5.fluxos) || [];
    if (!F.length) { alvo.innerHTML = '<p class="vazio">Os dados deste diagrama não estão disponíveis nesta sessão.</p>'; return; }
    var KEYS = DIM_ALU, ST = 4;
    var tot = F.reduce(function (a, f) { return a + f.valor; }, 0);
    function tam(st, k) {
      return F.reduce(function (a, f) { return a + (f[KEYS[st]] === k ? f.valor : 0); }, 0);
    }
    var ORD = [["A", "B"]];
    for (var st = 1; st < ST; st++) {
      var ks = {}; F.forEach(function (f) { ks[f[KEYS[st]]] = 1; });
      ORD.push(Object.keys(ks).sort(function (a, b) { return tam(st, b) - tam(st, a); }));
    }
    for (st = 2; st < ST; st++) {
      (function (st) {
        var pos = {}; ORD[st - 1].forEach(function (k, i) { pos[k] = i; });
        var bar = {};
        ORD[st].forEach(function (k) {
          var sw = 0, sv = 0;
          F.forEach(function (f) { if (f[KEYS[st]] === k) { sw += pos[f[KEYS[st - 1]]] * f.valor; sv += f.valor; } });
          bar[k] = sv ? sw / sv : 0;
        });
        ORD[st].sort(function (a, b) { return bar[a] - bar[b]; });
      })(st);
    }
    var IDX = ORD.map(function (o) { var m = {}; o.forEach(function (k, i) { m[k] = i; }); return m; });
    aluOrd = ORD;

    var PAD = tot * 0.018, P = [], Hs = [];
    for (st = 0; st < ST; st++) {
      var H = ORD[st].reduce(function (a, k) { return a + tam(st, k); }, 0) + PAD * (ORD[st].length - 1);
      var y = 0, pp = {};
      ORD[st].forEach(function (k) { var t = tam(st, k); pp[k] = [y, y + t]; y += t + PAD; });
      P.push(pp); Hs.push(H);
    }
    var Hmax = Math.max.apply(null, Hs);
    P = P.map(function (pp, i) {
      var off = (Hmax - Hs[i]) / 2, o = {};
      Object.keys(pp).forEach(function (k) { o[k] = [pp[k][0] + off, pp[k][1] + off]; });
      return o;
    });

    var W = 1100, TOPO = 50, ALT = 600, BASE = 14, NW = 14;
    var X = [150, 440, 700, 930];
    var ky = ALT / Hmax;
    function Y(v) { return TOPO + v * ky; }
    var dc = KEYS.indexOf(aluCor);

    /* empilhamento dos fios em cada nó: na saída, pela ordem do destino e da
       cor; na entrada, pela ordem da origem e da cor (menos cruzamentos) */
    var R = F.map(function (f, i) { return { f: f, i: i, v: f.valor, out: [], inn: [] }; });
    function cmp(a, b, ordem) {
      for (var j = 0; j < ordem.length; j++) {
        var s = ordem[j] === "c" ? dc : ordem[j];
        if (s < 0 || s >= ST) continue;
        var d = IDX[s][a.f[KEYS[s]]] - IDX[s][b.f[KEYS[s]]];
        if (d) return d;
      }
      return 0;
    }
    for (st = 0; st < ST; st++) {
      ORD[st].forEach(function (k) {
        var rs = R.filter(function (r) { return r.f[KEYS[st]] === k; });
        if (st < ST - 1) {
          var y0 = P[st][k][0];
          /* mesmo desempate dos dois lados de cada trecho: a faixa não torce */
          rs.slice().sort(function (a, b) { return cmp(a, b, [st + 1, "c", st + 2, st - 1, st + 3, st - 2]); })
            .forEach(function (r) { r.out[st] = [y0, y0 + r.v]; y0 += r.v; });
        }
        if (st > 0) {
          var y1 = P[st][k][0];
          rs.slice().sort(function (a, b) { return cmp(a, b, [st - 1, "c", st + 1, st - 2, st + 2, st - 3]); })
            .forEach(function (r) { r.inn[st] = [y1, y1 + r.v]; y1 += r.v; });
        }
      });
    }
    aluR = R;

    function fita(x0, a0, b0, x1, a1, b1) {
      var xa = x0 + NW, xb = x1, dx = xb - xa;
      var p = xa + dx * 0.30, q = xb - dx * 0.14, m1 = p + (q - p) * 0.5;
      return "M" + xa + "," + Y(a0) + " L" + p + "," + Y(a0) +
        " C" + m1 + "," + Y(a0) + " " + m1 + "," + Y(a1) + " " + q + "," + Y(a1) +
        " L" + xb + "," + Y(a1) + " L" + xb + "," + Y(b1) + " L" + q + "," + Y(b1) +
        " C" + m1 + "," + Y(b1) + " " + m1 + "," + Y(b0) + " " + p + "," + Y(b0) +
        " L" + xa + "," + Y(b0) + " Z";
    }
    function corFio(f) { return (COR_DIM[aluCor] || {})[f[aluCor]] || CINZA; }
    function alfa(f) { return aluCor === "bloco" && f.bloco === "B" ? 0.8 : 0.66; }

    var svg = [];
    svg.push('<line x1="10" x2="' + (W - 10) + '" y1="' + (TOPO - 14) + '" y2="' + (TOPO - 14) + '" stroke="#D9D9DE" stroke-width="1"/>');
    CAB_ALU.forEach(function (t, i) {
      var x = i === 0 ? 10 : (i === ST - 1 ? W - 10 : X[i] + NW + 8);
      svg.push('<text x="' + x + '" y="' + (TOPO - 24) + '" font-size="13" font-weight="600" font-family="Oswald,Roboto,sans-serif" fill="#1A1A1F" text-anchor="' +
        (i === ST - 1 ? "end" : "start") + '">' + t + "</text>");
    });

    /* fios: os maiores primeiro, para os finos ficarem visíveis nos cruzamentos */
    var ordemDesenho = R.slice().sort(function (a, b) { return b.v - a.v; });
    for (st = 0; st < ST - 1; st++) {
      ordemDesenho.forEach(function (r) {
        svg.push('<path class="fx" data-r="' + r.i + '" d="' + fita(X[st], r.out[st][0], r.out[st][1], X[st + 1], r.inn[st + 1][0], r.inn[st + 1][1]) +
          '" fill="' + corFio(r.f) + '" fill-opacity="' + alfa(r.f) + '"/>');
      });
    }

    /* nós, com rótulos que também respondem ao mouse e ao teclado */
    var LH = 14, fundo = 0;
    /* contorno branco sob o texto: rótulo legível sobre as faixas */
    var HALO = ' stroke="#fff" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke"';
    for (st = 0; st < ST; st++) {
      var ult = -1e9;
      ORD[st].forEach(function (k) {
        var a = P[st][k][0], b = P[st][k][1], v = b - a;
        var nome = (NOMES_ALU[st][k] || [k]), esq = st === 0;
        var ico = st === 1 && COR_EIXO[k];
        var xt = esq ? X[st] - 8 : X[st] + NW + 8, anc = esq ? "end" : "start";
        var yt = Math.max(Y(a) + 11, ult + 15);
        var xtt = ico ? xt + 24 : xt;
        var fim = yt + nome.length * LH;
        var cor = st === 0 ? COR_DIM.bloco[k] : st === 1 ? corEixo(k) : st === 2 ? COR_DIM.classe[k] : "#2e4a6e";
        var g = '<g class="no" tabindex="0" role="button" aria-pressed="false" data-st="' + st + '" data-k="' + esc(k) + '" aria-label="' +
          esc(rotAlu(st, k) + ", R$ " + num(v) + " milhões, " + num(v / tot * 100, 0) + "% da carteira máxima") + '">' +
          '<rect class="hit" x="' + (esq ? xt - 190 : X[st]) + '" y="' + Math.min(Y(a), yt - 12) + '" width="' + (esq ? 190 + 8 + NW : 210) +
          '" height="' + Math.max(Y(b) - Math.min(Y(a), yt - 12), fim - yt + 18) + '" fill="transparent"/>' +
          '<rect class="nr" x="' + X[st] + '" y="' + Y(a) + '" width="' + NW + '" height="' + Math.max(1, Y(b) - Y(a)) + '" fill="' + cor + '"/>';
        if (ico) g += '<rect x="' + xt + '" y="' + (yt - 12) + '" width="18" height="18" fill="' + corEixo(k) + '"/>' +
          icoInline(k, xt + 2, yt - 10, 14, tintaEixo(k));
        nome.forEach(function (ln, i) {
          g += '<text x="' + xtt + '" y="' + (yt + i * LH) + '" font-size="' + (esq ? 13 : 12) +
            '" font-weight="700" fill="#1A1A1F" text-anchor="' + anc + '"' + HALO + ">" + esc(ln) + "</text>";
        });
        g += '<text x="' + xtt + '" y="' + fim + '" font-size="11.5" fill="#55555F" text-anchor="' + anc + '"' + HALO + '>R$ ' + num(v) +
          " milhões</text></g>";
        svg.push(g);
        ult = fim + 4;
        if (ult > fundo) fundo = ult;
      });
    }

    var altura = Math.max(TOPO + ALT + BASE, fundo + 8);
    alvo.innerHTML = '<div class="alu-scroll"><svg id="svg-aluvial" viewBox="0 0 ' + W + " " + altura +
      '" width="100%" role="group" aria-label="Trajetória do valor da carteira, da etapa ao componente. Use Tab para percorrer as categorias e Enter para fixar uma." ' +
      'style="font-family:Roboto,system-ui,sans-serif;background:#fff">' + svg.join("") + '</svg></div><div class="alu-tip" hidden></div>';

    /* ---- interação ---- */
    var el = alvo.querySelector("svg"), tip = alvo.querySelector(".alu-tip");
    var fios = $$(".fx", el), nos = $$(".no", el);
    function acende(teste) {
      el.classList.add("foco");
      fios.forEach(function (p) { p.classList.toggle("on", teste(R[+p.dataset.r].f)); });
    }
    function porNo(st, k) { return function (f) { return f[KEYS[st]] === k; }; }
    function repouso() {
      if (aluFixo) acende(porNo(aluFixo.st, aluFixo.k));
      else { el.classList.remove("foco"); fios.forEach(function (p) { p.classList.remove("on"); }); }
      tip.hidden = true;
    }
    function mostraTip(html, cx, cy) {
      tip.innerHTML = html; tip.hidden = false;
      var r = alvo.getBoundingClientRect(), w = tip.offsetWidth;
      var x = cx - r.left + 14, y = cy - r.top + 14;
      if (x + w > r.width) x = Math.max(0, cx - r.left - w - 14);
      tip.style.left = x + "px"; tip.style.top = y + "px";
    }
    function textoNo(st, k) {
      var v = tam(st, k);
      return "<b>" + esc(rotAlu(st, k)) + "</b>R$ " + num(v) + " milhões, " + num(v / tot * 100, 0) + "% da carteira máxima" +
        '<small>' + (aluFixo && aluFixo.st === st && aluFixo.k === k ? "Clique para desfazer a seleção" : "Clique para fixar e ver a composição") + "</small>";
    }
    nos.forEach(function (g) {
      var st_ = +g.dataset.st, k = g.dataset.k;
      g.addEventListener("mouseenter", function () { acende(porNo(st_, k)); });
      g.addEventListener("mousemove", function (ev) { mostraTip(textoNo(st_, k), ev.clientX, ev.clientY); });
      g.addEventListener("mouseleave", repouso);
      g.addEventListener("focus", function () {
        acende(porNo(st_, k));
        var b = g.querySelector(".nr").getBoundingClientRect();
        mostraTip(textoNo(st_, k), b.right, b.top);
      });
      g.addEventListener("blur", repouso);
      function alterna() {
        aluFixo = aluFixo && aluFixo.st === st_ && aluFixo.k === k ? null : { st: st_, k: k };
        nos.forEach(function (n) {
          var on = !!aluFixo && +n.dataset.st === aluFixo.st && n.dataset.k === aluFixo.k;
          n.classList.toggle("fixo", on); n.setAttribute("aria-pressed", on);
        });
        aluPainel();
        acende(porNo(st_, k));
        if (!aluFixo) repouso();
      }
      g.addEventListener("click", alterna);
      g.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); alterna(); }
        if (ev.key === "Escape" && aluFixo) { aluFixo = { st: st_, k: k }; alterna(); }
      });
    });
    fios.forEach(function (p) {
      var f = R[+p.dataset.r].f;
      p.addEventListener("mouseenter", function () { acende(function (x) { return x === f; }); });
      p.addEventListener("mousemove", function (ev) {
        mostraTip("<b>R$ " + num(f.valor, 2) + " milhões</b>" + KEYS.map(function (d, s) { return esc(rotAlu(s, f[d])); }).join(" &rsaquo; "),
          ev.clientX, ev.clientY);
      });
      p.addEventListener("mouseleave", repouso);
    });
    if (aluFixo) {
      nos.forEach(function (n) {
        var on = +n.dataset.st === aluFixo.st && n.dataset.k === aluFixo.k;
        n.classList.toggle("fixo", on); n.setAttribute("aria-pressed", on);
      });
      repouso();
    }
    aluLegenda();
    aluPainel();
  }

  /* legenda da cor escolhida, em cápsulas (no eixo, com o ícone) */
  function aluLegenda() {
    var alvo = $("#aluvial-leg"); if (!alvo || !aluOrd) return;
    var st = DIM_ALU.indexOf(aluCor);
    alvo.innerHTML = aluOrd[st].map(function (k) {
      var cor = (COR_DIM[aluCor] || {})[k] || CINZA;
      return '<span class="alu-l">' + (aluCor === "eixo" ? '<span class="q" style="' + varsEixo(k) + '">' + icoEixo(k) + "</span>"
        : '<i style="background:' + cor + '"></i>') + esc(aluCor === "eixo" ? CURTO_EIXO[k] || k : rotAlu(st, k)) + "</span>";
    }).join("");
  }

  /* composição da categoria fixada nas outras três dimensões */
  function aluPainel() {
    var alvo = $("#aluvial-sel"); if (!alvo) return;
    var F = (P5 && P5.fluxos) || [];
    if (!aluFixo || !F.length || !aluOrd) {
      alvo.innerHTML = '<p class="alu-dica">Clique numa categoria do diagrama, ou percorra com Tab e tecle Enter, ' +
        "para ver como o valor dela se divide nas outras três colunas.</p>";
      return;
    }
    var tot = F.reduce(function (a, f) { return a + f.valor; }, 0);
    var dimSel = DIM_ALU[aluFixo.st];
    var sub = F.filter(function (f) { return f[dimSel] === aluFixo.k; });
    var vs = sub.reduce(function (a, f) { return a + f.valor; }, 0);
    var h = '<div class="alu-sel-cab">' +
      (aluFixo.st === 1 ? '<span class="q" style="' + varsEixo(aluFixo.k) + '">' + icoEixo(aluFixo.k) + "</span>" : "") +
      "<div><b>" + esc(rotAlu(aluFixo.st, aluFixo.k)) + "</b><span>R$ " + num(vs) + " milhões, " + num(vs / tot * 100, 0) +
      "% da carteira máxima</span></div>" +
      '<button type="button" class="ghost" id="alu-limpa">Limpar seleção</button></div><div class="alu-sel-dims">';
    DIM_ALU.forEach(function (d, s) {
      if (s === aluFixo.st) return;
      var t = {}; sub.forEach(function (f) { t[f[d]] = (t[f[d]] || 0) + f.valor; });
      var ks = aluOrd[s].filter(function (k) { return t[k] > 0; }).sort(function (a, b) { return t[b] - t[a]; });
      h += '<div class="alu-dim"><h5>' + CAB_ALU[s] + '</h5><span class="alu-barra" aria-hidden="true">' +
        ks.map(function (k) {
          return '<i style="width:' + (t[k] / vs * 100).toFixed(2) + "%;background:" + ((COR_DIM[d] || {})[k] || CINZA) + '" title="' +
            esc(rotAlu(s, k)) + '"></i>';
        }).join("") + "</span><ul>" +
        ks.map(function (k) {
          return '<li><i style="background:' + ((COR_DIM[d] || {})[k] || CINZA) + '"></i><span>' + esc(rotAlu(s, k)) + "</span><b>" +
            num(t[k] / vs * 100, 0) + "%</b></li>";
        }).join("") + "</ul></div>";
    });
    alvo.innerHTML = h + "</div>";
    $("#alu-limpa").addEventListener("click", function () {
      aluFixo = null; desenhaAluvial($("#fig-aluvial"));
    });
  }

  /* parágrafo de leitura do aluvial, calculado dos mesmos fluxos que o desenham */
  function leituraAluvial() {
    var F = (P5 && P5.fluxos) || [];
    if (!F.length) return "";
    function soma(chave, val) { return F.reduce(function (a, f) { return a + (val == null || f[chave] === val ? f.valor : 0); }, 0); }
    function soma2(c1, v1, c2, v2) { return F.reduce(function (a, f) { return a + (f[c1] === v1 && f[c2] === v2 ? f.valor : 0); }, 0); }
    function maior(chave) {
      var t = {}; F.forEach(function (f) { t[f[chave]] = (t[f[chave]] || 0) + f.valor; });
      return Object.keys(t).sort(function (a, b) { return t[b] - t[a]; }).map(function (k) { return { k: k, v: t[k] }; });
    }
    var tot = soma(), A = soma("bloco", "A"), B = soma("bloco", "B");
    var eixos = maior("eixo"), comps = maior("comp");
    var alta = soma("classe", "alta"), estr = soma("classe", "estrategico");
    var prAlta = alta ? soma2("classe", "alta", "bloco", "A") / alta : 0;
    var prEstr = estr ? soma2("classe", "estrategico", "bloco", "A") / estr : 0;
    var nomeEixo = {}; (META.eixos || []).forEach(function (e) { nomeEixo[e.cod] = e.nome; });
    var nomeComp = {}; (PMETA.componentes || []).forEach(function (c) { nomeComp[c.cod] = c.nome.toLowerCase(); });
    var prep = ["C0", "C1", "C4"].reduce(function (a, k) { return a + soma("comp", k); }, 0);
    var p = function (v) { return num(v / tot * 100, 0) + "%"; };
    return "No valor máximo, a carteira soma <b>R$ " + num(tot, 1) + " milhões</b>. A Estruturação, contratável agora, " +
      "responde por " + p(A) + " (R$ " + num(A, 1) + " milhões); a Escala, que depende da condição de cada item, pelos outros " + p(B) + ". " +
      "<b>" + esc(nomeEixo[eixos[0].k] || eixos[0].k) + "</b> concentra " + p(eixos[0].v) + " do total, seguido de " +
      esc(nomeEixo[eixos[1].k] || eixos[1].k) + " (" + p(eixos[1].v) + "). " +
      "As experiências de <b>alta prioridade</b> somam " + p(alta) + " do valor, mas a prontidão não acompanha a pontuação: " +
      "a parcela já contratável é de " + num(prAlta * 100, 0) + "% entre elas e de " + num(prEstr * 100, 0) +
      "% entre as de potencial estratégico. O valor se concentra em <b>" + esc(nomeComp[comps[0].k] || comps[0].k) + "</b> (" +
      p(comps[0].v) + ") e " + esc(nomeComp[comps[1].k] || comps[1].k) + " (" + p(comps[1].v) + "); os componentes " +
      "preparatórios (estudo, desenvolvimento institucional e monitoramento) reúnem os R$ " + num(prep, 1) + " milhões restantes.";
  }

  /* ---- filtros do ranking ---- */
  var fEstado = { busca: "", eixo: "", uf: "", bioma: "", nat: "", campo: false };
  var ordRank = { chave: "matriz", dir: "desc" };
  var marcadas = [];

  function montaRanking() {
    preencheSelect($("#f-eixo"), (META.eixos || []).map(function (e) { return { v: e.cod, t: e.nome }; }));
    chipsEixo($("#f-eixos"), $("#f-eixo"), function () {
      var n = { _total: LINHAS.length };
      LINHAS.forEach(function (l) { n[l.eixo] = (n[l.eixo] || 0) + 1; });
      return n;
    });
    var ufs = {}, biomas = {}, nats = {};
    LINHAS.forEach(function (l) {
      ufsDe(l.uf).forEach(function (u) { ufs[u] = 1; });
      String(l.biomas || "").split(",").forEach(function (b) { b = b.trim(); if (b) biomas[b] = 1; });
      if (l.natureza) nats[l.natureza] = 1;
    });
    preencheSelect($("#f-uf"), Object.keys(ufs).sort());
    preencheSelect($("#f-bioma"), Object.keys(biomas).sort());
    preencheSelect($("#f-nat"), Object.keys(nats).sort());

    $("#f-busca").addEventListener("input", function (e) { fEstado.busca = e.target.value.toLowerCase(); pintaRanking(); });
    [["#f-eixo", "eixo"], ["#f-uf", "uf"], ["#f-bioma", "bioma"], ["#f-nat", "nat"]].forEach(function (p) {
      $(p[0]).addEventListener("change", function (e) { fEstado[p[1]] = e.target.value; pintaRanking(); });
    });
    $("#f-campo").addEventListener("change", function (e) { fEstado.campo = e.target.value === "campo"; pintaRanking(); });
    $("#f-reset").addEventListener("click", function () {
      fEstado = { busca: "", eixo: "", uf: "", bioma: "", nat: "", campo: false };
      $("#f-busca").value = ""; $("#f-eixo").value = ""; $("#f-uf").value = "";
      $("#f-bioma").value = ""; $("#f-nat").value = ""; $("#f-campo").value = "todas";
      if ($("#f-eixos").atualiza) $("#f-eixos").atualiza();
      pintaRanking();
    });

    $$("#tbl-ranking thead th[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.sort;
        if (ordRank.chave === k) ordRank.dir = ordRank.dir === "desc" ? "asc" : "desc";
        else { ordRank.chave = k; ordRank.dir = (k === "nome" || k === "municipio" || k === "uf" ||
          k === "eixo" || k === "natureza" || k === "classe" || k === "campo") ? "asc" : "desc"; }
        pintaRanking();
      });
    });

    $("#cmp-clear").addEventListener("click", function () { marcadas = []; pintaRanking(); pintaComparacao(); });
    pintaRanking();
  }

  function filtra() {
    return LINHAS.filter(function (l) {
      if (fEstado.campo && !l.exp) return false;
      if (fEstado.eixo && l.eixo !== fEstado.eixo) return false;
      if (fEstado.uf && ufsDe(l.uf).indexOf(fEstado.uf) < 0) return false;
      if (fEstado.bioma && String(l.biomas).indexOf(fEstado.bioma) < 0) return false;
      if (fEstado.nat && l.natureza !== fEstado.nat) return false;
      if (fEstado.busca) {
        var t = (l.nome + " " + l.org + " " + l.municipio).toLowerCase();
        if (t.indexOf(fEstado.busca) < 0) return false;
      }
      return true;
    });
  }

  var CHAVES = {
    nome: ["nome", "txt"], municipio: ["municipio", "txt"], uf: ["uf", "txt"],
    eixo: ["eixo", "txt"], natureza: ["natureza", "txt"], classe: ["classeOrd", "n"],
    campo: ["campo", "txt"], matriz: ["matriz", "n"], p5: ["p5", "n"],
    blocoa: ["amax", "n"], blocob: ["bmax", "n"]
  };

  /* UF: até duas siglas por extenso; acima disso, a primeira + contagem,
     com a lista completa no title e no arquivo exportado (data-exp). */
  var CLASSE_CURTA = { alta: "Alta prioridade", estrategico: "Potencial estratégico", nao: "Não recomendada" };
  LINHAS.forEach(function (l) { l.classeOrd = l.classe ? CLASSE_ORDEM.indexOf(l.classe) : null; });

  /* Município e UF numa célula só: acima de duas UFs, a primeira + contagem,
     com a lista completa no title e no arquivo exportado. */
  function localCelula(l) {
    var us = ufsDe(l.uf), uf;
    if (!us.length) uf = esc(l.uf || "");
    else if (us.length <= 2) uf = esc(us.join(", "));
    else uf = esc(us[0]) + ' <span class="vazio">+' + (us.length - 1) + "</span>";
    var ufTxt = us.length ? us.join(", ") : (l.uf || "");
    var cheio = l.municipio ? l.municipio + (ufTxt ? " (" + ufTxt + ")" : "") : ufTxt;
    return '<td class="loc" data-exp="' + esc(cheio) + '" title="' + esc(cheio) + '">' +
      esc(l.municipio || "—") + "<small>" + uf + "</small></td>";
  }

  function ufCelula(uf) {
    var us = ufsDe(uf);
    if (!us.length) return "<td>" + esc(uf || "—") + "</td>";
    if (us.length <= 2) return "<td>" + esc(us.join(", ")) + "</td>";
    return '<td data-exp="' + esc(us.join(", ")) + '" title="' + esc(us.join(", ")) + '">' +
      esc(us[0]) + ' <span class="vazio">+' + (us.length - 1) + "</span></td>";
  }

  function pintaRanking() {
    var c = CHAVES[ordRank.chave] || CHAVES.matriz;
    var dados = ordena(filtra(), function (l) {
      var v = l[c[0]];
      return c[1] === "txt" ? (v || "") : (v == null ? null : v);
    }, ordRank.dir, c[1]);

    $$("#tbl-ranking thead th[data-sort]").forEach(function (th) {
      th.classList.toggle("on", th.dataset.sort === ordRank.chave);
      th.classList.toggle("desc", th.dataset.sort === ordRank.chave && ordRank.dir === "desc");
    });

    $("#tb-ranking").innerHTML = dados.map(function (l) {
      var m = marcadas.indexOf(String(l.id)) >= 0;
      return '<tr class="' + (m ? "marcada" : "") + '" data-id="' + esc(l.id) + '">' +
        '<td><input type="checkbox" class="mk"' + (m ? " checked" : "") +
          (l.criterios ? ' aria-label="Selecionar para comparação"' : " disabled title=\"Sem avaliação nos dez critérios da matriz\"") + " /></td>" +
        '<td class="nome">' + esc(l.nome) + (l.org ? "<small>" + esc(l.org) + "</small>" : "") + "</td>" +
        localCelula(l) +
        "<td>" + tagEixo(l.eixo) + "</td>" +
        '<td class="nat" title="' + esc(l.natureza) + '">' + esc(l.natureza || "—") + "</td>" +
        '<td class="num nota">' + (l.matriz == null ? '<span class="vazio">—</span>'
          : '<span class="bn" aria-hidden="true"><i style="width:' + (l.matriz / 30 * 100).toFixed(1) + '%"></i></span>' + num(l.matriz, 0)) + "</td>" +
        (l.exp
          ? "<td>" + '<span class="campo-tag">' + esc(l.campo) + "</span></td>" +
            '<td class="num pts">' + (l.p5 == null ? '<span class="vazio">—</span>' : num(l.p5, 0) + barraPont(l.p5)) + "</td>" +
            '<td title="' + esc(l.classe ? CLASSE[l.classe] : "") + '">' +
              (l.classe ? capClasse(l.classe, true) : '<span class="vazio">—</span>') + "</td>" +
            '<td class="num">' + faixa(l.amin, l.amax) + "</td>" +
            '<td class="num">' + faixa(l.bmin, l.bmax) + "</td>"
          : '<td colspan="5" class="sem-campo">Não avaliada em campo</td>') +
        "</tr>";
    }).join("");

    $("#f-cnt").textContent = dados.length + " de " + LINHAS.length + " iniciativas";

    $$("#tb-ranking .mk").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.closest("tr").dataset.id;
        var i = marcadas.indexOf(id);
        if (cb.checked) { if (i < 0) { if (marcadas.length >= 6) { cb.checked = false; return; } marcadas.push(id); } }
        else if (i >= 0) marcadas.splice(i, 1);
        cb.closest("tr").classList.toggle("marcada", cb.checked);
        pintaComparacao();
      });
    });
  }

  /* ---- comparação (antiga aba Comparar, agora recurso do ranking) ---- */
  var radar = null;
  var PAL_CMP = ["#24246C", "#0C549C", "#54B43C", "#F09C18", "#E42424", "#0F7D8C"];

  function quebraRotulo(t) {
    /* rótulos longos do radar em até duas linhas, para não cortar nas bordas */
    var p = String(t).split(" ");
    if (t.length <= 16 || p.length < 2) return t;
    var meio = Math.ceil(t.length / 2), acc = "", i = 0;
    while (i < p.length - 1 && (acc + p[i]).length < meio) { acc += p[i] + " "; i++; }
    return [acc.trim(), p.slice(i).join(" ")];
  }

  function pintaComparacao() {
    var drawer = $("#cmp-drawer");
    var sel = marcadas.map(function (id) {
      return LINHAS.filter(function (l) { return String(l.id) === String(id); })[0];
    }).filter(function (l) { return l && l.criterios; });

    if (!sel.length) {
      drawer.classList.add("hidden");
      if (radar) { radar.destroy(); radar = null; }
      return;
    }
    drawer.classList.remove("hidden");

    $("#cmp-chips").innerHTML = sel.map(function (l, i) {
      return '<span class="cmp-chip"><b style="background:' + PAL_CMP[i % PAL_CMP.length] + '"></b>' +
        esc(l.nome) + '<button data-id="' + esc(l.id) + '" title="Remover da comparação" aria-label="Remover da comparação">&times;</button></span>';
    }).join("");
    $$("#cmp-chips button").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = marcadas.indexOf(b.dataset.id);
        if (i >= 0) marcadas.splice(i, 1);
        pintaRanking(); pintaComparacao();
      });
    });

    var CURTO = { relevancia: "Relevância", clima: "Clima", cadeias: "Cadeias produtivas", viabilidade: "Viabilidade",
      replicabilidade: "Replicabilidade", inovacao: "Inovação", investimentos: "Investimentos verdes",
      inclusao: "Inclusão produtiva", equidade: "Equidade", governanca: "Governança" };
    var rotulos = CRIT.map(function (c) { return CURTO[c.key] || c.label; });
    var ds = sel.map(function (l, i) {
      var cor = PAL_CMP[i % PAL_CMP.length];
      return {
        label: l.nome, data: CRIT.map(function (c) { return l.criterios[c.key] || 0; }),
        borderColor: cor, backgroundColor: cor + "22", borderWidth: 2,
        pointBackgroundColor: cor, pointRadius: 3
      };
    });
    if (radar) radar.destroy();
    radar = new Chart($("#cmp-radar"), {
      type: "radar",
      data: { labels: rotulos, datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: true, aspectRatio: 1,
        layout: { padding: 14 },
        scales: { r: { min: 0, max: 3, ticks: { stepSize: 1, backdropColor: "transparent", font: { size: 10 } },
          pointLabels: { font: { size: 11 }, padding: 8 },
          grid: { color: "#ECECEF" }, angleLines: { color: "#ECECEF" } } },
        plugins: { legend: { display: false } }
      }
    });

    $("#cmp-matriz").innerHTML =
      "<table><thead><tr><th>Critério</th>" +
        sel.map(function (l, i) {
          return '<th class="num" style="white-space:normal;min-width:110px;max-width:190px;vertical-align:bottom">' +
            '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:' +
            PAL_CMP[i % PAL_CMP.length] + '"></span>' + esc(l.nome) + "</th>";
        }).join("") +
      "</tr></thead><tbody>" +
      CRIT.map(function (c) {
        var vals = sel.map(function (l) { return l.criterios[c.key] || 0; });
        var mx = Math.max.apply(null, vals);
        return "<tr><td>" + esc(c.label) + "</td>" + vals.map(function (v) {
          return '<td class="num"' + (v === mx && mx > 0 ? ' style="font-weight:700;color:#24246C"' : "") + ">" + v + "</td>";
        }).join("") + "</tr>";
      }).join("") +
      '<tr><td><b>Nota da matriz</b></td>' +
        sel.map(function (l) { return '<td class="num"><b>' + num(l.matriz, 0) + "</b></td>"; }).join("") +
      "</tr>" +
      '<tr><td>Pontuação final</td>' +
        sel.map(function (l) { return '<td class="num">' + (l.p5 == null ? "—" : num(l.p5, 0)) + "</td>"; }).join("") +
      "</tr></tbody></table>";
  }

  /* ========================================================== 2. MAPA === */
  /* Pontos com o ícone do eixo (quadrado do livro); as avaliadas em campo são
     maiores e têm contorno. Pontos próximos se agrupam num anel com a
     composição por eixo. O painel lateral junta a contagem por eixo e a lista
     das iniciativas na área visível do mapa (padrão "lista de locais"). */
  var mapa = null, camadaPontos = null, camadaRotas = null, marcadores = {}, mkSel = null;
  var NE_BOUNDS = [[-18.3, -48.6], [-1.2, -34.8]];

  function htmlIco(cod, tam) {
    if (!(cod in ICO_INLINE)) { var sym = document.getElementById("i-" + cod); ICO_INLINE[cod] = sym ? sym.innerHTML : ""; }
    return '<svg width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" color="' + tintaEixo(cod) + '" aria-hidden="true">' +
      ICO_INLINE[cod] + "</svg>";
  }
  function iconeIni(l) {
    var t = l.exp ? 26 : 19;
    return L.divIcon({
      className: "mk-wrap",
      html: '<span class="mk' + (l.exp ? " campo" : "") + '" data-e="' + esc(l.eixo) + '" style="' + varsEixo(l.eixo) + '">' +
        htmlIco(l.eixo, l.exp ? 18 : 13) + "</span>",
      iconSize: [t, t], iconAnchor: [t / 2, t / 2], tooltipAnchor: [0, -t / 2]
    });
  }
  /* anel do agrupamento: um arco por eixo, proporcional à contagem */
  function iconeGrupo(cl) {
    var ms = cl.getAllChildMarkers(), n = {}, tot = ms.length, campo = 0;
    ms.forEach(function (m) { n[m.options.eixo] = (n[m.options.eixo] || 0) + 1; if (m.options.campo) campo++; });
    var r = 15, C = 2 * Math.PI * r, acc = 0, arcos = "";
    (META.eixos || []).forEach(function (e) {
      var q = n[e.cod] || 0; if (!q) return;
      var len = q / tot * C;
      arcos += '<circle r="' + r + '" cx="20" cy="20" fill="none" stroke="' + corEixo(e.cod) + '" stroke-width="7" stroke-dasharray="' +
        len.toFixed(2) + " " + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 20 20)"/>';
      acc += len;
    });
    return L.divIcon({
      className: "mk-wrap",
      html: '<span class="mk-grupo" data-eixos="' + Object.keys(n).join(" ") + '" title="' + tot + " iniciativas próximas" +
          (campo ? ", " + campo + " avaliada" + (campo > 1 ? "s" : "") + " em campo" : "") + '; clique para abrir">' +
        '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="11.5" fill="#fff"/>' + arcos +
        (campo ? '<circle cx="20" cy="20" r="19.2" fill="none" stroke="#24246C" stroke-width="1.6"/>' : "") +
        '<text x="20" y="24.5" text-anchor="middle" font-size="12.5" font-weight="700" fill="#24246C" font-family="Roboto,sans-serif">' +
        tot + "</text></svg></span>",
      iconSize: [40, 40], iconAnchor: [20, 20]
    });
  }

  INICIA.mapa = function () {
    preencheSelect($("#m-eixo"), (META.eixos || []).map(function (e) { return { v: e.cod, t: e.nome }; }));
    chipsEixo($("#m-eixos"), $("#m-eixo"));
    var ufs = {};
    LINHAS.forEach(function (l) { ufsDe(l.uf).forEach(function (u) { ufs[u] = 1; }); });
    preencheSelect($("#m-uf"), Object.keys(ufs).sort());

    /* zoom inteiro: em zoom fracionário os ladrilhos são escalados e aparecem
       emendas brancas entre eles */
    mapa = L.map("map-geral", { scrollWheelZoom: true });
    mapa.fitBounds(NE_BOUNDS, { padding: [4, 4] });   /* os nove estados */
    if (window.PTE_MAP && PTE_MAP.setup) PTE_MAP.setup(mapa, { base: "Cinza claro", noAirports: true });
    else L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; OpenStreetMap, &copy; CARTO", maxZoom: 19 }).addTo(mapa);
    legendaMapa().addTo(mapa);
    botaoNordeste().addTo(mapa);

    camadaRotas = L.layerGroup().addTo(mapa);
    camadaPontos = L.markerClusterGroup
      ? L.markerClusterGroup({
          maxClusterRadius: 24, showCoverageOnHover: false, zoomToBoundsOnClick: false,
          spiderfyOnMaxZoom: true, spiderfyDistanceMultiplier: 1.4, iconCreateFunction: iconeGrupo
        })
      : L.layerGroup();
    camadaPontos.addTo(mapa);
    if (camadaPontos.on) camadaPontos.on("clusterclick", function (ev) {
      /* pontos no mesmo município: abre em leque; senão, aproxima */
      var b = ev.layer.getBounds();
      if (b.getNorthEast().distanceTo(b.getSouthWest()) < 4000 || mapa.getBoundsZoom(b) > 11) ev.layer.spiderfy();
      else ev.layer.zoomToBounds({ padding: [50, 50] });
    });

    $("#m-eixo").addEventListener("change", pintaMapa);
    $("#m-uf").addEventListener("change", function () { pintaMapa(); enquadraUF($("#m-uf").value); });
    $("#m-rotas").addEventListener("change", pintaMapa);
    $("#m-so-campo").addEventListener("change", pintaMapa);
    mapa.on("moveend", function () { if (!fichaNoPainel) listaLateral(); });
    pintaMapa();
  };
  RETOMA.mapa = function () { if (mapa) setTimeout(function () { mapa.invalidateSize(); }, 60); };

  function enquadraUF(uf) {
    var f = uf && window.PTE_UF_NE && PTE_UF_NE.features.filter(function (x) { return x.properties.sigla === uf; })[0];
    if (f) mapa.fitBounds(L.geoJSON(f).getBounds(), { padding: [24, 24] });
    else mapa.fitBounds(NE_BOUNDS, { padding: [4, 4] });
  }
  function botaoNordeste() {
    var c = L.control({ position: "topleft" });
    c.onAdd = function () {
      var d = L.DomUtil.create("div", "leaflet-bar mk-ne");
      d.innerHTML = '<a href="#" role="button" title="Ver o Nordeste inteiro" aria-label="Ver o Nordeste inteiro">NE</a>';
      L.DomEvent.disableClickPropagation(d);
      d.querySelector("a").addEventListener("click", function (ev) { ev.preventDefault(); enquadraUF(""); });
      return d;
    };
    return c;
  }

  /* legenda compacta: o eixo aparece pelo ícone (e no painel ao lado); fica
     no mapa para sair no PNG exportado */
  function legendaMapa() {
    var ctl = L.control({ position: "bottomright" });
    ctl.onAdd = function () {
      var d = L.DomUtil.create("div", "pte-legend mk-leg");
      var h = '<button type="button" class="mk-leg-bt" aria-expanded="true">Legenda</button><div class="mk-leg-corpo">' +
        '<div class="mk-leg-eixos">' + (META.eixos || []).map(function (e) {
          return '<span title="' + esc(e.nome) + '"><span class="mk" style="' + varsEixo(e.cod) + '">' + htmlIco(e.cod, 13) + "</span>" +
            esc(e.cod) + "</span>";
        }).join("") + "</div>" +
        '<div class="mk-leg-l"><span class="mk campo" style="--e:#8A8A94;--ei:#fff"></span>Avaliada em campo</div>' +
        '<div class="mk-leg-l"><span class="mk" style="--e:#8A8A94;--ei:#fff"></span>Mapeada, sem visita</div>' +
        '<div class="mk-leg-l"><span class="mk-anel"></span>Iniciativas próximas: clique para abrir</div>';
      if (ROTAS.length) h += '<div class="mk-leg-rotas">' + ROTAS.map(function (r) {
        return '<div><i style="border-top-color:' + (COR_ROTA[r.id] || CINZA) + '"></i>' + esc(r.nome) + " (" + esc(r.uf) + ")</div>";
      }).join("") + "</div>";
      d.innerHTML = h + "</div>";
      var bt = d.querySelector(".mk-leg-bt");
      if (window.innerWidth < 700) { d.classList.add("fechada"); bt.setAttribute("aria-expanded", "false"); }
      bt.addEventListener("click", function () {
        var f = d.classList.toggle("fechada"); bt.setAttribute("aria-expanded", !f);
      });
      L.DomEvent.disableClickPropagation(d);
      L.DomEvent.disableScrollPropagation(d);
      return d;
    };
    return ctl;
  }

  var visiveis = [];
  function pintaMapa() {
    var eixo = $("#m-eixo").value, uf = $("#m-uf").value;
    var soCampo = $("#m-so-campo").checked;
    camadaPontos.clearLayers(); camadaRotas.clearLayers(); marcadores = {}; mkSel = null;

    visiveis = LINHAS.filter(function (l) {
      if (l.lat == null || l.lon == null) return false;
      if (soCampo && !l.exp) return false;
      if (eixo && l.eixo !== eixo) return false;
      if (uf && ufsDe(l.uf).indexOf(uf) < 0) return false;
      return true;
    });

    var ms = visiveis.map(function (l) {
      var m = L.marker([l.lat, l.lon], { icon: iconeIni(l), eixo: l.eixo, campo: !!l.exp, riseOnHover: true,
        keyboard: true, title: l.nome, alt: l.nome, zIndexOffset: l.exp ? 500 : 0 });
      m.bindTooltip(esc(l.nome), { direction: "top" });
      m.on("click", function () { selecionaPonto(l, false); });
      marcadores[l.id] = m;
      return m;
    });
    if (camadaPontos.addLayers) camadaPontos.addLayers(ms); else ms.forEach(function (m) { camadaPontos.addLayer(m); });

    if ($("#m-rotas").checked && ROTAS.length) {
      /* EXP já vem em ordem de data dentro de cada rota (gen_p5.py). A rota
         extra foi feita por três equipes: cada uma vira um trecho. Entrevistas
         virtuais não entram na linha, porque não houve deslocamento. */
      var trechos = {};
      EXP.forEach(function (e) {
        if (e.coleta !== "Presencial" || e.lat == null) return;
        var k = e.rota + "|" + (e.equipe || "");
        (trechos[k] = trechos[k] || []).push(e);
      });
      Object.keys(trechos).forEach(function (k) {
        var l = trechos[k], r = ROTAS.filter(function (x) { return x.id === l[0].rota; })[0] || {};
        if (l.length < 2) return;
        camadaRotas.addLayer(L.polyline(l.map(function (e) { return [e.lat, e.lon]; }), {
          color: COR_ROTA[l[0].rota] || CINZA, weight: 2.5, opacity: 0.8, dashArray: "6 5"
        }).bindTooltip((r.nome || "") + ", equipe " + (l[0].equipe || "") + ", de " + l[0].data + " a " + l[l.length - 1].data));
      });
    }
    $("#m-cnt").textContent = visiveis.length + " iniciativas no mapa";
    if (!fichaNoPainel) resumoLateral();
  }

  /* painel lateral sem ponto selecionado: contagem por eixo (filtra e realça)
     e a lista das iniciativas na área visível */
  var fichaNoPainel = false, buscaMapa = "";
  function resumoLateral() {
    fichaNoPainel = false;
    if (mkSel && mkSel.getElement()) mkSel.getElement().classList.remove("sel");
    var uf = $("#m-uf").value, soCampo = $("#m-so-campo").checked, ativo = $("#m-eixo").value;
    var base = LINHAS.filter(function (l) {
      return l.lat != null && (!soCampo || l.exp) && (!uf || ufsDe(l.uf).indexOf(uf) >= 0);
    });
    var n = {}, nc = {}, mx = 1;
    base.forEach(function (l) { n[l.eixo] = (n[l.eixo] || 0) + 1; if (l.exp) nc[l.eixo] = (nc[l.eixo] || 0) + 1; });
    Object.keys(n).forEach(function (k) { mx = Math.max(mx, n[k]); });
    var h = '<div class="ms-resumo"><h4>Iniciativas por eixo</h4>' +
      '<p class="ms-sub">' + base.length + " no mapa" + (uf ? " com atuação em " + esc(uf) : "") +
      ". A parte escura da barra são as avaliadas em campo. Passe o mouse para destacar no mapa; clique para filtrar.</p><ul>" +
      (META.eixos || []).map(function (e) {
        var k = e.cod, t = n[k] || 0, c = nc[k] || 0;
        return '<li><button type="button" data-e="' + k + '" style="' + varsEixo(k) + '" aria-pressed="' + (ativo === k) + '">' +
          '<span class="q">' + icoEixo(k) + '</span><span class="t">' + esc(CURTO_EIXO[k] || e.nome) + "</span>" +
          '<span class="b"><i style="width:' + (t / mx * 100).toFixed(1) + '%"></i><i class="c" style="width:' +
          (c / mx * 100).toFixed(1) + '%"></i></span><b>' + t + "</b></button></li>";
      }).join("") + "</ul></div>" +
      '<div class="ms-lista"><div class="ms-lista-cab"><h4 id="ms-lista-tit"></h4>' +
      '<input type="search" id="ms-busca" placeholder="Buscar iniciativa ou município" aria-label="Buscar iniciativa ou município no mapa" value="' +
      esc(buscaMapa) + '" /></div><ol id="ms-itens"></ol></div>';
    $("#map-side").innerHTML = h;
    $$("#map-side button[data-e]").forEach(function (b) {
      b.addEventListener("click", function () {
        var sel = $("#m-eixo");
        sel.value = sel.value === b.dataset.e ? "" : b.dataset.e;
        sel.dispatchEvent(new Event("change"));
      });
      b.addEventListener("mouseenter", function () { $("#map-geral").setAttribute("data-realce", b.dataset.e); });
      b.addEventListener("mouseleave", function () { $("#map-geral").removeAttribute("data-realce"); });
    });
    $("#ms-busca").addEventListener("input", function (ev) { buscaMapa = ev.target.value; listaLateral(); });
    listaLateral();
  }

  function listaLateral() {
    var ol = $("#ms-itens"); if (!ol || !mapa) return;
    var q = buscaMapa.trim().toLowerCase(), area = mapa.getBounds();
    var itens = visiveis.filter(function (l) {
      if (q) return (l.nome + " " + l.org + " " + l.municipio).toLowerCase().indexOf(q) >= 0;
      return area.contains([l.lat, l.lon]);
    }).sort(function (a, b) {
      return (b.exp ? 1 : 0) - (a.exp ? 1 : 0) || (b.matriz || 0) - (a.matriz || 0) || a.nome.localeCompare(b.nome, "pt-BR");
    });
    $("#ms-lista-tit").textContent = (q ? "Resultados da busca" : "Nesta área do mapa") + " (" + itens.length + ")";
    ol.innerHTML = itens.length ? itens.map(function (l) {
      return '<li><button type="button" data-id="' + esc(l.id) + '">' +
        '<span class="mk' + (l.exp ? " campo" : "") + '" style="' + varsEixo(l.eixo) + '">' + htmlIco(l.eixo, l.exp ? 16 : 12) + "</span>" +
        '<span class="t"><b>' + esc(l.nome) + "</b><small>" + esc(localIni(l)) +
        (l.exp ? '</small><span class="campo-tag">' + esc(l.campo) + "</span>" : "</small>") + "</span>" +
        '<span class="n" title="Nota da matriz">' + (l.matriz == null ? "" : num(l.matriz, 0)) + "</span></button></li>";
    }).join("") : '<li class="ms-vazio">' + (q ? "Nenhuma iniciativa com esse nome ou município. Confira a grafia ou limpe a busca."
      : "Nenhuma iniciativa nesta área. Afaste o zoom ou use o botão NE para ver o Nordeste inteiro.") + "</li>";
    $$("#ms-itens button[data-id]").forEach(function (b) {
      var l = LINHAS.filter(function (x) { return String(x.id) === b.dataset.id; })[0];
      b.addEventListener("click", function () { selecionaPonto(l, true); });
      b.addEventListener("mouseenter", function () { realcaPonto(l, true); });
      b.addEventListener("mouseleave", function () { realcaPonto(l, false); });
    });
  }

  function elPonto(l) {
    var m = marcadores[l.id]; if (!m) return null;
    var p = camadaPontos.getVisibleParent ? camadaPontos.getVisibleParent(m) : m;
    return p && p.getElement ? p.getElement() : null;
  }
  function realcaPonto(l, on) { var el = elPonto(l); if (el) el.classList.toggle("hl", on); }

  /* abre a ficha no painel; vindo da lista, aproxima o mapa até o ponto */
  function selecionaPonto(l, voar) {
    var m = marcadores[l.id];
    function marca() {
      if (mkSel && mkSel.getElement()) mkSel.getElement().classList.remove("sel");
      mkSel = m;
      if (m && m.getElement()) m.getElement().classList.add("sel");
    }
    fichaLateral(l);
    if (!m) return;
    if (!voar) { marca(); return; }
    vaiAte(m, marca, 0, null);
  }
  /* aproxima até o ponto sair do agrupamento; no mesmo município, abre em leque
     numa escala de cidade, sem descer ao nível da rua */
  function vaiAte(m, marca, n, antes) {
    var pai = camadaPontos.getVisibleParent ? camadaPontos.getVisibleParent(m) : m;
    if (!pai || pai === m) {
      if (!mapa.getBounds().contains(m.getLatLng()) || mapa.getZoom() < 7) {
        mapa.once("moveend", function () { setTimeout(marca, 350); });
        mapa.setView(m.getLatLng(), Math.max(mapa.getZoom(), 8));
      } else marca();
      return;
    }
    var b = pai.getBounds();
    if (b.getNorthEast().distanceTo(b.getSouthWest()) < 4000 || n > 4 || pai === antes) {
      var abre = function () {
        var p2 = camadaPontos.getVisibleParent(m);
        if (p2 && p2 !== m && p2.spiderfy) { p2.spiderfy(); setTimeout(marca, 450); } else marca();
      };
      if (mapa.getZoom() < 9) { mapa.once("moveend", function () { setTimeout(abre, 400); }); mapa.setView(b.getCenter(), 9); }
      else abre();
      return;
    }
    /* espera o reagrupamento animado do Leaflet.markercluster antes de olhar de novo */
    mapa.once("moveend", function () { setTimeout(function () { vaiAte(m, marca, n + 1, pai); }, 400); });
    mapa.fitBounds(b, { padding: [60, 60], maxZoom: 12 });
  }
  /* município da iniciativa: a UF da visita, quando houve; senão, só quando a base traz uma UF */
  function localIni(l) {
    var us = ufsDe(l.uf), uf = l.exp && l.exp.uf ? l.exp.uf : (us.length === 1 ? us[0] : "");
    return l.municipio ? l.municipio + (uf ? " (" + uf + ")" : "") : (us.join(", ") || "—");
  }

  /* do mapa para o cartão da incursão */
  function irParaCartao(aba) {
    mostrar("experiencias");
    function vai() {
      var c = $('#fichas .ficha[data-aba="' + aba + '"]');
      if (!c) { var t = $('#rotas-nav button[data-rota="todas"]'); if (t) t.click(); c = $('#fichas .ficha[data-aba="' + aba + '"]'); }
      if (!c) return;
      c.scrollIntoView({ behavior: "smooth", block: "center" });
      c.classList.remove("realce"); void c.offsetWidth; c.classList.add("realce");
    }
    setTimeout(vai, 80);
  }

  function fichaLateral(l) {
    var e = l.exp;
    fichaNoPainel = true;
    var h = (l.eixo ? '<div class="faixa-eixo" style="' + varsEixo(l.eixo) + '"><span class="q">' + icoEixo(l.eixo) + "</span>" +
        esc(l.eixo_nome || NOME_EIXO[l.eixo] || l.eixo) + "</div>" : "") +
      '<button type="button" class="ms-voltar" id="ms-voltar">Voltar à lista</button>' +
      "<h4>" + esc(l.nome) + "</h4>" +
      '<p class="loc">' + esc(localIni(l)) + (ufsDe(l.uf).length > 1 ? ". Atua em " + esc(ufsDe(l.uf).join(", ")) : "") + "</p>";
    if (e && e.pontuacao != null) h += '<div class="ms-pont"><b>' + num(e.pontuacao, 0) + "</b><div>" +
      capClasse(classeDe(e)) + barraPont(e.pontuacao) + "<small>Pontuação final, de 0 a 100</small></div></div>";
    h += "<dl>";
    if (l.org) h += "<dt>Organização</dt><dd>" + esc(l.org) + "</dd>";
    if (l.natureza) h += "<dt>Natureza jurídica</dt><dd>" + esc(l.natureza) + "</dd>";
    if (l.matriz != null) h += "<dt>Nota da matriz</dt><dd>" + num(l.matriz, 0) + " de 30</dd>";
    if (e) {
      h += "<dt>Coleta em campo</dt><dd>" + esc(e.coleta) + ", em " + esc(e.data) +
        " (" + esc(e.rota_nome) + ")</dd>";
      if (e.estimada) {
        h += "<dt>Etapa 1 — Estruturação</dt><dd>R$ " + faixaTxt(e.bloco_a.min, e.bloco_a.max) + " milhões</dd>";
        h += "<dt>Etapa 2 — Escala</dt><dd>" + (e.bloco_b.max ? "R$ " + faixaTxt(e.bloco_b.min, e.bloco_b.max) + " milhões" : "Sem Escala") + "</dd>";
        h += "<dt>Prontidão</dt><dd>" + pctTxt(e.prontidao) + " da carteira na Estruturação</dd>";
      } else {
        h += "<dt>Estimativa</dt><dd>Sem estimativa: não recomendada neste ciclo</dd>";
      }
    }
    h += "</dl>";
    if (e) h += '<button type="button" class="ms-ir" id="ms-ir">Ver o cartão da incursão</button>';
    if (l.ini && l.ini.resumo) h += '<p class="ms-resumo-ini">' + esc(l.ini.resumo) + "</p>";
    $("#map-side").innerHTML = h;
    $("#map-side").scrollTop = 0;
    $("#ms-voltar").addEventListener("click", resumoLateral);
    if (e) $("#ms-ir").addEventListener("click", function () { irParaCartao(e.aba); });
  }

  /* ================================================ 3. EXPERIÊNCIAS === */
  var rotaAtiva = "todas";

  INICIA.experiencias = function () {
    if (!EXP.length) {
      $("#fichas").innerHTML = '<div class="aviso">Não foi possível carregar as estimativas nesta sessão.</div>';
      return;
    }
    var nEst = EXP.filter(function (e) { return e.estimada; }).length;
    var nVirt = EXP.filter(function (e) { return e.coleta === "Virtual"; }).length;
    var nAlta = EXP.filter(function (e) { return e.estimada && e.classificacao === "alta"; }).length;
    $("#exp-lead").textContent = "Nas " + ROTAS.length + " rotas, " + EXP.length + " organizações receberam visita " +
      "presencial (" + (EXP.length - nVirt) + ") ou entrevista virtual (" + nVirt + "). Dessas, " + nAlta +
      " foram recomendadas com alta prioridade e " + (nEst - nAlta) + " como potencial estratégico, e as " + nEst +
      " têm estimativa de recursos; as outras " + (EXP.length - nEst) + " não foram recomendadas neste ciclo.";

    var botoes = [{ id: "todas", nome: "Todas as rotas", cor: "#24246C", n: EXP.length }].concat(
      ROTAS.map(function (r) {
        return { id: r.id, nome: r.nome + " (" + r.uf + ")", cor: COR_ROTA[r.id] || CINZA,
          n: EXP.filter(function (e) { return e.rota === r.id; }).length };
      }));
    $("#rotas-nav").innerHTML = botoes.map(function (b) {
      return '<button type="button" data-rota="' + b.id + '" style="--r:' + b.cor + ";--ri:" + tintaRota(b.id) + '" aria-pressed="' + (b.id === rotaAtiva) + '"' +
        (b.id === rotaAtiva ? ' class="active"' : "") + ">" + esc(b.nome) +
        ' <span class="n">' + b.n + "</span></button>";
    }).join("");
    $$("#rotas-nav button").forEach(function (b) {
      b.addEventListener("click", function () {
        rotaAtiva = b.dataset.rota;
        $$("#rotas-nav button").forEach(function (x) {
          x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", x === b);
        });
        pintaFichas();
      });
    });
    var mxCart = 0;
    EXP.forEach(function (e) { if (e.estimada) mxCart = Math.max(mxCart, (e.bloco_a.max || 0) + (e.bloco_b.max || 0)); });
    ESCALA_CART = Math.ceil(mxCart / 5) * 5 || 1;
    $("#fichas-leg").innerHTML = "Nas barras de carteira, a escala é a mesma em todos os cartões, de zero a R$ " +
      num(ESCALA_CART, 0) + ' milhões: <i class="sw a"></i>Estruturação e <i class="sw b"></i>Escala no valor máximo, ' +
      "com um traço no valor mínimo da carteira. Na pontuação, as marcas indicam 60 e 80 pontos, os limites da classificação.";
    window.addEventListener("resize", function () {
      clearTimeout(window.__pteInv); window.__pteInv = setTimeout(posicionaInv, 150);
    });
    pintaFichas();
  };
  var ESCALA_CART = 1;
  /* verde e laranja pedem texto anil; azul e anil, branco */
  function tintaRota(id) { return id === "R2" || id === "R3" ? "#24246C" : "#fff"; }

  /* linha do trajeto: as paradas de cada rota, na ordem das visitas */
  function pintaTrajeto() {
    var rotas = rotaAtiva === "todas" ? ROTAS : ROTAS.filter(function (r) { return r.id === rotaAtiva; });
    $("#trajeto").innerHTML = rotas.map(function (r) {
      var ps = EXP.filter(function (e) { return e.rota === r.id; });
      return '<div class="traj-linha" style="--r:' + (COR_ROTA[r.id] || CINZA) + ";--ri:" + tintaRota(r.id) + '">' +
        (rotaAtiva === "todas" ? '<span class="traj-rot">' + esc(r.nome) + "</span>" : "") +
        '<ol style="--n:' + ps.length + '" aria-label="Paradas da ' + esc(r.nome) + '">' + ps.map(function (e, i) {
          return '<li><button type="button" data-aba="' + esc(e.aba) + '" title="' + esc(e.nome + ", " + e.municipio +
            " (" + e.uf + "), " + e.data + (e.coleta === "Virtual" ? ", entrevista virtual" : "")) + '">' +
            '<span class="pt' + (e.coleta === "Virtual" ? " virt" : "") + '">' + (i + 1) + "</span>" +
            '<span class="dt">' + esc(e.data) + '</span><span class="nm">' + esc(nomeCurto(e)) + "</span></button></li>";
        }).join("") + "</ol></div>";
    }).join("");
    $$("#trajeto button[data-aba]").forEach(function (b) {
      b.addEventListener("click", function () {
        var c = $('#fichas .ficha[data-aba="' + b.dataset.aba + '"]');
        if (!c) return;
        c.scrollIntoView({ behavior: "smooth", block: "center" });
        c.classList.remove("realce"); void c.offsetWidth; c.classList.add("realce");
      });
    });
  }

  function pintaFichas() {
    var r = ROTAS.filter(function (x) { return x.id === rotaAtiva; })[0];
    $("#rota-info").innerHTML = r
      ? "<b>" + esc(r.nome) + "</b> (" + esc(r.uf) + "), de " + esc(r.periodo) + ". " +
        (/·/.test(r.equipe) ? "Equipes: " : "Equipe: ") + esc(String(r.equipe).replace(/ · /g, "; ")) + "." 
      : "Todas as rotas, na ordem em que foram percorridas.";

    pintaTrajeto();
    var lista = EXP.filter(function (e) { return rotaAtiva === "todas" || e.rota === rotaAtiva; });
    var inv = $("#inv");
    $("#fichas").after(inv);   /* tira a ficha aberta da grade antes de redesenhar os cartões */
    $("#fichas").innerHTML = lista.map(function (e) {
      var tot = { min: (e.bloco_a.min || 0) + (e.bloco_b.min || 0), max: (e.bloco_a.max || 0) + (e.bloco_b.max || 0) };
      var cls = classeDe(e);
      var h = '<article class="ficha' + (e.estimada ? "" : " sem-est") + '" data-aba="' + esc(e.aba) + '" style="' + varsEixo(e.eixo_cod) + '">' +
        '<div class="faixa-eixo"><span class="q">' + icoEixo(e.eixo_cod) + "</span>" +
          esc(CURTO_EIXO[e.eixo_cod] || e.eixo_cod || "") + '<span class="rota" style="--r:' + (COR_ROTA[e.rota] || CINZA) + '">' +
          esc(e.rota_nome) + "</span></div>" +
        '<div class="ficha-corpo">' +
        "<h4>" + esc(e.nome) + "</h4>" +
        '<p class="loc">' + esc(e.municipio) + " (" + esc(e.uf) + "), " + esc(e.data) + ", " +
          (e.coleta === "Virtual" ? "entrevista virtual" : "visita presencial") +
          (e.equipe ? ". Equipe: " + esc(e.equipe) : "") +
          (e.nova_em_campo ? ". Encontrada em campo, fora da base de prospecção" : "") + "</p>";
      if (e.pontuacao != null) {
        h += '<div class="pont"><b>' + num(e.pontuacao, 0) + "</b><div>" + capClasse(cls) +
          barraPont(e.pontuacao) + "<small>" + (e.estimada ? esc(e.posicao) + "º lugar entre " + nEstimadas() + ", " : "") +
          "pontuação final de 0 a 100</small></div></div>";
      }
      if (e.estimada) {
        var pa = (e.bloco_a.max || 0) / ESCALA_CART * 100, pb = (e.bloco_b.max || 0) / ESCALA_CART * 100;
        h += '<div class="cart"><div class="cart-top"><span>Carteira total</span><b>R$ ' + faixaTxt(tot.min, tot.max) +
            ' <small>milhões</small></b></div>' +
          '<span class="barra-cart" role="img" aria-label="Carteira de R$ ' + faixaTxt(tot.min, tot.max) + ' milhões; Estruturação de R$ ' +
            faixaTxt(e.bloco_a.min, e.bloco_a.max) + ' milhões e Escala de R$ ' + faixaTxt(e.bloco_b.min, e.bloco_b.max) + ' milhões">' +
            '<i class="a" style="width:' + pa.toFixed(2) + '%"></i><i class="b" style="width:' + pb.toFixed(2) + '%"></i>' +
            '<em style="left:' + (tot.min / ESCALA_CART * 100).toFixed(2) + '%"></em></span>' +
          '<p class="cart-leg"><span><i class="sw a"></i>Estruturação ' + faixa(e.bloco_a.min, e.bloco_a.max) + "</span>" +
            '<span><i class="sw b"></i>Escala ' + faixa(e.bloco_b.min, e.bloco_b.max) + "</span></p></div>" +
          '<dl class="ficha-mini">' +
            "<div><dt>Prontidão</dt><dd>" + pctTxt(e.prontidao) + "</dd></div>" +
            "<div><dt>Informação financeira</dt><dd>" + esc(maiusc(e.info_financeira)) + "</dd></div>" +
            "<div><dt>Confiança da estimativa</dt><dd>" + esc(maiusc(e.confianca)) + "</dd></div>" +
            "<div><dt>Itens estimados</dt><dd>" + esc(e.itens) + "</dd></div>" +
            (e.gabinete != null ? "<div><dt>Nota da matriz</dt><dd>" + num(e.gabinete, 0) + " de 30</dd></div>" : "") +
          "</dl>";
        if (e.ficha_inv) {
          h += '<button class="abrir" type="button" data-aba="' + esc(e.aba) + '" aria-expanded="false">Ver ficha de investimento</button>';
        }
      } else {
        h += '<p class="sem-txt">Sem estimativa de recursos: não recomendada neste ciclo. ' +
          "A avaliação está na seção Diagnóstico de campo.</p>";
      }
      return h + "</div></article>";
    }).join("");
    $$("#fichas .abrir").forEach(function (b) {
      b.addEventListener("click", function () { abreInvestimento(b.dataset.aba); });
    });
    if (invAberta && !lista.some(function (e) { return e.aba === invAberta; })) fechaInvestimento();
    else if (invAberta) { marcaAberta(); posicionaInv(); }
  }

  /* a ficha de investimento abre logo abaixo da linha do cartão clicado */
  function posicionaInv() {
    var inv = $("#inv");
    if (!invAberta || !inv) return;
    var card = $('#fichas .ficha[data-aba="' + invAberta + '"]');
    if (!card) return;
    var top = card.offsetTop, ult = card;
    $$("#fichas .ficha").forEach(function (c) { if (Math.abs(c.offsetTop - top) < 4) ult = c; });
    if (ult.nextElementSibling !== inv) ult.after(inv);
  }

  /* ---- ficha de investimento: a aba da planilha, no estilo de uma ficha
     de carteira. Só existe quando os itens vieram no pacote cifrado. ---- */
  var invAberta = null;
  /* legenda dos códigos de origem citados nas notas (linha "Origem" da aba) */
  var LEGENDA_ORIGEM = "Origem das notas: K = ficha do formulário de campo, com o código do campo; F6.5 e F7.3 = ficha de " +
    "recomendação do relatório final; P3 e P4 = relatórios das incursões; R1 a R4 = transcrição da incursão correspondente; " +
    "PREM = premissa da equipe, a validar.";
  function pct(v) { return v == null ? "" : num(v * 100, 0) + "%"; }
  function marcaAberta() {
    $$("#fichas .ficha").forEach(function (f) {
      var b = f.querySelector(".abrir");
      var on = !!(b && b.dataset.aba === invAberta);
      f.classList.toggle("aberta", on);
      if (b) { b.textContent = on ? "Fechar ficha de investimento" : "Ver ficha de investimento"; b.setAttribute("aria-expanded", on); }
    });
  }
  function fechaInvestimento(voltar) {
    var card = invAberta && $('#fichas .ficha[data-aba="' + invAberta + '"]');
    invAberta = null; $("#inv").classList.add("hidden"); $("#inv").innerHTML = ""; marcaAberta();
    $("#fichas").after($("#inv"));
    if (voltar === true && card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function abreInvestimento(aba) {
    var e = EXP.filter(function (x) { return x.aba === aba; })[0];
    if (!e || !e.ficha_inv) return;
    if (invAberta === aba) { fechaInvestimento(true); return; }
    invAberta = aba; marcaAberta();
    var f = e.ficha_inv, cor = corEixo(e.eixo_cod);
    var slug = String(e.curto).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    var h = '<div class="faixa-eixo inv-faixa" style="' + varsEixo(e.eixo_cod) + '"><span class="q">' + icoEixo(e.eixo_cod) + "</span>" +
        esc(NOME_EIXO[e.eixo_cod] || e.eixo_cod || "") + "</div>" +
      '<div class="inv-head"><div class="inv-tit"><h4>Ficha de investimento: ' + esc(nomeCurto(e)) + "</h4>" +
      '<p class="meta">' +
      esc(e.municipio) + " (" + esc(e.uf) + "), " + esc(e.rota_nome) + ", " +
      (e.coleta === "Virtual" ? "entrevista em " : "visita em ") + esc(e.data) + "</p></div>" +
      '<div class="exp-bar" style="margin:0"><span class="exp-lab">Exportar:</span>' +
      '<button class="exp-btn" data-exp="xlsx" data-target="#inv-export" data-name="ficha-' + slug +
        '" data-title="Ficha de investimento — ' + esc(nomeCurto(e)) + '" data-sheet="Ficha">XLS</button>' +
      '<button class="exp-btn" data-exp="pdf" data-target="#inv-export" data-name="ficha-' + slug +
        '" data-title="Ficha de investimento — ' + esc(nomeCurto(e)) + '">PDF</button></div>' +
      '<button class="ghost fechar" id="inv-fechar">Fechar ficha</button></div>';
    h += '<div class="inv-kpis">' +
      '<div class="k-cls">' + capClasse(e.classificacao) + barraPont(e.pontuacao) + "<span>Pontuação final " +
        num(e.pontuacao, 0) + ", " + esc(e.posicao) + "º lugar entre " + nEstimadas() + "</span></div>" +
      "<div><b>" + pctTxt(e.prontidao) + "</b><span>Prontidão: parcela da carteira máxima já na Estruturação" +
        (e.condicao ? ". Condição predominante da Escala: " + esc(maiusc(e.condicao)) : "") + "</span></div>" +
      "<div><b>" + esc(maiusc(e.confianca)) + "</b><span>Confiança da estimativa; informação financeira " + esc(e.info_financeira) + "</span></div>" +
      '<div class="v a"><b>' + faixa(e.bloco_a.min, e.bloco_a.max) + "</b><span>Etapa 1, Estruturação (contratável agora), em R$ milhões</span></div>" +
      '<div class="v b"><b>' + faixa(e.bloco_b.min, e.bloco_b.max) + "</b><span>Etapa 2, Escala (após a condição de cada item), em R$ milhões</span></div>" +
      '<div class="v t"><b>' + faixa((e.bloco_a.min || 0) + (e.bloco_b.min || 0), (e.bloco_a.max || 0) + (e.bloco_b.max || 0)) +
        "</b><span>Carteira total, em R$ milhões, para 36 meses</span></div></div>";

    /* Na tela: cinco colunas. Rubrica e unidade viram uma linha abaixo do
       item; o racional abre sob demanda (detalhe expansível). A tabela
       completa, com as dez colunas originais, fica oculta e é a que vai
       para o XLS e o PDF, para não perder informação na exportação. */
    function intervalo(a, b, fmt) {
      if (a == null && b == null) return "";
      if (a == null || b == null || Math.round(a) === Math.round(b)) return fmt(a == null ? b : a);
      return fmt(a) + '<span class="a"> a </span>' + fmt(b);
    }
    var inteiro = function (v) { return num(v, 0); };
    var pctf = function (v) { return pct(v); };
    var TELA = [], EXPO = [];
    f.blocos.forEach(function (bl) {
      var t = '<div class="inv-bloco ' + bl.id.toLowerCase() + '"><h5>' + esc(bl.titulo) + "</h5>" +
        (bl.descricao ? '<p class="inv-desc">' + esc(bl.descricao) + (bl.id === "B" ? ". Cada item traz a condição para ser contratado." : ".") + "</p>" : "") +
        '<table class="inv-tbl"><colgroup><col class="c-n"><col class="c-item"><col class="c-q"><col class="c-u"><col class="c-t"></colgroup>' +
        '<thead><tr><th>Nº</th><th>Item</th><th class="num">Quantidade</th>' +
        '<th class="num">Valor unitário<small>R$, mínimo a máximo</small></th>' +
        '<th class="num">Valor total<small>R$, mínimo a máximo</small></th></tr></thead><tbody>';
      var x = '<div class="inv-bloco"><h5>' + esc(bl.titulo) + '</h5><table><thead><tr><th>Nº</th><th>Item</th><th>Rubrica</th><th>Unidade</th>' +
        "<th>Racional</th><th>Qtd. mínima</th><th>Qtd. máxima</th><th>Unitário mínimo (R$)</th><th>Unitário máximo (R$)</th>" +
        "<th>Total mínimo (R$)</th><th>Total máximo (R$)</th><th>Condição para contratar</th></tr></thead><tbody>";
      bl.componentes.forEach(function (c) {
        t += '<tr class="comp"><td>' + c.n + '</td><td colspan="3">' + esc(caixaNormal(c.nome)) + "</td>" +
          '<td class="num">' + intervalo(c.min, c.max, inteiro) + "</td></tr>";
        x += "<tr><td>" + c.n + "</td><td>" + esc(c.nome) + "</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>" +
          "<td>" + inteiro(c.min) + "</td><td>" + inteiro(c.max) + "</td><td></td></tr>";
        c.itens.forEach(function (it) {
          var sub = [it.rubrica, it.unidade ? "unidade: " + it.unidade : ""].filter(Boolean).join("; ");
          t += '<tr class="item"><td class="n">' + esc(it.n) + '</td><td class="it">' + esc(it.item) +
            (sub ? '<span class="rub">' + esc(maiusc(sub)) + "</span>" : "") +
            (it.condicao ? '<span class="cond"><b>Condição para contratar:</b> ' + esc(it.condicao) + "</span>" : "") +
            (it.racional ? '<details class="rac"><summary>Racional do custo</summary><p>' + esc(it.racional) + "</p></details>" : "") +
            "</td>" +
            '<td class="num">' + intervalo(it.q_min, it.q_max, inteiro) + "</td>" +
            '<td class="num">' + intervalo(it.u_min, it.u_max, inteiro) + "</td>" +
            '<td class="num">' + intervalo(it.min, it.max, inteiro) + "</td></tr>";
          x += "<tr><td>" + esc(it.n) + "</td><td>" + esc(it.item) + "</td><td>" + esc(it.rubrica || "") + "</td><td>" +
            esc(it.unidade || "") + "</td><td>" + esc(it.racional || "") + "</td><td>" +
            (it.q_min == null ? "" : inteiro(it.q_min)) + "</td><td>" + (it.q_max == null ? "" : inteiro(it.q_max)) + "</td><td>" +
            inteiro(it.u_min) + "</td><td>" + inteiro(it.u_max) + "</td><td>" + inteiro(it.min) + "</td><td>" + inteiro(it.max) + "</td><td>" +
            esc(it.condicao || "") + "</td></tr>";
        });
      });
      bl.resumo.forEach(function (r) {
        var total = /^Total geral/.test(r.rotulo);
        var rot = String(r.rotulo);
        t += '<tr class="' + (total ? "total " + bl.id.toLowerCase() : "resumo") + '"><td></td><td>' + esc(rot) +
          (r.racional ? '<span class="rub">' + esc(r.racional) + "</span>" : "") + "</td><td></td>" +
          '<td class="num">' + (r.pct_min == null ? "" : intervalo(r.pct_min * 100, r.pct_max * 100, function (v) { return num(v, 0) + "%"; })) + "</td>" +
          '<td class="num">' + intervalo(r.min, r.max, inteiro) + "</td></tr>";
        x += "<tr><td></td><td>" + esc(rot) + "</td><td></td><td></td><td>" + esc(r.racional || "") + "</td><td></td><td></td><td>" +
          pctf(r.pct_min) + "</td><td>" + pctf(r.pct_max) + "</td><td>" + inteiro(r.min) + "</td><td>" + inteiro(r.max) + "</td><td></td></tr>";
      });
      TELA.push(t + "</tbody></table></div>");
      EXPO.push(x + "</tbody></table></div>");
    });
    h += '<div id="inv-tabelas">' + TELA.join("") + "</div>";
    h += '<div id="inv-export" hidden>' + EXPO.join("") + "</div>";
    if (f.contrapartida || f.cofinanciamento) {
      h += '<div class="inv-extra">' +
        (f.contrapartida ? "<div><b>Contrapartida identificada</b>" + esc(f.contrapartida) + "</div>" : "") +
        (f.cofinanciamento ? "<div><b>Cofinanciamento possível</b>" + esc(f.cofinanciamento) + "</div>" : "") + "</div>";
    }
    if (f.notas.length) {
      h += '<div class="inv-notas"><b>Notas</b>' + f.notas.map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") +
        '<p class="legenda">' + esc(String(f.legenda || LEGENDA_ORIGEM).replace(/produto 5 ?B/i, "relatório final")) + "</p></div>";
    }
    var inv = $("#inv"); inv.innerHTML = h; inv.classList.remove("hidden");
    inv.style.cssText = varsEixo(e.eixo_cod);
    posicionaInv();
    $("#inv-fechar").addEventListener("click", function () { fechaInvestimento(true); });
    inv.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ====================================================== 4. ANÁLISE === */
  var graficos = [];
  Chart.defaults.font.family = '"Roboto", system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = "#55555F";
  Chart.defaults.borderColor = "#ECECEF";

  var AZ_A = "#1d5fb0", AZ_B = "#a3b3c6";   /* mesma paleta do aluvial */

  /* Rótulo de valor em toda barra: dentro do segmento quando cabe, senão
     na ponta. Barras flutuantes ([mín, máx]) mostram os dois valores. */
  var rotulosBarras = {
    id: "rotulosBarras",
    afterDatasetsDraw: function (ch) {
      if (ch.config.type !== "bar") return;
      var ctx = ch.ctx, horiz = ch.options.indexAxis === "y";
      var inteiro = !!ch.options.rotuloInteiro;
      var fmt = function (v) { return num(v, inteiro ? 0 : 1); };
      ctx.save(); ctx.font = "600 10.5px Roboto, sans-serif"; ctx.textBaseline = "middle";
      ch.data.datasets.forEach(function (ds, di) {
        var meta = ch.getDatasetMeta(di); if (meta.hidden) return;
        meta.data.forEach(function (bar, i) {
          var raw = ds.data[i]; if (raw == null) return;
          var txt, v;
          if (Array.isArray(raw)) { if (!raw[1]) return; txt = fmt(raw[0]) + " – " + fmt(raw[1]); v = raw[1]; }
          else { v = Number(raw); if (!v) return; txt = fmt(v); }
          var w = ctx.measureText(txt).width;
          var claro = /^#(a3b3c6|dbe3ec|D9D9DE|6fa3dc)/i.test(String(ds.backgroundColor)) ||
            (Array.isArray(ds.backgroundColor) && /^#(a3b3c6|dbe3ec|D9D9DE)/i.test(String(ds.backgroundColor[i])));
          if (horiz) {
            var x0 = bar.base, x1 = bar.x, larg = Math.abs(x1 - x0);
            if (larg > w + 10) { ctx.fillStyle = claro ? "#1A1A1F" : "#fff"; ctx.textAlign = "right"; ctx.fillText(txt, x1 - 5, bar.y); }
            else if (di === ch.data.datasets.length - 1 || ch.data.datasets.length === 1) {
              ctx.fillStyle = "#1A1A1F"; ctx.textAlign = "left"; ctx.fillText(txt, x1 + 5, bar.y); }
          } else {
            var y0 = bar.base, y1 = bar.y, alt = Math.abs(y0 - y1);
            ctx.textAlign = "center";
            if (alt > 16 && bar.width > w + 6) { ctx.fillStyle = claro ? "#1A1A1F" : "#fff"; ctx.fillText(txt, bar.x, (y0 + y1) / 2); }
            else if (di === ch.data.datasets.length - 1 || ch.data.datasets.length === 1) {
              ctx.fillStyle = "#1A1A1F"; ctx.fillText(txt, bar.x, y1 - 8); }
          }
        });
      });
      ctx.restore();
    }
  };
  Chart.register(rotulosBarras);

  function eixoMil(v) { return num(v, 0); }

  INICIA.analise = function () {
    if (!QUADROS) {
      $("#view-analise .bloco").insertAdjacentHTML("beforebegin",
        '<div class="aviso">Não foi possível carregar as estimativas nesta sessão.</div>');
      return;
    }
    var qa = QUADROS.contratavel, qb = QUADROS.referencia, qc = QUADROS.carteira;

    if (S7fin()) situacaoFinanceira(P5.secao7);
    else $("#view-analise .bloco > h3").insertAdjacentHTML("afterend",
      '<div class="aviso">Os indicadores financeiros não estão disponíveis nesta versão dos dados.</div>');

    /* ---- faixa por bloco (barra flutuante mín–máx) ---- */
    graficos.push(new Chart($("#ch-blocos"), {
      type: "bar",
      data: {
        labels: ["Etapa 1 — Estruturação", "Etapa 2 — Escala", "Carteira total"],
        datasets: [{
          data: [[qa.total.min, qa.total.max], [qb.total.min, qb.total.max], [qc.reais.min, qc.reais.max]],
          backgroundColor: [AZ_A, AZ_B, "#24246C"], borderSkipped: false, barPercentage: 0.55
        }]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) {
          return "R$ " + num(c.raw[0]) + " a " + num(c.raw[1]) + " milhões"; } } } },
        scales: { x: { beginAtZero: true, title: { display: true, text: "R$ milhões" },
          ticks: { callback: eixoMil } }, y: { grid: { display: false } } }
      }
    }));

    /* ---- Figura 7.8: custo-base da Estruturação por componente, mín–máx ---- */
    var S7 = P5.secao7 || null;
    if (S7 && S7.f78) {
      graficos.push(new Chart($("#ch-componentes"), {
        type: "bar",
        data: {
          labels: S7.f78.map(function (c) { return c.rotulo; }),
          datasets: [{ data: S7.f78.map(function (c) { return [c.min, c.max]; }),
            backgroundColor: AZ_A, borderSkipped: false, barPercentage: 0.55 }]
        },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) {
            return "R$ " + num(c.raw[0]) + " a " + num(c.raw[1]) + " milhões"; } } } },
          scales: { x: { beginAtZero: true, title: { display: true, text: "R$ milhões (custo-base da Estruturação)" } },
            y: { grid: { display: false }, ticks: { autoSkip: false } } }
        }
      }));
    }

    /* ---- anualização ---- */
    var anos = QUADROS.anualizacao.filter(function (a) { return /^Ano \d/.test(a.ano); });
    graficos.push(new Chart($("#ch-anual"), {
      type: "bar",
      data: {
        labels: anos.map(function (a) { return a.ano; }),
        datasets: [{ data: anos.map(function (a) { return a.total; }), backgroundColor: AZ_A, barPercentage: 0.5 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) {
          return "R$ " + num(c.raw) + " milhões (" + num(anos[c.dataIndex].pct * 100, 0) + "% do total)"; } } } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "R$ milhões" } }, x: { grid: { display: false } } }
      },
      plugins: [rotuloTopo(function (i) { return num(anos[i].pct * 100, 0) + "%"; })]
    }));

    /* ---- por eixo ---- */
    var est = EXP.filter(function (e) { return e.estimada; });
    var eixos = (META.eixos || []).map(function (e) { return e.cod; });
    var somaA = {}, somaB = {};
    est.forEach(function (e) {
      somaA[e.eixo_cod] = (somaA[e.eixo_cod] || 0) + (e.bloco_a.max || 0);
      somaB[e.eixo_cod] = (somaB[e.eixo_cod] || 0) + (e.bloco_b.max || 0);
    });
    eixos.sort(function (a, b) { return ((somaA[b] || 0) + (somaB[b] || 0)) - ((somaA[a] || 0) + (somaB[a] || 0)); });
    var nomeEixo = {}; (META.eixos || []).forEach(function (e) { nomeEixo[e.cod] = e.nome; });
    graficos.push(new Chart($("#ch-eixo"), {
      type: "bar",
      data: {
        labels: eixos,
        datasets: [
          { label: "Estruturação", data: eixos.map(function (k) { return somaA[k] || 0; }), backgroundColor: AZ_A },
          { label: "Escala", data: eixos.map(function (k) { return somaB[k] || 0; }), backgroundColor: AZ_B }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } },
          tooltip: { callbacks: { title: function (c) { return nomeEixo[c[0].label] || c[0].label; },
            label: function (c) { return c.dataset.label + ": R$ " + num(c.raw) + " milhões"; } } } },
        scales: { x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: "R$ milhões (valor máximo)" } } }
      }
    }));

    /* ---- por classificação (Tabela 7.4) ---- */
    var ordem = ["alta", "estrategico"];
    var pA = {}, pB = {}, pN = {};
    est.forEach(function (e) {
      pA[e.classificacao] = (pA[e.classificacao] || 0) + (e.bloco_a.max || 0);
      pB[e.classificacao] = (pB[e.classificacao] || 0) + (e.bloco_b.max || 0);
      pN[e.classificacao] = (pN[e.classificacao] || 0) + 1;
    });
    graficos.push(new Chart($("#ch-classe"), {
      type: "bar",
      data: {
        labels: ordem.map(function (p) { return CLASSE[p] + " (" + (pN[p] || 0) + ")"; }),
        datasets: [
          { label: "Estruturação", data: ordem.map(function (p) { return pA[p] || 0; }), backgroundColor: AZ_A },
          { label: "Escala", data: ordem.map(function (p) { return pB[p] || 0; }), backgroundColor: AZ_B }
        ]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } },
          tooltip: { callbacks: { label: function (c) {
            var k = ordem[c.dataIndex], t = (pA[k] || 0) + (pB[k] || 0);
            return c.dataset.label + ": R$ " + num(c.raw) + " milhões" +
              (c.datasetIndex === 0 && t ? " (prontidão de " + num((pA[k] || 0) / t * 100, 0) + "%)" : ""); } } } },
        scales: { x: { stacked: true, beginAtZero: true, title: { display: true, text: "R$ milhões (valor máximo)" } },
          y: { stacked: true, grid: { display: false } } }
      }
    }));

    /* ---- Escala por tipo de condição para contratar (Tabela 7.5) ---- */
    var COND = (P5 && P5.condicoes) || [];
    if (COND.length) {
      graficos.push(new Chart($("#ch-condicao"), {
        type: "bar",
        data: {
          labels: COND.map(function (c) { return c.cod + " (" + c.itens + " itens)"; }),
          datasets: [{ data: COND.map(function (c) { return [c.min, c.max]; }),
            backgroundColor: AZ_B, borderSkipped: false, barPercentage: 0.55 }]
        },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: {
            title: function (c) { return COND[c[0].dataIndex].rotulo; },
            label: function (c) { var x = COND[c.dataIndex];
              return "R$ " + num(c.raw[0]) + " a " + num(c.raw[1]) + " milhões; " + x.itens + " itens em " + x.experiencias + " experiências"; } } } },
          scales: { x: { beginAtZero: true, title: { display: true, text: "R$ milhões (Escala, mínimo a máximo)" } },
            y: { grid: { display: false }, ticks: { autoSkip: false } } }
        }
      }));
    }

    /* ---- por experiência ---- */
    var ordE = est.slice().sort(function (a, b) {
      return ((b.bloco_a.max || 0) + (b.bloco_b.max || 0)) - ((a.bloco_a.max || 0) + (a.bloco_b.max || 0));
    });
    graficos.push(new Chart($("#ch-experiencias"), {
      type: "bar",
      data: {
        labels: ordE.map(function (e) { return nomeCurto(e); }),
        datasets: [
          { label: "Etapa 1 — Estruturação", data: ordE.map(function (e) { return e.bloco_a.max; }), backgroundColor: AZ_A },
          { label: "Etapa 2 — Escala", data: ordE.map(function (e) { return e.bloco_b.max; }), backgroundColor: AZ_B }
        ]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "top", align: "end", labels: { boxWidth: 12 } },
          tooltip: { callbacks: { title: function (c) { return nomeCurto(ordE[c[0].dataIndex]); },
            label: function (c) { return c.dataset.label + ": R$ " + num(c.raw) + " milhões"; } } } },
        scales: { y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 },
            callback: function (v) { var t = nomeCurto(ordE[v]); return t.length > 34 ? t.slice(0, 32) + "…" : t; } } },
          x: { stacked: true, beginAtZero: true, position: "top", title: { display: true, text: "R$ milhões (valor máximo)" } } }
      }
    }));

    montaTabelaExp(est);
  };

  function S7fin() { return !!(P5 && P5.secao7 && P5.secao7.f71); }

  /* rótulos das figuras vêm da planilha com o código do campo do formulário
     entre parênteses ("Custo operacional anual (C1)"); na tela, sem o código */
  function semCodigo(t) { return String(t == null ? "" : t).replace(/\s*\((?:[A-Z]\d{1,2}(?:\.\d+)?)\)\s*$/, ""); }

  /* barras horizontais empilhadas a partir de uma matriz {colunas, linhas} */
  function empilhada(canvas, mz, cores, eixo) {
    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: mz.linhas.map(function (l) { return semCodigo(l.rotulo); }),
        datasets: mz.colunas.map(function (c, k) {
          return { label: c, data: mz.linhas.map(function (l) { return l.valores[k]; }),
            backgroundColor: cores[k], barPercentage: 0.62 };
        })
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 11, font: { size: 10.5 } } } },
        rotuloInteiro: true,
        scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 },
            title: { display: true, text: eixo || "Número de fichas" } },
          y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false } } }
      }
    });
  }

  function simples(canvas, lista, rotEixo) {
    var l = lista.slice().sort(function (a, b) { return b.n - a.n; });
    return new Chart(canvas, {
      type: "bar",
      data: { labels: l.map(function (x) { return semCodigo(x.rotulo); }),
        datasets: [{ data: l.map(function (x) { return x.n; }), backgroundColor: AZ_A, barPercentage: 0.62 }] },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } }, rotuloInteiro: true,
        scales: { x: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: rotEixo } },
          y: { grid: { display: false }, ticks: { autoSkip: false } } }
      }
    });
  }

  function situacaoFinanceira(S) {
    var CINZA_V = "#D9D9DE";
    graficos.push(empilhada($("#ch-71"), S.f71, [AZ_A, AZ_B, CINZA_V]));
    graficos.push(empilhada($("#ch-72"), S.f72, [AZ_A, "#6fa3dc", AZ_B, CINZA_V]));
    graficos.push(empilhada($("#ch-73"), S.f73, [AZ_A, "#6fa3dc", "#F09C18", CINZA_V]));
    graficos.push(simples($("#ch-74"), S.f74, "Número de menções"));
    graficos.push(simples($("#ch-75"), S.f75, "Número de menções"));
    graficos.push(simples($("#ch-76"), S.f76, "Número de fichas"));
  }

  function rotuloTopo(fn) {
    return {
      id: "rotuloTopo",
      afterDatasetsDraw: function (ch) {
        var ctx = ch.ctx; ctx.save();
        ctx.font = "600 11px Roboto, sans-serif"; ctx.fillStyle = "#24246C"; ctx.textAlign = "center";
        ch.getDatasetMeta(0).data.forEach(function (bar, i) { ctx.fillText(fn(i), bar.x, bar.y - 6); });
        ctx.restore();
      }
    };
  }

  var ordExp = { chave: "tmax", dir: "desc" };
  var CH_EXP = {
    nome: function (e) { return e.curto; }, eixo: function (e) { return e.eixo_cod; },
    classe: function (e) { return CLASSE_ORDEM.indexOf(e.classificacao); },
    pront: function (e) { return e.prontidao; },
    conf: function (e) { return ["alta", "média", "baixa"].indexOf(e.confianca); },
    p5: function (e) { return e.pontuacao; }, itens: function (e) { return e.itens; },
    amax: function (e) { return e.bloco_a.max; }, bmax: function (e) { return e.bloco_b.max; },
    tmax: function (e) { return (e.bloco_a.max || 0) + (e.bloco_b.max || 0); }
  };

  function montaTabelaExp(est) {
    function pinta() {
      var txt = ordExp.chave === "nome" || ordExp.chave === "eixo";
      var l = ordena(est, CH_EXP[ordExp.chave], ordExp.dir, txt ? "txt" : "n");
      $$("#tbl-exp thead th[data-sort]").forEach(function (th) {
        th.classList.toggle("on", th.dataset.sort === ordExp.chave);
        th.classList.toggle("desc", th.dataset.sort === ordExp.chave && ordExp.dir === "desc");
      });
      var tA0 = 0, tA1 = 0, tB0 = 0, tB1 = 0, mxTab = 0;
      l.forEach(function (e) { mxTab = Math.max(mxTab, (e.bloco_a.max || 0) + (e.bloco_b.max || 0)); });
      mxTab = mxTab || 1;
      $("#tb-exp").innerHTML = l.map(function (e) {
        tA0 += e.bloco_a.min || 0; tA1 += e.bloco_a.max || 0; tB0 += e.bloco_b.min || 0; tB1 += e.bloco_b.max || 0;
        return "<tr>" +
          '<td class="nome">' + esc(nomeCurto(e)) + "<small>" + esc(e.municipio) + " (" + esc(e.uf) + ")</small></td>" +
          "<td>" + tagEixo(e.eixo_cod) + "</td>" +
          "<td>" + capClasse(e.classificacao, true) + "</td>" +
          '<td class="num">' + pctTxt(e.prontidao) + "</td>" +
          "<td>" + esc(maiusc(e.confianca)) + "</td>" +
          '<td class="num">' + num(e.pontuacao, 0) + "</td>" +
          '<td class="num">' + esc(e.itens) + "</td>" +
          '<td class="num">' + faixa(e.bloco_a.min, e.bloco_a.max) + "</td>" +
          '<td class="num">' + faixa(e.bloco_b.min, e.bloco_b.max) + "</td>" +
          '<td class="num"><b>' + num((e.bloco_a.max || 0) + (e.bloco_b.max || 0)) + "</b>" +
            '<span class="barra-cart mini" aria-hidden="true"><i class="a" style="width:' + ((e.bloco_a.max || 0) / mxTab * 100).toFixed(1) +
            '%"></i><i class="b" style="width:' + ((e.bloco_b.max || 0) / mxTab * 100).toFixed(1) + '%"></i></span></td>' +
          "</tr>";
      }).join("") +
      '<tr class="linha-total"><td>Total</td><td></td><td></td><td class="num">' + pctTxt(tA1 / ((tA1 + tB1) || 1)) + "</td><td></td><td></td><td></td>" +
        '<td class="num">' + faixa(tA0, tA1) + '</td><td class="num">' + faixa(tB0, tB1) + "</td>" +
        '<td class="num">' + num(tA1 + tB1) + "</td></tr>";
    }
    $$("#tbl-exp thead th[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.sort;
        if (ordExp.chave === k) ordExp.dir = ordExp.dir === "desc" ? "asc" : "desc";
        else { ordExp.chave = k; ordExp.dir = (k === "nome" || k === "eixo" || k === "classe" || k === "conf") ? "asc" : "desc"; }
        pinta();
      });
    });
    pinta();
  }

  /* ======================================================= abertura === */
  var inicial = (location.hash || "").replace("#", "");
  mostrar(document.getElementById("view-" + inicial) ? inicial : "carteira");
})();
