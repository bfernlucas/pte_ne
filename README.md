# Redes Ceará · Diagnóstico Territorial

Painel interativo e policy brief que mapeiam pobreza, inclusão produtiva e rede institucional nos municípios onde a Redes Ceará atua na Região Metropolitana de Fortaleza.

A entrega é composta por quatro páginas HTML estáticas, pensadas para leitura direta pelo cliente sem dependência de backend ou build.

## Conteúdo da entrega

| Arquivo | O que é |
|---|---|
| `index.html` | Página inicial com seleção de município e contexto do diagnóstico. |
| `policy_brief.html` | Policy brief com a revisão de literatura e as recomendações à Redes Ceará. |
| `fortaleza.html` | Painel de Fortaleza: 13 bairros organizados em 2 territórios (Grande Bom Jardim e Grande Mucuripe). |
| `maracanau.html` | Painel de Maracanaú: 44 bairros organizados em 6 regiões. |

Cada painel municipal traz 8 abas: Visão Geral, Demografia, Vulnerabilidade, Infraestrutura, Economia, Sociedade Civil, Síntese e Adicionalidade.

## Como abrir

Por serem páginas HTML estáticas, basta abrir `index.html` no navegador. Nenhuma instalação é necessária. A navegação entre municípios e abas é feita por links internos.

Para rodar com um servidor local (recomendado para evitar travas de CORS caso algum navegador restrinja o carregamento de bibliotecas):

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Estrutura do repositório

```
coalizao_ce/
├── README.md
├── .gitignore
├── index.html              # landing
├── policy_brief.html       # policy brief
├── fortaleza.html          # painel Fortaleza
├── maracanau.html          # painel Maracanaú
├── assets/
│   └── images/             # fotografias do policy brief
└── data/                   # bases brutas e dicionário
    ├── Agregados_por_bairros_renda_responsavel_BR.csv
    ├── cnpj_fortaleza_bairros_estudo.xlsx
    └── dicionario_de_dados_renda_responsavel.xlsx
```

A pasta `data/` guarda as bases utilizadas na construção dos indicadores. Os painéis HTML já trazem os dados embutidos, então não dependem desses arquivos em tempo de execução; eles ficam versionados para rastreabilidade.

## Fontes de dados

- **IBGE** — Censo 2022, setores censitários e agregados por bairro
- **MDS / CadÚnico** — 2025
- **INEP** — 2023
- **CNES / DataSUS** — 2024
- **Receita Federal** — CNPJs por bairro, 2024
- **RAIS** — 2022
- **IPEA / IPECE** — indicadores estaduais e municipais
- **Mapa das OSCs** — base de organizações da sociedade civil
- **Prefeituras** de Fortaleza e Maracanaú
- **Cartografia** — OpenStreetMap / CARTO

## Metodologia resumida

Os painéis cruzam indicadores de vulnerabilidade (extrema pobreza, CadÚnico, renda), infraestrutura (esgoto, CRAS, unidades de saúde), economia local (MEIs, MPEs, MGEs, vínculos formais) e sociedade civil organizada (OSCs) em dois recortes territoriais:

- **Fortaleza**: agregação dos 13 bairros de atuação da Redes Ceará em 2 territórios (Grande Bom Jardim e Grande Mucuripe).
- **Maracanaú**: todos os 44 bairros do município, agrupados nas 6 regiões político-administrativas.

A aba **Adicionalidade** aplica sobre esses indicadores uma leitura qualitativa em três pilares (necessidade relativa, viabilidade institucional e vácuo de articulação), cruzando com o perfil de cada parceiro da Redes Ceará para sugerir alocação preferencial.

## Tecnologia

HTML, CSS e JavaScript puros. Sem framework, sem build. As únicas dependências externas são:

- **Chart.js** — gráficos
- **Leaflet + CARTO basemaps** — mapas
- **Google Fonts (Inter)** — tipografia

Todas carregadas via CDN no `<head>` de cada página.

## Redes Ceará

Iniciativa que reúne Pacto Contra a Fome, Movimento BemMaior, Astor Capital, Instituto Localiza e Somos Um em torno do combate à fome e da inclusão produtiva no Ceará.

---

Elaborado por Lucas Fernandes.
