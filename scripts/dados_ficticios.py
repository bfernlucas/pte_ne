#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera pacotes FICTÍCIOS (PTE_P5 e PTE_CAMPO) com a mesma estrutura dos
pacotes cifrados, para testar o layout do painel sem a senha.

Os nomes, rotas e notas vêm dos próprios scripts (gen_p5.py e
montar_campo.py, já públicos). Todos os VALORES MONETÁRIOS, itens das
fichas e figuras da seção 7 são inventados: servem só para medir largura,
quebra de linha e rolagem. Nunca publicar nem usar como dado.

Uso (dentro de scripts/teste_visual.py):
    from dados_ficticios import gerar
    p5, campo = gerar()
"""
import json, os, random, sys, tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import gen_p5  # noqa: E402
import montar_campo  # noqa: E402

RUBRICAS = ["Consultoria especializada", "Equipamentos e material permanente",
            "Capacitação e formação de equipes", "Obras e instalações",
            "Serviços de terceiros — pessoa jurídica", "Monitoramento e avaliação independente"]
UNIDADES = ["mês", "unidade", "turma", "hora técnica", "estudo", "kit"]
RACIONAL = ["Referência de mercado para serviços equivalentes na região, com três cotações.",
            "Custo unitário do SINAPI de setembro de 2026, ajustado para o porte da experiência.",
            "Quantidade declarada pela organização na visita e conferida com o plano de trabalho.",
            None]


def _ficha(rnd, a_max, b_max, a_min, b_min):
    blocos = []
    for bid, tmin, tmax, titulo in (("A", a_min, a_max, "A. Bloco A — contratável nesta etapa"),
                                     ("B", b_min, b_max, "B. Bloco B — referência indicativa")):
        comps, base_max = [], tmax * 1e6 / 1.15
        ncomp = rnd.randint(2, 4)
        for c in range(ncomp):
            itens, cmax = [], base_max / ncomp
            nit = rnd.randint(2, 5)
            for i in range(nit):
                q0 = rnd.randint(1, 12); q1 = q0 + rnd.randint(0, 12)
                tot1 = cmax / nit; u1 = tot1 / q1; u0 = u1 * 0.8
                itens.append({"n": "%d.%d" % (c + 1, i + 1),
                              "item": rnd.choice(["Contratação de assessoria técnica para estruturação do plano de negócios",
                                                  "Aquisição de equipamentos de beneficiamento",
                                                  "Oficinas de formação em gestão financeira",
                                                  "Sistema de monitoramento de indicadores de impacto",
                                                  "Estudo de viabilidade técnica e econômica"]),
                              "rubrica": rnd.choice(RUBRICAS), "unidade": rnd.choice(UNIDADES),
                              "racional": rnd.choice(RACIONAL), "q_min": q0, "q_max": q1,
                              "u_min": u0, "u_max": u1, "min": u0 * q0, "max": tot1})
            comps.append({"n": c + 1, "nome": rnd.choice(["Estruturação institucional e governança",
                                                         "Investimento em ativos e fundos",
                                                         "Assistência técnica e capacidades",
                                                         "Monitoramento e avaliação"]),
                          "min": sum(x["min"] for x in itens), "max": cmax, "itens": itens})
        cb_min = sum(c["min"] for c in comps); cb_max = sum(c["max"] for c in comps)
        resumo = [
            {"rotulo": "CUSTO-BASE DO BLOCO " + bid, "racional": None, "pct_min": None, "pct_max": None,
             "min": cb_min, "max": cb_max},
            {"rotulo": "Gestão do apoio", "racional": "Percentual sobre o custo-base, conforme a seção 7.2",
             "pct_min": 0.05, "pct_max": 0.08, "min": cb_min * .05, "max": cb_max * .08},
            {"rotulo": "Contingência", "racional": "Classe 5 da AACE: faixa de incerteza do custo-base",
             "pct_min": 0.05, "pct_max": 0.07, "min": cb_min * .05, "max": cb_max * .07},
            {"rotulo": "TOTAL GERAL DO BLOCO " + bid, "racional": None, "pct_min": None, "pct_max": None,
             "min": tmin * 1e6, "max": tmax * 1e6},
        ]
        blocos.append({"id": bid, "titulo": titulo, "componentes": comps, "resumo": resumo})
    return {"blocos": blocos,
            "notas": ["(1) Valores fictícios gerados para teste de layout.",
                      "(2) Faixa de custo com precisão Classe 5 da AACE International.",
                      "(3) Horizonte de 36 meses, preços de setembro de 2026."],
            "contrapartida": "Espaço físico e equipe técnica cedidos pela organização (fictício).",
            "cofinanciamento": "Possível articulação com fundo estadual (fictício).",
            "carteira": {"min": (a_min + b_min) * 1e6, "max": (a_max + b_max) * 1e6}}


def gerar(semente=7):
    rnd = random.Random(semente)
    base = gen_p5.carregar_base()
    experiencias, pos = [], 0
    posturas = gen_p5.POSTURA_ORDEM
    for rota in gen_p5.ROTAS:
        for (nome, mun, uf, coleta, data, aba, ref) in sorted(rota["paradas"], key=lambda x: gen_p5.data_ord(x[4])):
            b = base.get(ref, {}) if ref else {}
            nova = gen_p5.NOVAS_EM_CAMPO.get(nome, {})
            imp, inov, oper, inv = gen_p5.NOTAS[nome]
            total = 6 * imp + 6 * inov + 5 * oper + 3 * inv
            est = bool(aba)
            a_max = round(rnd.uniform(0.8, 7), 3) if est else None
            b_max = round(rnd.uniform(0.5, 6), 3) if est else None
            e = {"nome": nome, "curto": (aba[3:] if aba else nome), "rota": rota["id"], "rota_nome": rota["nome"],
                 "municipio": mun, "uf": uf, "coleta": coleta, "data": data,
                 "equipe": rota["equipe"] if rota["id"] != "RX" else gen_p5.EQUIPE_RX.get(nome, "Sinoel, Caio e Luiz"),
                 "ref_id": ref, "lat": b.get("lat", nova.get("lat")), "lon": b.get("lon", nova.get("lon")),
                 "nova_em_campo": ref is None, "eixo_cod": b.get("eixo_cod") or "ADT", "estimada": est,
                 "aba": aba, "ficha": None, "postura": rnd.choice(posturas) if est else None,
                 "info_financeira": rnd.choice(["completa", "parcial", "ausente"]) if est else None,
                 "confianca": rnd.choice(["alta", "média", "baixa"]) if est else None,
                 "pontuacao": total, "classificacao": gen_p5.classificar(total),
                 "notas": {"impacto": imp, "inovacao": inov, "operacao": oper, "investimento": inv},
                 "posicao": None, "itens": rnd.randint(6, 30) if est else None,
                 "bloco_a": {"min": round(a_max * .31, 3) if est else None, "max": a_max},
                 "bloco_b": {"min": round(b_max * .31, 3) if est else None, "max": b_max},
                 "gabinete": b.get("pontuacao")}
            if est:
                e["ficha_inv"] = _ficha(rnd, a_max, b_max, e["bloco_a"]["min"], e["bloco_b"]["min"])
            experiencias.append(e)
    for i, e in enumerate(sorted([x for x in experiencias if x["estimada"]], key=lambda x: -x["pontuacao"])):
        e["posicao"] = i + 1
    est = [e for e in experiencias if e["estimada"]]
    A0 = sum(e["bloco_a"]["min"] for e in est); A1 = sum(e["bloco_a"]["max"] for e in est)
    B0 = sum(e["bloco_b"]["min"] for e in est); B1 = sum(e["bloco_b"]["max"] for e in est)
    fluxos = []
    for e in est:
        for bl, v in (("A", e["bloco_a"]["max"]), ("B", e["bloco_b"]["max"])):
            for comp, fr in (("C2", .5), ("C3", .3), ("C1", .15), ("C4", .05)):
                fluxos.append({"bloco": bl, "eixo": e["eixo_cod"], "postura": e["postura"], "comp": comp, "valor": v * fr})
    lin = lambda r, mn, mx: {"rotulo": r, "min": mn, "max": mx}
    quadros = {
        "contratavel": {"rubricas": [], "custo_base": {"comp": [0] * 5, "min": A0 / 1.15, "max": A1 / 1.15},
                        "gestao": lin("Gestão", 0, 0), "contingencia": lin("Contingência", 0, 0),
                        "total": lin("Total", A0, A1)},
        "referencia": {"rubricas": [], "custo_base": {"comp": [0] * 5, "min": B0 / 1.15, "max": B1 / 1.15},
                       "gestao": lin("Gestão", 0, 0), "contingencia": lin("Contingência", 0, 0),
                       "total": lin("Total", B0, B1)},
        "carteira": {"reais": {"min": A0 + B0, "max": A1 + B1},
                     "dolares": {"min": (A0 + B0) / 5.2, "max": (A1 + B1) / 5.2}},
        "anualizacao": [{"ano": "Ano %d" % k, "base": 0, "total": A1 * p, "pct": p}
                        for k, p in ((1, .4), (2, .35), (3, .25))],
    }
    mz = lambda cols, rots: {"colunas": cols, "linhas": [{"rotulo": r, "valores": [rnd.randint(1, 9) for _ in cols]} for r in rots]}
    lst = lambda rots: [{"rotulo": r, "n": rnd.randint(1, 20)} for r in rots]
    secao7 = {"fichas": 29,
              "f71": mz(["Disponível", "Parcial", "Não informado"], ["Receita anual", "Custo operacional", "Patrimônio", "Endividamento"]),
              "f72": mz(["Alta", "Média", "Baixa", "Sem informação"], ["Maturidade operacional", "Potencial de escalonamento", "Governança"]),
              "f73": mz(["Com receita e busca ativa", "Com receita, sem busca", "Sem receita, com busca", "Sem informação"],
                        ["Associações", "Cooperativas", "Empresas", "Órgãos públicos", "Redes"]),
              "f74": lst(["Recursos próprios", "Editais públicos", "Fundações privadas", "Bancos de desenvolvimento",
                          "Cooperação internacional", "Emendas parlamentares", "Doações de pessoas físicas", "Outros"]),
              "f75": lst(["Não reembolsável", "Crédito subsidiado", "Capital de giro", "Equity", "Garantias", "Outros"]),
              "f76": lst(["Nunca acessou", "Acessou uma vez", "Acessa com frequência", "Não sabe", "Sem informação"]),
              "f78": [{"rotulo": n, "min": rnd.uniform(1, 5), "max": rnd.uniform(6, 20)} for c, n in gen_p5.COMPONENTES],
              "t72": [], "cambio": "US$ 1 = R$ 5,20 (fictício)"}
    p5 = {"meta": {"componentes": [{"cod": c, "nome": t} for c, t in gen_p5.COMPONENTES],
                   "postura_ordem": posturas, "postura_rotulo": gen_p5.POSTURA_ROTULO,
                   "pesos": gen_p5.PESOS, "organizacoes": len(experiencias), "estimadas": len(est)},
          "rotas": [{k: v for k, v in r.items() if k != "paradas"} for r in gen_p5.ROTAS],
          "experiencias": experiencias, "quadros": quadros, "fluxos": fluxos, "secao7": secao7}

    tmp = tempfile.mkdtemp()
    montar_campo.P5 = os.path.join(tmp, "p5.json")
    montar_campo.OUT = os.path.join(tmp, "campo.json")
    json.dump(p5, open(montar_campo.P5, "w", encoding="utf-8"), ensure_ascii=False)
    import contextlib, io
    with contextlib.redirect_stdout(io.StringIO()):
        montar_campo.main()
    campo = json.load(open(montar_campo.OUT, encoding="utf-8"))
    return p5, campo


if __name__ == "__main__":
    p5, campo = gerar()
    print(len(p5["experiencias"]), "experiências;", len(campo["experiencias"]), "no pacote de campo")
    print("carteira fictícia R$ %.1f a %.1f mi" % (p5["quadros"]["carteira"]["reais"]["min"], p5["quadros"]["carteira"]["reais"]["max"]))
