# PTE-NE — Painel da carteira e das incursões de campo

Painel do Plano Brasil Nordeste de Transformação Ecológica, na versão do
Produto 5 B. Cinco seções, com a identidade visual do documento PTE:

| Seção | O que mostra |
|---|---|
| **Carteira** | os números da carteira, o aluvial da trajetória do valor (Figura 7.10) e o ranking de todas as iniciativas, com a nota da matriz e a pontuação do P5; linhas marcadas abrem a comparação nos dez critérios |
| **Mapa** | toda a base de prospecção, as organizações visitadas e os trechos das rotas efetivamente percorridas |
| **Experiências de campo** | as 29 organizações visitadas ou entrevistadas, por rota, com postura, pontuação e faixas de Bloco A e B; e a leitura qualitativa das incursões |
| **Análise** | as Figuras 7.1 a 7.11 e as Tabelas 7.3 a 7.5 da seção 7 |
| **Método e downloads** | o que cada número significa e de onde vem |

A página `painel-sheets.html` é a versão antiga, que lê o Google Sheets ao vivo.

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

## Acesso restrito e evidência das incursões de campo

O painel inteiro fica atrás de um login da equipe: quem abre o site cai em
`entrar.html` e só vê `index.html` depois de entrar. A sistematização dos
Produtos 3, 4 e 5 B — 29 organizações avaliadas, notas por dimensão,
classificação e estimativa de recursos — fica em **Experiências de campo** e
**Análise**.

**Como a proteção funciona.** O GitHub Pages não tem autenticação, então ela
não está numa tela de senha e sim no dado: `assets/data/campo.enc.js` e
`assets/data/p5.enc.js` são publicados cifrados com **AES-256-GCM**, e as credenciais da equipe derivam a
chave que o abre (PBKDF2-HMAC-SHA256, 600.000 iterações). Sem elas o arquivo é
ruído, mesmo baixado direto do repositório.

Os arquivos em claro (`dados_campo.json`, `dados_p5.json`) **nunca entram no Git** — está no
`.gitignore`. Só o cifrado é versionado. As credenciais não ficam em lugar
nenhum do repositório: circulam fora dele.

> **Limite conhecido.** Como o repositório é público, o arquivo cifrado pode
> ser baixado e testado offline, sem limite de tentativas. A proteção depende
> inteiramente de a senha não ser adivinhável. Senha curta ou previsível
> (sigla + ano, por exemplo) reduz muito a margem. Tornar o repositório
> privado elimina essa exposição.

### Arquivos

| Arquivo | Papel |
|---|---|
| `entrar.html` | página de entrada |
| `assets/js/auth.js` | derivação de chave e sessão (WebCrypto) |
| `assets/js/painel.js` | seções, ranking, mapa, gráficos e aluvial |
| `assets/js/campo.js` | leitura qualitativa das incursões (classes `ec-`) |
| `assets/data/campo.enc.js` · `p5.enc.js` | dados cifrados |
| `scripts/gen_p5.py` | monta `dados_p5.json` a partir da planilha de estimativa |
| `scripts/montar_campo.py` | monta `dados_campo.json` (números do P5 B + leitura de campo) |
| `scripts/cifrar_campo.py` | cifra um pacote |
| `scripts/publicar_p5.py` | faz tudo de uma vez: gera, confere a senha e cifra os dois pacotes |

### Regenerar os dados ou trocar a senha

```bash
pip install cryptography openpyxl

python scripts/publicar_p5.py                 # gera os dois JSON, pede a senha, cifra os dois pacotes
python scripts/publicar_p5.py --nova-senha    # idem, trocando a senha de propósito
```

O script lê as planilhas da pasta `PTE - Incursões` e confere a senha contra o
`campo.enc.js` publicado antes de gravar. Publique os dois `.enc.js` resultantes. Não há recuperação: a senha não é
conferida por servidor, ela **é** a chave. Perdida, gera-se outra e republica.

> A área exige contexto seguro (https ou localhost). Abrir por `file://` não
> funciona — o navegador bloqueia a API de criptografia.
