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
  function maiusc(t) { t = String(t == null ? "" : t); return t.charAt(0).toUpperCase() + t.slice(1); }
  function corEixo(cod) { return COR_EIXO[cod] || CINZA; }
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
  var ROTULO_POSTURA = PMETA.postura_rotulo || {};

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
      postura: e && e.postura ? e.postura : "",
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
      postura: e.postura || "",
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
    var cart = QUADROS && QUADROS.carteira;
    var blocos = [
      ["" + LINHAS.length, "iniciativas", INI.length + " da prospecção" +
        (novas ? " + " + novas + " encontradas em campo" : "") + ", sem repetição"],
      ["" + comFicha, "foram a campo", "visita técnica ou entrevista"],
      ["" + estimadas, "com estimativa de recursos", "seção 7 do relatório final"]
    ];
    if (cart && cart.reais) {
      blocos.push([
        num(cart.reais.min, 0) + " – " + num(cart.reais.max, 0),
        "R$ milhões na carteira",
        "US$ " + num(cart.dolares.min, 0) + " – " + num(cart.dolares.max, 0) + " mi · 36 meses"
      ]);
    }
    $("#carteira-numeros").innerHTML = blocos.map(function (b) {
      return "<div><b>" + esc(b[0]) + "</b><span>" + esc(b[1]) + "</span><small>" + esc(b[2]) + "</small></div>";
    }).join("");

    desenhaAluvial($("#fig-aluvial"));
    $("#aluvial-leitura").innerHTML = leituraAluvial();

    if (!P5) {
      $("#carteira-lead").insertAdjacentHTML("afterend",
        '<div class="aviso">A camada do relatório final não abriu nesta sessão. ' +
        'O ranking aparece só com a nota da matriz.</div>');
    }
    montaRanking();
  };


  /* ---- aluvial da trajetória do valor (Figura 7.10), desenhado em SVG a
     partir de P5.fluxos. Mesmo desenho da figura do relatório: fitas do
     Bloco A em azul firme, do Bloco B em cinza-azulado; ordem das colunas
     por tamanho e, a partir da terceira, pelo baricentro da anterior. ---- */
  var NOMES_ALU = [
    { A: ["Bloco A — contratável", "nesta etapa"], B: ["Bloco B — referência", "indicativa"] },
    { NIVA: ["Infraestrutura Verde-Azul", "e Adaptação Climática"], ADT: ["Adensamento Tecnológico"],
      EC: ["Economia Circular", "e Solidária"], TE: ["Transição Energética"],
      FSI: ["Finanças Sustentáveis", "e Inclusivas"], BIO: ["Bioeconomia e Sistemas", "Agroalimentares"] },
    { "pronta": ["Pronta para", "receber apoio"], "pronta c/ dado": ["Pronta, com um", "dado a completar"],
      "dimensionar": ["Precisa dimensionar", "o investimento"], "fortalecer": ["Precisa se", "fortalecer"],
      "preparatório": ["Etapa", "preparatória"] },
    { C0: ["Estudo de", "dimensionamento"], C1: ["Estruturação", "institucional"],
      C2: ["Investimento em", "ativos e fundos"], C3: ["Assistência técnica", "e capacidades"],
      C4: ["Monitoramento", "e avaliação"] }
  ];
  var CAB_ALU = ["ORIGEM DO VALOR", "EIXO DO PTE-NE", "POSTURA DE APOIO", "COMPONENTE DO APOIO"];

  function desenhaAluvial(alvo) {
    var F = (P5 && P5.fluxos) || [];
    if (!F.length) { alvo.innerHTML = '<p class="vazio">Sem dados de fluxo nesta sessão.</p>'; return; }
    var KEYS = ["bloco", "eixo", "postura", "comp"], ST = 4;
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
    /* geometria: coordenadas em "valor" no eixo y, convertidas no fim */
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

    var W = 1100, TOPO = 46, ALT = 600, BASE = 14, NW = 14;
    var X = [150, 440, 700, 930];
    var ky = ALT / Hmax;
    function Y(v) { return TOPO + v * ky; }
    var COR = { A: "#2a78d6", B: "#dbe3ec" }, ALF = { A: 0.62, B: 0.92 };
    var NO0 = { A: "#1d5fb0", B: "#a3b3c6" }, NO = "#2e4a6e";

    function fita(x0, a0, b0, x1, a1, b1) {
      /* curva com trecho reto inicial (lead) e final (tail), como na figura */
      var xa = x0 + NW, xb = x1, dx = xb - xa;
      var p = xa + dx * 0.30, q = xb - dx * 0.14, m1 = p + (q - p) * 0.5;
      return "M" + xa + "," + Y(a0) + " L" + p + "," + Y(a0) +
        " C" + m1 + "," + Y(a0) + " " + m1 + "," + Y(a1) + " " + q + "," + Y(a1) +
        " L" + xb + "," + Y(a1) + " L" + xb + "," + Y(b1) + " L" + q + "," + Y(b1) +
        " C" + m1 + "," + Y(b1) + " " + m1 + "," + Y(b0) + " " + p + "," + Y(b0) +
        " L" + xa + "," + Y(b0) + " Z";
    }

    var svg = [];
    svg.push('<line x1="10" x2="' + (W - 10) + '" y1="' + (TOPO - 12) + '" y2="' + (TOPO - 12) +
      '" stroke="#D9D9DE" stroke-width="1"/>');
    CAB_ALU.forEach(function (t, i) {
      var x = i === 0 ? 10 : (i === ST - 1 ? W - 10 : X[i] + NW + 8);
      var anc = i === 0 ? "start" : (i === ST - 1 ? "end" : "start");
      svg.push('<text x="' + x + '" y="' + (TOPO - 20) + '" font-size="11" letter-spacing=".06em" fill="#55555F" text-anchor="' +
        anc + '">' + t + "</text>");
    });

    /* fitas: pilha por origem (saída) e por destino (entrada), separadas por bloco */
    for (st = 0; st < ST - 1; st++) {
      var agg = {};
      F.forEach(function (f) {
        var k = f.bloco + "|" + f[KEYS[st]] + "|" + f[KEYS[st + 1]];
        agg[k] = (agg[k] || 0) + f.valor;
      });
      var out = {}, seg = {};
      ORD[st].forEach(function (s_) { out[s_] = P[st][s_][0]; });
      ORD[st].forEach(function (s_) {
        ORD[st + 1].forEach(function (d_) {
          ["A", "B"].forEach(function (bl) {
            var v = agg[bl + "|" + s_ + "|" + d_] || 0;
            if (v > 0) { seg[bl + "|" + s_ + "|" + d_] = [out[s_], out[s_] + v]; out[s_] += v; }
          });
        });
      });
      var inn = {};
      ORD[st + 1].forEach(function (d_) { inn[d_] = P[st + 1][d_][0]; });
      ORD[st + 1].forEach(function (d_) {
        ORD[st].forEach(function (s_) {
          ["A", "B"].forEach(function (bl) {
            var k = bl + "|" + s_ + "|" + d_, v = agg[k] || 0;
            if (v <= 0) return;
            var sg = seg[k];
            svg.push('<path d="' + fita(X[st], sg[0], sg[1], X[st + 1], inn[d_], inn[d_] + v) +
              '" fill="' + COR[bl] + '" fill-opacity="' + ALF[bl] + '"><title>' +
              esc((bl === "A" ? "Bloco A" : "Bloco B") + ": R$ " + num(v) + " mi") + "</title></path>");
            inn[d_] += v;
          });
        });
      });
    }

    /* nós e rótulos, com anti-colisão vertical */
    var LH = 14, fundo = 0;
    for (st = 0; st < ST; st++) {
      var ult = -1e9;
      ORD[st].forEach(function (k) {
        var a = P[st][k][0], b = P[st][k][1];
        svg.push('<rect x="' + X[st] + '" y="' + Y(a) + '" width="' + NW + '" height="' + Math.max(1, Y(b) - Y(a)) +
          '" fill="' + (st === 0 ? NO0[k] : NO) + '"/>');
        var nome = (NOMES_ALU[st][k] || [k]), esq = st === 0;
        var xt = esq ? X[st] - 8 : X[st] + NW + 8, anc = esq ? "end" : "start";
        var yt = Math.max(Y(a) + 11, ult + 15);   /* 15 = altura de maiúscula + respiro */
        nome.forEach(function (ln, i) {
          svg.push('<text x="' + xt + '" y="' + (yt + i * LH) + '" font-size="' + (esq ? 13 : 12) +
            '" font-weight="700" fill="#1A1A1F" text-anchor="' + anc + '">' + esc(ln) + "</text>");
        });
        svg.push('<text x="' + xt + '" y="' + (yt + nome.length * LH) + '" font-size="11.5" fill="#55555F" text-anchor="' +
          anc + '">R$ ' + num(b - a) + " milhões</text>");
        ult = yt + nome.length * LH + 4;
        if (ult > fundo) fundo = ult;
      });
    }

    var altura = Math.max(TOPO + ALT + BASE, fundo + 8);
    alvo.innerHTML = '<svg id="svg-aluvial" viewBox="0 0 ' + W + " " + altura +
      '" width="100%" role="img" aria-label="Trajetória do valor da carteira, do bloco ao componente" ' +
      'style="font-family:Roboto,system-ui,sans-serif;background:#fff">' + svg.join("") + "</svg>";
  }

  /* parágrafo de leitura do aluvial, calculado dos mesmos fluxos que o desenham */
  var FRASE_POSTURA = { "pronta": "prontas para receber apoio", "pronta c/ dado": "prontas, com um dado a confirmar",
    "dimensionar": "que precisam dimensionar o investimento", "fortalecer": "que precisam se fortalecer institucionalmente",
    "preparatório": "em etapa preparatória" };
  function leituraAluvial() {
    var F = (P5 && P5.fluxos) || [];
    if (!F.length) return "";
    function soma(chave, val) { return F.reduce(function (a, f) { return a + (val == null || f[chave] === val ? f.valor : 0); }, 0); }
    function maior(chave) {
      var t = {}; F.forEach(function (f) { t[f[chave]] = (t[f[chave]] || 0) + f.valor; });
      return Object.keys(t).sort(function (a, b) { return t[b] - t[a]; }).map(function (k) { return { k: k, v: t[k] }; });
    }
    var tot = soma(), A = soma("bloco", "A"), B = soma("bloco", "B");
    var eixos = maior("eixo"), post = maior("postura"), comps = maior("comp");
    var nomeEixo = {}; (META.eixos || []).forEach(function (e) { nomeEixo[e.cod] = e.nome; });
    var nomeComp = {}; (PMETA.componentes || []).forEach(function (c) { nomeComp[c.cod] = c.nome.toLowerCase(); });
    var prontaA = F.reduce(function (a, f) { return a + (f.postura === "pronta" && f.bloco === "A" ? f.valor : 0); }, 0);
    var prontaB = F.reduce(function (a, f) { return a + (f.postura === "pronta" && f.bloco === "B" ? f.valor : 0); }, 0);
    var p = function (v) { return num(v / tot * 100, 0) + "%"; };
    return "No valor máximo, a carteira soma <b>R$ " + num(tot, 1) + " milhões</b>. O Bloco A, contratável nesta etapa, " +
      "responde por " + p(A) + " (R$ " + num(A, 1) + " milhões); o Bloco B, de referência indicativa, pelos outros " + p(B) + ". " +
      "<b>" + esc(nomeEixo[eixos[0].k] || eixos[0].k) + "</b> concentra " + p(eixos[0].v) + " do total, seguido de " +
      esc(nomeEixo[eixos[1].k] || eixos[1].k) + " (" + p(eixos[1].v) + "). " +
      "Pela postura, a maior parte do valor está em organizações <b>" + esc(FRASE_POSTURA[post[0].k] || post[0].k) +
      "</b> (" + p(post[0].v) + ") ou " + esc(FRASE_POSTURA[post[1].k] || post[1].k) + " (" + p(post[1].v) +
      "); as prontas para receber apoio somam " +
      "R$ " + num(prontaA + prontaB, 1) + " milhões" + (prontaB < 0.05 ? ", todos no Bloco A" : "") + ". " +
      "É por isso que o apoio se concentra em <b>" + esc(nomeComp[comps[0].k] || comps[0].k) + "</b> (" + p(comps[0].v) + ") e " +
      esc(nomeComp[comps[1].k] || comps[1].k) + " (" + p(comps[1].v) + "), e não em estudos ou estruturação.";
  }

  /* ---- filtros do ranking ---- */
  var fEstado = { busca: "", eixo: "", uf: "", bioma: "", nat: "", campo: false };
  var ordRank = { chave: "matriz", dir: "desc" };
  var marcadas = [];

  function montaRanking() {
    preencheSelect($("#f-eixo"), (META.eixos || []).map(function (e) { return { v: e.cod, t: e.nome }; }));
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
    $("#f-campo").addEventListener("change", function (e) { fEstado.campo = e.target.checked; pintaRanking(); });
    $("#f-reset").addEventListener("click", function () {
      fEstado = { busca: "", eixo: "", uf: "", bioma: "", nat: "", campo: false };
      $("#f-busca").value = ""; $("#f-eixo").value = ""; $("#f-uf").value = "";
      $("#f-bioma").value = ""; $("#f-nat").value = ""; $("#f-campo").checked = false;
      pintaRanking();
    });

    $$("#tbl-ranking thead th[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.sort;
        if (ordRank.chave === k) ordRank.dir = ordRank.dir === "desc" ? "asc" : "desc";
        else { ordRank.chave = k; ordRank.dir = (k === "nome" || k === "municipio" || k === "uf" ||
          k === "eixo" || k === "natureza" || k === "postura" || k === "campo") ? "asc" : "desc"; }
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
    eixo: ["eixo", "txt"], natureza: ["natureza", "txt"], postura: ["postura", "txt"],
    campo: ["campo", "txt"], matriz: ["matriz", "n"], p5: ["p5", "n"],
    blocoa: ["amax", "n"], blocob: ["bmax", "n"]
  };

  /* UF: até duas siglas por extenso; acima disso, a primeira + contagem,
     com a lista completa no title e no arquivo exportado (data-exp). */
  var POSTURA_CURTA = { "pronta": "Pronta", "pronta c/ dado": "Pronta, dado a confirmar",
    "dimensionar": "Dimensionar", "fortalecer": "Fortalecer", "preparatório": "Preparatória" };

  /* Município e UF numa célula só: acima de duas UFs, a primeira + contagem,
     com a lista completa no title e no arquivo exportado. */
  function localCelula(l) {
    var us = ufsDe(l.uf), uf;
    if (!us.length) uf = esc(l.uf || "");
    else if (us.length <= 2) uf = esc(us.join(", "));
    else uf = esc(us[0]) + ' <span class="vazio">+' + (us.length - 1) + "</span>";
    var cheio = (l.municipio ? l.municipio + " · " : "") + (us.length ? us.join(", ") : (l.uf || ""));
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
          (l.criterios ? "" : " disabled title=\"sem perfil nos dez critérios\"") + " /></td>" +
        '<td class="nome">' + esc(l.nome) + (l.org ? "<small>" + esc(l.org) + "</small>" : "") + "</td>" +
        localCelula(l) +
        "<td>" + (l.eixo ? '<span class="tag tag-eixo" style="background:' + corEixo(l.eixo) + '">' +
          esc(l.eixo) + "</span>" : '<span class="vazio">—</span>') + "</td>" +
        '<td class="nat" title="' + esc(l.natureza) + '">' + esc(l.natureza || "—") + "</td>" +
        '<td class="num">' + (l.matriz == null ? '<span class="vazio">—</span>' : num(l.matriz, 0)) + "</td>" +
        "<td>" + (l.campo ? '<span class="tag pill-campo">' + esc(l.campo) + "</span>" : "") + "</td>" +
        '<td class="num">' + (l.p5 == null ? '<span class="vazio">—</span>' : num(l.p5, 0)) + "</td>" +
        '<td title="' + esc(l.postura ? (ROTULO_POSTURA[l.postura] || l.postura) : "") + '">' +
          esc(l.postura ? (POSTURA_CURTA[l.postura] || l.postura) : "—") + "</td>" +
        '<td class="num">' + faixa(l.amin, l.amax) + "</td>" +
        '<td class="num">' + faixa(l.bmin, l.bmax) + "</td>" +
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
        esc(l.nome) + '<button data-id="' + esc(l.id) + '" title="remover">&times;</button></span>';
    }).join("");
    $$("#cmp-chips button").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = marcadas.indexOf(b.dataset.id);
        if (i >= 0) marcadas.splice(i, 1);
        pintaRanking(); pintaComparacao();
      });
    });

    var rotulos = CRIT.map(function (c) { return c.label; });
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
        layout: { padding: 8 },
        scales: { r: { min: 0, max: 3, ticks: { stepSize: 1, backdropColor: "transparent", font: { size: 10 } },
          pointLabels: { font: { size: 10.5 }, padding: 6, callback: quebraRotulo },
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
  var mapa = null, camadaPontos = null, camadaRotas = null;

  INICIA.mapa = function () {
    preencheSelect($("#m-eixo"), (META.eixos || []).map(function (e) { return { v: e.cod, t: e.nome }; }));
    var ufs = {};
    LINHAS.forEach(function (l) { ufsDe(l.uf).forEach(function (u) { ufs[u] = 1; }); });
    preencheSelect($("#m-uf"), Object.keys(ufs).sort());

    /* zoom inteiro: em zoom fracionário os ladrilhos são escalados e aparecem
       emendas brancas entre eles */
    mapa = L.map("map-geral", { scrollWheelZoom: true });
    mapa.fitBounds([[-18.3, -48.6], [-1.2, -34.8]], { padding: [4, 4] });   /* os nove estados */
    if (window.PTE_MAP && PTE_MAP.setup) PTE_MAP.setup(mapa, { base: "Cinza claro", noAirports: true });
    else L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { attribution: "&copy; OpenStreetMap, &copy; CARTO", maxZoom: 19 }).addTo(mapa);
    legendaMapa().addTo(mapa);

    camadaRotas = L.layerGroup().addTo(mapa);
    camadaPontos = L.layerGroup().addTo(mapa);

    ["#m-eixo", "#m-uf"].forEach(function (s) { $(s).addEventListener("change", pintaMapa); });
    $("#m-rotas").addEventListener("change", pintaMapa);
    $("#m-so-campo").addEventListener("change", pintaMapa);
    pintaMapa();
  };
  RETOMA.mapa = function () { if (mapa) setTimeout(function () { mapa.invalidateSize(); }, 60); };

  var NOME_CURTO_EIXO = { FSI: "Finanças Sustentáveis", ADT: "Adensamento Tecnológico",
    BIO: "Bioeconomia", TE: "Transição Energética", EC: "Economia Circular", NIVA: "Infraestrutura Verde-Azul" };

  function legendaMapa() {
    var ctl = L.control({ position: "bottomright" });
    ctl.onAdd = function () {
      var d = L.DomUtil.create("div", "pte-legend");
      d.style.fontSize = ".72rem"; d.style.lineHeight = "1.6";
      var h = '<div style="font-weight:700;font-size:.68rem;text-transform:uppercase;letter-spacing:.07em;color:#55555F">Eixo</div>' +
        (META.eixos || []).map(function (e) {
          return '<div title="' + esc(e.nome) + '"><i style="background:' + corEixo(e.cod) + '"></i>' +
            esc(e.cod) + " · " + esc(NOME_CURTO_EIXO[e.cod] || e.nome) + "</div>";
        }).join("") +
        '<div style="font-weight:700;font-size:.68rem;text-transform:uppercase;letter-spacing:.07em;color:#55555F;margin-top:6px">Campo</div>' +
        '<div><i style="background:#fff;border:2px solid #1A1A1F;box-sizing:border-box"></i>visita ou entrevista</div>' +
        '<div style="color:#8A8A94">linhas: trechos presenciais, por equipe</div>';
      if (ROTAS.length) h += ROTAS.map(function (r) {
        return '<div><i style="border-radius:0;height:0;border-top:2.5px dashed ' +
          (COR_ROTA[r.id] || CINZA) + ';width:16px"></i>' + esc(r.nome) + " · " + esc(r.uf) + "</div>";
      }).join("");
      d.innerHTML = h;
      L.DomEvent.disableClickPropagation(d);
      return d;
    };
    return ctl;
  }

  function raio(l) {
    var base = l.matriz == null ? 18 : Number(l.matriz);
    return 4 + (base - 14) * 0.55;
  }

  function pintaMapa() {
    var eixo = $("#m-eixo").value, uf = $("#m-uf").value;
    var soCampo = $("#m-so-campo").checked;
    camadaPontos.clearLayers(); camadaRotas.clearLayers();

    var vis = LINHAS.filter(function (l) {
      if (l.lat == null || l.lon == null) return false;
      if (soCampo && !l.exp) return false;
      if (eixo && l.eixo !== eixo) return false;
      if (uf && ufsDe(l.uf).indexOf(uf) < 0) return false;
      return true;
    });

    vis.forEach(function (l) {
      var m = L.circleMarker([l.lat, l.lon], {
        radius: raio(l), color: l.exp ? "#1A1A1F" : corEixo(l.eixo),
        weight: l.exp ? 2 : 1, fillColor: corEixo(l.eixo),
        fillOpacity: l.exp ? 0.92 : 0.5
      });
      m.bindTooltip(l.nome, { direction: "top" });
      m.on("click", function () { fichaLateral(l); });
      camadaPontos.addLayer(m);
    });

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
        }).bindTooltip((r.nome || "") + " · " + (l[0].equipe || "") + " · " + l[0].data + " a " + l[l.length - 1].data));
      });
    }
    $("#m-cnt").textContent = vis.length + " iniciativas no mapa";
  }

  function fichaLateral(l) {
    var e = l.exp;
    var h = "<h4>" + esc(l.nome) + "</h4>" +
      '<p class="loc" style="font-size:.79rem;color:#8A8A94;margin:2px 0 10px">' +
      esc([l.municipio, l.uf].filter(Boolean).join(" · ")) + "</p>";
    if (l.eixo) h += '<span class="tag tag-eixo" style="background:' + corEixo(l.eixo) + '">' +
      esc(l.eixo_nome || l.eixo) + "</span>";
    h += "<dl>";
    if (l.org) h += "<dt>Organização</dt><dd>" + esc(l.org) + "</dd>";
    if (l.natureza) h += "<dt>Natureza jurídica</dt><dd>" + esc(l.natureza) + "</dd>";
    if (l.matriz != null) h += "<dt>Nota da matriz</dt><dd>" + num(l.matriz, 0) + " de 30</dd>";
    if (e) {
      h += "<dt>Coleta em campo</dt><dd>" + esc(e.coleta) + " · " + esc(e.data) +
        " · " + esc(e.rota_nome) + "</dd>";
      if (e.pontuacao != null) h += "<dt>Pontuação final</dt><dd>" + num(e.pontuacao, 0) + " de 100</dd>";
      if (e.postura) h += "<dt>Postura de apoio</dt><dd>" + esc(ROTULO_POSTURA[e.postura] || e.postura) + "</dd>";
      if (e.estimada) {
        h += "<dt>Bloco A — contratável</dt><dd>R$ " + faixa(e.bloco_a.min, e.bloco_a.max) + " mi</dd>";
        h += "<dt>Bloco B — referência</dt><dd>R$ " + faixa(e.bloco_b.min, e.bloco_b.max) + " mi</dd>";
      } else {
        h += "<dt>Estimativa</dt><dd>Sem estimativa nesta etapa</dd>";
      }
    }
    h += "</dl>";
    if (l.ini && l.ini.resumo) h += '<p style="font-size:.83rem;color:#55555F;margin-top:14px">' +
      esc(l.ini.resumo) + "</p>";
    $("#map-side").innerHTML = h;
  }

  /* ================================================ 3. EXPERIÊNCIAS === */
  var rotaAtiva = "todas";

  INICIA.experiencias = function () {
    if (!EXP.length) {
      $("#fichas").innerHTML = '<div class="aviso">A camada do relatório final não abriu nesta sessão.</div>';
      return;
    }
    var nEst = EXP.filter(function (e) { return e.estimada; }).length;
    var nVirt = EXP.filter(function (e) { return e.coleta === "Virtual"; }).length;
    $("#exp-lead").textContent = EXP.length + " organizações foram visitadas ou entrevistadas em " +
      ROTAS.length + " rotas (" + (EXP.length - nVirt) + " presencialmente e " + nVirt +
      " por entrevista virtual). " + nEst + " têm estimativa de recursos; as demais não foram " +
      "recomendadas para apoio nesta etapa.";

    var botoes = [{ id: "todas", nome: "Todas as rotas", cor: CINZA, n: EXP.length }].concat(
      ROTAS.map(function (r) {
        return { id: r.id, nome: r.nome + " · " + r.uf, cor: COR_ROTA[r.id] || CINZA,
          n: EXP.filter(function (e) { return e.rota === r.id; }).length };
      }));
    $("#rotas-nav").innerHTML = botoes.map(function (b) {
      return '<button data-rota="' + b.id + '" style="border-left-color:' + b.cor + '"' +
        (b.id === rotaAtiva ? ' class="active"' : "") + ">" + esc(b.nome) +
        ' <span style="color:#8A8A94">(' + b.n + ")</span></button>";
    }).join("");
    $$("#rotas-nav button").forEach(function (b) {
      b.addEventListener("click", function () {
        rotaAtiva = b.dataset.rota;
        $$("#rotas-nav button").forEach(function (x) { x.classList.toggle("active", x === b); });
        pintaFichas();
      });
    });
    pintaFichas();
  };

  function pintaFichas() {
    var r = ROTAS.filter(function (x) { return x.id === rotaAtiva; })[0];
    $("#rota-info").innerHTML = r
      ? "<b>" + esc(r.nome) + "</b> · " + esc(r.uf) + " · " + esc(r.periodo) + " · equipe: " + esc(r.equipe)
      : "Todas as rotas, na ordem em que foram percorridas.";

    var lista = EXP.filter(function (e) { return rotaAtiva === "todas" || e.rota === rotaAtiva; });
    $("#fichas").innerHTML = lista.map(function (e) {
      var cor = corEixo(e.eixo_cod);
      var h = '<article class="ficha' + (e.estimada ? "" : " sem-est") + '" style="border-top-color:' + cor + '">' +
        "<h4>" + esc(e.nome) + "</h4>" +
        '<p class="loc">' + esc(e.municipio) + " · " + esc(e.uf) + " · " + esc(e.data) +
          (e.equipe ? " · " + esc(e.equipe) : "") + "</p>" +
        '<div class="tags">' +
          (e.eixo_cod ? '<span class="tag tag-eixo" style="background:' + cor + '">' + esc(e.eixo_cod) + "</span>" : "") +
          '<span class="tag pill-rota">' + esc(e.rota_nome) + "</span>" +
          '<span class="tag tag-out">' + esc(e.coleta) + "</span>" +
          (e.nova_em_campo ? '<span class="tag tag-out" title="não constava da base de prospecção">nova em campo</span>' : "") +
        "</div>";
      if (e.estimada) {
        h += "<dl>" +
          "<dt>Postura de apoio</dt><dd>" + esc(ROTULO_POSTURA[e.postura] || e.postura) + "</dd>" +
          "<dt>Pontuação final</dt><dd>" + num(e.pontuacao, 0) + " · " + esc(e.posicao) + "º de 27</dd>" +
          "<dt>Informação financeira</dt><dd>" + esc(maiusc(e.info_financeira)) + "</dd>" +
          "<dt>Confiança da estimativa</dt><dd>" + esc(maiusc(e.confianca)) + "</dd>" +
          "<dt>Itens estimados</dt><dd>" + esc(e.itens) + "</dd>" +
          (e.gabinete != null ? "<dt>Nota da matriz</dt><dd>" + num(e.gabinete, 0) + " de 30</dd>" : "") +
          "</dl>" +
          '<div class="faixa"><dl>' +
            "<dt>Bloco A — contratável</dt><dd><b>" + faixa(e.bloco_a.min, e.bloco_a.max) + "</b></dd>" +
            "<dt>Bloco B — referência</dt><dd>" + faixa(e.bloco_b.min, e.bloco_b.max) + "</dd>" +
            "<dt>Carteira (A + B)</dt><dd>" + faixa((e.bloco_a.min || 0) + (e.bloco_b.min || 0),
              (e.bloco_a.max || 0) + (e.bloco_b.max || 0)) + "</dd>" +
          '</dl><p style="margin:6px 0 0;font-size:.72rem;color:#8A8A94">R$ milhões, 36 meses</p></div>';
        if (e.ficha_inv) {
          h += '<button class="abrir" data-aba="' + esc(e.aba) + '">Ver ficha de investimento</button>';
        }
      } else {
        h += '<div class="faixa">Sem estimativa de recursos: não recomendada para apoio nesta etapa ' +
          "(ver Evidência de campo, abaixo).</div>";
      }
      return h + "</article>";
    }).join("");
    $$("#fichas .abrir").forEach(function (b) {
      b.addEventListener("click", function () { abreInvestimento(b.dataset.aba); });
    });
    if (invAberta && !lista.some(function (e) { return e.aba === invAberta; })) fechaInvestimento();
    else if (invAberta) marcaAberta();
  }

  /* ---- ficha de investimento: a aba da planilha, no estilo de uma ficha
     de carteira. Só existe quando os itens vieram no pacote cifrado. ---- */
  var invAberta = null;
  function reais(v) {
    if (v == null) return "—";
    if (Math.abs(v) >= 1e6) return num(v / 1e6, 2) + " mi";
    return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
  function pct(v) { return v == null ? "" : num(v * 100, 0) + "%"; }
  function marcaAberta() {
    $$("#fichas .ficha").forEach(function (f) {
      var b = f.querySelector(".abrir");
      f.classList.toggle("aberta", !!(b && b.dataset.aba === invAberta));
    });
  }
  function fechaInvestimento() {
    invAberta = null; $("#inv").classList.add("hidden"); $("#inv").innerHTML = ""; marcaAberta();
  }
  function abreInvestimento(aba) {
    var e = EXP.filter(function (x) { return x.aba === aba; })[0];
    if (!e || !e.ficha_inv) return;
    if (invAberta === aba) { fechaInvestimento(); return; }
    invAberta = aba; marcaAberta();
    var f = e.ficha_inv, cor = corEixo(e.eixo_cod);
    var slug = String(e.curto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    var h = '<div class="inv-head"><div><h4>' + esc(e.curto) + "</h4>" +
      '<p class="meta">' + esc(e.municipio) + " · " + esc(e.uf) + " · " + esc(e.rota_nome) + " · " + esc(e.data) +
      ' · <span class="tag tag-eixo" style="background:' + cor + '">' + esc(e.eixo_cod) + "</span></p></div>" +
      '<div class="exp-bar" style="margin:0"><span class="exp-lab">Exportar:</span>' +
      '<button class="exp-btn" data-exp="xlsx" data-target="#inv-tabelas" data-name="ficha-' + slug +
        '" data-title="Ficha de investimento — ' + esc(e.curto) + '" data-sheet="Ficha">XLS</button>' +
      '<button class="exp-btn" data-exp="pdf" data-target="#inv-tabelas" data-name="ficha-' + slug +
        '" data-title="Ficha de investimento — ' + esc(e.curto) + '">PDF</button></div>' +
      '<button class="ghost fechar" id="inv-fechar">Fechar</button></div>';
    h += '<div class="inv-kpis">' +
      "<div><b>" + esc(ROTULO_POSTURA[e.postura] || e.postura) + "</b><span>postura de apoio</span></div>" +
      "<div><b>" + num(e.pontuacao, 0) + "</b><span>pontuação final · " + esc(e.posicao) + "º de 27</span></div>" +
      "<div><b>" + esc(maiusc(e.confianca)) + "</b><span>confiança · informação " + esc(e.info_financeira) + "</span></div>" +
      "<div><b>" + faixa(e.bloco_a.min, e.bloco_a.max) + "</b><span>Bloco A — contratável, R$ mi</span></div>" +
      "<div><b>" + faixa(e.bloco_b.min, e.bloco_b.max) + "</b><span>Bloco B — referência, R$ mi</span></div>" +
      "<div><b>" + faixa((e.bloco_a.min || 0) + (e.bloco_b.min || 0), (e.bloco_a.max || 0) + (e.bloco_b.max || 0)) +
        "</b><span>carteira A + B, R$ mi · 36 meses</span></div></div>";
    h += '<div id="inv-tabelas">';
    f.blocos.forEach(function (bl) {
      h += '<div class="inv-bloco ' + bl.id.toLowerCase() + '"><h5>' + esc(bl.titulo) + "</h5>" +
        '<div class="tbl-scroll" style="max-height:none"><table class="inv-tbl"><colgroup>' +
        '<col style="width:44px"><col style="width:34%"><col style="width:16%"><col style="width:8%">' +
        '<col style="width:7%"><col style="width:7%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:9%">' +
        "</colgroup><thead><tr><th>Nº</th><th>Item</th><th>Rubrica</th><th>Unidade</th>" +
        '<th class="num">Qtd. mín.</th><th class="num">Qtd. máx.</th><th class="num">Unit. mín. (R$)</th><th class="num">Unit. máx. (R$)</th>' +
        '<th class="num">Total mín. (R$)</th><th class="num">Total máx. (R$)</th></tr></thead><tbody>';
      bl.componentes.forEach(function (c) {
        h += '<tr class="comp"><td>' + c.n + "</td><td>" + esc(c.nome) + "</td><td></td><td></td><td></td><td></td><td></td><td></td>" +
          '<td class="num">' + reais(c.min) + '</td><td class="num">' + reais(c.max) + "</td></tr>";
        c.itens.forEach(function (it) {
          h += '<tr class="item"><td class="n">' + esc(it.n) + '</td><td class="it">' + esc(it.item) +
            (it.racional ? "<small>" + esc(it.racional) + "</small>" : "") + "</td>" +
            "<td>" + esc(it.rubrica || "") + "</td><td>" + esc(it.unidade || "") + "</td>" +
            '<td class="num">' + (it.q_min == null ? "" : num(it.q_min, 0)) + '</td><td class="num">' + (it.q_max == null ? "" : num(it.q_max, 0)) + "</td>" +
            '<td class="num">' + reais(it.u_min) + '</td><td class="num">' + reais(it.u_max) + "</td>" +
            '<td class="num">' + reais(it.min) + '</td><td class="num">' + reais(it.max) + "</td></tr>";
        });
      });
      bl.resumo.forEach(function (r) {
        var total = /^TOTAL GERAL/.test(r.rotulo);
        h += '<tr class="' + (total ? "total " + bl.id.toLowerCase() : "resumo") + '"><td></td><td>' + esc(r.rotulo) +
          "</td><td>" + esc(r.racional || "") + "</td><td></td>" +
          '<td class="num"></td><td class="num"></td><td class="num">' + pct(r.pct_min) + '</td><td class="num">' + pct(r.pct_max) + "</td>" +
          '<td class="num">' + reais(r.min) + '</td><td class="num">' + reais(r.max) + "</td></tr>";
      });
      h += "</tbody></table></div></div>";
    });
    h += "</div>";
    if (f.contrapartida || f.cofinanciamento) {
      h += '<div class="inv-extra">' +
        (f.contrapartida ? "<div><b>Contrapartida identificada</b>" + esc(f.contrapartida) + "</div>" : "") +
        (f.cofinanciamento ? "<div><b>Cofinanciamento possível</b>" + esc(f.cofinanciamento) + "</div>" : "") + "</div>";
    }
    if (f.notas.length) h += '<div class="inv-notas">' + f.notas.map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div>";
    var inv = $("#inv"); inv.innerHTML = h; inv.classList.remove("hidden");
    $("#inv-fechar").addEventListener("click", fechaInvestimento);
    inv.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ====================================================== 4. ANÁLISE === */
  var graficos = [];
  Chart.defaults.font.family = '"Roboto", system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = "#55555F";
  Chart.defaults.borderColor = "#ECECEF";

  var AZ_A = "#1d5fb0", AZ_B = "#a3b3c6";   /* mesma paleta da Figura 7.10 */

  function eixoMil(v) { return num(v, 0); }

  INICIA.analise = function () {
    if (!QUADROS) {
      $("#view-analise .bloco").insertAdjacentHTML("beforebegin",
        '<div class="aviso">A camada do relatório final não abriu nesta sessão.</div>');
      return;
    }
    var qa = QUADROS.contratavel, qb = QUADROS.referencia, qc = QUADROS.carteira;

    if (S7fin()) situacaoFinanceira(P5.secao7);
    else $("#view-analise .bloco > h3").insertAdjacentHTML("afterend",
      '<div class="aviso">Os indicadores da seção 7.1 não vieram nesta versão dos dados.</div>');

    /* ---- faixa por bloco (barra flutuante mín–máx) ---- */
    graficos.push(new Chart($("#ch-blocos"), {
      type: "bar",
      data: {
        labels: ["Bloco A — contratável", "Bloco B — referência", "Carteira (A + B)"],
        datasets: [{
          data: [[qa.total.min, qa.total.max], [qb.total.min, qb.total.max], [qc.reais.min, qc.reais.max]],
          backgroundColor: [AZ_A, AZ_B, "#24246C"], borderSkipped: false, barPercentage: 0.55
        }]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) {
          return "R$ " + num(c.raw[0]) + " a " + num(c.raw[1]) + " mi"; } } } },
        scales: { x: { beginAtZero: true, title: { display: true, text: "R$ milhões" },
          ticks: { callback: eixoMil } }, y: { grid: { display: false } } }
      }
    }));

    /* ---- Figura 7.8: custo-base contratável por componente, mín–máx ---- */
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
            return "R$ " + num(c.raw[0]) + " a " + num(c.raw[1]) + " mi"; } } } },
          scales: { x: { beginAtZero: true, title: { display: true, text: "R$ milhões (custo-base, Bloco A)" } },
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
          return "R$ " + num(c.raw) + " mi · " + num(anos[c.dataIndex].pct * 100, 0) + "%"; } } } },
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
          { label: "Bloco A", data: eixos.map(function (k) { return somaA[k] || 0; }), backgroundColor: AZ_A },
          { label: "Bloco B", data: eixos.map(function (k) { return somaB[k] || 0; }), backgroundColor: AZ_B }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } },
          tooltip: { callbacks: { title: function (c) { return nomeEixo[c[0].label] || c[0].label; },
            label: function (c) { return c.dataset.label + ": R$ " + num(c.raw) + " mi"; } } } },
        scales: { x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: "R$ milhões (máx.)" } } }
      }
    }));

    /* ---- por postura ---- */
    var ordem = PMETA.postura_ordem || [];
    var pA = {}, pB = {}, pN = {};
    est.forEach(function (e) {
      pA[e.postura] = (pA[e.postura] || 0) + (e.bloco_a.max || 0);
      pB[e.postura] = (pB[e.postura] || 0) + (e.bloco_b.max || 0);
      pN[e.postura] = (pN[e.postura] || 0) + 1;
    });
    graficos.push(new Chart($("#ch-postura"), {
      type: "bar",
      data: {
        labels: ordem.map(function (p) { return (ROTULO_POSTURA[p] || p) + " (" + (pN[p] || 0) + ")"; }),
        datasets: [
          { label: "Bloco A — contratável", data: ordem.map(function (p) { return pA[p] || 0; }), backgroundColor: AZ_A },
          { label: "Bloco B — referência", data: ordem.map(function (p) { return pB[p] || 0; }), backgroundColor: AZ_B }
        ]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": R$ " + num(c.raw) + " mi"; } } } },
        scales: { x: { stacked: true, beginAtZero: true, title: { display: true, text: "R$ milhões (máx.)" } },
          y: { stacked: true, grid: { display: false } } }
      }
    }));

    /* ---- por experiência ---- */
    var ordE = est.slice().sort(function (a, b) {
      return ((b.bloco_a.max || 0) + (b.bloco_b.max || 0)) - ((a.bloco_a.max || 0) + (a.bloco_b.max || 0));
    });
    graficos.push(new Chart($("#ch-experiencias"), {
      type: "bar",
      data: {
        labels: ordE.map(function (e) { return e.curto; }),
        datasets: [
          { label: "Bloco A — contratável", data: ordE.map(function (e) { return e.bloco_a.max; }), backgroundColor: AZ_A },
          { label: "Bloco B — referência", data: ordE.map(function (e) { return e.bloco_b.max; }), backgroundColor: AZ_B }
        ]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "top", align: "end", labels: { boxWidth: 12 } },
          tooltip: { callbacks: { title: function (c) { return ordE[c[0].dataIndex].curto; },
            label: function (c) { return c.dataset.label + ": R$ " + num(c.raw) + " mi"; } } } },
        scales: { y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 },
            callback: function (v) { var t = ordE[v].curto; return t.length > 34 ? t.slice(0, 32) + "…" : t; } } },
          x: { stacked: true, beginAtZero: true, position: "top", title: { display: true, text: "R$ milhões (valor máximo)" } } }
      }
    }));

    montaTabelaExp(est);
  };

  function S7fin() { return !!(P5 && P5.secao7 && P5.secao7.f71); }

  /* barras horizontais empilhadas a partir de uma matriz {colunas, linhas} */
  function empilhada(canvas, mz, cores, eixo) {
    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: mz.linhas.map(function (l) { return l.rotulo; }),
        datasets: mz.colunas.map(function (c, k) {
          return { label: c, data: mz.linhas.map(function (l) { return l.valores[k]; }),
            backgroundColor: cores[k], barPercentage: 0.62 };
        })
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 11, font: { size: 10.5 } } } },
        scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 },
            title: { display: true, text: eixo || "fichas" } },
          y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false } } }
      }
    });
  }

  function simples(canvas, lista, rotEixo) {
    var l = lista.slice().sort(function (a, b) { return b.n - a.n; });
    return new Chart(canvas, {
      type: "bar",
      data: { labels: l.map(function (x) { return x.rotulo; }),
        datasets: [{ data: l.map(function (x) { return x.n; }), backgroundColor: AZ_A, barPercentage: 0.62 }] },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
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
    graficos.push(simples($("#ch-74"), S.f74, "menções"));
    graficos.push(simples($("#ch-75"), S.f75, "menções"));
    graficos.push(simples($("#ch-76"), S.f76, "fichas"));
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
    postura: function (e) { return (PMETA.postura_ordem || []).indexOf(e.postura); },
    conf: function (e) { return ["alta", "média", "baixa"].indexOf(e.confianca); },
    p5: function (e) { return e.pontuacao; }, itens: function (e) { return e.itens; },
    amin: function (e) { return e.bloco_a.min; }, amax: function (e) { return e.bloco_a.max; },
    bmin: function (e) { return e.bloco_b.min; }, bmax: function (e) { return e.bloco_b.max; },
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
      var tA0 = 0, tA1 = 0, tB0 = 0, tB1 = 0;
      $("#tb-exp").innerHTML = l.map(function (e) {
        tA0 += e.bloco_a.min || 0; tA1 += e.bloco_a.max || 0; tB0 += e.bloco_b.min || 0; tB1 += e.bloco_b.max || 0;
        return "<tr>" +
          '<td class="nome">' + esc(e.curto) + "<small>" + esc(e.municipio) + " · " + esc(e.uf) + "</small></td>" +
          '<td><span class="tag tag-eixo" style="background:' + corEixo(e.eixo_cod) + '">' + esc(e.eixo_cod) + "</span></td>" +
          "<td>" + esc(ROTULO_POSTURA[e.postura] || e.postura) + "</td>" +
          "<td>" + esc(maiusc(e.confianca)) + "</td>" +
          '<td class="num">' + num(e.pontuacao, 0) + "</td>" +
          '<td class="num">' + esc(e.itens) + "</td>" +
          '<td class="num">' + num(e.bloco_a.min) + "</td>" +
          '<td class="num">' + num(e.bloco_a.max) + "</td>" +
          '<td class="num">' + num(e.bloco_b.min) + "</td>" +
          '<td class="num">' + num(e.bloco_b.max) + "</td>" +
          '<td class="num"><b>' + num((e.bloco_a.max || 0) + (e.bloco_b.max || 0)) + "</b></td>" +
          "</tr>";
      }).join("") +
      '<tr style="background:#F5F5F7;font-weight:700"><td>Total</td><td></td><td></td><td></td><td></td><td></td>' +
        '<td class="num">' + num(tA0) + '</td><td class="num">' + num(tA1) + "</td>" +
        '<td class="num">' + num(tB0) + '</td><td class="num">' + num(tB1) + "</td>" +
        '<td class="num">' + num(tA1 + tB1) + "</td></tr>";
    }
    $$("#tbl-exp thead th[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.sort;
        if (ordExp.chave === k) ordExp.dir = ordExp.dir === "desc" ? "asc" : "desc";
        else { ordExp.chave = k; ordExp.dir = (k === "nome" || k === "eixo" || k === "postura" || k === "conf") ? "asc" : "desc"; }
        pinta();
      });
    });
    pinta();
  }

  /* ======================================================= abertura === */
  var inicial = (location.hash || "").replace("#", "");
  mostrar(document.getElementById("view-" + inicial) ? inicial : "carteira");
})();
