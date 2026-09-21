#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cifra uma camada de dados restrita para publicacao no GitHub Pages.

Os arquivos de origem (dados_campo.json, dados_p5.json) NUNCA entram no
repositorio: ficam no .gitignore. O que se publica sao apenas os pacotes
.enc.js, que sem a senha sao ruido -- mesmo baixados diretamente do
repositorio publico.

  python3 scripts/cifrar_campo.py                 # evidencia de campo
  python3 scripts/cifrar_campo.py --senha "..."   # senha por argumento

  # camada do Produto 5 (faixas de recursos por organizacao)
  python3 scripts/cifrar_campo.py --src dados_p5.json \
      --out assets/data/p5.enc.js --var PTE_P5_ENC

A MESMA senha e usuario devem valer para todos os pacotes: o login abre
todos de uma vez.

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


def cifrar_arquivo(src: str, out: str, var: str, usuario: str, senha: str) -> dict:
    """Cifra um JSON em claro num pacote window.<var>. Devolve os dados."""
    dados = json.load(open(src, encoding="utf-8"))
    claro = json.dumps(dados, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    salt = secrets.token_bytes(16)
    nonce = secrets.token_bytes(12)
    cifrado = AESGCM(derivar(usuario, senha, salt)).encrypt(nonce, claro, None)
    pacote = {
        "v": 1, "kdf": "PBKDF2-SHA256", "iter": ITER, "cipher": "AES-256-GCM",
        "salt": base64.b64encode(salt).decode(),
        "nonce": base64.b64encode(nonce).decode(),
        "ct": base64.b64encode(cifrado).decode(),
    }
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(f"window.{var} = " + json.dumps(pacote) + ";\n")
    return dados


def abrir_pacote(caminho: str, usuario: str, senha: str) -> bool:
    """True se o pacote cifrado existente abre com estas credenciais."""
    txt = open(caminho, encoding="utf-8").read()
    pacote = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])
    chave = derivar(usuario, senha, base64.b64decode(pacote["salt"]))
    try:
        AESGCM(chave).decrypt(base64.b64decode(pacote["nonce"]), base64.b64decode(pacote["ct"]), None)
        return True
    except Exception:
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--usuario", default="equipe")
    ap.add_argument("--senha")
    ap.add_argument("--src", default=SRC, help="JSON em claro (padrao: dados_campo.json)")
    ap.add_argument("--out", default=OUT, help="pacote cifrado a gerar")
    ap.add_argument("--var", default="PTE_CAMPO_ENC", help="nome da global em window")
    args = ap.parse_args()

    src = args.src if os.path.isabs(args.src) else os.path.join(ROOT, args.src)
    out = args.out if os.path.isabs(args.out) else os.path.join(ROOT, args.out)
    if not os.path.exists(src):
        print(f"ERRO: nao encontrei {src}", file=sys.stderr)
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

    dados = json.load(open(src, encoding="utf-8"))
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

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"window.{args.var} = " + json.dumps(pacote) + ";\n")

    n = len(dados.get("experiencias", []))
    print(f"OK  {n} experiencias cifradas")
    print(f"    {len(claro)/1024:.1f} KB em claro -> {len(cifrado)/1024:.1f} KB cifrados")
    print(f"    usuario: {args.usuario}  |  {ITER:,} iteracoes".replace(",", "."))
    print(f"    -> {os.path.relpath(out, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
