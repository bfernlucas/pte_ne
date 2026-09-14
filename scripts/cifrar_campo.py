#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cifra a camada de evidencia de campo para publicacao no GitHub Pages.

O arquivo de origem (dados_campo.json) NUNCA entra no repositorio: fica no
.gitignore. O que se publica e apenas assets/data/campo.enc.js, que sem a
senha e ruido -- mesmo baixado diretamente do repositorio publico.

  python3 scripts/cifrar_campo.py                 # pede a senha
  python3 scripts/cifrar_campo.py --senha "..."   # senha por argumento

Esquema: PBKDF2-HMAC-SHA256 (600.000 iteracoes) -> AES-256-GCM.
A chave deriva de usuario + senha, entao os dois sao necessarios.
"""
import argparse, base64, getpass, hashlib, json, os, secrets, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dados_campo.json")
OUT = os.path.join(ROOT, "assets", "data", "campo.enc.js")
ITER = 600_000


def derivar(usuario: str, senha: str, salt: bytes) -> bytes:
    material = f"{usuario.strip().lower()}\n{senha}".encode("utf-8")
    return hashlib.pbkdf2_hmac("sha256", material, salt, ITER, dklen=32)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--usuario", default="equipe")
    ap.add_argument("--senha")
    args = ap.parse_args()

    if not os.path.exists(SRC):
        print(f"ERRO: nao encontrei {SRC}", file=sys.stderr)
        return 1

    senha = args.senha or getpass.getpass("Senha da equipe: ")
    if len(senha) < 8:
        print("ERRO: use ao menos 8 caracteres.", file=sys.stderr)
        return 1
    if len(senha) < 16:
        print("AVISO: senha curta. O arquivo cifrado e publico, entao pode ser\n"
              "       testada offline sem limite de tentativas. Evite padroes\n"
              "       previsiveis (sigla do projeto + ano, por exemplo).",
              file=sys.stderr)

    dados = json.load(open(SRC, encoding="utf-8"))
    claro = json.dumps(dados, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    salt = secrets.token_bytes(16)
    nonce = secrets.token_bytes(12)
    cifrado = AESGCM(derivar(args.usuario, senha, salt)).encrypt(nonce, claro, None)

    pacote = {
        "v": 1,
        "kdf": "PBKDF2-SHA256",
        "iter": ITER,
        "cipher": "AES-256-GCM",
        "salt": base64.b64encode(salt).decode(),
        "nonce": base64.b64encode(nonce).decode(),
        "ct": base64.b64encode(cifrado).decode(),
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("window.PTE_CAMPO_ENC = " + json.dumps(pacote) + ";\n")

    n = len(dados.get("experiencias", []))
    print(f"OK  {n} experiencias cifradas")
    print(f"    {len(claro)/1024:.1f} KB em claro -> {len(cifrado)/1024:.1f} KB cifrados")
    print(f"    usuario: {args.usuario}  |  {ITER:,} iteracoes".replace(",", "."))
    print(f"    -> {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
