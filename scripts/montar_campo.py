#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monta dados_campo.json -- a camada de evidencia das incursoes (P3, P4, P5).

Fonte: Documentos Tecnicos 3, 4 e 5 (Quanta/OEI). As notas vem do Apendice 2
do P5, que e a fonte canonica: o texto corrido dos eixos tem rotulos de
classificacao divergentes e a coluna "peso" das fichas e ambigua.

Cruza cada experiencia com a base de prospeccao (assets/data/iniciativas.js)
para permitir a comparacao gabinete x campo.
"""
import json, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "assets", "data", "iniciativas.js")
OUT = os.path.join(ROOT, "dados_campo.json")

# nome | eixo | A oper | B inv | C impacto | D inov | total/100 | classif
# | envelope min | max (R$ mi) | postura | base informacional | rota | o que se apoia
EXP = [
 ("Fazenda Nutrilite Brasil","NIVA",5,5,5,5,100,"alta",1.1,2.2,"condicionado","parcial","R2",
  "Semimecanização da colheita de acerola, diversificação de culturas e contabilização de emissões."),
 ("Trilha Caminhos da Ibiapaba","NIVA",5,5,5,5,100,"alta",3.6,5.1,"condicionado","parcial","R2",
  "Formalização jurídica do movimento, indicadores e cadeia do ecoturismo comunitário."),
 ("No Clima da Caatinga","NIVA",5,5,5,5,100,"alta",5.1,8.3,"quantificacao","ausente","R2",
  "Restauração com raízes alongadas, SAFs, segurança hídrica e diversificação financeira."),
 ("Tecnologia SARA","NIVA",5,5,5,5,100,"alta",3.0,5.6,"quantificacao","ausente","R1",
  "Programa permanente de difusão, dimensionamento nas três escalas e unidades nos 9 estados."),
 ("Rede Xique Xique","BIO",5,4,5,5,97,"alta",2.0,3.5,"quantificacao","ausente","Extra",
  "Política de logística para 33 municípios, capital de giro e unidade de polpa com SIF."),
 ("Acreditar Microcrédito","FSI",4,5,5,5,95,"alta",10.2,13.6,"direto","completa","R3",
  "Ampliação do fundo, redução de juros por diluição de custo e formação de agentes de crédito."),
 ("Sistema Metroviário do Ceará","NIVA",5,5,4,5,94,"alta",40.0,80.0,"condicionado","parcial","Extra",
  "Interiorização (VLT Cariri e Sobral), integração tarifária e transição para energia limpa."),
 ("Porto Digital — Recife","ADT",5,4,4,5,91,"alta",13.0,23.5,"quantificacao","ausente","R3",
  "Interiorização para Petrolina, Garanhuns e Araripina e sistematização da transferência."),
 ("Fazenda Tamanduá","NIVA",5,4,5,4,91,"alta",1.7,3.0,"quantificacao","ausente","Extra",
  "Crédito e ATER para médio porte, mecanismo de PSA e selo de origem. Não é custeio."),
 ("CTERSA","TE",3,5,5,5,90,"alta",3.6,6.1,"preparacao","ausente","R1",
  "Definição da configuração jurídica (gargalo primário) e custeio pós-implantação."),
 ("EMBRAPII IA — IFCE","ADT",5,4,3,5,85,"alta",4.8,8.8,"condicionado","parcial","Extra",
  "Prospecção dirigida à transformação ecológica e serviços tecnológicos a pequenos produtores."),
 ("Projeto Vale Sustentável","NIVA",4,3,5,4,83,"alta",10.4,12.7,"condicionado","parcial","R1",
  "Metodologia de contabilização de carbono para a Caatinga e piloto de PSA com o INCRA."),
 ("Instituto Caburé","NIVA",3,4,5,4,81,"alta",3.4,4.5,"direto","completa","R2",
  "Fortalecimento institucional, sistematização da metodologia e economia azul."),
 ("Instituto Casaca de Couro","NIVA",4,4,4,4,80,"alta",2.3,3.9,"preparacao","ausente","R1",
  "Irrigação de áreas coletivas, redução do custo da certificação e ampliação da equipe."),
 ("Cooperativa Pindorama","TE",4,4,4,4,80,"alta",5.9,11.1,"preparacao","ausente","R3",
  "Antecipação do projeto de biogás da vinhaça e sistematização da repartição de CBIOs."),
 ("Blue C","NIVA",3,3,5,4,78,"estrategico",0.15,0.35,"preparatorio","completa","Extra",
  "Capital de giro para produzir algas antes da venda. Menor operação da carteira."),
 ("Um Milhão de Tetos Solares","TE",5,3,3,4,76,"estrategico",0.8,1.5,"preparatorio","ausente","R1",
  "Assessoria jurídica para a barreira regulatória com a concessionária."),
 ("Consórcio Público da Ibiapaba","EC",3,4,4,4,75,"estrategico",1.5,3.0,"preparatorio","parcial","R2",
  "Centrais de resíduos, redução da dependência do ICMS Verde e inclusão de catadores."),
 ("Cooperativa Solar Bem Viver","TE",3,4,4,4,75,"estrategico",0.4,0.8,"preparatorio","ausente","R1",
  "Equacionamento da divisão de áreas de concessão entre dois cadastros da concessionária."),
 ("Porto Digital — Caruaru","ADT",3,4,2,4,63,"estrategico",0.0,0.0,"preparatorio","ausente","R3",
  "Sem alocação própria: contemplada no envelope do Porto Digital — Recife."),
 ("Programa Terra Plantar","BIO",4,2,3,3,62,"estrategico",1.0,2.0,"preparatorio","ausente","R3",
  "Estruturação de indicadores e rastreabilidade da aplicação de recursos."),
 ("AMAREZ","EC",3,3,3,3,60,"estrategico",0.10,0.20,"preparatorio","parcial","R1",
  "Capital de giro para estocar material e vender direto à indústria, sem intermediação."),
 ("Banco Comunitário de Araçoiaba","FSI",2,2,2,3,46,"nao",0.0,0.0,"","","R3",
  "Não recomendada nesta etapa: requer fortalecimento institucional prévio."),
 ("Carbono Social do Bioma Caatinga","FSI",2,2,1,3,40,"nao",0.0,0.0,"","","R3",
  "Não recomendada nesta etapa: sem créditos gerados, sem receita e sem financiamento."),
]

PESOS = {"impacto": 30, "inovacao": 30, "operacao": 25, "investimento": 15}
STOP = set("de da do das dos e a o as os para em no na programa projeto instituto "
           "associacao cooperativa rede sistema centro unidade publico parque "
           "tecnologico sociedade brasil nordeste com".split())


def _norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]", " ", s)


def _toks(s):
    return {t for t in _norm(s).split() if len(t) > 2 and t not in STOP}


def carregar_base():
    txt = open(BASE, encoding="utf-8").read()
    bruto = txt.split("=", 1)[1].strip().rstrip(";")
    return json.loads(bruto)["iniciativas"]


def main():
    base = carregar_base()
    saida = []
    for (nome, eixo, a, b, c, d, total, classif, emin, emax,
         postura, baseinf, rota, apoio) in EXP:
        ti = _toks(nome)
        melhor, escore = None, 0.0
        for r in base:
            tb = _toks(r["nome"] + " " + (r.get("org") or ""))
            if not ti or not tb:
                continue
            s = len(ti & tb) / max(1, min(len(ti), len(tb)))
            if s > escore:
                escore, melhor = s, r
        casou = escore >= 0.6
        saida.append({
            "nome": nome,
            "eixo_cod": eixo,
            "notas": {"operacao": a, "investimento": b, "impacto": c, "inovacao": d},
            "total": total,
            "classificacao": classif,
            "envelope": {"min": emin, "max": emax},
            "postura": postura,
            "base_informacional": baseinf,
            "rota": rota,
            "apoio": apoio,
            "ref_id": melhor["id"] if casou else None,
            "gabinete": melhor["pontuacao"] if casou else None,
            "municipio": melhor.get("municipio") if casou else None,
            "estado": melhor.get("estado") if casou else None,
            "lat": melhor.get("lat") if casou else None,
            "lon": melhor.get("lon") if casou else None,
        })

    doc = {
        "meta": {
            "fonte": "Documentos Tecnicos 3, 4 e 5 - Quanta/OEI",
            "contrato": "13849/2026 OEI/FPOS - TdR 12.500/2026",
            "referencia_notas": "Apendice 2 do Produto 5",
            "pesos": PESOS,
            "faixas": {"alta": "80 a 100", "estrategico": "50 a 79", "nao": "abaixo de 50"},
            "moeda": "R$ milhoes correntes de agosto de 2026, horizonte de 36 meses",
            "total": len(saida),
        },
        "experiencias": saida,
    }
    json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    casadas = sum(1 for x in saida if x["ref_id"])
    print(f"OK  {len(saida)} experiencias -> {os.path.relpath(OUT, ROOT)}")
    print(f"    cruzadas com a base de prospeccao: {casadas}  |  sem correspondencia: {len(saida)-casadas}")
    print(f"    envelope: R$ {sum(x['envelope']['min'] for x in saida):.1f} a "
          f"{sum(x['envelope']['max'] for x in saida):.1f} mi")


if __name__ == "__main__":
    main()
