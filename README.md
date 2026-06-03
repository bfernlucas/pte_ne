# Dashboard com Google Sheets

Dashboard estático (HTML/CSS/JS) que lê uma planilha do **Google Sheets**
em tempo real e exibe **cartões KPI, gráficos, mapa e tabela**.
Pode ser publicado gratuitamente no **GitHub Pages**.

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

1. Monte sua planilha. A **primeira linha** deve conter os cabeçalhos
   (nomes das colunas). Exemplo:

   | bairro | cidade | lat | lon | estabelecimentos | renda_media | populacao |
   |--------|--------|-----|-----|------------------|-------------|-----------|
   | Centro | Fortaleza | -3.7275 | -38.5270 | 1240 | 2850 | 28500 |

2. Clique em **Compartilhar → "Qualquer pessoa com o link" → Leitor**.

3. Copie o **ID da planilha** da URL (o trecho entre `/d/` e `/edit`):

   ```
   https://docs.google.com/spreadsheets/d/AQUI_ESTA_O_ID/edit
   ```

4. Abra `assets/js/config.js` e edite:
   - `SHEET_ID`: cole o ID
   - `SHEET_NAME`: nome da aba (guia), ex. `"Página1"`
   - `USE_DEMO_DATA`: mude para `false`
   - `COLUMNS`: ajuste os nomes das colunas para baterem com a sua planilha

Pronto — ao recarregar a página, o dashboard mostra seus dados reais e
se atualiza automaticamente a cada `REFRESH_SECONDS` segundos.

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

## Personalização rápida

- **Métricas (KPIs/colunas):** edite `COLUMNS.metrics` em `config.js`.
  Formatos disponíveis: `"int"`, `"money"`, `"num"`.
- **Métrica principal** (barras e tamanho dos pontos no mapa): `PRIMARY_METRIC`.
- **Mapa:** precisa de colunas de `lat` e `lon`. Sem elas, o mapa fica vazio.
- **Cores dos gráficos:** constante `PALETTE` em `app.js`.

## Tecnologias

- [Chart.js](https://www.chartjs.org/) — gráficos
- [Leaflet](https://leafletjs.com/) + OpenStreetMap — mapa
- [PapaParse](https://www.papaparse.com/) — leitura do CSV do Google Sheets
