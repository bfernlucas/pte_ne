# PTE-NE — Painel de Iniciativas

Painel do Plano Brasil Nordeste de Transformação Ecológica. Consultoria Quanta
(QCP) para a OEI, contrato 13849/2026, TdR 12.500/2026.

## Rotina de publicação

**Autorização permanente concedida pelo usuário:** fazer o merge na `main`
automaticamente ao concluir um trabalho, **sem pedir autorização a cada vez**.

Fluxo padrão:

1. Desenvolver na branch de trabalho designada
2. Commitar com mensagem descritiva
3. **Merge na `main` e push — direto, sem perguntar**
4. Informar o link publicado

O GitHub Pages publica da `main`, então só existe no ar o que foi mergeado.
Não abrir pull request para isso: o merge é direto.

Esta autorização cobre o merge e a publicação. Não se estende a apagar dados,
tornar o repositório privado/público, mexer em domínio ou qualquer ação
destrutiva ou irreversível — para essas, continuar perguntando.

## Publicação

- Site: <https://bfernlucas.github.io/pte_ne/>
- **Sem domínio próprio.** O `pte-nordeste.com.br` foi descartado por decisão
  do usuário; não recriar o arquivo `CNAME`.

## Acesso

O painel inteiro fica atrás de login (`entrar.html` → `index.html`).
A camada de evidência de campo é publicada apenas cifrada
(`assets/data/campo.enc.js`, AES-256-GCM com chave derivada das credenciais).

**Nunca versionar credenciais nem `dados_campo.json` em claro.** O repositório
é público; conferir com `git grep` antes de commitar quando mexer nisso.

## Arquitetura

- Dados: `assets/data/iniciativas.js` (`window.PTE_DATA`, 79 iniciativas),
  gerado por `scripts/gen_data.py` a partir de `PTE2026_matriz_dashboard.xlsx`
- Abas: `#tabs button[data-view=X]` mostra `#view-X`; ver `setView()` em
  `assets/js/dashboard.js`
- Módulos por responsabilidade: `dashboard.js`, `rota.js`, `maplayers.js`,
  `export.js`, `campo.js`
- Evidência de campo: `scripts/montar_campo.py` → `dados_campo.json`
  (fora do Git) → `scripts/cifrar_campo.py` → `campo.enc.js`

## Convenções

- **CTERSA**: a planilha o chamava de `Renova-Semiárido` (id 46). A equipe
  confirmou que são a mesma iniciativa — apresentar **sempre como CTERSA**.
- Rótulos de seção em versalete (regra global de `h1..h4`); **nomes próprios
  longos abrem exceção** com `text-transform:none`, para não prejudicar a
  leitura. Rótulo grita, nome não.

- Interface e documentação em português
- CSS de módulo novo em arquivo próprio, com prefixo de classe — não inchar
  `dashboard.css`. **Conferir que o prefixo é mesmo livre**: o módulo de campo
  nasceu com `cmp-`, que a aba Comparar já usava, e a colisão em `.cmp-card`
  quebrou a borda dos cartões daquela aba. Hoje o prefixo é `ec-`.
- Notas das experiências de campo: **fonte canônica é o Apêndice 2 do
  Produto 5**. O texto corrido dos eixos traz rótulos de classificação
  divergentes e a coluna de peso das fichas é ambígua — não usar.

## Pendências conhecidas

- 1 experiência não consta da base de prospecção (Instituto Caburé).
  Decidir se entra na planilha como registro novo.
- BA, MA e SE não receberam incursão; a Rota 4 (Bahia) foi postergada.

- Senha atual é previsível (sigla + ano) e o arquivo cifrado é público,
  logo testável offline. Repositório privado eliminaria a exposição.
