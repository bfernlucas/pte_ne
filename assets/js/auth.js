/**
 * Area restrita do painel PTE-NE.
 *
 * O painel inteiro fica atras de login. As camadas com dado sensivel sao
 * publicadas apenas cifradas:
 *   - assets/data/campo.enc.js -> evidencia das incursoes (PTE_CAMPO_ENC)
 *   - assets/data/p5.enc.js    -> faixas de recursos por organizacao,
 *                                 secao 7 do relatorio final (PTE_P5_ENC)
 * A senha da equipe deriva a chave que abre as duas; sem ela os arquivos
 * sao ruido, mesmo baixados direto do repositorio publico.
 *
 * Esquema: PBKDF2-HMAC-SHA256 (600.000 iteracoes) -> AES-256-GCM.
 * Exige contexto seguro (https ou localhost) -- nao funciona em file://.
 */
(function (global) {
  "use strict";

  var PAGINA_LOGIN = "entrar.html";

  /* Pacotes conhecidos. 'obrigatorio' derruba o login se faltar ou nao abrir;
     os opcionais permitem publicar o painel antes de uma camada existir. */
  var PACOTES = [
    { chave: "pte.campo", enc: "PTE_CAMPO_ENC", claro: "PTE_CAMPO", obrigatorio: true },
    { chave: "pte.p5", enc: "PTE_P5_ENC", claro: "PTE_P5", obrigatorio: false }
  ];

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

  function abrirPacote(usuario, senha, spec) {
    var pacote = global[spec.enc];
    if (!pacote) {
      return spec.obrigatorio
        ? Promise.reject(new Error("arquivo-ausente"))
        : Promise.resolve(null);
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
          sessionStorage.setItem(spec.chave, JSON.stringify(dados));
        } catch (e) {
          /* sessao indisponivel: segue so em memoria */
        }
        global[spec.claro] = dados;
        return dados;
      });
  }

  /** Abre todos os pacotes com as mesmas credenciais. Rejeita se a senha nao confere. */
  function abrir(usuario, senha) {
    if (!global.crypto || !global.crypto.subtle) {
      return Promise.reject(new Error("contexto-inseguro"));
    }
    return Promise.all(
      PACOTES.map(function (spec) {
        return abrirPacote(usuario, senha, spec).catch(function (erro) {
          if (erro && erro.message === "arquivo-ausente") throw erro;
          if (spec.obrigatorio) throw new Error("senha-incorreta");
          return { falhou: spec.enc };
        });
      })
    ).then(function (r) {
      var falhas = r.filter(function (x) { return x && x.falhou; });
      if (falhas.length) {
        /* o pacote obrigatorio abriu, logo a senha esta certa: o outro pacote
           foi cifrado com credenciais diferentes. Melhor avisar do que abrir
           o painel pela metade. */
        sair();
        throw new Error("camadas-desalinhadas");
      }
      return r[0];
    });
  }

  function lerSessao(spec) {
    if (global[spec.claro]) return global[spec.claro];
    try {
      var bruto = sessionStorage.getItem(spec.chave);
      if (bruto) {
        global[spec.claro] = JSON.parse(bruto);
        return global[spec.claro];
      }
    } catch (e) {
      /* sem sessionStorage */
    }
    return null;
  }

  /** Evidencia de campo ja aberta nesta sessao, ou null. */
  function dados() {
    return lerSessao(PACOTES[0]);
  }

  /** Camada do Produto 5 ja aberta nesta sessao, ou null. */
  function p5() {
    return lerSessao(PACOTES[1]);
  }

  function sair() {
    PACOTES.forEach(function (spec) {
      try {
        sessionStorage.removeItem(spec.chave);
      } catch (e) {
        /* nada a fazer */
      }
      delete global[spec.claro];
    });
  }

  /** Em paginas restritas: devolve os dados ou manda para o login. */
  function exigir() {
    var d = dados();
    if (!d) {
      location.replace(PAGINA_LOGIN + "?destino=" + encodeURIComponent(location.pathname.split("/").pop()));
      return null;
    }
    /* sessao aberta antes de a camada do relatorio final existir: o pacote
       esta na pagina, mas nao na sessao. Refaz o login para abrir os dois. */
    if (global[PACOTES[1].enc] && !p5()) {
      sair();
      location.replace(PAGINA_LOGIN + "?destino=" + encodeURIComponent(location.pathname.split("/").pop()) + "&motivo=camada");
      return null;
    }
    return d;
  }

  global.PTEAuth = { abrir: abrir, dados: dados, p5: p5, sair: sair, exigir: exigir };
})(window);
