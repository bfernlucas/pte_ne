#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Publica as camadas restritas do painel numa só passada:

  1. gen_p5.py        planilha de estimativa  -> dados_p5.json    (em claro, fora do Git)
  2. montar_campo.py  P5 B + leitura de campo -> dados_campo.json (em claro, fora do Git)
  3. cifra os dois com a senha da equipe      -> p5.enc.js e campo.enc.js

Antes de cifrar, confere a senha contra o campo.enc.js publicado: se não
abrir, para sem gravar nada — um erro de digitação não tranca a equipe fora.
Para trocar a senha de propósito, use --nova-senha.

Uso (no Windows, na pasta do clone):
    python scripts\\publicar_p5.py
    python scripts\\publicar_p5.py --xlsx "C:\\...\\PTE2026_fichas_investimento.xlsx"
"""
import argparse, getpass, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
ROOT = os.path.dirname(AQUI)

import gen_p5, montar_campo, cifrar_campo  # noqa: E402

ENC_CAMPO = os.path.join(ROOT, "assets", "data", "campo.enc.js")
ENC_P5 = os.path.join(ROOT, "assets", "data", "p5.enc.js")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", help="PTE2026_fichas_investimento.xlsx (padrão: pasta PTE - Incursões)")
    ap.add_argument("--usuario", default="equipe")
    ap.add_argument("--nova-senha", action="store_true",
                    help="não conferir contra o pacote atual (troca deliberada de senha)")
    a = ap.parse_args()

    print("1/3  gerando dados_p5.json ...")
    sys.argv = [sys.argv[0]]
    gen_p5.main(a.xlsx)
    print("2/3  gerando dados_campo.json ...")
    montar_campo.main()

    senha = getpass.getpass("3/3  senha da equipe (usuário '%s'): " % a.usuario)
    if a.nova_senha:
        if getpass.getpass("     repita a nova senha: ") != senha:
            print("ERRO: as senhas não conferem. Nada foi gravado.")
            return 1
    elif os.path.exists(ENC_CAMPO) and not cifrar_campo.abrir_pacote(ENC_CAMPO, a.usuario, senha):
        print("ERRO: essa senha não abre o campo.enc.js publicado. Nada foi gravado.\n"
              "      (Para trocar a senha de propósito, rode com --nova-senha.)")
        return 1

    cifrar_campo.cifrar_arquivo(os.path.join(ROOT, "dados_campo.json"), ENC_CAMPO,
                                "PTE_CAMPO_ENC", a.usuario, senha)
    cifrar_campo.cifrar_arquivo(os.path.join(ROOT, "dados_p5.json"), ENC_P5,
                                "PTE_P5_ENC", a.usuario, senha)
    for f in (ENC_CAMPO, ENC_P5):
        if not cifrar_campo.abrir_pacote(f, a.usuario, senha):
            print("ERRO: conferência pós-cifra falhou em %s" % f)
            return 1
    print("OK   campo.enc.js e p5.enc.js cifrados e conferidos com a mesma senha.")
    print("     Pode avisar o Claude para publicar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
