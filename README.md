# PTE2026 — Painel de Iniciativas

Dashboards das iniciativas do Plano Brasil Nordeste de Transformação Ecológica,
com **cartões KPI, gráficos, mapa, ranking de pontuação e rota de campo** das
52 iniciativas.

> **Novidades desta versão**
> - **🏆 Ranking por pontuação**: leaderboard interativo (posição, medalhas,
>   barra por nota, cor por eixo), pontuação no mapa (tamanho do ponto), na
>   tabela e no popup, e KPIs de pontuação média / nº de avaliadas.
> - **🧭 Rota de campo**: ao filtrar (ex.: por **eixo**), o botão *Gerar rota*
>   monta uma **rota geográfica/operacional otimizada** entre as iniciativas
>   (vizinho-mais-próximo + 2-opt), com itinerário ordenado e distância. Opção
>   de traçar **por rodovias (OSRM)** com km/tempo reais.
> - **Base = planilha**: os dados embutidos passaram a refletir a planilha
>   `PTE2026_matriz_dashboard_vf.xlsx` (versão oficial), com os campos em branco
>   preenchidos (exceto pontuação). Ver [`docs/BENCHMARKING.md`](docs/BENCHMARKING.md).

## Atualizar os dados a partir da planilha

A página é estática, mas os dados ficam **embutidos** no `index.html`. Para
regenerá-los a partir da planilha (preenche brancos, corrige coordenadas e
reescreve os 52 registros):

```bash
pip install openpyxl
python3 tools/build_dashboard.py PTE2026_matriz_dashboard_vf.xlsx
```

O script também salva uma cópia portátil da planilha (com valores) e exporta
`assets/data/iniciativas.json`. Editar o algoritmo da rota/ranking? Mexa em
`tools/features.py` e rode o build de novo (ele reinjeta só o bloco de JS).

Há duas versões:

| Página | Arquivo | Descrição |
|--------|---------|-----------|
| **Dashboard publicável** (padrão) | `index.html` | Autocontido, com os 52 dados embutidos, **mapa em destaque**, **ranking** e **rota de campo**. Abre direto, sem servidor. É a página servida pelo GitHub Pages. |
| **Painel ao vivo** | `painel-sheets.html` | Lê o **Google Sheets** em tempo real (endpoint `gviz`). Use quando quiser que o painel reflita a planilha conforme ela é editada. |

## Publicar no GitHub Pages

1. No GitHub, vá em **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Selecione a **branch** e a pasta **`/ (root)`** e clique **Save**.
4. Em ~1 minuto o site fica disponível em:
   `https://bfernlucas.github.io/pte_ne/`

O endereço serve o `index.html` (dashboard publicável). O painel ao vivo fica em
`https://bfernlucas.github.io/pte_ne/painel-sheets.html`.

---

### Sobre o painel ao vivo (Google Sheets)

O painel ao vivo busca os dados direto do navegador usando o endpoint público
do Google (`gviz`), sem servidor, build ou chave de API.

```
Google Sheets (público)  ──CSV──▶  Dashboard (GitHub Pages)
                                     ├─ Cartões KPI
                                     ├─ Gráficos (Chart.js)
                                     ├─ Mapa (Leaflet / OpenStreetMap)
                                     └─ Tabela
```

Não precisa de servidor, build, nem chave de API. O dashboard busca os dados
direto do navegador usando o endpoint público do Google (`gviz`).

---

## 1. Como rodar localmente

Por causa das regras de segurança do navegador (CORS), abra com um servidor
local em vez de dar duplo clique no arquivo:

```bash
# dentro da pasta do projeto
python3 -m http.server 8000
# depois abra http://localhost:8000
```

Ao abrir, ele já mostra **dados de exemplo** (Fortaleza/Maracanaú).

## 2. Conectar sua planilha do Google Sheets

A planilha original (`Critérios de seleção de projetos PTE2026`) tem **3 linhas
de cabeçalho mescladas** (título, grupos e nomes das colunas). O dashboard — e o
Google Sheets via CSV — só entende **cabeçalhos na primeira linha**. Por isso:

1. Na sua planilha, crie uma **aba nova e "limpa"** (ex. chamada `Dashboard`)
   com os cabeçalhos na **primeira linha**, exatamente assim:

   | id | iniciativa | objetivo | tematica | organizacao | municipio | estado | bioma | eixo | avaliador | lat | lon | pontuacao |
   |----|-----------|----------|----------|-------------|-----------|--------|-------|------|-----------|-----|-----|-----------|

   > 💡 Dica: preencha essa aba com **fórmulas** apontando para o painel original
   > (ex. `='Exercício - Matriz de avaliação'!A4`). Assim ela se atualiza
   > sozinha conforme você avalia os projetos, e o dashboard reflete em tempo real.
   > Lembre-se de dar nome às colunas de **latitude → `lat`** e **longitude → `lon`**.

2. Clique em **Compartilhar → "Qualquer pessoa com o link" → Leitor**.

3. Copie o **ID da planilha** da URL (o trecho entre `/d/` e `/edit`):

   ```
   https://docs.google.com/spreadsheets/d/AQUI_ESTA_O_ID/edit
   ```

4. Abra `assets/js/config.js` e edite:
   - `SHEET_ID`: cole o ID
   - `SHEET_NAME`: nome da aba limpa, ex. `"Dashboard"`
   - `USE_DEMO_DATA`: mude para `false`

Pronto — ao recarregar a página, o dashboard mostra seus dados reais e
se atualiza automaticamente a cada `REFRESH_SECONDS` segundos. Conforme você
preenche a coluna **Pontuação** na avaliação, o KPI de pontuação média e a
tabela se atualizam sozinhos.

## 3. Publicar no GitHub Pages

1. Faça commit e push deste repositório.
2. No GitHub: **Settings → Pages**.
3. Em "Build and deployment", selecione **Branch: main** (ou a sua), pasta `/ (root)`.
4. Salve. Em ~1 minuto o site fica disponível em
   `https://SEU_USUARIO.github.io/pte_ne/`.

---

## Estrutura do projeto

```
index.html                 página do dashboard
assets/css/style.css       estilos
assets/js/config.js        ⚙️ configuração (planilha + colunas) — edite aqui
assets/js/demo-data.js     dados de exemplo
assets/js/app.js           lógica (busca, gráficos, mapa, tabela)
```

## Personalização rápida (tudo em `assets/js/config.js`)

- **Cartões KPI:** lista `KPIS`. Tipos: `count` (nº de registros),
  `distinct` (valores únicos de uma coluna), `avg` (média), `sum` (soma).
- **Gráficos:** `CHARTS.bar` e `CHARTS.pie` — basta indicar a coluna (`key`)
  pela qual contar (ex. `estado`, `eixo`, `bioma`).
- **Filtros:** lista `FILTERS` — cada item vira um menu suspenso no topo.
- **Mapa:** usa as colunas `lat` e `lon`. Sem coordenadas, o ponto não aparece.
- **Tabela / popup do mapa:** `COLUMNS.table` e `COLUMNS.popup`.
- **Cores dos gráficos:** constante `PALETTE` em `app.js`.

## Tecnologias

- [Chart.js](https://www.chartjs.org/) — gráficos
- [Leaflet](https://leafletjs.com/) + OpenStreetMap — mapa
- [PapaParse](https://www.papaparse.com/) — leitura do CSV do Google Sheets
