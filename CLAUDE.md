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

O painel inteiro fica atrás de login (`entrar.html` → `index.html`). Duas
camadas são publicadas apenas cifradas (AES-256-GCM, chave derivada das
credenciais), e o login abre as duas com a mesma senha:

- `assets/data/campo.enc.js` — evidência de campo (`PTE_CAMPO`)
- `assets/data/p5.enc.js` — faixas de recursos por organização e quadros da
  seção 7 do Produto 5 B (`PTE_P5`)

**Nunca versionar credenciais nem `dados_campo.json` / `dados_p5.json` em
claro.** O repositório é público; conferir com `git grep` antes de commitar
quando mexer nisso. Login em página estática não protege arquivo em claro:
dado sensível novo entra no pacote cifrado, não em `.js` aberto.

## Arquitetura

Versão P5 (set/2026): cinco seções no estilo data.worldbank.org, com a
identidade do documento PTE (azul `#24246C`, Oswald + Roboto). Esqueleto e
decisões no documento do projeto `claude/dashboard-p5-esqueleto.md`.

- Seções: `#secnav button[data-view=X]` mostra `#view-X` — Carteira (números,
  aluvial, ranking com comparação), Mapa, Experiências de campo (rotas reais +
  fichas + `campo.js`), Análise (Figuras 7.1–7.11), Método e downloads.
- Módulos: `painel.js` (seções, ranking, mapa, gráficos, aluvial em SVG),
  `campo.js` (leitura qualitativa, prefixo `ec-`), `maplayers.js`, `export.js`,
  `auth.js`. CSS: `painel.css` + `campo.css`.
- **Aposentados, não carregados pelo `index.html`:** `dashboard.js`, `rota.js`,
  `demo-data.js`, `config.js`, `app.js`, `dashboard.css`.
- Dados:
  - `assets/data/iniciativas.js` (`window.PTE_DATA`, 79 iniciativas), de
    `scripts/gen_data.py` sobre `PTE2026_matriz_dashboard.xlsx`
  - `scripts/gen_p5.py` → `dados_p5.json` (fora do Git), lendo
    `PTE2026_fichas_investimento.xlsx` e `PTE2026_secao7_base_e_graficos.xlsx`
    na pasta `PTE - Incursões`. Confere totais contra os quadros e as notas
    contra o Apêndice 2; para se algo não fechar.
  - `scripts/montar_campo.py` → `dados_campo.json` (fora do Git): números do
    P5 B + leitura qualitativa codificada no próprio script.
  - **Publicar:** `python scripts\publicar_p5.py` no Windows — gera os dois,
    pede a senha uma vez, confere contra o `campo.enc.js` atual e cifra os
    dois pacotes. Só quem tem a senha roda este passo.
- Rotas: a tabela da seção 2 do P5 B é a fonte canônica (Rota 1, 2, 3 e rota
  extra). A rota extra teve três equipes; no mapa cada uma é um trecho, e
  entrevistas virtuais não entram nas linhas.
- Base cartográfica: Esri (Cinza claro / Ruas). As bases da CARTO passaram a
  exigir chave e devolvem ladrilhos com marca d'água. Manter zoom inteiro no
  mapa: zoom fracionário cria emendas brancas entre ladrilhos.

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
  Produto 5 B** (6·impacto + 6·inovação + 5·operação + 3·investimento). O texto corrido dos eixos traz rótulos de classificação
  divergentes e a coluna de peso das fichas é ambígua — não usar.

## Pendências conhecidas

- 2 organizações visitadas não constam da base de prospecção (Instituto
  Caburé e Porto Digital — Unidade Caruaru). Decidir se entram na planilha.
- MA e SE não receberam incursão. A Bahia entrou na rota extra (ago/2026).
- As 5 organizações da Bahia ainda não têm gargalos/potencialidades
  codificados em `montar_campo.py` (entram com números, sem leitura qualitativa).

- Senha atual é previsível (sigla + ano) e o arquivo cifrado é público,
  logo testável offline. Repositório privado eliminaria a exposição.

## Fluxo de trabalho com o Claude (Cowork)

O contêiner da sessão não tem credencial de escrita neste repositório
(o proxy só injeta credencial para repositórios autorizados na sessão, e
não há ferramenta para autorizar de dentro dela). O fluxo validado é:

- **Clone de trabalho:** `C:\Users\Lucas\pte_ne` (fora do OneDrive de propósito).
- **Editar:** direto no clone, pela ponte do desktop (`sed -i` / Python
  read-modify-write). Só o trecho alterado trafega — nunca reescrever
  arquivo inteiro a partir de saída de ferramenta.
- **Git:** sempre pelo Windows, shell `cmd.exe` (PowerShell polui a saída
  com `NativeCommandError` e engole variáveis `$`). Credencial: `gh` logado
  como `bfernlucas`, escopo `repo`.
- **Nunca rodar git pelo shell Linux da ponte:** o `core.autocrlf=true` do
  Git for Windows deixa CRLF no disco e o git Linux enxerga todos os
  arquivos de texto como modificados (diff falso de ~11 mil linhas).
- **Não usar a API de conteúdo do GitHub para editar:** ela exige o arquivo
  inteiro em base64 a cada alteração — dezenas de KB para trocar uma linha.
