#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste visual do painel com dados FICTÍCIOS (scripts/dados_ficticios.py).

Serve o repositório em localhost, injeta os pacotes fictícios na sessão
(como se o login tivesse aberto os pacotes cifrados) e, para cada seção:
  - confere que não há rolagem horizontal (scrollWidth <= clientWidth);
  - lista elementos que ultrapassam a largura da janela;
  - registra erros de console e requisições com falha;
  - salva capturas de tela.

Não altera a proteção em produção: nada disto é carregado pelo index.html.

    python3 scripts/teste_visual.py SAIDA_DIR [largura ...]
"""
import http.server, json, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
from dados_ficticios import gerar  # noqa: E402

SECOES = ["carteira", "mapa", "experiencias", "diagnostico", "analise"]
SUB_DIAG = ["experiencias", "evidencia", "captacao", "comparar", "campo"]


def servidor():
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(s, *a, **k): super().__init__(*a, directory=RAIZ, **k)
        def log_message(s, *a): pass
    srv = socketserver.TCPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def prefixo_ct(arq, var):
    txt = open(os.path.join(RAIZ, "assets", "data", arq), encoding="utf-8").read()
    return json.loads(txt[txt.index("{"):txt.rindex("}") + 1])["ct"][:40]


ESTOURO_JS = """() => {
  const W = document.documentElement.clientWidth, out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
    let p = el.parentElement, clip = false;
    while (p && p !== document.body) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden') { clip = true; break; }
      p = p.parentElement;
    }
    if (!clip && r.right > W + 1) out.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + el.className).slice(0, 80) + ' → ' + Math.round(r.right));
  }
  return out.slice(0, 15);
}"""

ROLAGEM_INTERNA_JS = """() => {
  const out = [];
  for (const el of document.querySelectorAll('.tbl-scroll, .ec-tw, .ec-mx')) {
    if (el.offsetParent && el.scrollWidth > el.clientWidth + 1)
      out.push((el.id || el.className) + ' ' + el.scrollWidth + '>' + el.clientWidth);
  }
  return out;
}"""


def main():
    saida = sys.argv[1] if len(sys.argv) > 1 else "capturas"
    larguras = [int(x) for x in sys.argv[2:]] or [1366, 1920]
    os.makedirs(saida, exist_ok=True)
    p5, campo = gerar()
    ini = ("sessionStorage.setItem('pte.campo', %s);sessionStorage.setItem('pte.campo.v', %s);"
           "sessionStorage.setItem('pte.p5', %s);sessionStorage.setItem('pte.p5.v', %s);") % (
        json.dumps(json.dumps(campo)), json.dumps(prefixo_ct("campo.enc.js", "")),
        json.dumps(json.dumps(p5)), json.dumps(prefixo_ct("p5.enc.js", "")))
    srv, porta = servidor()
    rel = {"porta": porta, "resultados": []}
    proxy = os.environ.get("HTTPS_PROXY")
    with sync_playwright() as pw:
        # proxy só para https: o servidor local (http) fica fora dele
        args = ["--proxy-server=https=" + proxy.split("://")[-1]] if proxy else []
        nav = pw.chromium.launch(args=args)
        for W in larguras:
            ctx = nav.new_context(viewport={"width": W, "height": 900}, ignore_https_errors=True)
            ctx.add_init_script(ini)
            pg = ctx.new_page()
            erros, falhas = [], []
            pg.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: erros.append("pageerror: " + str(e)))
            pg.on("requestfailed", lambda r: falhas.append(r.url + " " + (r.failure or "")))
            pg.on("response", lambda r: falhas.append("%s %d" % (r.url, r.status)) if r.status >= 400 else None)
            pg.goto("http://127.0.0.1:%d/index.html" % porta, wait_until="networkidle")

            def medir(nome, completa=True):
                pg.wait_for_timeout(700)
                m = pg.evaluate("() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]")
                rel["resultados"].append({"largura": W, "tela": nome, "scrollWidth": m[0], "clientWidth": m[1],
                                          "ok": m[0] <= m[1], "estouros": pg.evaluate(ESTOURO_JS),
                                          "rolagem_interna": pg.evaluate(ROLAGEM_INTERNA_JS)})
                pg.screenshot(path=os.path.join(saida, "%d-%s.png" % (W, nome)), full_page=completa)

            for s in SECOES:
                pg.click('#secnav button[data-view="%s"]' % s)
                pg.wait_for_timeout(1500 if s in ("mapa", "analise") else 600)
                medir(s)
                if s == "carteira":
                    cbs = pg.query_selector_all("#tb-ranking .mk:not([disabled])")[:3]
                    for c in cbs: c.check()
                    medir("carteira-comparacao")
                if s == "experiencias":
                    b = pg.query_selector("#fichas .abrir")
                    if b:
                        b.click(); pg.wait_for_timeout(900)
                        pg.evaluate("document.getElementById('inv').scrollIntoView()")
                        medir("ficha-investimento")
                        pg.locator("#inv").screenshot(path=os.path.join(saida, "%d-ficha-investimento-recorte.png" % W))
                if s == "diagnostico":
                    for sub in SUB_DIAG:
                        pg.click('#ec-nav button[data-sec="%s"]' % sub)
                        if sub == "experiencias":
                            pg.click("#ec-corpo tr[data-n]")
                        if sub == "comparar":
                            for v in ("0", "1", "2"):
                                pg.select_option("#ec-cmp-add", v)
                        medir("diagnostico-" + sub)
            rel.setdefault("console", {})[W] = sorted(set(erros))
            rel.setdefault("falhas", {})[W] = sorted(set(falhas))
            ctx.close()
        nav.close()
    srv.shutdown()
    json.dump(rel, open(os.path.join(saida, "relatorio.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for r in rel["resultados"]:
        print("%5d %-26s %s  %d/%d %s %s" % (r["largura"], r["tela"], "OK " if r["ok"] else "ROLA", r["scrollWidth"],
              r["clientWidth"], r["estouros"][:3] or "", r["rolagem_interna"] or ""))
    print("console:", json.dumps(rel["console"], ensure_ascii=False)[:1500])
    print("falhas:", json.dumps(rel["falhas"], ensure_ascii=False)[:1500])


if __name__ == "__main__":
    main()
