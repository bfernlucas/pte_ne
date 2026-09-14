# PTE2026 — Painel de Iniciativas

Dashboards das iniciativas do Plano Brasil Nordeste de Transformação Ecológica,
com **cartões KPI, gráficos, mapa e tabela** das 52 iniciativas.

Há duas versões:

| Página | Arquivo | Descrição |
|--------|---------|-----------|
| **Dashboard publicável** (padrão) | `index.html` | Autocontido, com os 52 dados embutidos e **mapa em destaque** com filtros e legenda interativa. Abre direto, sem servidor. É a página servida pelo GitHub Pages. |
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

## Área restrita — evidência das incursões de campo

A sistematização dos Produtos 3, 4 e 5 (24 experiências avaliadas, notas por
dimensão, classificação e estimativa de recursos) fica em `restrito.html`,
atrás de um login da equipe em `entrar.html`.

**Como a proteção funciona.** O GitHub Pages não tem autenticação — por isso a
proteção não está numa tela de senha, e sim no dado: `assets/data/campo.enc.js`
é publicado cifrado com **AES-256-GCM**, e a senha da equipe é o que deriva a
chave que o abre (PBKDF2-HMAC-SHA256, 600.000 iterações). Sem a senha o arquivo
é ruído, mesmo baixado direto do repositório público.

O arquivo em claro (`dados_campo.json`) **nunca entra no Git** — está no
`.gitignore`. Só o cifrado é versionado.

### Regenerar os dados

```bash
pip install cryptography openpyxl

python3 scripts/montar_campo.py      # monta dados_campo.json (fica fora do Git)
python3 scripts/cifrar_campo.py      # pede a senha e gera campo.enc.js
```

### Trocar a senha

Rode `scripts/cifrar_campo.py` de novo com a senha nova e publique o
`campo.enc.js` resultante. Não há recuperação: a senha não é conferida por
nenhum servidor, ela É a chave. Se for perdida, gera-se outra e republica.

> A área restrita exige contexto seguro (https ou localhost). Abrir por
> `file://` não funciona — o navegador bloqueia a API de criptografia.
