# Benchmarking — Ranking e Rota de campo (PTE2026)

Documento de fundamentação das duas funcionalidades adicionadas ao dashboard:
**(1) melhor visualização do ranking de pontuação** e **(2) algoritmo de rota
geográfica/operacional de campo por eixo**. Inclui a pesquisa comparativa que
embasou as escolhas e o caminho de evolução.

---

## 0. Contexto e restrições de projeto

O dashboard (`index.html`) é uma página **estática, autocontida**, publicada no
**GitHub Pages**, que abre direto no navegador (inclusive via `file://`), **sem
servidor, sem build e sem chave de API**. Esse contexto é decisivo: a solução
precisa rodar **100% no cliente** e funcionar **offline**, podendo *opcionalmente*
enriquecer-se com serviços externos quando houver internet.

Base: **52 iniciativas**, distribuídas em **6 eixos**, nos 9 estados do Nordeste.
O campo `lat/lon` representa a **sede** da organização — que, para programas
nacionais/federais, fica **fora do NE** (Brasília, Rio). O campo `estado` é a
**cobertura** (abrangência) no NE.

---

## 1. Visualização de ranking

### 1.1 O que a literatura/benchmark recomenda

| Padrão | Quando usar | Veredito p/ o nosso caso |
|---|---|---|
| **Barra horizontal ordenada** (ranked bar) | comparar valores e posições de muitos itens | ✅ padrão de ouro p/ ranking |
| **Leaderboard** (lista ranqueada com posição + barra) | destacar topo/meio/base, com rótulos longos | ✅ ideal p/ nomes grandes de iniciativas |
| Bump chart / slope chart | variação de posição **ao longo do tempo** | ❌ não temos série temporal |
| Bullet chart | valor **vs. meta** | ◻️ útil se houver nota de corte |
| Pizza/donut p/ ranking | — | ❌ ruim para ordenar |

Boas práticas convergentes (Material Design, Toucan Toco, Pencil&Paper):
ordenar do maior p/ menor; **codificar cor por categoria**; **revelar detalhe
no hover/clique** (progressive disclosure); manter rótulos e escala explícitos.

### 1.2 Solução implementada

- **Leaderboard interativo** (`🏆 Ranking por pontuação`): cada linha tem
  **posição** (🥇🥈🥉 para o top 3), nome, **eixo (cor)**, município, **barra
  proporcional à nota** e o valor. Respeita os filtros (filtre por eixo → ranking
  daquele eixo). **Clique** numa linha → seleciona a iniciativa no mapa.
- **Ranking no mapa**: o **raio do marcador** passa a ser proporcional à
  pontuação (maior nota = ponto maior), preservando a cor por eixo.
- **Popup e tabela**: agora exibem a pontuação e o selo de posição
  (`#3 🥉` / *não avaliada*).
- **KPIs**: somadas **Pontuação média** e **Avaliadas (n/total)**.
- Iniciativas com `pontuacao = 0` são tratadas como **"não avaliadas"** (a nota
  não foi preenchida, conforme instrução) — aparecem no fim com tag própria.

---

## 2. Rota geográfica/operacional de campo

### 2.1 Natureza do problema

Selecionar iniciativas (tipicamente **por eixo**) e obter a **ordem de visita**
que minimiza o deslocamento é um **Problema do Caixeiro Viajante (TSP)** — e, com
janelas de tempo/múltiplas equipes, um **Vehicle Routing Problem (VRP)**.

### 2.2 Algoritmos — benchmark

| Abordagem | Qualidade | Custo | Cabe no navegador? |
|---|---|---|---|
| Força bruta / Held–Karp (exato) | ótimo | explode acima de ~12 pontos | só p/ n pequeno |
| **Vizinho-mais-próximo (NN)** | ~25% acima do ótimo | O(n²), instantâneo | ✅ |
| **NN + 2-opt** *(escolhido)* | **~5% acima do ótimo** | O(n²) por passada, trivial p/ n≤50 | ✅ |
| 3-opt / Lin–Kernighan | 1–3% do ótimo | mais complexo | ✅ (overkill aqui) |
| OR-Tools / LKH / VROOM | quase-ótimo, VRP completo | exige servidor/WASM pesado | ❌ p/ página estática |

Como cada eixo tem **5–13 iniciativas** (e ≤ ~9 *paradas* após agrupamento),
**NN + 2-opt** entrega rota praticamente ótima de forma instantânea e offline.
Teste real (eixo Transição Energética): NN = 3.441 km → **NN+2-opt = 2.813 km
(−18%)**.

### 2.3 Serviços de roteamento por estrada — benchmark

| Serviço | Licença/custo | Self-host | Otimização (TSP) | Observações |
|---|---|---|---|---|
| **OSRM** *(usado, opcional)* | BSD, grátis | sim | **/trip** (TSP) e /route | servidor público `router.project-osrm.org` com limite de uso |
| OpenRouteService | grátis c/ cota + planos | sim | sim (`/optimization`, VROOM) | requer API key |
| Mapbox Optimization v1 | pago, free tier | não | sim | bom custo-benefício |
| Google Routes/Directions | pago (~US$5–30/1k) | não | waypoint optimization | caro em escala |
| TomTom / GraphHopper / NextBillion | pago, free tier | parcial | sim | alternativas comerciais |

### 2.4 Solução implementada (e por quê)

> **Padrão: cálculo client-side (offline). Enriquecimento: OSRM sob demanda.**

1. **Ponto operacional** (a "lógica de campo" pedida): para cada iniciativa,
   define-se o ponto a visitar —
   - **regional/federal (cobre +1 UF)** → **centróide das UFs cobertas** no NE;
   - **estadual (1 UF)** → a **sede** se estiver no Nordeste, senão o centróide da UF.

   Isso resolve o problema das sedes em Brasília/Rio (que não são ponto de campo)
   sem descartar o dado de sede: programas federais passam a ser ancorados no
   **centro de gravidade da sua atuação no NE**. **22 das 52** iniciativas usam
   esse centróide.

2. **Agrupamento de paradas**: iniciativas que caem no mesmo ponto operacional
   viram **uma parada** (ex.: vários programas federais que cobrem as 9 UFs).
   Evita visitar a mesma coordenada várias vezes.

3. **Ordenação**: **NN + 2-opt** sobre distância **geodésica (haversine)**.
   Início configurável: **maior pontuação** (prioridade) ou **extremo norte**
   (geográfico). Opção **circular** (volta à origem).

4. **Traçado**: por padrão **linha geodésica** (sempre funciona). Caixa
   *"Traçar por rodovias (OSRM)"* consulta o `router.project-osrm.org` para
   desenhar o trajeto **por estradas** e mostrar **km e tempo de carro reais**,
   com *fallback* automático para linha reta se o serviço estiver indisponível.

5. **Saídas**: rota numerada no mapa + **itinerário ordenado** (parada, local,
   iniciativas, distância de cada trecho) + resumo (paradas, km, tempo, modo).

### 2.5 Evolução possível (roadmap)

- **Matriz de tempo real** (OSRM `/table`) em vez de haversine, p/ ordenar por
  tempo de viagem.
- **VRP** (VROOM/OR-Tools) p/ múltiplas equipes, **janelas de tempo**, dias de
  visita e capacidade.
- **Clusterização territorial** (k-means/DBSCAN) p/ dividir um eixo em campanhas
  regionais antes de rotear.
- **Priorização ponderada**: combinar pontuação + urgência + custo no ponto de
  partida e na sequência.

---

## 3. Preenchimento de dados (exceto pontuação)

Campos em branco completados na base, mantendo a pontuação intacta:

| ID | Iniciativa | Campo | Valor |
|---|---|---|---|
| 5 | Rede de Ativadores (Conexsus) | município | Rio de Janeiro (escritório; coords já no RJ) |
| 8 | Pacto Global de Jovens (ONU) | município/UF/bioma | Recife / PE / Mata Atlântica (coords já em Recife) |
| 11 | JEPP (SEBRAE) | lat/lon | Brasília |
| 19 | Territórios da Cidadania | lat/lon | Brasília |
| 20 | Programa Redeser | lat/lon | Crato/CE |
| 27 | Biodigestores e Biogás | natureza jurídica | Órgão Público do Poder Executivo Federal |
| 49 | Rural Sustentável Caatinga | lat | **correção** `-230032` → `-23.0032` |

`pontuacao = 0` (IDs 8, 24, 27, 28, 31) foi **mantida** — são avaliações
pendentes e a instrução foi não preencher pontuação.

---

## Fontes

- Nearest neighbour / 2-opt / Lin–Kernighan — Wikipedia.
- OSRM Trip/Route service — `project-osrm.org/docs` e `osrm-backend/docs/http.md`.
- Comparativos de APIs de roteamento — NextBillion.ai, Brocoders, afi.io,
  valerieparhamthompson.com.
- Boas práticas de ranking/leaderboard — Material Design (Data viz),
  Toucan Toco, Pencil&Paper, Domo, ChartExpo.
- OR-Tools (Vehicle Routing) — Google for Developers.
- Leaflet Routing Machine — liedman.net.
