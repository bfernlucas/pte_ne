#!/usr/bin/env python3
"""Gera assets/data/iniciativas.js a partir de PTE2026_matriz_dashboard.xlsx.
Uso: python3 scripts/gen_data.py
"""
import openpyxl, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "PTE2026_matriz_dashboard.xlsx")
OUT = os.path.join(ROOT, "assets", "data", "iniciativas.js")

# Pré-selecionadas (aba Cruzamento): id -> UFs onde aparece
PRE = {27: ["MA"], 21: ["PI"], 52: ["PI", "CE"], 10: ["CE", "RN", "PB", "PE", "AL", "BA"],
       20: ["CE"], 74: ["CE"], 32: ["CE"], 38: ["CE"], 57: ["CE"], 58: ["CE"], 6: ["RN"],
       34: ["RN"], 24: ["PB", "PE"], 76: ["PB"], 53: ["PB"], 1: ["PE"], 12: ["PE"], 13: ["PE"],
       39: ["PE"], 56: ["AL"], 9: ["AL"], 16: ["AL"], 66: ["AL"], 67: ["AL"], 47: ["AL"],
       50: ["SE"], 75: ["SE"], 3: ["BA"], 17: ["BA"], 65: ["BA"], 72: ["BA"]}
FORA_NE = {11, 19, 59, 60, 70}  # sede fora do NE (não são sites de visita de campo)
EXCLUDE = {29}  # ID 29 (Crédito de Carbono Integral/CCI-BSHE) removida — mesma entidade da ID 56

# Iniciativas com mais de um local de visita possível. A rota escolhe a
# coordenada ótima entre estes pontos; o mapa mostra todos.
ALT_LOCAIS = {
    24: [  # Programa 1 Milhão de Tetos Solares
        {"municipio": "Remígio", "uf": "PB", "lat": -6.9528, "lon": -35.8331},
        {"municipio": "Araripina", "uf": "PE", "lat": -7.5764, "lon": -40.4983},
    ],
}

# Revisão editorial dos nomes: nome principal padronizado, sem siglas de UF,
# sem subtítulos/descrições e sem acrônimo da organização (que vira subtítulo).
NAME_OVERRIDES = {
    3: "Conselho Gestor do Fundo Rotativo",
    5: "Rede de Ativadores de Crédito Socioambiental",
    7: "ID Hub Brazil",
    8: "Projeto Pacto Global de Jovens pelo Clima",
    9: "OxeTech",
    11: "Programa Jovem Empreendedor Primeiros Passos (JEPP)",
    13: "Parque Tecnológico Porto Digital",
    17: "Rede BATUC de Turismo Comunitário",
    18: "Associação das Comunidades Negras Rurais Quilombolas do Maranhão",
    19: "Territórios da Cidadania",
    21: "Green Energy Park",
    22: "Logística Verde e Operações Sustentáveis no Porto de Suape",
    23: "SENAI CIMATEC",
    24: "Programa 1 Milhão de Tetos Solares (P1MTS)",
    25: "Programa Água Doce",
    26: "APROBAMBU",
    27: "Raízes Solares",
    28: "Programa Sertão Vivo",
    29: "Crédito de Carbono Integral (CCI-BSHE)",
    30: "Programa Município Selo Verde",
    34: "Modelo de Gestão Municipal de Resíduos Sólidos de Arez",
    37: "Labifor",
    39: "Programas Complementares de Captação de Água da ASA",
    40: "Projeto Tecnologia SARA",
    41: "Zoneamento Ecológico-Econômico da Zona Costeira do Ceará",
    44: "Conecta Caatinga",
    47: "SIMACaatinga",
    49: "Renova-Semiárido",
    51: "No Clima da Caatinga",
    56: "Projetos de Conservação e Sustentabilidade do Bioma Caatinga",
    59: "Comitê da Bacia Hidrográfica do Rio São Francisco (CBHSF)",
    60: "Observatório da Transição Energética",
    61: "Hub de Hidrogênio Verde do Complexo do Pecém",
    62: "Projeto Pecém – Fortescue",
    68: "Voltalia – Cluster Serra Branca",
    69: "Complexo Solar São Gonçalo – Enel Green Power",
    72: "Programa Indústria Verde – FIEB",
    73: "Plano de Descarbonização e Hub de H2V – Porto do Itaqui / EMAP",
    74: "Complexo Eólico Marinho Dragão do Mar – Energo",
    75: "Hub de Hidrogênio Verde de Sergipe – Green Energy Park / SergipeTec",
    76: "Cooperativa de Energia Solar Bem Viver / CERSA",
    77: "Grupo EQM / ZEG Biogás – Biometano da Vinhaça",
    78: "SENAI e Hubs de Inovação em Hidrogênio Verde / Powershoring",
    80: "Debêntures Verdes da Casa dos Ventos (Complexo Rio do Vento)",
    81: "Instituto Clima e Sociedade",
    82: "SITAWI Finanças do Bem",
}

# Ajuste de organização (subtítulo) — quando difere do que consta na planilha
ORG_OVERRIDES = {
    56: "Associação de Produtores de Crédito da Caatinga",
}

EIXO_COD = {"Finanças Sustentáveis e Inclusivas": "FSI", "Adensamento Tecnológico": "ADT",
            "Bioeconomia e Sistemas Agroalimentares Adaptados": "BIO", "Transição Energética": "TE",
            "Economia Circular e Solidária": "EC", "Nova Infraestrutura Verde-Azul e Adaptação Climática": "NIVA"}
CRIT = [("relevancia", "Relevância territorial"), ("clima", "Adaptação/mitigação climática"),
        ("cadeias", "Fortalecimento de cadeias produtivas"), ("viabilidade", "Viabilidade operacional"),
        ("replicabilidade", "Replicabilidade/escala"), ("inovacao", "Inovação tecnológica e social"),
        ("investimentos", "Atração de investimentos verdes"), ("inclusao", "Inclusão produtiva"),
        ("equidade", "Equidade de gênero, raça e etnia"), ("governanca", "Governança multinível")]
# Cores dos eixos alinhadas à paleta do Plano Brasil Nordeste (PTE-NE)
EIXO_CORES = [("Finanças Sustentáveis e Inclusivas", "FSI", "#1f4da1"),
              ("Adensamento Tecnológico", "ADT", "#7a3fb8"),
              ("Bioeconomia e Sistemas Agroalimentares Adaptados", "BIO", "#43a047"),
              ("Transição Energética", "TE", "#f37520"),
              ("Economia Circular e Solidária", "EC", "#f6a609"),
              ("Nova Infraestrutura Verde-Azul e Adaptação Climática", "NIVA", "#0d9488")]


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["Matriz de avaliação"]

    def val(r, c):
        v = ws.cell(row=r, column=c).value
        if isinstance(v, str):
            v = v.strip()
        return v if v not in ("",) else None

    items = []
    for r in range(4, ws.max_row + 1):
        nm = val(r, 2)
        if not nm or str(nm).strip().upper() == "NOVAS INICIATIVAS":
            continue
        idn = int(val(r, 1))
        if idn in EXCLUDE:
            continue
        nm = NAME_OVERRIDES.get(idn, nm)
        crit = {key: val(r, 22 + k) for k, (key, _) in enumerate(CRIT)}
        eixo = val(r, 16)
        items.append({
            "id": idn, "nome": nm, "objetivo": val(r, 3), "tematica": val(r, 4), "org": ORG_OVERRIDES.get(idn, val(r, 5)),
            "cnpj": val(r, 6), "fundacao": val(r, 7), "cnae": val(r, 8), "endereco": val(r, 9),
            "lat": val(r, 10), "lon": val(r, 11), "avaliador": val(r, 12),
            "municipio": val(r, 13), "estado": val(r, 14), "biomas": val(r, 15),
            "eixo": eixo, "eixo_cod": EIXO_COD.get(eixo), "eixo_sec": val(r, 17),
            "setor": val(r, 18), "natureza": val(r, 19), "tipo_inst": val(r, 20), "salvaguardas": val(r, 21),
            "criterios": crit, "pontuacao": val(r, 32), "observacoes": val(r, 33),
            "preselecionada": idn in PRE, "pre_ufs": PRE.get(idn, []), "fora_ne": idn in FORA_NE,
        })

    # coordenadas alternativas (rota escolhe a ótima; mapa mostra todas)
    for it in items:
        if it["id"] in ALT_LOCAIS:
            it["locais"] = ALT_LOCAIS[it["id"]]
            it["lat"] = it["locais"][0]["lat"]
            it["lon"] = it["locais"][0]["lon"]

    meta = {"fonte": "PTE2026_matriz_dashboard.xlsx", "total": len(items),
            "preselecionadas": sum(1 for i in items if i["preselecionada"]),
            "eixos": [{"nome": n, "cod": c, "cor": cor} for n, c, cor in EIXO_CORES],
            "criterios": [{"key": k, "label": l} for k, l in CRIT]}
    out = {"meta": meta, "iniciativas": items}
    js = "window.PTE_DATA = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n"
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"OK: {OUT} ({len(js)} bytes) | {meta['total']} iniciativas, {meta['preselecionadas']} pré-selecionadas")


if __name__ == "__main__":
    main()
