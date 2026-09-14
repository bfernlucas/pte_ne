/**
 * Area restrita do painel PTE-NE.
 *
 * A camada de evidencia de campo e publicada apenas cifrada
 * (assets/data/campo.enc.js). A senha da equipe deriva a chave que a abre;
 * sem ela o arquivo e ruido, mesmo baixado direto do repositorio.
 *
 * Esquema: PBKDF2-HMAC-SHA256 (600.000 iteracoes) -> AES-256-GCM.
 * Exige contexto seguro (https ou localhost) -- nao funciona em file://.
 */
(function (global) {
  "use strict";

  var CHAVE_SESSAO = "pte.campo";
  var PAGINA_LOGIN = "entrar.html";

  function bytes(txt) {
    return new TextEncoder().encode(txt);
  }

  function deB64(s) {
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function derivarChave(usuario, senha, salt, iteracoes) {
    var material = bytes(usuario.trim().toLowerCase() + "\n" + senha);
    return crypto.subtle
      .importKey("raw", material, "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: iteracoes, hash: "SHA-256" },
          base,
          { name: "AES-GCM", length: 256 },
          false,
          ["decrypt"]
        );
      });
  }

  /** Tenta abrir o pacote cifrado. Resolve com os dados; rejeita se a senha nao confere. */
  function abrir(usuario, senha) {
    var pacote = global.PTE_CAMPO_ENC;
    if (!pacote) {
      return Promise.reject(new Error("arquivo-ausente"));
    }
    if (!global.crypto || !global.crypto.subtle) {
      return Promise.reject(new Error("contexto-inseguro"));
    }
    return derivarChave(usuario, senha, deB64(pacote.salt), pacote.iter)
      .then(function (chave) {
        return crypto.subtle.decrypt(
          { name: "AES-GCM", iv: deB64(pacote.nonce) },
          chave,
          deB64(pacote.ct)
        );
      })
      .then(function (claro) {
        var dados = JSON.parse(new TextDecoder().decode(claro));
        try {
          sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(dados));
        } catch (e) {
          /* sessao indisponivel: segue so em memoria */
        }
        global.PTE_CAMPO = dados;
        return dados;
      })
      .catch(function (erro) {
        if (erro && (erro.message === "arquivo-ausente" || erro.message === "contexto-inseguro")) {
          throw erro;
        }
        throw new Error("senha-incorreta");
      });
  }

  /** Dados ja abertos nesta sessao, ou null. */
  function dados() {
    if (global.PTE_CAMPO) return global.PTE_CAMPO;
    try {
      var bruto = sessionStorage.getItem(CHAVE_SESSAO);
      if (bruto) {
        global.PTE_CAMPO = JSON.parse(bruto);
        return global.PTE_CAMPO;
      }
    } catch (e) {
      /* sem sessionStorage */
    }
    return null;
  }

  function sair() {
    try {
      sessionStorage.removeItem(CHAVE_SESSAO);
    } catch (e) {
      /* nada a fazer */
    }
    delete global.PTE_CAMPO;
  }

  /** Em paginas restritas: devolve os dados ou manda para o login. */
  function exigir() {
    var d = dados();
    if (!d) {
      location.replace(PAGINA_LOGIN + "?destino=" + encodeURIComponent(location.pathname.split("/").pop()));
      return null;
    }
    return d;
  }

  global.PTEAuth = { abrir: abrir, dados: dados, sair: sair, exigir: exigir };
})(window);
