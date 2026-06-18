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
              ("Bioeconomia e Sistemas Agroalimentares Adaptados", "BIO", "#55b847"),
              ("Transição Energética", "TE", "#f37520"),
              ("Economia Circular e Solidária", "EC", "#17a2b8"),
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
        crit = {key: val(r, 22 + k) for k, (key, _) in enumerate(CRIT)}
        eixo = val(r, 16)
        items.append({
            "id": idn, "nome": nm, "objetivo": val(r, 3), "tematica": val(r, 4), "org": val(r, 5),
            "cnpj": val(r, 6), "fundacao": val(r, 7), "cnae": val(r, 8), "endereco": val(r, 9),
            "lat": val(r, 10), "lon": val(r, 11), "avaliador": val(r, 12),
            "municipio": val(r, 13), "estado": val(r, 14), "biomas": val(r, 15),
            "eixo": eixo, "eixo_cod": EIXO_COD.get(eixo), "eixo_sec": val(r, 17),
            "setor": val(r, 18), "natureza": val(r, 19), "tipo_inst": val(r, 20), "salvaguardas": val(r, 21),
            "criterios": crit, "pontuacao": val(r, 32), "observacoes": val(r, 33),
            "preselecionada": idn in PRE, "pre_ufs": PRE.get(idn, []), "fora_ne": idn in FORA_NE,
        })

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
