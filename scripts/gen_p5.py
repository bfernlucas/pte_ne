#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera assets/data/p5.js -- a camada do Produto 5 B do painel PTE-NE.

Fontes
------
1. PTE2026_fichas_investimento.xlsx (secao 7 do P5 B): aba "Quadro por
   experiencia" (27 experiencias com estimativa), abas por experiencia
   (rota, ficha de campo, numero de itens) e aba "Quadros da carteira"
   (quadros 1 a 4 consolidados).
2. Tabela de rotas do proprio P5 B (secao 2): as 29 organizacoes com
   visita ou entrevista, com municipio, UF, forma de coleta e data.
   Transcrita em ROTAS abaixo -- e a atribuicao de rota canonica do
   relatorio, que prevalece sobre o campo "Rota" das abas da planilha.

Os valores sao Classe 5 da AACE International (RP 18R-97), em R$ milhoes
de setembro de 2026, horizonte de 36 meses.

Escreve dados_p5.json na raiz -- arquivo EM CLARO, mantido fora do Git.
Para publicar:

    python3 scripts/gen_p5.py [caminho/para/PTE2026_fichas_investimento.xlsx]
    python3 scripts/cifrar_campo.py --src dados_p5.json \
        --out assets/data/p5.enc.js --var PTE_P5_ENC
"""
import json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Saida EM CLARO, fora do Git (.gitignore). As faixas de recursos por
# organizacao nao vao para o repositorio publico: quem publica e
# scripts/cifrar_campo.py, que gera assets/data/p5.enc.js.
OUT = os.path.join(ROOT, "dados_p5.json")
BASE = os.path.join(ROOT, "assets", "data", "iniciativas.js")

_CANDIDATOS = [
    os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "PTE - Incursões"),   # Windows
    os.path.join(os.path.expanduser("~"), "mnt", "PTE - Incursões"),                   # ponte (VM)
]
PADRAO_XLSX = next(
    (os.path.join(d, "PTE2026_fichas_investimento.xlsx") for d in _CANDIDATOS
     if os.path.exists(os.path.join(d, "PTE2026_fichas_investimento.xlsx"))),
    os.path.join(_CANDIDATOS[0], "PTE2026_fichas_investimento.xlsx"))

# ---------------------------------------------------------------------------
# Rotas efetivamente realizadas, conforme a tabela da secao 2 do P5 B.
# aba  = nome da aba da planilha de estimativa (None = sem estimativa)
# ref  = id em assets/data/iniciativas.js (None = nao consta da prospeccao)
# ---------------------------------------------------------------------------
ROTAS = [
 {"id": "R1", "nome": "Rota 1", "uf": "RN e PB", "periodo": "16 a 23 de julho de 2026",
  "equipe": "Lucas e Bruna", "cor": "#0C549C",
  "paradas": [
   ("Amarez", "Arez", "RN", "Presencial", "16/07", "20 AMAREZ", 31),
   ("CTERSA", "Campina Grande", "PB", "Presencial", "17/07", "17 CTERSA", 46),
   ("Tecnologia SARA", "Campina Grande", "PB", "Presencial", "17/07", "12 Tecnologia SARA", 37),
   ("Projeto Vale Sustentável", "Assu", "RN", "Presencial", "21/07", "04 Projeto Vale Sustentável", 40),
   ("Cooperativa de Energia Solar Bem Viver", "Lagoa Seca", "PB", "Presencial", "22/07", "25 Cooperativa Bem Viver", 73),
   ("Um Milhão de Tetos Solares", "Remígio", "PB", "Presencial", "23/07", "24 Um Milhão de Tetos Solares", 23),
   ("Instituto Casaca de Couro", "Pirpirituba", "PB", "Presencial", "23/07", "18 Instituto Casaca de Couro", 45),
  ]},
 {"id": "R2", "nome": "Rota 2", "uf": "CE e PI", "periodo": "17 a 29 de julho de 2026",
  "equipe": "Leide e Renata", "cor": "#54B43C",
  "paradas": [
   ("Consórcio Público de Manejo de Resíduos Sólidos da Ibiapaba", "Tianguá", "CE", "Presencial", "17/07", "21 Consórcio da Ibiapaba", 33),
   ("Fazenda Nutrilite Brasil", "Ubajara", "CE", "Presencial", "23/07", "08 Fazenda Nutrilite Brasil", 54),
   ("Trilha Caminhos da Ibiapaba", "Viçosa do Ceará e Piracuruca", "CE/PI", "Presencial", "28/07", "06 Trilha Caminhos da Ibiapaba", 49),
   ("No Clima da Caatinga", "Crateús e Buriti dos Montes", "CE/PI", "Virtual", "29/07", "10 No Clima da Caatinga", 48),
   ("Instituto Caburé", "Cajueiro da Praia", "PI", "Virtual", "22/07", "02 Instituto Caburé", None),
  ]},
 {"id": "R3", "nome": "Rota 3", "uf": "PE e AL", "periodo": "27 a 31 de julho de 2026",
  "equipe": "Sinoel, Tamara e Luiz", "cor": "#F09C18",
  "paradas": [
   ("Parque Tecnológico Porto Digital — Recife", "Recife", "PE", "Presencial", "27/07", "09 Porto Digital Recife", 12),
   ("Programa Terra Plantar (IPA)", "Recife", "PE", "Presencial", "27/07", "22 Programa Terra Plantar", 52),
   ("Banco Comunitário de Araçoiaba", "Araçoiaba", "PE", "Presencial", "28/07", None, 4),
   ("Acreditar — Associação de Microcrédito e Desenvolvimento", "Glória do Goitá", "PE", "Presencial", "29/07", "01 Acreditar", 1),
   ("Porto Digital — Unidade Caruaru", "Caruaru", "PE", "Presencial", "29/07", "26 Porto Digital Caruaru", None),
   ("Associação dos Produtores de Crédito de Carbono Social do Bioma Caatinga", "Delmiro Gouveia", "AL", "Presencial", "30/07", None, 53),
   ("Cooperativa Agroindustrial Pindorama", "Coruripe", "AL", "Presencial", "31/07", "16 Cooperativa Pindorama", 64),
  ]},
 {"id": "RX", "nome": "Rota extra", "uf": "PB, RN, CE e BA", "periodo": "5 a 21 de agosto de 2026",
  "equipe": "Lucas e Bruna (RN e PB) · Leide e Andreia (CE) · Sinoel, Caio e Luiz (BA)", "cor": "#24246C",
  "paradas": [
   ("Rede Xique Xique", "Natal", "RN", "Presencial", "05/08", "14 Rede Xique Xique", 6),
   ("Sistema Metroviário do Ceará", "Fortaleza", "CE", "Presencial", "06/08", "03 Sistema Metroviário do Ceará", 39),
   ("Unidade MCTI/EMBRAPII de Inovação em IA — IFCE", "Fortaleza", "CE", "Presencial", "07/08", "05 Unidade EMBRAPII", 9),
   ("Blue C", "Fortaleza, Flecheiras e Guajiru", "CE", "Virtual", "13/08", "19 Blue C", 55),
   ("Fazenda Tamanduá", "Patos", "PB", "Presencial", "14/08", "15 Fazenda Tamanduá", 50),
   ("Solos", "Salvador", "BA", "Presencial", "19/08", "13 Solos", 29),
   ("Rede Recicla Bahia", "Salvador", "BA", "Presencial", "19/08", "07 Rede Recicla Bahia", 32),
   ("Rede BATUC", "Salvador", "BA", "Presencial", "20/08", "23 Rede BATUC", 16),
   ("Acelen Renováveis", "São Francisco do Conde", "BA", "Presencial", "20/08", "11 Acelen Renováveis", 62),
   ("FIEB — Programa de Apoio a Projetos de Indústria Verde", "Salvador", "BA", "Presencial", "21/08", "27 FIEB", 69),
  ]},
]

# A rota extra foi feita por tres equipes, em trechos separados (pastas de
# "Coleta de campo - Rotas"). Cada trecho vira uma linha propria no mapa.
EQUIPE_RX = {
    "Rede Xique Xique": "Lucas e Bruna", "Fazenda Tamanduá": "Lucas e Bruna",
    "Sistema Metroviário do Ceará": "Leide e Andreia",
    "Unidade MCTI/EMBRAPII de Inovação em IA — IFCE": "Leide e Andreia",
    "Blue C": "Leide e Andreia",
}


def data_ord(d):
    dia, mes = d.split("/")
    return int(mes) * 100 + int(dia)


# Visitadas em campo que nao constam da matriz de prospeccao: coordenadas do
# local efetivamente visitado, para que aparecam no mapa.
NOVAS_EM_CAMPO = {
    "Instituto Caburé": {"lat": -2.9333, "lon": -41.3417},
    "Porto Digital — Unidade Caruaru": {"lat": -8.2825, "lon": -35.9760},
}

# Matriz de avaliacao do Apendice 2 do P5 B (tabela de pontuacao das 29):
# notas de 1 a 5 em impacto (D10), inovacao (E8), operacao (B10) e
# investimento (C8); total 0-100 = 6*imp + 6*inov + 5*oper + 3*inv.
# Chave = nome da parada em ROTAS.
NOTAS = {
 "Fazenda Nutrilite Brasil": (5, 5, 5, 5),
 "Trilha Caminhos da Ibiapaba": (5, 5, 5, 5),
 "No Clima da Caatinga": (5, 5, 5, 5),
 "Tecnologia SARA": (5, 5, 5, 5),
 "Rede Xique Xique": (5, 5, 5, 4),
 "Acreditar — Associação de Microcrédito e Desenvolvimento": (5, 5, 4, 5),
 "Acelen Renováveis": (4, 5, 5, 5),
 "Solos": (5, 5, 5, 3),
 "Sistema Metroviário do Ceará": (4, 5, 5, 5),
 "Parque Tecnológico Porto Digital — Recife": (4, 5, 5, 4),
 "Fazenda Tamanduá": (5, 4, 5, 4),
 "CTERSA": (5, 5, 3, 5),
 "Unidade MCTI/EMBRAPII de Inovação em IA — IFCE": (3, 5, 5, 4),
 "Rede Recicla Bahia": (5, 4, 4, 3),
 "Projeto Vale Sustentável": (5, 4, 4, 3),
 "Instituto Caburé": (5, 4, 3, 4),
 "Cooperativa Agroindustrial Pindorama": (4, 4, 4, 4),
 "Instituto Casaca de Couro": (4, 4, 4, 4),
 "Blue C": (5, 4, 3, 3),
 "Um Milhão de Tetos Solares": (3, 4, 5, 3),
 "Cooperativa de Energia Solar Bem Viver": (4, 4, 3, 4),
 "Consórcio Público de Manejo de Resíduos Sólidos da Ibiapaba": (4, 4, 3, 4),
 "Porto Digital — Unidade Caruaru": (2, 4, 3, 4),
 "FIEB — Programa de Apoio a Projetos de Indústria Verde": (3, 3, 3, 4),
 "Programa Terra Plantar (IPA)": (3, 3, 4, 2),
 "Rede BATUC": (3, 3, 3, 3),
 "Amarez": (3, 3, 3, 3),
 "Banco Comunitário de Araçoiaba": (2, 3, 2, 2),
 "Associação dos Produtores de Crédito de Carbono Social do Bioma Caatinga": (1, 3, 2, 2),
}
PESOS = {"impacto": 6, "inovacao": 6, "operacao": 5, "investimento": 3}


def classificar(total):
    if total >= 80:
        return "alta"
    if total >= 50:
        return "estrategico"
    return "nao"


POSTURA_ORDEM = ["pronta", "pronta c/ dado", "dimensionar", "fortalecer", "preparatório"]
POSTURA_ROTULO = {
    "pronta": "Pronta para receber apoio",
    "pronta c/ dado": "Pronta, com dado a confirmar",
    "dimensionar": "Precisa dimensionar o investimento",
    "fortalecer": "Precisa se fortalecer institucionalmente",
    "preparatório": "Etapa preparatória",
}
COMPONENTES = [
    ("C0", "Estudo de dimensionamento"),
    ("C1", "Estruturação institucional e governança"),
    ("C2", "Investimento em ativos e fundos"),
    ("C3", "Assistência técnica e capacidades"),
    ("C4", "Monitoramento e avaliação"),
]


def n(v, casas=6):
    if v is None:
        return None
    try:
        return round(float(v), casas)
    except (TypeError, ValueError):
        return None


def carregar_base():
    txt = open(BASE, encoding="utf-8").read()
    d = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])
    return {r["id"]: r for r in d["iniciativas"]}


def main(xlsx=None):
    xlsx = xlsx or (sys.argv[1] if len(sys.argv) > 1 else PADRAO_XLSX)
    if not os.path.exists(xlsx):
        sys.exit("planilha nao encontrada: %s" % xlsx)
    import openpyxl
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    base = carregar_base()

    # --- quadro por experiencia -------------------------------------------
    q = wb["Quadro por experiência"]
    por_aba = {}
    for r in range(4, q.max_row + 1):
        aba = q.cell(r, 7).value
        if not aba:
            continue
        por_aba[aba] = {
            "nome_quadro": q.cell(r, 2).value,
            "eixo_cod": q.cell(r, 3).value,
            "postura": q.cell(r, 4).value,
            "info_financeira": q.cell(r, 5).value,
            "confianca": q.cell(r, 6).value,
            "a_min": n(q.cell(r, 8).value), "a_max": n(q.cell(r, 9).value),
            "b_min": n(q.cell(r, 10).value), "b_max": n(q.cell(r, 11).value),
            "pontuacao": q.cell(r, 12).value,
            "posicao": q.cell(r, 13).value,
        }
    # itens, da aba de cada experiencia
    for aba in por_aba:
        if aba in wb.sheetnames:
            por_aba[aba]["itens"] = wb[aba].cell(6, 13).value
            fic = wb[aba].cell(5, 4).value or ""
            m = re.search(r"ficha\s+(.+)$", str(fic))
            por_aba[aba]["ficha"] = None if (not m or "sem ID" in m.group(1)) else m.group(1).strip()

    # --- experiencias, na ordem das rotas ---------------------------------
    experiencias = []
    for rota in ROTAS:
        paradas = sorted(rota["paradas"], key=lambda x: data_ord(x[4]))   # ordem percorrida
        for (nome, mun, uf, coleta, data, aba, ref) in paradas:
            equipe = rota["equipe"] if rota["id"] != "RX" else EQUIPE_RX.get(nome, "Sinoel, Caio e Luiz")
            e = por_aba.get(aba, {}) if aba else {}
            b = base.get(ref, {}) if ref else {}
            nova = NOVAS_EM_CAMPO.get(nome, {})
            if nome not in NOTAS:
                sys.exit("sem notas do Apendice 2 para: %s" % nome)
            imp, inov, oper, inv = NOTAS[nome]
            total = PESOS["impacto"] * imp + PESOS["inovacao"] * inov + \
                PESOS["operacao"] * oper + PESOS["investimento"] * inv
            if e.get("pontuacao") is not None and e["pontuacao"] != total:
                sys.exit("pontuacao diverge para %s: planilha %s, Apendice 2 %s"
                         % (nome, e["pontuacao"], total))
            experiencias.append({
                "nome": nome,
                "curto": e.get("nome_quadro") or nome,
                "rota": rota["id"], "rota_nome": rota["nome"],
                "municipio": mun, "uf": uf, "coleta": coleta, "data": data, "equipe": equipe,
                "ref_id": ref,
                "lat": b.get("lat", nova.get("lat")),
                "lon": b.get("lon", nova.get("lon")),
                "nova_em_campo": ref is None,
                "eixo_cod": e.get("eixo_cod") or b.get("eixo_cod"),
                "estimada": bool(aba),
                "aba": aba,
                "ficha": e.get("ficha"),
                "postura": e.get("postura"),
                "info_financeira": e.get("info_financeira"),
                "confianca": e.get("confianca"),
                "pontuacao": total,
                "classificacao": classificar(total),
                "notas": {"impacto": imp, "inovacao": inov, "operacao": oper, "investimento": inv},
                "posicao": e.get("posicao"),
                "itens": e.get("itens"),
                "bloco_a": {"min": e.get("a_min"), "max": e.get("a_max")},
                "bloco_b": {"min": e.get("b_min"), "max": e.get("b_max")},
                "gabinete": b.get("pontuacao"),
            })

    faltando = [a for a in por_aba if a not in {x["aba"] for x in experiencias}]
    if faltando:
        sys.exit("abas da planilha sem parada de rota correspondente: %s" % faltando)

    # --- quadros consolidados ---------------------------------------------
    qc = wb["Quadros da carteira"]

    def rubricas(r0, r1):
        out = []
        for r in range(r0, r1 + 1):
            if qc.cell(r, 1).value is None:
                continue
            out.append({
                "n": qc.cell(r, 1).value,
                "rubrica": qc.cell(r, 2).value,
                "comp": [n(qc.cell(r, c).value) for c in range(3, 8)],
                "min": n(qc.cell(r, 8).value), "max": n(qc.cell(r, 9).value),
                "pct": n(qc.cell(r, 10).value, 8),
            })
        return out

    def linha(r):
        return {"rotulo": qc.cell(r, 2).value,
                "min": n(qc.cell(r, 8).value), "max": n(qc.cell(r, 9).value)}

    quadros = {
        "contratavel": {
            "rubricas": rubricas(6, 38),
            "custo_base": {"comp": [n(qc.cell(39, c).value) for c in range(3, 8)],
                           "min": n(qc.cell(39, 8).value), "max": n(qc.cell(39, 9).value)},
            "gestao": linha(40), "contingencia": linha(41), "total": linha(43),
        },
        "referencia": {
            "rubricas": rubricas(48, 80),
            "custo_base": {"comp": [n(qc.cell(81, c).value) for c in range(3, 8)],
                           "min": n(qc.cell(81, 8).value), "max": n(qc.cell(81, 9).value)},
            "gestao": linha(82), "contingencia": linha(83), "total": linha(85),
        },
        "carteira": {
            "reais": {"min": n(qc.cell(88, 8).value), "max": n(qc.cell(88, 9).value)},
            "dolares": {"min": n(qc.cell(89, 8).value), "max": n(qc.cell(89, 9).value)},
        },
        "anualizacao": [
            {"ano": qc.cell(r, 2).value, "base": n(qc.cell(r, 3).value),
             "total": n(qc.cell(r, 4).value), "pct": n(qc.cell(r, 5).value, 8)}
            for r in range(93, 97) if qc.cell(r, 2).value
        ],
    }

    # --- fluxos da Figura 7.10: bloco -> eixo -> postura -> componente ------
    # Cada item da aba Base entra com o seu custo-base maximo, escalado para
    # que a soma por experiencia e bloco feche com o total maximo (com gestao
    # e contingencia) do Quadro por experiencia -- o mesmo criterio da figura.
    b = wb["Base"]
    por_nome = {v["nome_quadro"]: v for v in por_aba.values()}
    linhas_base, soma_base = [], {}
    for r in range(4, b.max_row + 1):
        ex = b.cell(r, 2).value
        if not ex:
            continue
        bloco = "A" if b.cell(r, 17).value == "S" else "B"
        comp = str(b.cell(r, 4).value or "")[:2]
        v = float(b.cell(r, 15).value or 0) / 1e6
        if ex not in por_nome:
            sys.exit("experiencia da aba Base sem linha no Quadro: %s" % ex)
        linhas_base.append((ex, bloco, b.cell(r, 3).value, comp, v))
        soma_base[(ex, bloco)] = soma_base.get((ex, bloco), 0) + v
    fl = {}
    for ex, bloco, postura, comp, v in linhas_base:
        if v <= 0:
            continue
        q = por_nome[ex]
        alvo = q["a_max"] if bloco == "A" else q["b_max"]
        k = (bloco, q["eixo_cod"], postura, comp)
        fl[k] = fl.get(k, 0) + v * alvo / soma_base[(ex, bloco)]
    fluxos = [{"bloco": k[0], "eixo": k[1], "postura": k[2], "comp": k[3], "valor": round(v, 6)}
              for k, v in sorted(fl.items())]

    # --- figuras 7.1 a 7.6 e 7.8 (planilha de apoio da secao 7) ---------------
    secao7 = None
    apoio7 = os.path.join(os.path.dirname(os.path.abspath(xlsx)), "PTE2026_secao7_base_e_graficos.xlsx")
    if os.path.exists(apoio7):
        w7 = openpyxl.load_workbook(apoio7, data_only=True)
        ind, res = w7["Indicadores 7.1"], w7["Resumo 7.2–7.3"]

        def matriz(ws, r_cab, r0, r1, c1):
            cols = [ws.cell(r_cab, c).value for c in range(2, c1 + 1)]
            return {"colunas": cols,
                    "linhas": [{"rotulo": ws.cell(r, 1).value,
                                "valores": [ws.cell(r, c).value or 0 for c in range(2, c1 + 1)]}
                               for r in range(r0, r1 + 1) if ws.cell(r, 1).value]}

        def lista(ws, r0, r1):
            return [{"rotulo": ws.cell(r, 1).value, "n": ws.cell(r, 2).value or 0}
                    for r in range(r0, r1 + 1) if ws.cell(r, 1).value]

        secao7 = {
            "fichas": ind.cell(52, 2).value,
            "f71": matriz(ind, 4, 5, 8, 4),
            "f72": matriz(ind, 11, 12, 14, 5),
            "f73": matriz(ind, 17, 18, 22, 5),
            "f74": lista(ind, 26, 33),
            "f75": lista(ind, 37, 42),
            "f76": lista(ind, 46, 50),
            "f78": [{"rotulo": res.cell(r, 1).value, "min": n(res.cell(r, 2).value), "max": n(res.cell(r, 3).value)}
                    for r in range(21, 26)],
            "t72": [{"rotulo": res.cell(r, 1).value, "min": n(res.cell(r, 2).value),
                     "max": n(res.cell(r, 3).value), "pct": n(res.cell(r, 4).value, 6)}
                    for r in range(31, 39)],
            "cambio": res.cell(9, 1).value,
        }
        if secao7["fichas"] != 29:
            sys.exit("Indicadores 7.1: conferencia de fichas diferente de 29")
        soma78 = sum(x["max"] for x in secao7["f78"])
        if abs(soma78 - quadros["contratavel"]["custo_base"]["max"]) > 0.01:
            sys.exit("Figura 7.8 nao fecha com o Quadro 1 (%.3f)" % soma78)
    else:
        print("aviso: %s ausente -- figuras 7.1 a 7.6 ficam fora do painel" % apoio7)

    est = [e for e in experiencias if e["estimada"]]
    doc = {
        "meta": {
            "fonte": "Produto 5 B — Relatório final (OEI/PTE-NE), seção 7 e "
                     "PTE2026_fichas_investimento.xlsx",
            "contrato": "13849/2026 OEI/FPOS — TdR 12.500/2026",
            "classe": "Classe 5 — AACE International, RP 18R-97",
            "moeda": "R$ milhões, preços de setembro de 2026",
            "horizonte": "36 meses",
            "organizacoes": len(experiencias),
            "estimadas": len(est),
            "fichas": 29,
            "componentes": [{"cod": c, "nome": t} for c, t in COMPONENTES],
            "postura_ordem": POSTURA_ORDEM,
            "pesos": PESOS,
            "faixas": {"alta": "80 a 100", "estrategico": "50 a 79", "nao": "abaixo de 50"},
            "postura_rotulo": POSTURA_ROTULO,
        },
        "rotas": [{k: v for k, v in r.items() if k != "paradas"} for r in ROTAS],
        "experiencias": experiencias,
        "quadros": quadros,
        "fluxos": fluxos,
        "secao7": secao7,
    }

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print("%s: %d organizacoes, %d com estimativa" % (OUT, len(experiencias), len(est)))
    print("carteira R$ %.1f a %.1f mi" % (quadros["carteira"]["reais"]["min"],
                                          quadros["carteira"]["reais"]["max"]))


if __name__ == "__main__":
    main()
